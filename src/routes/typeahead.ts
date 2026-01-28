/**
 * Typeahead API Routes
 * Provides search suggestions as user types
 */

import { Router, Request, Response } from 'express';
import { getTypeaheadSuggestions } from '../services/typeaheadService';

const router = Router();

/**
 * GET /api/typeahead
 * Get typeahead suggestions based on partial query
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { q, limit } = req.query;

  console.log(`[TYPEAHEAD] Request received: q="${q}", limit=${limit}, ip=${req.ip}`);

  try {
    if (!q || typeof q !== 'string') {
      console.warn(`[TYPEAHEAD] Invalid request: q=${q} (type: ${typeof q})`);
      return res.status(400).json({
        error: 'Query parameter "q" is required and must be a string'
      });
    }

    if (q.trim().length < 2) {
      console.log(`[TYPEAHEAD] Query too short: "${q}" (length: ${q.trim().length})`);
      return res.json({
        suggestions: [],
        query: q,
        timestamp: new Date().toISOString()
      });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 10;
    console.log(`[TYPEAHEAD] Fetching suggestions for "${q}" with limit ${limitNum}`);
    
    const result = await getTypeaheadSuggestions(q, limitNum);
    
    const executionTime = Date.now() - startTime;
    console.log(`[TYPEAHEAD] Success: Found ${result.suggestions.length} suggestions for "${q}" in ${executionTime}ms`);

    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`[TYPEAHEAD] Error after ${executionTime}ms:`, {
      error: error.message,
      stack: error.stack,
      query: q
    });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export { router as typeaheadRouter };

