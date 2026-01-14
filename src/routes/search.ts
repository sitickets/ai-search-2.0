import { Router, Request, Response } from 'express';
import { mpcService, MPCQuery } from '../services/mpcService';
import { searchTickets } from '../services/search/ticketSearch';
import { searchEvents } from '../services/search/eventSearch';
import { searchByPrice } from '../services/search/priceSearch';
import { searchByLocation } from '../services/search/locationSearch';

const router = Router();

/**
 * POST /api/search
 * Natural language search endpoint (MPC)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { query, conversation_id, context } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    const mpcQuery: MPCQuery = {
      query,
      conversationId: conversation_id,
      context
    };

    const response = await mpcService.processQuery(mpcQuery);

    res.json({
      query,
      conversation_id: conversation_id || null,
      ...response,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/search/tickets
 * Direct ticket search endpoint
 */
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const results = await searchTickets(req.body);
    res.json({
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/search/events
 * Direct event search endpoint
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const results = await searchEvents(req.body);
    res.json({
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/search/price
 * Direct price search endpoint
 */
router.post('/price', async (req: Request, res: Response) => {
  try {
    const results = await searchByPrice(req.body);
    res.json({
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/search/location
 * Direct location search endpoint
 */
router.post('/location', async (req: Request, res: Response) => {
  try {
    const results = await searchByLocation(req.body);
    res.json({
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/search/history
 * Get search history for a conversation
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { conversation_id } = req.query;

    // TODO: Implement search history retrieval from database
    res.json({
      conversation_id: conversation_id || null,
      history: [],
      message: 'History functionality coming soon...'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export { router as searchRouter };
