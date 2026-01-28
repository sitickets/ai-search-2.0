/**
 * Simple Query Protection Test
 * Quick test to verify protection is working
 */

import { query } from '../services/database';
import { queryProtection } from '../services/queryProtection';

async function main() {
  console.log('🧪 Quick Query Protection Test\n');
  
  // Show configuration
  const config = queryProtection.getConfig();
  console.log('Configuration:');
  console.log(`  Timeout: ${config.maxQueryTimeMs}ms`);
  console.log(`  Max Rows: ${config.maxResultRows}`);
  console.log(`  Max Length: ${config.maxQueryLength}\n`);
  
  // Test 1: Valid query
  console.log('Test 1: Valid query...');
  try {
    const result = await query(`
      SELECT id, title, event_date
      FROM master_events
      WHERE event_date >= CURRENT_DATE
      LIMIT 5
    `);
    console.log(`✅ Passed: Returned ${result.rows.length} rows\n`);
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
  
  // Test 2: Missing WHERE clause (should be rejected)
  console.log('Test 2: Missing WHERE clause (should be rejected)...');
  try {
    await query('SELECT * FROM master_ticketing_groups');
    console.log('❌ Failed: Query was not rejected\n');
  } catch (error: any) {
    if (error.message.includes('WHERE clause')) {
      console.log(`✅ Passed: Query correctly rejected\n`);
    } else {
      console.log(`⚠️  Unexpected error: ${error.message}\n`);
    }
  }
  
  // Test 3: Query validation
  console.log('Test 3: Query validation...');
  const validation = queryProtection.validateQuery(`
    SELECT * FROM master_events 
    WHERE event_date >= CURRENT_DATE 
    LIMIT 10
  `);
  if (validation.allowed) {
    console.log('✅ Passed: Query validation passed\n');
  } else {
    console.log(`❌ Failed: ${validation.reason}\n`);
  }
  
  // Test 4: Result size limit
  console.log('Test 4: Result size limit...');
  try {
    const result = await query(`
      SELECT * FROM master_events 
      WHERE event_date >= CURRENT_DATE 
      LIMIT 50000
    `);
    const maxRows = config.maxResultRows;
    if (result.rows.length <= maxRows) {
      console.log(`✅ Passed: Results limited to ${result.rows.length} rows (max: ${maxRows})\n`);
    } else {
      console.log(`❌ Failed: Results not limited (${result.rows.length} > ${maxRows})\n`);
    }
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
  
  console.log('✅ All tests completed!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

