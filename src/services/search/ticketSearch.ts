/**
 * Ticket Search Service
 * Searches for tickets by various criteria
 */

import { query } from '../database';

export interface TicketSearchParams {
  eventId?: number;
  performer?: string;
  venue?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  dateFrom?: string;
  dateTo?: string;
  section?: string;
  row?: string;
  quantity?: number;
  limit?: number;
}

export interface TicketResult {
  ticket_id: number;
  event_id: number;
  event_name: string;
  event_date: Date;
  performer?: string;
  venue?: string;
  city?: string;
  state?: string;
  section?: string;
  row?: string;
  seat?: string;
  price: number;
  quantity_available: number;
  ticketing_group_id: number;
}

export async function searchTickets(params: TicketSearchParams): Promise<TicketResult[]> {
  const {
    eventId,
    performer,
    venue,
    location,
    priceMin,
    priceMax,
    dateFrom,
    dateTo,
    section,
    row,
    quantity,
    limit = 50
  } = params;

  let sql = `
    SELECT DISTINCT
      mtg.id as ticket_id,
      mtg.event_id,
      me.title as event_name,
      me.event_date,
      mtg.section,
      mtg.row,
      mtg.seat_range as seat,
      mtg.price,
      mtg.quantity_available,
      mtg.id as ticketing_group_id,
      v.name as venue,
      v.city,
      v.state
    FROM public.master_ticketing_groups mtg
    INNER JOIN public.master_events me ON mtg.event_id = me.id
    LEFT JOIN public.venues v ON me.venue_id = v.id
    WHERE 1=1
  `;

  const queryParams: any[] = [];
  let paramIndex = 1;

  if (eventId) {
    sql += ` AND mtg.event_id = $${paramIndex++}`;
    queryParams.push(eventId);
  }

  if (performer) {
    sql += ` AND me.title ILIKE $${paramIndex++}`;
    queryParams.push(`%${performer}%`);
  }

  if (venue) {
    sql += ` AND v.name ILIKE $${paramIndex++}`;
    queryParams.push(`%${venue}%`);
  }

  if (location) {
    // Handle location with multiple terms (e.g., "Westchester County|Westchester")
    const locationTerms = location.split('|');
    if (locationTerms.length > 1) {
      // Search for any of the terms
      sql += ` AND (`;
      locationTerms.forEach((term, idx) => {
        if (idx > 0) sql += ` OR `;
        sql += `(v.city ILIKE $${paramIndex} OR v.state ILIKE $${paramIndex} OR v.name ILIKE $${paramIndex} OR v.county ILIKE $${paramIndex})`;
        queryParams.push(`%${term.trim()}%`);
      });
      sql += `)`;
      paramIndex += locationTerms.length;
    } else {
      // Single location term - also check county field if it exists
      sql += ` AND (v.city ILIKE $${paramIndex} OR v.state ILIKE $${paramIndex} OR v.name ILIKE $${paramIndex} OR v.county ILIKE $${paramIndex})`;
      queryParams.push(`%${location}%`);
      paramIndex++;
    }
  }

  if (priceMin !== undefined) {
    sql += ` AND mtg.price >= $${paramIndex++}`;
    queryParams.push(priceMin);
  }

  if (priceMax !== undefined) {
    sql += ` AND mtg.price <= $${paramIndex++}`;
    queryParams.push(priceMax);
  }

  if (dateFrom) {
    sql += ` AND me.event_date >= $${paramIndex++}`;
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND me.event_date <= $${paramIndex++}`;
    queryParams.push(dateTo);
  }

  if (section) {
    sql += ` AND mtg.section ILIKE $${paramIndex++}`;
    queryParams.push(`%${section}%`);
  }

  if (row) {
    sql += ` AND mtg.row ILIKE $${paramIndex++}`;
    queryParams.push(`%${row}%`);
  }

  if (quantity !== undefined) {
    sql += ` AND mtg.quantity_available >= $${paramIndex++}`;
    queryParams.push(quantity);
  }

  sql += ` AND mtg.quantity_available > 0`;
  sql += ` ORDER BY me.event_date ASC, mtg.price ASC`;
  sql += ` LIMIT $${paramIndex++}`;
  queryParams.push(limit);

  const result = await query(sql, queryParams);
  return result.rows.map(row => ({
    ticket_id: row.ticket_id,
    event_id: row.event_id,
    event_name: row.event_name,
    event_date: row.event_date,
    performer: row.performer,
    venue: row.venue,
    city: row.city,
    state: row.state,
    section: row.section,
    row: row.row,
    seat: row.seat,
    price: parseFloat(row.price),
    quantity_available: parseInt(row.quantity_available),
    ticketing_group_id: row.ticketing_group_id
  }));
}

