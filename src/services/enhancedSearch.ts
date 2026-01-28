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
    dateFrom?: string;
    dateTo?: string;
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
    dateFrom?: string;
    dateTo?: string;
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

    // Extract date range from natural language
    const { dateFrom, dateTo } = this.extractDateRange(lowerQuery);

    // Search both tickets and events
    const [tickets, events] = await Promise.all([
      this.searchTicketsWithContext({
        performer,
        priceMin,
        priceMax,
        dateFrom,
        dateTo,
        includeWebContext: true
      }),
      this.searchEventsWithContext({
        performer,
        dateFrom,
        dateTo,
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

  /**
   * Extract date range from natural language queries
   */
  private extractDateRange(query: string): { dateFrom?: string; dateTo?: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // "this weekend"
    if (query.includes('this weekend') || query.includes('this week end')) {
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(today);
      saturday.setDate(today.getDate() + daysUntilSaturday);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      
      return {
        dateFrom: saturday.toISOString().split('T')[0],
        dateTo: sunday.toISOString().split('T')[0]
      };
    }
    
    // "this week"
    if (query.includes('this week')) {
      const dayOfWeek = today.getDay();
      const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + daysUntilSunday);
      
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: endOfWeek.toISOString().split('T')[0]
      };
    }
    
    // "next weekend"
    if (query.includes('next weekend')) {
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      // Calculate days until next Saturday
      let daysUntilNextSaturday: number;
      if (dayOfWeek === 6) {
        // Today is Saturday, next weekend is next week
        daysUntilNextSaturday = 7;
      } else if (dayOfWeek === 0) {
        // Today is Sunday, next weekend is next Saturday (6 days)
        daysUntilNextSaturday = 6;
      } else {
        // Calculate days until this Saturday, then add 7 for next weekend
        const daysUntilThisSaturday = (6 - dayOfWeek + 7) % 7 || 7;
        daysUntilNextSaturday = daysUntilThisSaturday === 0 ? 7 : daysUntilThisSaturday + 7;
      }
      const nextSaturday = new Date(today);
      nextSaturday.setDate(today.getDate() + daysUntilNextSaturday);
      const nextSunday = new Date(nextSaturday);
      nextSunday.setDate(nextSaturday.getDate() + 1);
      
      return {
        dateFrom: nextSaturday.toISOString().split('T')[0],
        dateTo: nextSunday.toISOString().split('T')[0]
      };
    }
    
    // "this month"
    if (query.includes('this month')) {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: endOfMonth.toISOString().split('T')[0]
      };
    }
    
    // "next month"
    if (query.includes('next month')) {
      const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return {
        dateFrom: startOfNextMonth.toISOString().split('T')[0],
        dateTo: endOfNextMonth.toISOString().split('T')[0]
      };
    }
    
    // Specific month names (e.g., "in February", "in Feb")
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                        'july', 'august', 'september', 'october', 'november', 'december'];
    const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    for (let i = 0; i < monthNames.length; i++) {
      if (query.includes(monthNames[i]) || query.includes(monthAbbr[i])) {
        const year = today.getFullYear();
        const month = i; // 0-indexed
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);
        
        // If the month has passed this year, use next year
        if (startOfMonth < today) {
          startOfMonth.setFullYear(year + 1);
          endOfMonth.setFullYear(year + 1);
        }
        
        return {
          dateFrom: startOfMonth.toISOString().split('T')[0],
          dateTo: endOfMonth.toISOString().split('T')[0]
        };
      }
    }
    
    return {};
  }
}

// Export singleton instance
export const enhancedSearchService = new EnhancedSearchService();

