/**
 * Simple static file server for test UI
 * Serves HTML/JS/CSS files without requiring Next.js build
 */

const serverless = require('serverless-http');
const express = require('express');
const path = require('path');

const app = express();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export handler for serverless
module.exports.handler = serverless(app);

