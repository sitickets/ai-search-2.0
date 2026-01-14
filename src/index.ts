/**
 * AI Search 2.0 - Main Entry Point
 * Smart search tool with ChatGPT-like interface for ticketing data
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchRouter } from './routes/search';
import { healthRouter } from './routes/health';
import { config } from './config/env';

// Load environment variables
dotenv.config();

const app = express();
const PORT = config.server.port();

// Middleware
app.use(cors({
  origin: config.cors.origin() === '*' ? '*' : config.cors.origin().split(','),
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/search', searchRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Search 2.0',
    version: '1.0.0',
    description: 'Smart search tool for ticketing data',
    endpoints: {
      health: '/api/health',
      search: '/api/search'
    }
  });
});

// Start server
app.listen(PORT, () => {
  const host = process.env.HOST || 'localhost';
  console.log(`🚀 AI Search 2.0 server running on port ${PORT}`);
  console.log(`📊 Environment: ${config.server.nodeEnv()}`);
  console.log(`🔗 Health check: http://${host}:${PORT}/api/health`);
});

