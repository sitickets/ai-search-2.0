/**
 * Database Service
 * Manages PostgreSQL connection pool and provides database utilities
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config/env';
import { queryProtection } from './queryProtection';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const dbConfig = config.database;
    
    if (!dbConfig.url()) {
      throw new Error('POSTGRES_DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: dbConfig.url(),
      ssl: {
        rejectUnauthorized: false
      },
      max: dbConfig.poolMax(),
      idleTimeoutMillis: dbConfig.poolIdleTimeout(),
      connectionTimeoutMillis: dbConfig.poolConnectionTimeout(),
      // Note: query timeout is handled in the query() function via Promise.race
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute query with protection against slow/unoptimized queries
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const pool = getPool();
  const startTime = Date.now();

  // 1. Validate query before execution
  const validation = queryProtection.validateQuery(text, params);
  if (!validation.allowed) {
    throw new Error(`Query rejected: ${validation.reason}`);
  }

  // Log warnings if any
  if (validation.warnings && validation.warnings.length > 0) {
    console.warn('Query warnings:', validation.warnings);
  }

  try {
    // 2. Set statement timeout if enabled
    const timeoutSql = queryProtection.getStatementTimeoutSql();
    if (timeoutSql) {
      await pool.query(timeoutSql);
    }

    // 3. Execute query with timeout
    const queryPromise = pool.query(text, params);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout: exceeded ${queryProtection.getConfig().maxQueryTimeMs}ms`));
      }, queryProtection.getConfig().maxQueryTimeMs);
    });
    
    const result = await Promise.race([queryPromise, timeoutPromise]);

    // 4. Check execution time
    const executionTime = Date.now() - startTime;
    if (executionTime > 5000) { // Log slow queries (>5 seconds)
      console.warn(`Slow query detected: ${executionTime}ms`, {
        query: text.substring(0, 200), // Log first 200 chars
        params: params?.length || 0
      });
    }

    // 5. Limit result set size
    if (result.rows && result.rows.length > queryProtection.getConfig().maxResultRows) {
      console.warn(`Result set truncated from ${result.rows.length} to ${queryProtection.getConfig().maxResultRows} rows`);
      result.rows = result.rows.slice(0, queryProtection.getConfig().maxResultRows);
      result.rowCount = result.rows.length;
    }

    return result;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error('Query error:', {
      error: error.message,
      executionTime: `${executionTime}ms`,
      query: text.substring(0, 200),
      params: params?.length || 0
    });
    throw error;
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Get database schema information for SQL Agent
 */
export async function getSchemaInfo(): Promise<string> {
  const result = await query(`
    SELECT 
      table_schema,
      table_name,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'boxoffice')
      AND table_name IN (
        'tickets_orders',
        'tickets_orders_items',
        'master_ticketing_groups',
        'master_events',
        'carts',
        'tickets_cart_items',
        'tickets',
        'ticket_groups',
        'event_zone',
        'event_zone_tiers',
        'public_users',
        'user_addresses'
      )
    ORDER BY table_schema, table_name, ordinal_position
  `);

  const schemaMap: Record<string, any[]> = {};
  
  result.rows.forEach(row => {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!schemaMap[key]) {
      schemaMap[key] = [];
    }
    schemaMap[key].push({
      column: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES'
    });
  });

  let schemaInfo = 'Database Schema:\n\n';
  Object.keys(schemaMap).forEach(table => {
    schemaInfo += `Table: ${table}\n`;
    schemaMap[table].forEach(col => {
      schemaInfo += `  - ${col.column} (${col.type}${col.nullable ? ', nullable' : ''})\n`;
    });
    schemaInfo += '\n';
  });

  return schemaInfo;
}

