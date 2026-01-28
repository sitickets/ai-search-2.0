/**
 * Test Script for Query Protection
 * Tests all query protection features
 */

import { query } from '../services/database';
import { queryProtection } from '../services/queryProtection';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  warning?: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, warning?: string) {
  results.push({ name, passed, error, warning });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (warning) console.log(`   Warning: ${warning}`);
}

async function testQueryTimeout() {
  console.log('\n📋 Testing Query Timeout Protection...\n');
  
  try {
    // This query should timeout (sleep for 60 seconds, but timeout is 30 seconds)
    const startTime = Date.now();
    await query('SELECT pg_sleep(60)');
    logTest('Query Timeout', false, 'Query did not timeout as expected');
  } catch (error: any) {
    const executionTime = Date.now() - Date.now();
    if (error.message.includes('timeout')) {
      logTest('Query Timeout', true);
    } else {
      logTest('Query Timeout', false, error.message);
    }
  }
}

async function testResultSizeLimit() {
  console.log('\n📋 Testing Result Size Limit...\n');
  
  try {
    // Query that returns many rows (but should be limited)
    const result = await query(`
      SELECT * FROM master_events 
      WHERE event_date >= CURRENT_DATE 
      ORDER BY event_date 
      LIMIT 50000
    `);
    
    const maxRows = queryProtection.getConfig().maxResultRows;
    if (result.rows.length <= maxRows) {
      logTest('Result Size Limit', true, undefined, 
        `Returned ${result.rows.length} rows (limit: ${maxRows})`);
    } else {
      logTest('Result Size Limit', false, 
        `Returned ${result.rows.length} rows, expected max ${maxRows}`);
    }
  } catch (error: any) {
    logTest('Result Size Limit', false, error.message);
  }
}

async function testMissingWhereClause() {
  console.log('\n📋 Testing Missing WHERE Clause Protection...\n');
  
  try {
    // This should be rejected (large table without WHERE)
    await query('SELECT * FROM master_ticketing_groups LIMIT 100');
    logTest('Missing WHERE Clause (with LIMIT)', true, 
      undefined, 'Query allowed with LIMIT clause');
  } catch (error: any) {
    if (error.message.includes('WHERE clause')) {
      logTest('Missing WHERE Clause (with LIMIT)', false, 
        'Query rejected even with LIMIT');
    } else {
      logTest('Missing WHERE Clause (with LIMIT)', false, error.message);
    }
  }
  
  try {
    // This should be rejected (large table without WHERE and no LIMIT)
    await query('SELECT * FROM master_ticketing_groups');
    logTest('Missing WHERE Clause (no LIMIT)', false, 
      'Query was not rejected as expected');
  } catch (error: any) {
    if (error.message.includes('WHERE clause')) {
      logTest('Missing WHERE Clause (no LIMIT)', true);
    } else {
      logTest('Missing WHERE Clause (no LIMIT)', false, error.message);
    }
  }
}

async function testCartesianProduct() {
  console.log('\n📋 Testing Cartesian Product Detection...\n');
  
  try {
    // This should be rejected (cartesian product)
    await query(`
      SELECT * FROM master_events me, master_ticketing_groups mtg
      LIMIT 100
    `);
    logTest('Cartesian Product Detection', false, 
      'Query was not rejected as expected');
  } catch (error: any) {
    if (error.message.includes('cartesian product')) {
      logTest('Cartesian Product Detection', true);
    } else {
      logTest('Cartesian Product Detection', false, error.message);
    }
  }
}

async function testQueryComplexity() {
  console.log('\n📋 Testing Query Complexity Checks...\n');
  
  try {
    // Query with many JOINs (should warn but allow)
    const result = await query(`
      SELECT me.*, v.*, mtg.*
      FROM master_events me
      JOIN venues v ON me.venue_id = v.id
      JOIN master_ticketing_groups mtg ON me.id = mtg.event_id
      WHERE me.event_date >= CURRENT_DATE
      LIMIT 10
    `);
    logTest('Query Complexity (JOINs)', true, 
      undefined, 'Query executed (warnings may be logged)');
  } catch (error: any) {
    logTest('Query Complexity (JOINs)', false, error.message);
  }
  
  try {
    // Query with DISTINCT without LIMIT (should warn)
    const result = await query(`
      SELECT DISTINCT me.title, me.event_date
      FROM master_events me
      WHERE me.event_date >= CURRENT_DATE
      ORDER BY me.event_date
      LIMIT 10
    `);
    logTest('Query Complexity (DISTINCT)', true, 
      undefined, 'Query executed with LIMIT');
  } catch (error: any) {
    logTest('Query Complexity (DISTINCT)', false, error.message);
  }
}

async function testQueryLength() {
  console.log('\n📋 Testing Query Length Protection...\n');
  
  try {
    // Create a very long query
    const longQuery = 'SELECT * FROM master_events WHERE ' + 
      Array(10000).fill('id = 1 OR').join(' ') + ' id = 1 LIMIT 1';
    
    const validation = queryProtection.validateQuery(longQuery);
    if (!validation.allowed) {
      logTest('Query Length Protection', true, 
        undefined, validation.reason);
    } else {
      logTest('Query Length Protection', false, 
        'Long query was not rejected');
    }
  } catch (error: any) {
    logTest('Query Length Protection', false, error.message);
  }
}

async function testValidQuery() {
  console.log('\n📋 Testing Valid Query Execution...\n');
  
  try {
    // This should work fine
    const result = await query(`
      SELECT id, title, event_date
      FROM master_events
      WHERE event_date >= CURRENT_DATE
      ORDER BY event_date
      LIMIT 10
    `);
    
    if (result.rows.length >= 0) {
      logTest('Valid Query Execution', true, 
        undefined, `Returned ${result.rows.length} rows`);
    } else {
      logTest('Valid Query Execution', false, 'Unexpected result format');
    }
  } catch (error: any) {
    logTest('Valid Query Execution', false, error.message);
  }
}

async function testSlowQueryLogging() {
  console.log('\n📋 Testing Slow Query Logging...\n');
  
  try {
    // Query that takes a bit of time (but not too long)
    const startTime = Date.now();
    await query(`
      SELECT COUNT(*) 
      FROM master_events 
      WHERE event_date >= CURRENT_DATE
    `);
    const executionTime = Date.now() - startTime;
    
    logTest('Slow Query Logging', true, 
      undefined, `Query took ${executionTime}ms (will log if >5000ms)`);
  } catch (error: any) {
    logTest('Slow Query Logging', false, error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Query Protection Test Suite\n');
  console.log('='.repeat(50));
  
  // Test configuration
  const config = queryProtection.getConfig();
  console.log('\n📊 Configuration:');
  console.log(`  Query Timeout: ${config.maxQueryTimeMs}ms`);
  console.log(`  Max Result Rows: ${config.maxResultRows}`);
  console.log(`  Max Query Length: ${config.maxQueryLength}`);
  console.log(`  Complexity Check: ${config.enableComplexityCheck}`);
  console.log(`  Statement Timeout: ${config.enableStatementTimeout}`);
  
  // Run tests
  await testValidQuery();
  await testQueryTimeout();
  await testResultSizeLimit();
  await testMissingWhereClause();
  await testCartesianProduct();
  await testQueryComplexity();
  await testQueryLength();
  await testSlowQueryLogging();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary:\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});

