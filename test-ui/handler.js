/**
 * Serverless handler for Next.js UI
 * Serves the Next.js app via serverless-http
 */

const serverless = require('serverless-http');
const next = require('next');

let app;
let handler;

// Initialize Next.js app (singleton pattern)
async function initApp() {
  if (!handler) {
    app = next({ 
      dev: false,
      conf: {
        distDir: '.next'
      }
    });
    await app.prepare();
    handler = serverless(app.getRequestHandler());
  }
  return handler;
}

// Export handler for serverless
module.exports.handler = async (event, context) => {
  const appHandler = await initApp();
  if (typeof appHandler !== 'function') {
    throw new Error('Handler is not a function. Next.js app may not be initialized correctly.');
  }
  return appHandler(event, context);
};

