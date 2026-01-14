/**
 * Event Search Service
 * Searches for events by performer, type, popularity, location, etc.
 */

import { query } from '../database';

export interface EventSearchParams {
  performer?: string;
  eventType?: string;
  location?: string;
  city?: string;
  state?: string;
  venue?: string;
  dateFrom?: string;
  dateTo?: string;
  popularityMin?: number;
  limit?: number;
}

export interface EventResult {
  event_id: number;
  title: string;
  event_date: Date;
  event_type?: string;
  performer?: string;
  venue?: string;
  city?: string;
  state?: string;
  popularity_score?: number;
  min_price?: number;
  max_price?: number;
  total_tickets_available?: number;
}

export async function searchEvents(params: EventSearchParams): Promise<EventResult[]> {
  const {
    performer,
    eventType,
    location,
    city,
    state,
    venue,
    dateFrom,
    dateTo,
    popularityMin,
    limit = 50
  } = params;

  let sql = `
    SELECT DISTINCT
      me.id as event_id,
      me.title,
      me.event_date,
      me.event_type,
      me.popularity_score,
      v.name as venue,
      v.city,
      v.state,
      MIN(mtg.price) as min_price,
      MAX(mtg.price) as max_price,
      SUM(mtg.quantity_available) as total_tickets_available
    FROM public.master_events me
    LEFT JOIN public.venues v ON me.venue_id = v.id
    LEFT JOIN public.master_ticketing_groups mtg ON me.id = mtg.event_id AND mtg.quantity_available > 0
    WHERE 1=1
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

  if (performer) {
    sql += ` AND me.title ILIKE $${paramIndex++}`;
    queryParams.push(`%${performer}%`);
  }

  if (eventType) {
    sql += ` AND me.event_type ILIKE $${paramIndex++}`;
    queryParams.push(`%${eventType}%`);
  }

  if (location) {
    sql += ` AND (v.city ILIKE $${paramIndex} OR v.state ILIKE $${paramIndex} OR v.name ILIKE $${paramIndex})`;
    queryParams.push(`%${location}%`);
    paramIndex++;
  }

  if (city) {
    sql += ` AND v.city ILIKE $${paramIndex++}`;
    queryParams.push(`%${city}%`);
  }

  if (state) {
    sql += ` AND v.state ILIKE $${paramIndex++}`;
    queryParams.push(`%${state}%`);
  }

  if (venue) {
    sql += ` AND v.name ILIKE $${paramIndex++}`;
    queryParams.push(`%${venue}%`);
  }

  if (dateFrom) {
    sql += ` AND me.event_date >= $${paramIndex++}`;
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND me.event_date <= $${paramIndex++}`;
    queryParams.push(dateTo);
  }

  if (popularityMin !== undefined) {
    sql += ` AND me.popularity_score >= $${paramIndex++}`;
    queryParams.push(popularityMin);
  }

  sql += ` GROUP BY me.id, me.title, me.event_date, me.event_type, me.popularity_score, v.name, v.city, v.state`;
  sql += ` HAVING SUM(mtg.quantity_available) > 0 OR COUNT(mtg.id) = 0`;
  sql += ` ORDER BY me.popularity_score DESC NULLS LAST, me.event_date ASC`;
  sql += ` LIMIT $${paramIndex++}`;
  queryParams.push(limit);

  const result = await query(sql, queryParams);
  return result.rows.map(row => ({
    event_id: row.event_id,
    title: row.title,
    event_date: row.event_date,
    event_type: row.event_type,
    performer: row.performer,
    venue: row.venue,
    city: row.city,
    state: row.state,
    popularity_score: row.popularity_score ? parseFloat(row.popularity_score) : undefined,
    min_price: row.min_price ? parseFloat(row.min_price) : undefined,
    max_price: row.max_price ? parseFloat(row.max_price) : undefined,
    total_tickets_available: row.total_tickets_available ? parseInt(row.total_tickets_available) : undefined
  }));
}

/**
 * Get event details by ID
 */
export async function getEventById(eventId: number): Promise<EventResult | null> {
  const results = await searchEvents({ limit: 1 });
  // Filter by eventId in memory since we need to modify the query
  const sql = `
    SELECT DISTINCT
      me.id as event_id,
      me.title,
      me.event_date,
      me.event_type,
      me.popularity_score,
      v.name as venue,
      v.city,
      v.state,
      MIN(mtg.price) as min_price,
      MAX(mtg.price) as max_price,
      SUM(mtg.quantity_available) as total_tickets_available
    FROM public.master_events me
    LEFT JOIN public.venues v ON me.venue_id = v.id
    LEFT JOIN public.master_ticketing_groups mtg ON me.id = mtg.event_id AND mtg.quantity_available > 0
    WHERE me.id = $1
    GROUP BY me.id, me.title, me.event_date, me.event_type, me.popularity_score, v.name, v.city, v.state
  `;

  const result = await query(sql, [eventId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    event_id: row.event_id,
    title: row.title,
    event_date: row.event_date,
    event_type: row.event_type,
    venue: row.venue,
    city: row.city,
    state: row.state,
    popularity_score: row.popularity_score ? parseFloat(row.popularity_score) : undefined,
    min_price: row.min_price ? parseFloat(row.min_price) : undefined,
    max_price: row.max_price ? parseFloat(row.max_price) : undefined,
    total_tickets_available: row.total_tickets_available ? parseInt(row.total_tickets_available) : undefined
  };
}

