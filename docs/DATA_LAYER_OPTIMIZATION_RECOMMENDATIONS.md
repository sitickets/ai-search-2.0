# Data Layer Optimization: Indexes + Materialized Views

Recommendations to minimize response time for ai-search ticket/event queries, based on current query structure and returned data. Column names below match the **ai-search code** (`occurs_at`, `retail_price`, `current_quantity`, `tevo_popularity_score`, `master_venue_id`). Align with your actual schema if names differ (e.g. `venue_id`, `seat_order`).

---

## 1. Indexes (do these first)

Indexes reduce live-query cost and also speed up materialized view refresh. Add in this order.

### 1.1 `master_ticketing_groups` (largest impact – 100M+ rows)

**A. Partial composite for event search JOIN + aggregates**

Supports: `event_id`, `current_quantity > 0`, and MIN/MAX on `retail_price`.

```sql
-- Use CONCURRENTLY in production to avoid locking
CREATE INDEX CONCURRENTLY idx_mtg_event_qty_price_available
ON public.master_ticketing_groups (event_id, retail_price)
WHERE current_quantity > 0;
```

- Covers the event-search join and price aggregates; partial index keeps it smaller.
- If your schema uses `quantity_available` or similar, use that in the `WHERE` clause instead of `current_quantity`.

**B. For ticket search: same table, different access path**

Ticket search filters by `event_id`, `current_quantity > 0`, then orders by `occurs_at`, `retail_price`. The join is `mtg → master_events → master_venues`. An index that leads with `event_id` and supports the filter + sort helps:

```sql
CREATE INDEX CONCURRENTLY idx_mtg_event_quantity
ON public.master_ticketing_groups (event_id)
WHERE current_quantity > 0;
```

Often (A) is enough for both patterns; add (B) only if ticket search is still slow after (A) and the event-search MV.

### 1.2 `master_events`

**C. Future events (used in every query)**

```sql
CREATE INDEX CONCURRENTLY idx_master_events_occurs_at
ON public.master_events (occurs_at)
WHERE occurs_at >= CURRENT_DATE;
```

- Speeds up `me.occurs_at >= CURRENT_DATE` and date-range filters.

**D. Sort order for event search**

Event search orders by `tevo_popularity_score DESC NULLS LAST, occurs_at ASC`. A composite index supports that without a separate sort:

```sql
CREATE INDEX CONCURRENTLY idx_master_events_popularity_occurs
ON public.master_events (tevo_popularity_score DESC NULLS LAST, occurs_at ASC)
WHERE occurs_at >= CURRENT_DATE;
```

**E. Join to venues**

If you see nested-loop joins on `master_venue_id`, add:

```sql
CREATE INDEX CONCURRENTLY idx_master_events_master_venue_id
ON public.master_events (master_venue_id)
WHERE master_venue_id IS NOT NULL;
```

### 1.3 `master_venues` (location filters)

**F. Location filters (city, state, name)**

Event and ticket search use `v.city ILIKE`, `v.state ILIKE`, `v.name ILIKE` (and `v.county` if present). B-tree indexes support `ILIKE` only with a pattern that doesn’t start with `%`. For “starts with” or exact match:

```sql
CREATE INDEX CONCURRENTLY idx_master_venues_city
ON public.master_venues (lower(city))
WHERE city IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_master_venues_state
ON public.master_venues (lower(state))
WHERE state IS NOT NULL;
```

- `master_venues_name_index` already exists; keep it. Add trigram indexes if you need leading-wildcard search (e.g. `pg_trgm` on `city`, `state`, `name`) and accept the storage cost.

---

## 2. Materialized views (after indexes)

Precompute the expensive aggregates so live queries and the LLM path do minimal work.

### 2.1 Event-level price/availability summary (primary MV)

This replaces the heavy JOIN + GROUP BY + MIN/MAX/SUM in event search with a single join to a small table.

**Definition**

Use the same filters as your event search: future events only, and only events with at least one available ticket (or keep events with zero so you can show “sold out”):

```sql
CREATE MATERIALIZED VIEW public.mv_event_price_summary AS
SELECT
  me.id AS event_id,
  me.name AS event_name,
  me.occurs_at,
  me.tevo_popularity_score,
  me.master_venue_id,
  MIN(mtg.retail_price) AS min_price,
  MAX(mtg.retail_price) AS max_price,
  SUM(mtg.current_quantity) AS total_tickets_available
FROM public.master_events me
LEFT JOIN public.master_ticketing_groups mtg
  ON me.id = mtg.event_id
  AND mtg.current_quantity > 0
WHERE me.occurs_at >= CURRENT_DATE
GROUP BY me.id, me.name, me.occurs_at, me.tevo_popularity_score, me.master_venue_id;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX ON public.mv_event_price_summary (event_id);
```

**Indexes on the MV**

- `event_id` is already unique (above).
- For event search (filter by location/date, order by popularity/date), add:

```sql
CREATE INDEX ON public.mv_event_price_summary (occurs_at);
CREATE INDEX ON public.mv_event_price_summary (tevo_popularity_score DESC NULLS LAST, occurs_at ASC);
CREATE INDEX ON public.mv_event_price_summary (master_venue_id) WHERE master_venue_id IS NOT NULL;
```

**How the app uses it**

- **Event search:** Query `master_events` joined to `mv_event_price_summary` (and `master_venues` for venue/location). Filter by `occurs_at`, location (venue), and optionally `min_price`/`max_price`; order by `tevo_popularity_score`, `occurs_at`. No JOIN to `master_ticketing_groups` and no per-request aggregates.
- **Ticket search:** Keep querying `master_ticketing_groups` for per-ticket rows (section, row, price); the MV does not replace that. Optionally use the MV to restrict to “events that have tickets” before joining to `mtg` if that helps plans.

**Refresh**

- Use `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_price_summary;` on a schedule (e.g. every 5–15 minutes via pg_cron, EventBridge + Lambda, or app scheduler). CONCURRENTLY avoids blocking reads.

### 2.2 Optional: search catalog MV (event + venue + price in one place)

If you want the **fastest possible** search path and can afford a bit more staleness and refresh cost, add an MV that pre-joins event + venue + price so the app only filters and sorts on one object:

```sql
CREATE MATERIALIZED VIEW public.mv_event_search_catalog AS
SELECT
  s.event_id,
  s.event_name,
  s.occurs_at,
  s.tevo_popularity_score,
  s.min_price,
  s.max_price,
  s.total_tickets_available,
  v.id   AS venue_id,
  v.name AS venue_name,
  v.city AS venue_city,
  v.state AS venue_state
FROM public.mv_event_price_summary s
JOIN public.master_venues v ON v.id = s.master_venue_id;

CREATE UNIQUE INDEX ON public.mv_event_search_catalog (event_id);
CREATE INDEX ON public.mv_event_search_catalog (venue_city, venue_state);
CREATE INDEX ON public.mv_event_search_catalog (occurs_at);
CREATE INDEX ON public.mv_event_search_catalog (tevo_popularity_score DESC NULLS LAST, occurs_at ASC);
```

- **Refresh:** Refresh `mv_event_price_summary` first, then `mv_event_search_catalog` (or base the catalog on the base tables and refresh both in one job).
- **Use:** Event search becomes a single scan of `mv_event_search_catalog` with filters and LIMIT. No joins at read time.

---

## 3. Order of operations and expectations

| Step | Action | Goal |
|------|--------|------|
| 1 | Add indexes 1.1–1.3 (especially `idx_mtg_event_qty_price_available`, `idx_master_events_occurs_at`, `idx_master_events_popularity_occurs`) | Faster live queries and faster MV refresh |
| 2 | Create `mv_event_price_summary` + its indexes | Remove heavy aggregation from event search |
| 3 | Change event search to read from `mv_event_price_summary` (or `mv_event_search_catalog`) instead of joining to `master_ticketing_groups` | Sub-second event search when filters hit indexes |
| 4 | (Optional) Add `mv_event_search_catalog` and point event search at it | Fastest path: one table, no joins |
| 5 | Schedule REFRESH MATERIALIZED VIEW CONCURRENTLY (e.g. every 5–15 min) | Keep pricing/availability fresh without blocking reads |

**Rough impact (if indexes and MV are used in the app):**

- **Event search:** From multi-second to well under a second in typical cases (e.g. 0.1–0.5 s when reading from the MV and using indexes).
- **Ticket search:** Improves from indexes on `master_ticketing_groups` and `master_events`; still hits `mtg` for per-ticket data, so expect moderate improvement (e.g. 1–5 s → 0.5–2 s depending on filters).
- **MV refresh:** With the recommended indexes, refresh of `mv_event_price_summary` should be in the tens of seconds to a couple of minutes; tune refresh interval and instance size so it doesn’t overlap and strain the DB.

---

## 4. Schema alignment notes

- **Column names:** The ai-search code uses `me.name`, `me.occurs_at`, `me.tevo_popularity_score`, `me.master_venue_id`, `mtg.retail_price`, `mtg.current_quantity`, `v.name`, `v.city`, `v.state`, and optionally `v.county`. If your schema uses different names (e.g. `venue_id`, `event_date`, `price`, `quantity_available`), replace them in the SQL above.
- **FK and event_id:** The code joins `master_ticketing_groups.event_id` to `master_events.id`. If in your DB `master_ticketing_groups.event_id` references another table (e.g. `tevo_events.id`), the MV and event search must use the same event key your app uses (e.g. a view or the same ID space) so the MV stays consistent with what the app considers “event”.
- **Venue join:** The code uses `me.master_venue_id = v.id`. If your schema has `venue_id` instead, use that in the MV and indexes.

---

## 5. Monitoring after rollout

- Run `EXPLAIN (ANALYZE, BUFFERS)` on the main event and ticket search queries before and after; confirm they use the new indexes and (for event search) the MV.
- Track duration of `REFRESH MATERIALIZED VIEW CONCURRENTLY` and DB CPU/IO; if refresh runs too long or overlaps, increase the interval or add capacity.
- Use `pg_stat_user_indexes` / `pg_stat_user_tables` to confirm the new indexes and MVs are used and not duplicated by redundant indexes.

This combination of indexes and materialized views is the most comprehensive way to optimize response time for the current data shape and access patterns: indexes for immediate gain and faster refresh, and MVs to move heavy aggregation off the hot path.
