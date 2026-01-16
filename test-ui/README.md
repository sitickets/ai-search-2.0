# AI Search 2.0 - Test UI (Serverless)

Simple Next.js chat UI running as a Serverless Lambda project for testing AI Search 2.0.

## Architecture

- **UI Lambda**: Serves Next.js app via `serverless-http`
- **API Lambda**: Handles chat/search requests
- **Ollama EC2**: Remote LLM server (configured in API's `.env`)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build Next.js app:
```bash
npm run build
```

## Running Locally

### Option 1: Start Both Services (Recommended)

From the parent directory (`ai-search-2.0`):
```bash
npm run start:dev
```

This starts both:
- API Lambda on `http://localhost:4000`
- UI Lambda on `http://localhost:5001`

### Option 2: Start UI Only

```bash
npm run offline
```

This starts UI Lambda on `http://localhost:5001`

**Note**: Make sure API Lambda is running on port 4000 for the UI to work.

## Configuration

### Ports (configured in `serverless.yml`):
- **httpPort**: 5001 (UI web server)
- **lambdaPort**: 5002 (Lambda runtime)

### Environment Variables:
- `NEXT_PUBLIC_API_URL`: API endpoint (defaults to `http://localhost:4000` in dev)

## How It Works

1. **UI (port 5001)**: Next.js app served via serverless-http
2. **UI → API**: Connects to local API Lambda on `localhost:4000`
3. **API → Ollama**: Connects to remote Ollama EC2 (from `.env` in API project)

## Deployment

```bash
npm run deploy
```

Deploys UI Lambda to AWS.
