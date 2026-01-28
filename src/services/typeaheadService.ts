/**
 * Typeahead Service
 * Provides search suggestions as user types
 */

import { query } from './database';
import { searchEvents } from './search/eventSearch';

export interface TypeaheadSuggestion {
  text: string;
  type: 'event' | 'performer' | 'venue' | 'location';
  event_id?: number;
  venue?: string;
  city?: string;
  state?: string;
}

export interface TypeaheadResult {
  suggestions: TypeaheadSuggestion[];
  query: string;
}

/**
 * Get typeahead suggestions based on partial query
 */
export async function getTypeaheadSuggestions(
  partialQuery: string,
  limit: number = 10
): Promise<TypeaheadResult> {
  const startTime = Date.now();
  const searchQuery = partialQuery.trim();

  console.log(`[TYPEAHEAD-SERVICE] Starting search for "${searchQuery}" (limit: ${limit})`);

  if (!partialQuery || searchQuery.length < 2) {
    console.log(`[TYPEAHEAD-SERVICE] Query too short: "${searchQuery}" (length: ${searchQuery.length})`);
    return {
      suggestions: [],
      query: partialQuery
    };
  }

  const searchTerm = `%${searchQuery}%`;
  const suggestions: TypeaheadSuggestion[] = [];

  try {
    // Search for events (which includes performer names in titles)
    // Use a simpler query for typeahead - no price aggregations needed for speed
    console.log(`[TYPEAHEAD-SERVICE] Searching events for "${searchQuery}"`);
    const eventStartTime = Date.now();
    
    // Expand common abbreviations to improve matching
    const abbreviationMap: Record<string, string> = {
      'ny': 'new york',
      'la': 'los angeles',
      'sf': 'san francisco',
      'chi': 'chicago',
      'philly': 'philadelphia',
      'phx': 'phoenix',
      'dc': 'washington',
      'nj': 'new jersey',
      'ct': 'connecticut',
      'ma': 'massachusetts',
      'pa': 'pennsylvania',
      'fl': 'florida',
      'tx': 'texas',
      'ca': 'california'
    };
    
    // Expand abbreviations in the search query
    let expandedQuery = searchQuery.toLowerCase();
    for (const [abbr, full] of Object.entries(abbreviationMap)) {
      // Replace standalone abbreviations (word boundaries)
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      expandedQuery = expandedQuery.replace(regex, full);
    }
    
    // Use word-based matching: each word from expanded query must appear
    // This handles "NY Red b" -> "new york red b" matching "New York Red Bulls"
    const expandedWords = expandedQuery.trim().split(/\s+/).filter(w => w.length > 0);
    
    // Build query where each word must appear somewhere in the name
    // Use simple LIKE pattern for all words (including single chars like "b")
    let eventSql = `
      SELECT DISTINCT
        me.id as event_id,
        me.name as title,
        me.occurs_at as event_date,
        v.name as venue,
        v.city,
        v.state
      FROM public.master_events me
      LEFT JOIN public.master_venues v ON me.master_venue_id = v.id
      WHERE me.occurs_at >= CURRENT_DATE
    `;
    
    const eventParams: any[] = [];
    let paramIndex = 1;
    const conditions: string[] = [];
    
    // Each word must appear somewhere in the name (supports partial matches)
    expandedWords.forEach(word => {
      eventParams.push(`%${word}%`);
      conditions.push(`LOWER(me.name) LIKE $${paramIndex++}`);
    });
    
    if (conditions.length > 0) {
      eventSql += ` AND (${conditions.join(' AND ')})`;
    }
    
    eventSql += ` ORDER BY me.occurs_at ASC LIMIT $${paramIndex}`;
    eventParams.push(Math.min(limit, 5));
    
    const eventResult = await query(eventSql, eventParams);
    const events = eventResult.rows.map(row => ({
      event_id: row.event_id,
      title: row.title,
      event_date: row.event_date,
      venue: row.venue,
      city: row.city,
      state: row.state
    }));
    
    const eventTime = Date.now() - eventStartTime;
    console.log(`[TYPEAHEAD-SERVICE] Found ${events.length} events in ${eventTime}ms`);

    // Add event suggestions
    for (const event of events) {
      suggestions.push({
        text: event.title,
        type: 'event',
        event_id: event.event_id,
        venue: event.venue,
        city: event.city,
        state: event.state
      });
    }
    console.log(`[TYPEAHEAD-SERVICE] Added ${events.length} event suggestions (total: ${suggestions.length})`);

    // Search for venues - try with schema prefix first, fallback to no schema
    if (suggestions.length < limit) {
      let venueResult;
      const venueLimit = Math.min(limit - suggestions.length, 3);
      console.log(`[TYPEAHEAD-SERVICE] Searching venues for "${searchQuery}" (limit: ${venueLimit})`);
      const venueStartTime = Date.now();
      try {
        const venueSql = `
          SELECT DISTINCT
            v.name as venue,
            v.city,
            v.state,
            COUNT(DISTINCT me.id) as event_count
          FROM public.master_venues v
          LEFT JOIN public.master_events me ON v.id = me.master_venue_id
        WHERE v.name ILIKE $1
        AND (me.occurs_at >= CURRENT_DATE OR me.occurs_at IS NULL)
          GROUP BY v.id, v.name, v.city, v.state
          ORDER BY event_count DESC, v.name ASC
          LIMIT $2
        `;
        venueResult = await query(venueSql, [searchTerm, venueLimit]);
        const venueTime = Date.now() - venueStartTime;
        console.log(`[TYPEAHEAD-SERVICE] Found ${venueResult.rows.length} venues in ${venueTime}ms`);
      } catch (error: any) {
        const venueTime = Date.now() - venueStartTime;
        console.warn(`[TYPEAHEAD-SERVICE] Venue search failed after ${venueTime}ms:`, error.message);
        venueResult = { rows: [] };
      }
      
      for (const row of venueResult.rows) {
        if (suggestions.length >= limit) break;
        
        suggestions.push({
          text: `${row.venue}${row.city ? ` - ${row.city}, ${row.state || ''}` : ''}`,
          type: 'venue',
          venue: row.venue,
          city: row.city,
          state: row.state
        });
      }
      console.log(`[TYPEAHEAD-SERVICE] Added ${venueResult.rows.length} venue suggestions (total: ${suggestions.length})`);
    }

    // Search for locations (cities/states)
    if (suggestions.length < limit) {
      let locationResult;
      const locationLimit = Math.min(limit - suggestions.length, 2);
      console.log(`[TYPEAHEAD-SERVICE] Searching locations for "${searchQuery}" (limit: ${locationLimit})`);
      const locationStartTime = Date.now();
      try {
        const locationSql = `
          SELECT DISTINCT
            v.city,
            v.state,
            COUNT(DISTINCT me.id) as event_count
          FROM public.master_venues v
          LEFT JOIN public.master_events me ON v.id = me.master_venue_id
          WHERE (v.city ILIKE $1 OR v.state ILIKE $1)
          AND (me.occurs_at >= CURRENT_DATE OR me.occurs_at IS NULL)
          AND v.city IS NOT NULL
          GROUP BY v.city, v.state
          ORDER BY event_count DESC, v.city ASC
          LIMIT $2
        `;
        locationResult = await query(locationSql, [searchTerm, locationLimit]);
        const locationTime = Date.now() - locationStartTime;
        console.log(`[TYPEAHEAD-SERVICE] Found ${locationResult.rows.length} locations in ${locationTime}ms`);
      } catch (error: any) {
        const locationTime = Date.now() - locationStartTime;
        console.warn(`[TYPEAHEAD-SERVICE] Location search failed after ${locationTime}ms:`, error.message);
        locationResult = { rows: [] };
      }
      
      for (const row of locationResult.rows) {
        if (suggestions.length >= limit) break;
        
        suggestions.push({
          text: `${row.city}${row.state ? `, ${row.state}` : ''}`,
          type: 'location',
          city: row.city,
          state: row.state
        });
      }
      console.log(`[TYPEAHEAD-SERVICE] Added ${locationResult.rows.length} location suggestions (total: ${suggestions.length})`);
    }

    // Remove duplicates based on text
    const uniqueSuggestions = suggestions.reduce((acc, suggestion) => {
      if (!acc.find(s => s.text === suggestion.text)) {
        acc.push(suggestion);
      }
      return acc;
    }, [] as TypeaheadSuggestion[]);

    const finalSuggestions = uniqueSuggestions.slice(0, limit);
    const totalTime = Date.now() - startTime;
    
    console.log(`[TYPEAHEAD-SERVICE] Completed: ${finalSuggestions.length} unique suggestions (${suggestions.length} before dedup) in ${totalTime}ms`);
    console.log(`[TYPEAHEAD-SERVICE] Suggestions:`, finalSuggestions.map(s => `${s.type}: "${s.text}"`).join(', '));

    return {
      suggestions: finalSuggestions,
      query: partialQuery
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[TYPEAHEAD-SERVICE] Error after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack,
      query: partialQuery
    });
    return {
      suggestions: [],
      query: partialQuery
    };
  }
}

