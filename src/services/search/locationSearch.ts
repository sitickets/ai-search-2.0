/**
 * Location Search Service
 * Searches for events and tickets by location (city, state, venue)
 */

import { query } from '../database';

export interface LocationSearchParams {
  city?: string;
  state?: string;
  venue?: string;
  zipCode?: string;
  radius?: number; // miles (requires lat/lng)
  latitude?: number;
  longitude?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface LocationResult {
  event_id: number;
  event_name: string;
  event_date: Date;
  venue: string;
  city: string;
  state: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  min_price?: number;
  max_price?: number;
  total_tickets_available?: number;
}

export async function searchByLocation(params: LocationSearchParams): Promise<LocationResult[]> {
  const {
    city,
    state,
    venue,
    zipCode,
    dateFrom,
    dateTo,
    limit = 50
  } = params;

  let sql = `
    SELECT DISTINCT
      me.id as event_id,
      me.name as event_name,
      me.occurs_at as event_date,
      v.name as venue,
      v.city,
      v.state,
      v.zip_code,
      v.latitude,
      v.longitude,
      MIN(mtg.price) as min_price,
      MAX(mtg.price) as max_price,
      SUM(mtg.current_quantity) as total_tickets_available
    FROM public.master_events me
    INNER JOIN public.master_venues v ON me.master_venue_id = v.id
    LEFT JOIN public.master_ticketing_groups mtg ON me.id = mtg.event_id AND mtg.current_quantity > 0
    WHERE 1=1
    AND me.occurs_at >= CURRENT_DATE
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

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

  if (zipCode) {
    sql += ` AND v.zip_code = $${paramIndex++}`;
    queryParams.push(zipCode);
  }

  if (dateFrom) {
    sql += ` AND me.occurs_at >= $${paramIndex++}`;
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND me.occurs_at <= $${paramIndex++}`;
    queryParams.push(dateTo);
  }

  sql += ` GROUP BY me.id, me.name, me.occurs_at, v.name, v.city, v.state, v.zip_code, v.latitude, v.longitude`;
  sql += ` HAVING SUM(mtg.current_quantity) > 0 OR COUNT(mtg.id) = 0`;
  sql += ` ORDER BY me.occurs_at ASC`;
  sql += ` LIMIT $${paramIndex++}`;
  queryParams.push(limit);

  const result = await query(sql, queryParams);
  return result.rows.map(row => ({
    event_id: row.event_id,
    event_name: row.event_name,
    event_date: row.event_date,
    venue: row.venue,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    latitude: row.latitude ? parseFloat(row.latitude) : undefined,
    longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    min_price: row.min_price ? parseFloat(row.min_price) : undefined,
    max_price: row.max_price ? parseFloat(row.max_price) : undefined,
    total_tickets_available: row.total_tickets_available ? parseInt(row.total_tickets_available) : undefined
  }));
}

/**
 * Get popular venues in a location
 */
export interface VenueInfo {
  venue_id: number;
  venue_name: string;
  city: string;
  state: string;
  event_count: number;
  upcoming_events: number;
}

export async function getPopularVenues(city?: string, state?: string, limit: number = 20): Promise<VenueInfo[]> {
  let sql = `
    SELECT 
      v.id as venue_id,
      v.name as venue_name,
      v.city,
      v.state,
      COUNT(DISTINCT me.id) as event_count,
          COUNT(DISTINCT CASE WHEN me.occurs_at >= CURRENT_DATE THEN me.id END) as upcoming_events
        FROM public.master_venues v
        LEFT JOIN public.master_events me ON v.id = me.master_venue_id
    WHERE 1=1
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

  if (city) {
    sql += ` AND v.city ILIKE $${paramIndex++}`;
    queryParams.push(`%${city}%`);
  }

  if (state) {
    sql += ` AND v.state ILIKE $${paramIndex++}`;
    queryParams.push(`%${state}%`);
  }

  sql += ` GROUP BY v.id, v.name, v.city, v.state`;
  sql += ` HAVING COUNT(DISTINCT me.id) > 0`;
  sql += ` ORDER BY upcoming_events DESC, event_count DESC`;
  sql += ` LIMIT $${paramIndex++}`;
  queryParams.push(limit);

  const result = await query(sql, queryParams);
  return result.rows.map(row => ({
    venue_id: row.venue_id,
    venue_name: row.venue_name,
    city: row.city,
    state: row.state,
    event_count: parseInt(row.event_count),
    upcoming_events: parseInt(row.upcoming_events)
  }));
}

