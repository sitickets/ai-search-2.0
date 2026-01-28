/**
 * Lambda Handler for AI Search 2.0
 * Wraps Express app for serverless deployment
 */

import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchRouter } from './routes/search';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { typeaheadRouter } from './routes/typeahead';
import { config } from './config/env';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin() === '*' ? '*' : config.cors.origin().split(','),
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/typeahead', typeaheadRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Search 2.0',
    version: '1.0.0',
    description: 'Smart search tool for ticketing data',
    endpoints: {
      health: '/api/health',
      search: '/api/search',
      chat: '/api/chat',
      typeahead: '/api/typeahead'
    }
  });
});

// Export Lambda handler
export const handler = serverless(app);

