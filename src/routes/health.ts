import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

// Initialize database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

router.get('/', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await pool.query('SELECT NOW() as current_time, current_database() as database');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        database: dbResult.rows[0].database,
        serverTime: dbResult.rows[0].current_time
      },
      version: '1.0.0'
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message
      },
      version: '1.0.0'
    });
  }
});

export { router as healthRouter };

