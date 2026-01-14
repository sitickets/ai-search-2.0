/**
 * Enhanced Search Service
 * Combines database search with web search for richer results
 */

import { searchTickets, TicketResult } from './search/ticketSearch';
import { searchEvents, EventResult } from './search/eventSearch';
import { webSearchService, WebSearchResult } from './webSearch';

export interface EnhancedTicketResult extends TicketResult {
  webContext?: {
    performerInfo?: {
      bio?: string;
      genres?: string[];
      popularity?: string;
    };
    eventInfo?: {
      description?: string;
      reviews?: string[];
    };
    webResults?: WebSearchResult[];
  };
}

export interface EnhancedEventResult extends EventResult {
  webContext?: {
    performerInfo?: {
      bio?: string;
      genres?: string[];
      upcomingTours?: string[];
    };
    venueInfo?: {
      description?: string;
      capacity?: string;
      address?: string;
    };
    webResults?: WebSearchResult[];
  };
}

export class EnhancedSearchService {
  /**
   * Search tickets with web context enhancement
   */
  async searchTicketsWithContext(params: {
    performer?: string;
    eventId?: number;
    venue?: string;
    priceMin?: number;
    priceMax?: number;
    includeWebContext?: boolean;
  }): Promise<EnhancedTicketResult[]> {
    // Get tickets from database
    const tickets = await searchTickets(params);

    // If web context is requested and we have performer/event info
    if (params.includeWebContext !== false && tickets.length > 0) {
      // Get unique performers/events from results
      const performers = new Set<string>();
      const events = new Set<number>();

      tickets.forEach(ticket => {
        if (ticket.event_name) {
          // Extract performer name from event title (simplified)
          const performerMatch = ticket.event_name.match(/^([^:]+)/);
          if (performerMatch) {
            performers.add(performerMatch[1].trim());
          }
          events.add(ticket.event_id);
        }
      });

      // Enhance each ticket with web context
      const enhancedTickets = await Promise.all(
        tickets.map(async (ticket) => {
          const enhanced: EnhancedTicketResult = { ...ticket };

          // Get web context for performer
          if (ticket.event_name && performers.has(ticket.event_name.split(':')[0]?.trim())) {
            try {
              const performerContext = await webSearchService.getPerformerContext(
                ticket.event_name.split(':')[0].trim()
              );
              enhanced.webContext = {
                performerInfo: {
                  bio: performerContext.bio,
                  genres: performerContext.genres,
                  popularity: performerContext.popularity
                },
                webResults: performerContext.webResults
              };
            } catch (error) {
              console.error('Error fetching performer context:', error);
            }
          }

          return enhanced;
        })
      );

      return enhancedTickets;
    }

    return tickets as EnhancedTicketResult[];
  }

  /**
   * Search events with web context enhancement
   */
  async searchEventsWithContext(params: {
    performer?: string;
    eventType?: string;
    location?: string;
    includeWebContext?: boolean;
  }): Promise<EnhancedEventResult[]> {
    // Get events from database
    const events = await searchEvents(params);

    // If web context is requested
    if (params.includeWebContext !== false && events.length > 0) {
      const enhancedEvents = await Promise.all(
        events.map(async (event) => {
          const enhanced: EnhancedEventResult = { ...event };

          try {
            // Get performer context
            if (event.title) {
              const performerName = event.title.split(':')[0]?.trim() || event.title;
              const performerContext = await webSearchService.getPerformerContext(performerName);
              
              enhanced.webContext = {
                performerInfo: {
                  bio: performerContext.bio,
                  genres: performerContext.genres,
                  upcomingTours: performerContext.upcomingTours
                },
                webResults: performerContext.webResults
              };
            }

            // Get venue context
            if (event.venue) {
              const venueInfo = await webSearchService.searchVenueInfo(
                event.venue,
                event.city ? `${event.city}, ${event.state}` : undefined
              );
              
              if (enhanced.webContext) {
                enhanced.webContext.venueInfo = {
                  description: venueInfo[0]?.snippet,
                  address: venueInfo[0]?.url
                };
                enhanced.webContext.webResults = [
                  ...(enhanced.webContext.webResults || []),
                  ...venueInfo
                ];
              }
            }
          } catch (error) {
            console.error('Error enhancing event with web context:', error);
          }

          return enhanced;
        })
      );

      return enhancedEvents;
    }

    return events as EnhancedEventResult[];
  }

  /**
   * Get comprehensive search results with both DB and web data
   */
  async comprehensiveSearch(query: string): Promise<{
    tickets: EnhancedTicketResult[];
    events: EnhancedEventResult[];
    webContext: {
      performerInfo?: any;
      eventInfo?: any;
      webResults: WebSearchResult[];
    };
  }> {
    // Parse query to extract search parameters (simplified)
    const lowerQuery = query.toLowerCase();
    
    // Extract performer name (simplified - would use NLP in production)
    const performerMatch = query.match(/(?:for|by|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    const performer = performerMatch ? performerMatch[1] : undefined;

    // Extract price range
    const priceMatch = lowerQuery.match(/\$?(\d+)\s*(?:to|-)?\s*\$?(\d+)?/);
    const priceMin = priceMatch ? parseInt(priceMatch[1]) : undefined;
    const priceMax = priceMatch && priceMatch[2] ? parseInt(priceMatch[2]) : undefined;

    // Search both tickets and events
    const [tickets, events] = await Promise.all([
      this.searchTicketsWithContext({
        performer,
        priceMin,
        priceMax,
        includeWebContext: true
      }),
      this.searchEventsWithContext({
        performer,
        includeWebContext: true
      })
    ]);

    // Get general web context about the query
    const webResults = await webSearchService.search({
      query,
      limit: 5
    });

    return {
      tickets,
      events,
      webContext: {
        webResults
      }
    };
  }
}

// Export singleton instance
export const enhancedSearchService = new EnhancedSearchService();

