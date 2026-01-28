/**
 * Price Search Service
 * Searches for tickets and events by price range
 */

import { query } from '../database';

export interface PriceSearchParams {
  minPrice?: number;
  maxPrice?: number;
  eventId?: number;
  performer?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface PriceResult {
  event_id: number;
  event_name: string;
  event_date: Date;
  venue?: string;
  city?: string;
  state?: string;
  section?: string;
  row?: string;
  price: number;
  quantity_available: number;
  ticketing_group_id: number;
}

export async function searchByPrice(params: PriceSearchParams): Promise<PriceResult[]> {
  const {
    minPrice,
    maxPrice,
    eventId,
    performer,
    location,
    dateFrom,
    dateTo,
    limit = 50
  } = params;

  let sql = `
    SELECT DISTINCT
      mtg.id as ticketing_group_id,
      mtg.event_id,
      me.name as event_name,
      me.occurs_at as event_date,
      mtg.section,
      mtg.row,
      mtg.retail_price as price,
      mtg.current_quantity as quantity_available,
      v.name as venue,
      v.city,
      v.state
    FROM public.master_ticketing_groups mtg
    INNER JOIN public.master_events me ON mtg.event_id = me.id
    LEFT JOIN public.master_venues v ON me.master_venue_id = v.id
    WHERE mtg.current_quantity > 0
    AND me.occurs_at >= CURRENT_DATE
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

  if (minPrice !== undefined) {
    sql += ` AND mtg.retail_price >= $${paramIndex++}`;
    queryParams.push(minPrice);
  }

  if (maxPrice !== undefined) {
    sql += ` AND mtg.retail_price <= $${paramIndex++}`;
    queryParams.push(maxPrice);
  }

  if (eventId) {
    sql += ` AND mtg.event_id = $${paramIndex++}`;
    queryParams.push(eventId);
  }

  if (performer) {
    sql += ` AND me.name ILIKE $${paramIndex++}`;
    queryParams.push(`%${performer}%`);
  }

  if (location) {
    sql += ` AND (v.city ILIKE $${paramIndex} OR v.state ILIKE $${paramIndex} OR v.name ILIKE $${paramIndex})`;
    queryParams.push(`%${location}%`);
    paramIndex++;
  }

  if (dateFrom) {
    sql += ` AND me.occurs_at >= $${paramIndex++}`;
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND me.occurs_at <= $${paramIndex++}`;
    queryParams.push(dateTo);
  }

  sql += ` ORDER BY mtg.retail_price ASC, me.occurs_at ASC`;
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
    section: row.section,
    row: row.row,
    price: parseFloat(row.price),
    quantity_available: parseInt(row.quantity_available),
    ticketing_group_id: row.ticketing_group_id
  }));
}

/**
 * Get price statistics for an event
 */
export interface PriceStats {
  min_price: number;
  max_price: number;
  avg_price: number;
  median_price?: number;
  total_tickets: number;
}

export async function getPriceStats(eventId: number): Promise<PriceStats | null> {
  const sql = `
    SELECT 
      MIN(retail_price) as min_price,
      MAX(retail_price) as max_price,
      AVG(retail_price) as avg_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY retail_price) as median_price,
      SUM(current_quantity) as total_tickets
    FROM public.master_ticketing_groups
    WHERE event_id = $1 AND current_quantity > 0
  `;

  const result = await query(sql, [eventId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    min_price: parseFloat(row.min_price) || 0,
    max_price: parseFloat(row.max_price) || 0,
    avg_price: parseFloat(row.avg_price) || 0,
    median_price: row.median_price ? parseFloat(row.median_price) : undefined,
    total_tickets: parseInt(row.total_tickets) || 0
  };
}

