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
  user_location?: string; // User's location from browser locale
  user_city?: string;
  user_state?: string;
  user_country?: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  sources?: {
    db_results?: any[];
    web_results?: any[];
    ticket_links?: Array<{event_name: string, link: string, event_id: number}>;
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
    const { 
      message, 
      conversation_id, 
      messages, 
      include_web_search = true, 
      include_db_search = true,
      user_location,
      user_city,
      user_state,
      user_country
    } = request;

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
        // Enhance search with user location if available
        let searchQuery = message;
        if (user_location || user_city || user_state) {
          const locationParts = [user_city, user_state, user_country].filter(Boolean);
          if (locationParts.length > 0) {
            searchQuery = `${message} ${locationParts.join(', ')}`;
          }
        }
        
        const dbSearch = await enhancedSearchService.comprehensiveSearch(searchQuery);
        dbResults = [
          ...(dbSearch.tickets || []).slice(0, 10), // Get more results for better selection
          ...(dbSearch.events || []).slice(0, 10)
        ];
        
        // If user location provided, prioritize nearby results
        if (user_city || user_state) {
          dbResults = this.prioritizeByLocation(dbResults, user_city, user_state);
        }
      } catch (error: any) {
        console.error('[CHAT-SERVICE] DB search error:', {
          error: error.message,
          stack: error.stack,
          query: message
        });
        // Don't fail the entire request if DB search times out
        // User will still get a response, just without DB results
        if (error.message?.includes('timeout')) {
          console.warn('[CHAT-SERVICE] DB search timed out, continuing without DB results');
        }
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
    const context = this.buildContext(dbResults, webResults, user_location, user_city, user_state);

    // Generate response using Ollama
    let assistantMessage: string;
    try {
      assistantMessage = await this.generateResponse(conversationHistory, context, dbResults);
    } catch (error: any) {
      console.error('[CHAT-SERVICE] Error generating response:', error.message);
      // Provide a helpful error message if DB search timed out
      if (error.message?.includes('timeout') || dbResults.length === 0) {
        assistantMessage = "I'm having trouble searching the database right now. This might be due to a timeout. Please try:\n\n1. Being more specific with your search (e.g., 'concerts in Westchester NY this weekend')\n2. Searching for a specific artist or venue\n3. Trying again in a moment\n\nI can still help you with general questions about tickets and events!";
      } else {
        assistantMessage = "I encountered an error while processing your request. Please try rephrasing your question or try again in a moment.";
      }
    }

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date().toISOString()
    });

    // Store conversation
    conversationStore.set(convId, conversationHistory);

    // Extract ticket links from dbResults and ensure they're in the response
    const ticketLinks: Array<{event_name: string, link: string, event_id: number}> = [];
    if (dbResults.length > 0) {
      const seenEvents = new Set<number>();
      dbResults.forEach(ticket => {
        const eventId = ticket.event_id || ticket.ticket_id;
        if (eventId && !seenEvents.has(eventId)) {
          seenEvents.add(eventId);
          ticketLinks.push({
            event_name: ticket.event_name || ticket.title || 'Event',
            link: `https://sitickets.com/event/${eventId}`,
            event_id: eventId
          });
        }
      });
    }

    return {
      message: assistantMessage,
      conversation_id: convId,
      sources: {
        db_results: dbResults.length > 0 ? dbResults : [],
        web_results: webResults.length > 0 ? webResults : [],
        ticket_links: ticketLinks.length > 0 ? ticketLinks : [] // Explicit ticket links - always return array
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
  private async generateResponse(history: ChatMessage[], context: string, dbResults: any[]): Promise<string> {
    // Build system prompt with strict instructions
    const systemPrompt = `You are a helpful ticket marketplace assistant. Your job is to help users find and purchase tickets.

CRITICAL INSTRUCTIONS:
1. ALWAYS include actual ticket information in your FIRST response if tickets are available
2. ALWAYS mention the price range (e.g., "Prices range from $50 to $200")
3. ALWAYS include specific ticket details: event name, venue, date, and price
4. ALWAYS include the ticket link for EACH event you mention - format as: [Event Name](Ticket Link URL)
5. If multiple options exist, present 2-3 best options with clear details
6. Be direct and helpful - don't ask for more info if you already have ticket data
7. Use web search results only for additional context (artist bio, venue info)
8. Format all information clearly with line breaks

When tickets are available:
- Start with: "Great! I found tickets for [artist/event]"
- For EACH event, list: Event name, Venue, Date, Price range, AND the ticket link
- Format links as markdown: [Event Name](https://sitickets.com/event/ACTUAL_EVENT_ID_NUMBER)
- CRITICAL: Use the actual numeric Event ID from the context (e.g., 1234567), NOT placeholders like "EVENT_ID" or "LUMINEERS_EVENT_ID"
- If unsure between options, present 2-3 choices clearly with links for each
- CRITICAL: Only mention events that match the date criteria in the user's query
- CRITICAL: NEVER mention past dates or events that have already occurred
- CRITICAL: All events in the database are future events (filtered to >= today), so NEVER use dates from web search results
- If user asks for "this weekend", ONLY show events happening on Saturday or Sunday of this week
- If user asks for "next weekend", ONLY show events happening on Saturday or Sunday of next week
- If user asks for a specific date range, ONLY show events within that range
- If no events match the date criteria, say "I didn't find any events for [date range]" and suggest alternative dates
- ALWAYS use the exact event_date from the database context - do not use dates from web search results
- Always end with a call to action

When no tickets found:
- DO NOT suggest external websites like Eventbrite, Songkick, or other ticket sites
- Only suggest searching within our own database with different criteria
- Ask clarifying questions about location, date, or artist
- If location not found, try broader location terms (e.g., if "Westchester County" not found, try "Westchester" or nearby cities)

IMPORTANT: 
- Every event you mention MUST have a ticket link in the format [Event Name](Ticket Link URL)
- ONLY use ticket links from the context provided - do not make up event IDs
- If no ticket link is provided in context, say "tickets available" but don't create fake links

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
   * Build context string from search results with price ranges and ticket links
   */
  private buildContext(dbResults: any[], webResults: any[], userLocation?: string, userCity?: string, userState?: string): string {
    let context = '';

    if (dbResults.length > 0) {
      // Filter out past events before processing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureResults = dbResults.filter(result => {
        if (!result.event_date) return true; // Include if no date
        const eventDate = new Date(result.event_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
      });

      if (futureResults.length === 0) {
        context += '\n=== NO FUTURE EVENTS FOUND ===\n';
        return context;
      }

      context += '\n=== AVAILABLE TICKETS (Future Events Only) ===\n';
      
      // Group by event to show price ranges
      const eventGroups = new Map<string, any[]>();
      futureResults.forEach((result) => {
        const eventKey = result.event_name || result.title || 'Unknown Event';
        if (!eventGroups.has(eventKey)) {
          eventGroups.set(eventKey, []);
        }
        eventGroups.get(eventKey)!.push(result);
      });

      let idx = 1;
      for (const [eventName, tickets] of Array.from(eventGroups.entries()).slice(0, 5)) {
        const prices = tickets.map(t => t.price).filter(Boolean);
        const minPrice = prices.length > 0 ? Math.min(...prices) : null;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
        const firstTicket = tickets[0];
        
        context += `\n${idx}. ${eventName}\n`;
        if (firstTicket.venue || firstTicket.venue_name) {
          context += `   Venue: ${firstTicket.venue || firstTicket.venue_name}\n`;
        }
        if (firstTicket.city && firstTicket.state) {
          context += `   Location: ${firstTicket.city}, ${firstTicket.state}\n`;
        } else if (firstTicket.city) {
          context += `   Location: ${firstTicket.city}\n`;
        }
        if (firstTicket.event_date) {
          const date = new Date(firstTicket.event_date);
          const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          context += `   Date: ${dateStr} (${date.toISOString().split('T')[0]})\n`;
          context += `   IMPORTANT: This is a FUTURE event. Use this exact date in your response - do NOT use dates from web search.\n`;
        }
        if (minPrice !== null && maxPrice !== null) {
          if (minPrice === maxPrice) {
            context += `   Price: $${minPrice.toFixed(2)}\n`;
          } else {
            context += `   Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}\n`;
          }
        } else if (minPrice !== null) {
          context += `   Starting at: $${minPrice.toFixed(2)}\n`;
        }
        
        // Generate ticket link - CRITICAL: Always include this
        const eventId = firstTicket.event_id || firstTicket.ticket_id;
        if (eventId) {
          const ticketLink = `https://sitickets.com/event/${eventId}`;
          context += `   Event ID: ${eventId}\n`;
          context += `   Ticket Link: ${ticketLink}\n`;
          context += `   REQUIRED: You MUST include this EXACT link in your response as: [${eventName}](${ticketLink})\n`;
          context += `   CRITICAL: Use the actual Event ID ${eventId} in the link, NOT a placeholder like "EVENT_ID" or "${eventName.toUpperCase().replace(/\s+/g, '_')}_EVENT_ID"\n`;
        }
        
        if (tickets.length > 1) {
          context += `   (${tickets.length} ticket options available)\n`;
        }
        idx++;
      }
      
      if (userCity || userState) {
        context += `\nNOTE: User is located in ${[userCity, userState].filter(Boolean).join(', ') || userLocation || 'their location'}. Prioritize nearby events.\n`;
      }
    }

    if (webResults.length > 0) {
      context += '\n=== Additional Context (Web Search) ===\n';
      webResults.slice(0, 3).forEach((result, idx) => {
        context += `${idx + 1}. ${result.title || 'Result'}\n`;
        if (result.snippet) context += `   ${result.snippet.substring(0, 150)}...\n`;
      });
    }

    return context || 'No search results available.';
  }

  /**
   * Prioritize results by user location
   */
  private prioritizeByLocation(results: any[], userCity?: string, userState?: string): any[] {
    if (!userCity && !userState) return results;
    
    const locationResults: any[] = [];
    const otherResults: any[] = [];
    
    const cityLower = userCity?.toLowerCase() || '';
    const stateLower = userState?.toLowerCase() || '';
    
    results.forEach(result => {
      const resultCity = result.city?.toLowerCase() || '';
      const resultState = result.state?.toLowerCase() || '';
      
      if ((cityLower && resultCity.includes(cityLower)) || 
          (stateLower && resultState.includes(stateLower))) {
        locationResults.push(result);
      } else {
        otherResults.push(result);
      }
    });
    
    return [...locationResults, ...otherResults];
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

