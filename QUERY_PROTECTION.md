# Query Protection Documentation

## Overview

The query protection system prevents slow, unoptimized, or dangerous SQL queries from executing. It provides multiple layers of protection:

1. **Query Validation** - Checks query before execution
2. **Query Timeout** - Enforces maximum execution time
3. **Result Size Limits** - Prevents returning too many rows
4. **Complexity Analysis** - Detects potentially slow query patterns
5. **PostgreSQL Statement Timeout** - Database-level timeout protection

## Features

### 1. Query Timeout Protection

- **Default:** 30 seconds (`DB_QUERY_TIMEOUT_MS=30000`)
- **How it works:** Uses `Promise.race()` to cancel queries that exceed the timeout
- **PostgreSQL-level:** Also sets `statement_timeout` at the database level

### 2. Result Size Limits

- **Default:** 10,000 rows (`DB_MAX_RESULT_ROWS=10000`)
- **How it works:** Automatically truncates results if they exceed the limit
- **Warning:** Logs a warning when truncation occurs

### 3. Query Complexity Checks

Detects and warns about:
- **Too many JOINs** (>5 JOINs)
- **Nested subqueries** (>3 levels)
- **Multiple UNIONs** (>2 UNIONs)
- **DISTINCT without LIMIT**
- **ORDER BY without LIMIT**
- **GROUP BY without HAVING/LIMIT**
- **LIKE patterns starting with %** (can't use indexes)
- **Functions on WHERE columns** (prevents index usage)

### 4. Dangerous Query Detection

Blocks queries that:
- **Target large tables without WHERE clause** (unless LIMIT is present)
- **Create cartesian products** (multiple tables without JOIN conditions)
- **Exceed maximum query length** (default: 50KB)

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Query timeout in milliseconds (default: 30000 = 30 seconds)
DB_QUERY_TIMEOUT_MS=30000

# Maximum rows to return (default: 10000)
DB_MAX_RESULT_ROWS=10000

# Maximum query string length in characters (default: 50000)
DB_MAX_QUERY_LENGTH=50000

# Enable query complexity checks (default: true)
DB_ENABLE_COMPLEXITY_CHECK=true

# Enable PostgreSQL statement_timeout (default: true)
DB_ENABLE_STATEMENT_TIMEOUT=true
```

### Lambda Environment Variables

These are automatically included in `serverless.yml`:

```yaml
DB_QUERY_TIMEOUT_MS: ${env:DB_QUERY_TIMEOUT_MS, '30000'}
DB_MAX_RESULT_ROWS: ${env:DB_MAX_RESULT_ROWS, '10000'}
DB_MAX_QUERY_LENGTH: ${env:DB_MAX_QUERY_LENGTH, '50000'}
DB_ENABLE_COMPLEXITY_CHECK: ${env:DB_ENABLE_COMPLEXITY_CHECK, 'true'}
DB_ENABLE_STATEMENT_TIMEOUT: ${env:DB_ENABLE_STATEMENT_TIMEOUT, 'true'}
```

## Usage

The protection is automatically applied to all queries via the `query()` function in `database.ts`:

```typescript
import { query } from './services/database';

// This query is automatically protected
const result = await query('SELECT * FROM master_events WHERE id = $1', [123]);
```

## Examples

### Example 1: Query Timeout

```typescript
// Query that takes too long will be cancelled
try {
  const result = await query('SELECT * FROM master_ticketing_groups WHERE ...');
} catch (error) {
  // Error: Query timeout: exceeded 30000ms
}
```

### Example 2: Result Size Limit

```typescript
// Query returns 50,000 rows, but only 10,000 are returned
const result = await query('SELECT * FROM master_events LIMIT 50000');
// result.rows.length === 10000 (truncated)
// Warning logged: "Result set truncated from 50000 to 10000 rows"
```

### Example 3: Missing WHERE Clause

```typescript
// This query will be rejected
try {
  const result = await query('SELECT * FROM master_ticketing_groups');
} catch (error) {
  // Error: Query rejected: Query targets large table without WHERE clause and no LIMIT
}
```

### Example 4: Cartesian Product Detection

```typescript
// This query will be rejected
try {
  const result = await query(`
    SELECT * FROM master_events me, master_ticketing_groups mtg
  `);
} catch (error) {
  // Error: Query rejected: Query appears to create a cartesian product
}
```

## Monitoring

### Slow Query Logging

Queries taking longer than 5 seconds are automatically logged:

```
Slow query detected: 7234ms
{
  query: "SELECT * FROM master_events WHERE ...",
  params: 2
}
```

### Query Warnings

Complexity warnings are logged but don't block execution:

```
Query warnings: [
  "Query has 6 JOINs, which may be slow",
  "LIKE patterns starting with % cannot use indexes"
]
```

## Best Practices

1. **Always use parameterized queries** - Prevents SQL injection
2. **Always include WHERE clauses** - Especially on large tables
3. **Use LIMIT clauses** - Even when you expect few results
4. **Index your WHERE columns** - Avoid functions on indexed columns
5. **Monitor slow queries** - Review logs regularly

## Customization

You can customize the protection service:

```typescript
import { QueryProtectionService } from './services/queryProtection';

const customProtection = new QueryProtectionService({
  maxQueryTimeMs: 60000,        // 60 seconds
  maxResultRows: 5000,          // 5K rows max
  maxQueryLength: 100000,       // 100KB query max
  enableComplexityCheck: true,
  enableStatementTimeout: true
});
```

## Troubleshooting

### Query Timeout Errors

If queries are timing out:
1. Check if the query is actually slow (review query plan)
2. Increase `DB_QUERY_TIMEOUT_MS` if needed
3. Optimize the query (add indexes, rewrite query)

### Result Truncation

If results are being truncated:
1. Increase `DB_MAX_RESULT_ROWS` if needed
2. Add pagination to your queries
3. Use more specific WHERE clauses to reduce result set

### Query Rejection

If queries are being rejected:
1. Review the error message for the specific reason
2. Add missing WHERE clauses or JOIN conditions
3. Add LIMIT clauses if querying large tables
4. Review query complexity and optimize if needed

## Security Considerations

- **SQL Injection Protection:** Always use parameterized queries (already enforced)
- **Resource Exhaustion:** Query timeouts and result limits prevent resource exhaustion
- **Database Load:** Complexity checks help prevent queries that could overload the database
- **Information Disclosure:** Query validation prevents accidentally exposing too much data

---

*Last updated: January 20, 2026*

