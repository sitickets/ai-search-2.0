/**
 * AI Search 2.0 - Main Entry Point
 * Smart search tool with ChatGPT-like interface for ticketing data
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchRouter } from './routes/search';
import { healthRouter } from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
  console.log(`🚀 AI Search 2.0 server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

