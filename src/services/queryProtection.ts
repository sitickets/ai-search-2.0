/**
 * Query Protection Service
 * Protects against slow, unoptimized, or dangerous SQL queries
 */

export interface QueryProtectionConfig {
  maxQueryTimeMs: number;        // Maximum query execution time
  maxResultRows: number;          // Maximum rows to return
  maxQueryLength: number;         // Maximum query string length
  enableComplexityCheck: boolean; // Enable query complexity analysis
  enableStatementTimeout: boolean; // Enable PostgreSQL statement_timeout
}

export interface QueryProtectionResult {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
}

export class QueryProtectionService {
  private config: QueryProtectionConfig;

  constructor(config?: Partial<QueryProtectionConfig>) {
    this.config = {
      maxQueryTimeMs: parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000'), // 30 seconds default
      maxResultRows: parseInt(process.env.DB_MAX_RESULT_ROWS || '10000'),   // 10K rows max
      maxQueryLength: parseInt(process.env.DB_MAX_QUERY_LENGTH || '50000'), // 50KB query max
      enableComplexityCheck: process.env.DB_ENABLE_COMPLEXITY_CHECK !== 'false',
      enableStatementTimeout: process.env.DB_ENABLE_STATEMENT_TIMEOUT !== 'false',
      ...config
    };
  }

  /**
   * Validate query before execution
   */
  validateQuery(sql: string, params?: any[]): QueryProtectionResult {
    const warnings: string[] = [];
    const normalizedSql = sql.trim().toLowerCase();

    // 1. Check query length
    if (sql.length > this.config.maxQueryLength) {
      return {
        allowed: false,
        reason: `Query exceeds maximum length of ${this.config.maxQueryLength} characters (${sql.length} chars)`
      };
    }

    // 2. Check for dangerous patterns
    if (this.config.enableComplexityCheck) {
      const complexityCheck = this.checkQueryComplexity(normalizedSql);
      if (!complexityCheck.allowed) {
        return complexityCheck;
      }
      if (complexityCheck.warnings) {
        const warnArray = Array.isArray(complexityCheck.warnings) ? complexityCheck.warnings : [];
        warnings.push(...warnArray);
      }
    }

    // 3. Check for missing WHERE clause on large tables
    const missingWhereCheck = this.checkMissingWhereClause(normalizedSql);
    if (!missingWhereCheck.allowed) {
      return missingWhereCheck;
    }
    if (missingWhereCheck.warnings) {
      const warnArray = Array.isArray(missingWhereCheck.warnings) ? missingWhereCheck.warnings : [];
      warnings.push(...warnArray);
    }

    // 4. Check for potential cartesian products
    const cartesianCheck = this.checkCartesianProduct(normalizedSql);
    if (!cartesianCheck.allowed) {
      return cartesianCheck;
    }
    if (cartesianCheck.warnings) {
      const warnArray = Array.isArray(cartesianCheck.warnings) ? cartesianCheck.warnings : [];
      warnings.push(...warnArray);
    }

    return {
      allowed: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Check query complexity
   */
  private checkQueryComplexity(sql: string): QueryProtectionResult {
    const warnings: string[] = [];

    // Count JOINs - too many JOINs can be slow
    const joinCount = (sql.match(/\bjoin\b/g) || []).length;
    if (joinCount > 5) {
      warnings.push(`Query has ${joinCount} JOINs, which may be slow`);
    }

    // Check for subqueries - nested subqueries can be slow
    const subqueryCount = (sql.match(/\bselect\b.*\bselect\b/gi) || []).length;
    if (subqueryCount > 3) {
      warnings.push(`Query has ${subqueryCount} nested subqueries, which may be slow`);
    }

    // Check for UNIONs - can be expensive
    const unionCount = (sql.match(/\bunion\b/g) || []).length;
    if (unionCount > 2) {
      warnings.push(`Query has ${unionCount} UNIONs, which may be slow`);
    }

    // Check for DISTINCT on large result sets
    if (sql.includes('distinct') && !sql.includes('limit')) {
      warnings.push('DISTINCT without LIMIT may return many rows');
    }

    // Check for ORDER BY without LIMIT
    if (sql.includes('order by') && !sql.includes('limit')) {
      warnings.push('ORDER BY without LIMIT may be slow on large tables');
    }

    // Check for GROUP BY without HAVING or LIMIT
    if (sql.includes('group by') && !sql.includes('having') && !sql.includes('limit')) {
      warnings.push('GROUP BY without HAVING or LIMIT may return many rows');
    }

    // Check for LIKE patterns that start with % (can't use index)
    if (sql.match(/like\s+['"]%[^%]/gi)) {
      warnings.push('LIKE patterns starting with % cannot use indexes');
    }

    // Check for functions on indexed columns (can't use index)
    if (sql.match(/\bwhere\b.*\b(lower|upper|trim|substring|date_trunc|extract)\s*\(/gi)) {
      warnings.push('Functions on WHERE columns may prevent index usage');
    }

    return {
      allowed: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Check for missing WHERE clause on large tables
   */
  private checkMissingWhereClause(sql: string): QueryProtectionResult {
    // Large tables that should always have WHERE clauses
    const largeTables = [
      'master_ticketing_groups',
      'tickets_orders',
      'tickets_orders_items',
      'master_events'
    ];

    // Check if query targets large tables
    const targetsLargeTable = largeTables.some(table => 
      sql.includes(table) && !sql.includes('where')
    );

    if (targetsLargeTable) {
      // Allow if there's a LIMIT clause (still risky but better than nothing)
      if (sql.includes('limit')) {
        return {
          allowed: true,
          warnings: ['Query on large table without WHERE clause - ensure LIMIT is reasonable']
        };
      }
      
      return {
        allowed: false,
        reason: `Query targets large table without WHERE clause and no LIMIT. This could return millions of rows.`
      };
    }

    return { allowed: true };
  }

  /**
   * Check for potential cartesian products
   */
  private checkCartesianProduct(sql: string): QueryProtectionResult {
    // Count FROM/JOIN clauses
    const fromCount = (sql.match(/\bfrom\b/g) || []).length;
    const joinCount = (sql.match(/\bjoin\b/g) || []).length;
    const totalTables = fromCount + joinCount;

    // If multiple tables but no JOIN conditions, likely cartesian product
    if (totalTables > 1) {
      // Check for JOIN conditions
      const hasJoinCondition = sql.match(/\bjoin\b.*\bon\b/gi) || 
                               sql.match(/\bwhere\b.*\b=\b.*\b=/gi); // Implicit joins in WHERE

      if (!hasJoinCondition && totalTables > 1) {
        return {
          allowed: false,
          reason: 'Query appears to create a cartesian product (multiple tables without JOIN conditions)'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get PostgreSQL statement timeout SQL
   */
  getStatementTimeoutSql(): string {
    if (!this.config.enableStatementTimeout) {
      return '';
    }
    // Set statement timeout in milliseconds
    return `SET LOCAL statement_timeout = ${this.config.maxQueryTimeMs};`;
  }

  /**
   * Limit result set size
   */
  limitResults<T>(results: T[], maxRows?: number): T[] {
    const limit = maxRows || this.config.maxResultRows;
    if (results.length > limit) {
      console.warn(`Result set truncated from ${results.length} to ${limit} rows`);
      return results.slice(0, limit);
    }
    return results;
  }

  /**
   * Get configuration
   */
  getConfig(): QueryProtectionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const queryProtection = new QueryProtectionService();

