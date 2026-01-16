/**
 * Chat Service - ChatGPT-like conversational interface
 * Uses Ollama for LLM responses, combines DB and web search
 */

import axios from 'axios';
import { enhancedSearchService } from './enhancedSearch';
import { webSearchService } from '../services/webSearch';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  messages?: ChatMessage[]; // Conversation history
  include_web_search?: boolean;
  include_db_search?: boolean;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  sources?: {
    db_results?: any[];
    web_results?: any[];
  };
  metadata?: {
    query_type?: string;
    tokens_used?: number;
  };
}

// In-memory conversation storage (for local testing)
// In production, use Redis or database
const conversationStore = new Map<string, ChatMessage[]>();

export class ChatService {
  private ollamaBaseUrl: string;
  private ollamaModel: string;

  constructor() {
    // Get Ollama config - support both LLM_BASE_URL and OLLAMA_BASE_URL
    const llmBaseUrl = process.env.LLM_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const llmModel = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || 'llama3.1:8b-instruct';
    
    this.ollamaBaseUrl = llmBaseUrl;
    this.ollamaModel = llmModel;
  }

  /**
   * Process chat message with context from DB and web
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const { message, conversation_id, messages, include_web_search = true, include_db_search = true } = request;

    // Generate or use conversation ID
    const convId = conversation_id || this.generateConversationId();

    // Get conversation history
    let conversationHistory: ChatMessage[] = messages || conversationStore.get(convId) || [];

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Build context from DB and web search
    let dbResults: any[] = [];
    let webResults: any[] = [];

    if (include_db_search) {
      try {
        const dbSearch = await enhancedSearchService.comprehensiveSearch(message);
        dbResults = [
          ...(dbSearch.tickets || []).slice(0, 5),
          ...(dbSearch.events || []).slice(0, 5)
        ];
      } catch (error) {
        console.error('DB search error:', error);
      }
    }

    if (include_web_search) {
      try {
        webResults = await webSearchService.search({
          query: message,
          limit: 5
        });
      } catch (error) {
        console.error('Web search error:', error);
      }
    }

    // Build context for LLM
    const context = this.buildContext(dbResults, webResults);

    // Generate response using Ollama
    const assistantMessage = await this.generateResponse(conversationHistory, context);

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date().toISOString()
    });

    // Store conversation
    conversationStore.set(convId, conversationHistory);

    return {
      message: assistantMessage,
      conversation_id: convId,
      sources: {
        db_results: dbResults.length > 0 ? dbResults : undefined,
        web_results: webResults.length > 0 ? webResults : undefined
      },
      metadata: {
        query_type: this.detectQueryType(message),
        tokens_used: undefined // Ollama doesn't return token count easily
      }
    };
  }

  /**
   * Generate response using Ollama
   */
  private async generateResponse(history: ChatMessage[], context: string): Promise<string> {
    // Build system prompt
    const systemPrompt = `You are a helpful assistant for a ticket marketplace. You help users find tickets, events, and information.

You have access to:
1. Database search results (tickets and events)
2. Web search results (for additional context)

When answering:
- Use the database results to provide specific ticket/event information
- Use web search results to provide additional context (artist info, venue details, etc.)
- Be conversational and helpful
- If no results found, suggest alternative searches
- Format ticket prices, dates, and locations clearly

Context from searches:
${context}

Conversation history:
${history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}`;

    // Prepare messages for Ollama
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    try {
      const response = await axios.post(
        `${this.ollamaBaseUrl}/api/chat`,
        {
          model: this.ollamaModel,
          messages: messages,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        },
        {
          timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000')
        }
      );

      return response.data.message?.content || 'I apologize, but I could not generate a response.';
    } catch (error: any) {
      console.error('Ollama API error:', error);
      
      // Fallback response
      return `I encountered an error while processing your request. ${error.message || 'Please try again.'}`;
    }
  }

  /**
   * Build context string from search results
   */
  private buildContext(dbResults: any[], webResults: any[]): string {
    let context = '';

    if (dbResults.length > 0) {
      context += '\n=== Database Results ===\n';
      dbResults.slice(0, 5).forEach((result, idx) => {
        if (result.event_name) {
          context += `${idx + 1}. Event: ${result.event_name}\n`;
          if (result.venue_name) context += `   Venue: ${result.venue_name}\n`;
          if (result.event_date) context += `   Date: ${result.event_date}\n`;
          if (result.price) context += `   Price: $${result.price}\n`;
        }
      });
    }

    if (webResults.length > 0) {
      context += '\n=== Web Search Results ===\n';
      webResults.slice(0, 5).forEach((result, idx) => {
        context += `${idx + 1}. ${result.title || 'Result'}\n`;
        if (result.snippet) context += `   ${result.snippet.substring(0, 150)}...\n`;
        if (result.url) context += `   Source: ${result.url}\n`;
      });
    }

    return context || 'No search results available.';
  }

  /**
   * Detect query type
   */
  private detectQueryType(query: string): string {
    const lower = query.toLowerCase();
    if (lower.match(/\b(ticket|seat|buy|purchase)\b/)) return 'ticket';
    if (lower.match(/\b(event|concert|show|performer)\b/)) return 'event';
    if (lower.match(/\b(price|cost|cheap|expensive)\b/)) return 'price';
    if (lower.match(/\b(location|venue|where|city)\b/)) return 'location';
    return 'general';
  }

  /**
   * Generate conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(conversationId: string): ChatMessage[] {
    return conversationStore.get(conversationId) || [];
  }

  /**
   * Clear conversation
   */
  clearConversation(conversationId: string): void {
    conversationStore.delete(conversationId);
  }
}

// Export singleton
export const chatService = new ChatService();

