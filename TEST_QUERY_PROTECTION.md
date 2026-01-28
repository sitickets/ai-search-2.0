# Testing Query Protection

## Quick Start

### Run Simple Test (Recommended)

```bash
npm run test:query-protection:simple
```

This runs a quick test that verifies:
- ✅ Valid queries work
- ✅ Missing WHERE clauses are rejected
- ✅ Query validation works
- ✅ Result size limits work

### Run Full Test Suite

```bash
npm run test:query-protection
```

This runs comprehensive tests including:
- Query timeout protection
- Result size limits
- Missing WHERE clause detection
- Cartesian product detection
- Query complexity checks
- Query length protection
- Slow query logging
- Valid query execution

## Prerequisites

1. **Environment Variables**: Make sure `.env` is configured:
   ```bash
   POSTGRES_DATABASE_URL=postgresql://...
   DB_QUERY_TIMEOUT_MS=30000
   DB_MAX_RESULT_ROWS=10000
   ```

2. **Database Access**: Ensure you can connect to the UAT database

3. **Dependencies**: Install if needed:
   ```bash
   npm install
   ```

## Expected Output

### Simple Test Output

```
🧪 Quick Query Protection Test

Configuration:
  Timeout: 30000ms
  Max Rows: 10000
  Max Length: 50000

Test 1: Valid query...
✅ Passed: Returned 5 rows

Test 2: Missing WHERE clause (should be rejected)...
✅ Passed: Query correctly rejected

Test 3: Query validation...
✅ Passed: Query validation passed

Test 4: Result size limit...
✅ Passed: Results limited to 10000 rows (max: 10000)

✅ All tests completed!
```

### Full Test Suite Output

```
🧪 Query Protection Test Suite

==================================================

📊 Configuration:
  Query Timeout: 30000ms
  Max Result Rows: 10000
  Max Query Length: 50000
  Complexity Check: true
  Statement Timeout: true

📋 Testing Valid Query Execution...

✅ Valid Query Execution
   Warning: Returned 10 rows

📋 Testing Query Timeout Protection...

✅ Query Timeout

📋 Testing Result Size Limit...

✅ Result Size Limit
   Warning: Returned 10000 rows (limit: 10000)

... (more tests)

==================================================

📊 Test Summary:

Total Tests: 8
✅ Passed: 8
❌ Failed: 0

==================================================
```

## Troubleshooting

### Test Fails: "Cannot find module"

```bash
# Make sure you're in the project directory
cd ai-search-2.0

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Test Fails: Database Connection Error

1. Check `.env` file has `POSTGRES_DATABASE_URL`
2. Verify database credentials are correct
3. Check network connectivity to database

### Test Fails: Query Timeout Not Working

- Check `DB_QUERY_TIMEOUT_MS` is set in `.env`
- Verify the timeout value is reasonable (not too high)
- Check PostgreSQL `statement_timeout` is enabled

### Test Shows Warnings

Warnings are normal and indicate:
- Query complexity detected (but query still allowed)
- Result truncation occurred
- Slow query detected

These are informational and don't indicate failures.

## Manual Testing

You can also test protection manually:

```typescript
import { query } from './services/database';
import { queryProtection } from './services/queryProtection';

// Test 1: Valid query
const result = await query(`
  SELECT * FROM master_events 
  WHERE event_date >= CURRENT_DATE 
  LIMIT 10
`);

// Test 2: Check validation
const validation = queryProtection.validateQuery('SELECT * FROM master_ticketing_groups');
console.log(validation.allowed); // false
console.log(validation.reason); // "Query targets large table without WHERE clause..."

// Test 3: Test timeout (will fail after 30 seconds)
try {
  await query('SELECT pg_sleep(60)');
} catch (error) {
  console.log(error.message); // "Query timeout: exceeded 30000ms"
}
```

## Next Steps

After running tests:
1. ✅ Review test results
2. ✅ Check logs for warnings
3. ✅ Adjust configuration if needed
4. ✅ Deploy to Lambda and test in production

---

*For more details, see `QUERY_PROTECTION.md`*

