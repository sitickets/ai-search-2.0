# Query Performance Analysis - Event Search with MIN/MAX

## Current Query Structure

```sql
SELECT DISTINCT
  me.id as event_id,
  me.title,
  ...
  MIN(mtg.price) as min_price,
  MAX(mtg.price) as max_price,
  SUM(mtg.quantity_available) as total_tickets_available
FROM public.master_events me
LEFT JOIN public.master_ticketing_groups mtg 
  ON me.id = mtg.event_id 
  AND mtg.quantity_available > 0
WHERE me.event_date >= CURRENT_DATE
GROUP BY me.id, me.title, ...
ORDER BY me.popularity_score DESC NULLS LAST, me.event_date ASC
LIMIT 50
```

## Performance Concerns

### ⚠️ **YES, this can be expensive:**

1. **Table Size**: `master_ticketing_groups` has **100M+ rows**
2. **Aggregation Cost**: MIN/MAX/SUM on large datasets requires scanning/grouping
3. **LEFT JOIN**: Must check all ticket groups even if no matches
4. **GROUP BY**: Aggregates across potentially thousands of ticket groups per event

### Estimated Performance Impact

- **Without proper indexes**: 5-30+ seconds per query
- **With indexes**: 1-5 seconds per query
- **With optimizations**: 0.5-2 seconds per query

## Current Indexes (from migrations)

✅ **Index exists on `event_id`**:
```sql
CREATE INDEX ON master_ticketing_groups (event_id);
```

✅ **Composite index exists**:
```sql
CREATE INDEX mtg_has_ticket_idx ON master_ticketing_groups 
  (event_id, deleted_at, type, broadcast);
```

## Potential Issues

### 1. Missing Index on `quantity_available`
The JOIN condition filters `mtg.quantity_available > 0`, but there may not be an index on this column.

### 2. Missing Index on `price`
MIN/MAX on `price` requires scanning all matching rows. An index on `(event_id, price)` would help.

### 3. Missing Index on `master_events.event_date`
The WHERE clause filters `me.event_date >= CURRENT_DATE` - needs an index.

## Optimization Recommendations

### Option 1: Add Composite Index (Recommended)

```sql
-- Optimize for the JOIN and aggregation
CREATE INDEX idx_mtg_event_price_qty 
ON master_ticketing_groups 
(event_id, quantity_available, price) 
WHERE quantity_available > 0;
```

**Benefits:**
- Covers JOIN condition (`event_id`)
- Filters available tickets (`quantity_available > 0`)
- Optimizes MIN/MAX on `price`
- Partial index (smaller, faster)

### Option 2: Add Index on master_events.event_date

```sql
CREATE INDEX idx_events_date 
ON master_events (event_date) 
WHERE event_date >= CURRENT_DATE;
```

### Option 3: Materialized View (For Heavy Usage)

If this query runs frequently, consider a materialized view:

```sql
CREATE MATERIALIZED VIEW event_price_summary AS
SELECT 
  me.id as event_id,
  MIN(mtg.price) as min_price,
  MAX(mtg.price) as max_price,
  SUM(mtg.quantity_available) as total_tickets_available
FROM master_events me
LEFT JOIN master_ticketing_groups mtg 
  ON me.id = mtg.event_id 
  AND mtg.quantity_available > 0
WHERE me.event_date >= CURRENT_DATE
GROUP BY me.id;

CREATE INDEX ON event_price_summary (event_id);

-- Refresh periodically (e.g., every 5 minutes)
REFRESH MATERIALIZED VIEW CONCURRENTLY event_price_summary;
```

### Option 4: Query Optimization

Modify the query to be more efficient:

```sql
-- Instead of LEFT JOIN, use a subquery for aggregation
SELECT 
  me.id as event_id,
  me.title,
  ...
  (SELECT MIN(price) FROM master_ticketing_groups 
   WHERE event_id = me.id AND quantity_available > 0) as min_price,
  (SELECT MAX(price) FROM master_ticketing_groups 
   WHERE event_id = me.id AND quantity_available > 0) as max_price
FROM master_events me
WHERE me.event_date >= CURRENT_DATE
ORDER BY me.popularity_score DESC NULLS LAST, me.event_date ASC
LIMIT 50;
```

**Benefits:**
- Filters events first (smaller dataset)
- Only aggregates for the 50 events returned
- Can use indexes more efficiently

## Current Protection

✅ **Query Protection is Active:**
- 30-second timeout prevents runaway queries
- Result size limits prevent memory issues
- Slow query logging will alert you

## Monitoring

Check query performance:

```sql
-- Check query execution time
EXPLAIN ANALYZE
SELECT ... (your query);

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'master_ticketing_groups';
```

## Recommendations

1. **Short-term**: Add the composite index (Option 1)
2. **Medium-term**: Add event_date index (Option 2)
3. **Long-term**: Consider materialized view if query runs very frequently (Option 3)
4. **Query-level**: Optimize query structure (Option 4)

## Expected Performance After Optimization

- **Before**: 5-30 seconds
- **After indexes**: 1-5 seconds
- **After query optimization**: 0.5-2 seconds
- **After materialized view**: 0.1-0.5 seconds

---

*Note: The query protection timeout (30s) will catch slow queries, but optimization is still recommended for better user experience.*

