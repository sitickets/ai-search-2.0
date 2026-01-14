/**
 * Database Service
 * Manages PostgreSQL connection pool and provides database utilities
 */

import { Pool, PoolClient } from 'pg';
import { config } from '../config/env';

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

export async function query(text: string, params?: any[]) {
  const pool = getPool();
  return await pool.query(text, params);
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

