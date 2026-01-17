/**
 * Chat API Routes - ChatGPT-like interface
 */

import { Router, Request, Response } from 'express';
import { chatService, ChatRequest } from '../services/chatService';

const router = Router();

/**
 * POST /api/chat
 * Main chat endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      message, 
      conversation_id, 
      messages, 
      include_web_search, 
      include_db_search,
      user_location,
      user_city,
      user_state,
      user_country
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required and must be a string'
      });
    }

    const chatRequest: ChatRequest = {
      message,
      conversation_id,
      messages,
      include_web_search: include_web_search !== false, // Default true
      include_db_search: include_db_search !== false,    // Default true
      user_location,
      user_city,
      user_state,
      user_country
    };

    const response = await chatService.processChat(chatRequest);

    res.json({
      ...response,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/chat/history/:conversation_id
 * Get conversation history
 */
router.get('/history/:conversation_id', async (req: Request, res: Response) => {
  try {
    const { conversation_id } = req.params;
    const history = chatService.getConversationHistory(conversation_id);

    res.json({
      conversation_id,
      messages: history,
      count: history.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/chat/history/:conversation_id
 * Clear conversation history
 */
router.delete('/history/:conversation_id', async (req: Request, res: Response) => {
  try {
    const { conversation_id } = req.params;
    chatService.clearConversation(conversation_id);

    res.json({
      message: 'Conversation cleared',
      conversation_id
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export { router as chatRouter };

