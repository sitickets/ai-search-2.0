# AI Search 2.0

Smart search tool with ChatGPT-like interface for querying ticketing data from the SiTickets marketplace database.

## Overview

AI Search 2.0 provides a conversational interface to search through ticket/seat data in the UAT PostgreSQL database, with web-based contextual data enhancement.

## Features

- **Natural Language Queries**: Ask questions in plain English about tickets, seats, orders, events
- **PostgreSQL Integration**: Direct connection to UAT database for real-time data
- **MPC Server**: Model-Powered Chat server for intelligent search
- **Multi-Dimensional Search**:
  - **Tickets**: Search by event, performer, venue, section, row, price
  - **Events**: Search by performer, type, popularity, location, date
  - **Price**: Search by price range, get price statistics
  - **Location**: Search by city, state, venue, zip code
- **Web Context Enhancement**: Uses web search for additional contextual information (coming soon)
- **Chat-like Interface**: Conversational experience similar to ChatGPT
- **Read-Only Access**: Safe read-only queries against production-like data

## Architecture

- **Backend**: Node.js/TypeScript with Express (can run as Express server or AWS Lambda)
- **Database**: PostgreSQL (UAT - Read Only) via RDS
- **LLM Integration**: 
  - **Ollama** (self-hosted on EC2) - Recommended for open-source stack
  - **OpenAI GPT-4** - Optional cloud LLM
  - **Anthropic Claude** - Optional cloud LLM
- **Search Services**: Specialized services for tickets, events, prices, locations
- **MPC Service**: Orchestrates natural language queries and routes to appropriate search services
- **Deployment**: Supports both traditional Express server and AWS Lambda (serverless)

## Database Connection

Uses read-only connection to UAT PostgreSQL database:
- **Host**: `uat-sitickets-aurora-cluster.cluster-cmzvajts10ys.us-east-1.rds.amazonaws.com`
- **Database**: `uat`
- **Port**: `5432`
- **Connection**: See `connections.md` in parent directory

## Key Tables

- `tickets_orders` - Ticket orders
- `tickets_orders_items` - Order line items with seat details
- `master_ticketing_groups` - Master ticketing groups (100M+ rows)
- `master_events` - Event data (800K+ rows)
- `carts` - Shopping carts
- `boxoffice.tickets` - Box office tickets
- `boxoffice.ticket_groups` - Box office ticket groups
- `venues` - Venue information with location data

## API Endpoints

### Natural Language Search
```
POST /api/search
Body: { query: "Find tickets for Taylor Swift under $200", conversation_id?: string }
```

### Direct Search Endpoints

**Tickets**
```
POST /api/search/tickets
Body: { eventId?, performer?, venue?, location?, priceMin?, priceMax?, dateFrom?, dateTo?, section?, row?, quantity?, limit? }
```

**Events**
```
POST /api/search/events
Body: { performer?, eventType?, location?, city?, state?, venue?, dateFrom?, dateTo?, popularityMin?, limit? }
```

**Price**
```
POST /api/search/price
Body: { minPrice?, maxPrice?, eventId?, performer?, location?, dateFrom?, dateTo?, limit? }
```

**Location**
```
POST /api/search/location
Body: { city?, state?, venue?, zipCode?, dateFrom?, dateTo?, limit? }
```

**Health Check**
```
GET /api/health
```

## Getting Started

### Local Development (Express Server)

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and LLM configuration

# Run development server
npm run dev
```

### Serverless Deployment (AWS Lambda)

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and LLM configuration

# Build TypeScript
npm run build

# Deploy to AWS Lambda
npm run deploy          # Deploy to default stage
npm run deploy:dev      # Deploy to dev stage
npm run deploy:prod     # Deploy to prod stage

# Test locally with serverless-offline
npm run offline
```

## Environment Variables

See `.env.example` for complete configuration. Key variables:

### Required
- `POSTGRES_DATABASE_URL` - PostgreSQL connection string (required)

### LLM Configuration (Ollama - Recommended)
- `LLM_BASE_URL` - Ollama server URL (e.g., `http://ec2-instance:11434` or `http://localhost:11434`)
- `LLM_MODEL` - Ollama model name (default: `llama3.2:3b`)
- Legacy support: `OLLAMA_BASE_URL` and `OLLAMA_MODEL` also work

**Note**: The project is configured to work with the same Ollama server used by `jira-feature-documentor`. If you have Ollama running on EC2 for that project, you can use the same `LLM_BASE_URL` and `LLM_MODEL` values.

### Optional LLM Providers
- `OPENAI_API_KEY` - OpenAI API key (optional, for cloud LLM)
- `ANTHROPIC_API_KEY` - Anthropic API key (optional, for cloud LLM)

### AWS Configuration
- `AWS_REGION` - AWS region (default: us-east-1)
- `AWS_ACCESS_KEY_ID` - AWS access key (for Lambda deployment)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (for Lambda deployment)

### Server Configuration
- `PORT` - Server port (default: 3000, not used in Lambda)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - CORS allowed origins (default: *)

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build

# Start production server (Express)
npm start

# Test database connection
npm run test:connection

# Run serverless offline (for Lambda testing)
npm run offline
```

## Serverless Deployment

The project can be deployed as an AWS Lambda function using the Serverless Framework.

### Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js 20.x
- Serverless Framework installed globally: `npm install -g serverless`

### Deployment Steps

1. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Build TypeScript**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   # Deploy to dev stage
   npm run deploy:dev
   
   # Deploy to prod stage
   npm run deploy:prod
   ```

4. **Test Locally**
   ```bash
   npm run offline
   # Server runs on http://localhost:3000
   ```

### Lambda Configuration

The `serverless.yml` file automatically reads environment variables from `.env` using `serverless-dotenv-plugin`. All environment variables defined in `.env` will be available in Lambda.

### VPC Configuration (Optional)

If your Ollama server or RDS database requires VPC access, uncomment the VPC section in `serverless.yml` and set:
- `LAMBDA_SECURITY_GROUP_ID`
- `LAMBDA_SUBNET_ID_1`
- `LAMBDA_SUBNET_ID_2`

**Note**: VPC configuration increases Lambda cold start times (10-15 seconds). Only enable if required.

### Using Shared Ollama Server

If you're using the same Ollama EC2 instance as `jira-feature-documentor`:

1. Get the Ollama endpoint from that project's Terraform output:
   ```bash
   cd ../jira-feature-documentor/deploy/terraform
   terraform output ollama_endpoint
   ```

2. Set `LLM_BASE_URL` in your `.env`:
   ```bash
   LLM_BASE_URL=http://<ollama-endpoint>:11434
   LLM_MODEL=llama3.2:3b
   ```

3. If Lambda needs VPC access, configure VPC settings in `serverless.yml` (see above).

## Example Queries

### Natural Language
- "Find tickets for Taylor Swift concerts under $200"
- "Show me events in New York this month"
- "What are the cheapest tickets available?"
- "Find concerts in Los Angeles next week"

### Direct API Calls
```bash
# Search for tickets
curl -X POST http://localhost:3000/api/search/tickets \
  -H "Content-Type: application/json" \
  -d '{"performer": "Taylor Swift", "priceMax": 200}'

# Search for events
curl -X POST http://localhost:3000/api/search/events \
  -H "Content-Type: application/json" \
  -d '{"city": "New York", "dateFrom": "2024-01-01"}'
```

## Project Structure

```
src/
├── index.ts                 # Express server entry point
├── handler.ts              # Lambda handler wrapper
├── config/
│   └── env.ts              # Environment configuration
├── routes/
│   ├── health.ts            # Health check endpoint
│   └── search.ts            # Search API endpoints
└── services/
    ├── database.ts          # Database connection and utilities
    ├── mpcService.ts        # MPC orchestration service
    ├── webSearch.ts         # Web search service
    ├── enhancedSearch.ts    # Enhanced search with web context
    └── search/
        ├── ticketSearch.ts  # Ticket search service
        ├── eventSearch.ts   # Event search service
        ├── priceSearch.ts   # Price search service
        └── locationSearch.ts # Location search service
serverless.yml               # Serverless Framework configuration
.env.example                 # Environment variables template
```

## License

Proprietary - SiTickets Internal Use Only
