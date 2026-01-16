/**
 * Serverless handler for Next.js UI
 * Serves the Next.js app via serverless-http
 */

import serverless from 'serverless-http';
import next from 'next';

const app = next({ dev: false });
const handler = serverless(app.getRequestHandler());

export { handler };

