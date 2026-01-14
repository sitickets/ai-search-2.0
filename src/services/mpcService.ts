/**
 * MPC (Model-Powered Chat) Service
 * Main service that orchestrates natural language queries and search operations
 */

import { ChatOpenAI } from '@langchain/openai';
import { getSchemaInfo } from './database';
import { searchTickets, TicketSearchParams } from './search/ticketSearch';
import { searchEvents, EventSearchParams } from './search/eventSearch';
import { searchByPrice, PriceSearchParams } from './search/priceSearch';
import { searchByLocation, LocationSearchParams } from './search/locationSearch';
import { enhancedSearchService } from './enhancedSearch';

export interface MPCQuery {
  query: string;
  conversationId?: string;
  context?: Record<string, any>;
}

export interface MPCResponse {
  answer: string;
  results?: any[];
  queryType?: 'ticket' | 'event' | 'price' | 'location' | 'general';
  sqlQuery?: string;
  metadata?: Record<string, any>;
}

export class MPCService {
  private llm: ChatOpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4',
        temperature: 0,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Process natural language query and return results
   */
  async processQuery(mpcQuery: MPCQuery): Promise<MPCResponse> {
    const { query, context } = mpcQuery;

    // Parse query intent using simple keyword matching (can be enhanced with LLM)
    const queryType = this.detectQueryType(query);
    
    try {
      switch (queryType) {
        case 'ticket':
          return await this.handleTicketQuery(query, context);
        case 'event':
          return await this.handleEventQuery(query, context);
        case 'price':
          return await this.handlePriceQuery(query, context);
        case 'location':
          return await this.handleLocationQuery(query, context);
        default:
          return await this.handleGeneralQuery(query, context);
      }
    } catch (error: any) {
      return {
        answer: `I encountered an error processing your query: ${error.message}`,
        queryType: 'general',
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Detect query type from natural language
   */
  private detectQueryType(query: string): 'ticket' | 'event' | 'price' | 'location' | 'general' {
    const lowerQuery = query.toLowerCase();

    // Price-related queries
    if (lowerQuery.match(/\$\d+|\d+\s*dollars?|price|cheap|expensive|cost|affordable|budget/)) {
      return 'price';
    }

    // Location-related queries
    if (lowerQuery.match(/\b(in|near|at|around)\s+\w+|city|state|venue|location|where/)) {
      return 'location';
    }

    // Event-related queries
    if (lowerQuery.match(/\b(concert|show|event|performer|artist|band|sports|game)\b/)) {
      return 'event';
    }

    // Ticket-related queries
    if (lowerQuery.match(/\b(ticket|seat|section|row|available|buy|purchase)\b/)) {
      return 'ticket';
    }

    return 'general';
  }

  /**
   * Extract search parameters from natural language query
   */
  private extractSearchParams(query: string, type: string): any {
    const params: any = {};
    const lowerQuery = query.toLowerCase();

    // Extract price range
    const priceMatch = lowerQuery.match(/\$?(\d+)\s*(?:to|-)?\s*\$?(\d+)?/);
    if (priceMatch) {
      params.minPrice = parseInt(priceMatch[1]);
      if (priceMatch[2]) {
        params.maxPrice = parseInt(priceMatch[2]);
      }
    }

    // Extract location
    const locationPatterns = [
      /\b(in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /\b([A-Z][a-z]+),\s*([A-Z]{2})\b/,
    ];

    // Extract dates
    const datePatterns = [
      /\b(today|tomorrow|next week|next month)\b/,
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
    ];

    // Extract performer/event name (simple extraction - can be enhanced)
    // This is a placeholder - real implementation would use NLP

    return params;
  }

  private async handleTicketQuery(query: string, context?: Record<string, any>): Promise<MPCResponse> {
    const params = this.extractSearchParams(query, 'ticket') as TicketSearchParams;
    const includeWebContext = context?.includeWebContext !== false;
    
    // Use enhanced search if web context is requested
    if (includeWebContext) {
      const enhancedResults = await enhancedSearchService.searchTicketsWithContext({
        ...params,
        includeWebContext: true
      });
      
      return {
        answer: `Found ${enhancedResults.length} tickets matching your search.`,
        results: enhancedResults,
        queryType: 'ticket',
        metadata: { 
          count: enhancedResults.length,
          webContextIncluded: true
        }
      };
    }
    
    const results = await searchTickets(params);
    return {
      answer: `Found ${results.length} tickets matching your search.`,
      results,
      queryType: 'ticket',
      metadata: { count: results.length }
    };
  }

  private async handleEventQuery(query: string, context?: Record<string, any>): Promise<MPCResponse> {
    const params = this.extractSearchParams(query, 'event') as EventSearchParams;
    const includeWebContext = context?.includeWebContext !== false;
    
    // Use enhanced search if web context is requested
    if (includeWebContext) {
      const enhancedResults = await enhancedSearchService.searchEventsWithContext({
        ...params,
        includeWebContext: true
      });
      
      return {
        answer: `Found ${enhancedResults.length} events matching your search.`,
        results: enhancedResults,
        queryType: 'event',
        metadata: { 
          count: enhancedResults.length,
          webContextIncluded: true
        }
      };
    }
    
    const results = await searchEvents(params);
    return {
      answer: `Found ${results.length} events matching your search.`,
      results,
      queryType: 'event',
      metadata: { count: results.length }
    };
  }

  private async handlePriceQuery(query: string, context?: Record<string, any>): Promise<MPCResponse> {
    const params = this.extractSearchParams(query, 'price') as PriceSearchParams;
    const results = await searchByPrice(params);

    return {
      answer: `Found ${results.length} tickets in your price range.`,
      results,
      queryType: 'price',
      metadata: { count: results.length }
    };
  }

  private async handleLocationQuery(query: string, context?: Record<string, any>): Promise<MPCResponse> {
    const params = this.extractSearchParams(query, 'location') as LocationSearchParams;
    const results = await searchByLocation(params);

    return {
      answer: `Found ${results.length} events in that location.`,
      results,
      queryType: 'location',
      metadata: { count: results.length }
    };
  }

  private async handleGeneralQuery(query: string, context?: Record<string, any>): Promise<MPCResponse> {
    // For general queries, use comprehensive search with web context
    try {
      const comprehensiveResults = await enhancedSearchService.comprehensiveSearch(query);
      
      const totalResults = comprehensiveResults.tickets.length + comprehensiveResults.events.length;
      
      return {
        answer: `Found ${comprehensiveResults.tickets.length} tickets and ${comprehensiveResults.events.length} events matching your search.`,
        results: {
          tickets: comprehensiveResults.tickets,
          events: comprehensiveResults.events,
          webContext: comprehensiveResults.webContext
        },
        queryType: 'general',
        metadata: { 
          ticketCount: comprehensiveResults.tickets.length,
          eventCount: comprehensiveResults.events.length,
          webContextIncluded: true
        }
      };
    } catch (error: any) {
      return {
        answer: 'I can help you search for tickets, events, prices, and locations. Please be more specific about what you\'re looking for.',
        queryType: 'general',
        metadata: { error: error.message }
      };
    }
  }
}

// Export singleton instance
export const mpcService = new MPCService();

