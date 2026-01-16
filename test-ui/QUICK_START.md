# Quick Start Guide

## 1. Start Serverless Offline (API Backend)

In the parent directory (`ai-search-2.0`):

```bash
cd /Users/seniormike/git/sitickets/marketplace/ai-search-2.0
npm run offline
```

This starts the Lambda API on `http://localhost:4000`

## 2. Start Next.js UI

In this directory (`test-ui`):

```bash
cd test-ui
npm run dev
```

This starts the UI on `http://localhost:5001`

## 3. Open Browser

Navigate to: http://localhost:3001

## 4. Test Chat

Try queries like:
- "Find tickets for Taylor Swift"
- "What events are happening in New York?"
- "Show me cheap tickets under $50"
- "Tell me about concerts in Los Angeles"

## Troubleshooting

### API not responding
- Make sure serverless offline is running on port 4000
- Check `.env` file has `LLM_BASE_URL` set to your Ollama endpoint
- Check Ollama is running and accessible

### UI not loading
- Make sure Next.js dev server is running on port 5001
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` in `.env.local` is set to `http://localhost:4000`

