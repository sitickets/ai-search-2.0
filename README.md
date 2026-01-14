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

- **Backend**: Node.js/TypeScript with Express
- **Database**: PostgreSQL (UAT - Read Only)
- **LLM Integration**: OpenAI GPT-4 for natural language understanding (optional)
- **Search Services**: Specialized services for tickets, events, prices, locations
- **MPC Service**: Orchestrates natural language queries and routes to appropriate search services

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

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and OpenAI API key (optional)

# Run development server
npm run dev
```

## Environment Variables

See `.env.example` for required configuration:
- `POSTGRES_DATABASE_URL` - PostgreSQL connection string (required)
- `OPENAI_API_KEY` - OpenAI API key for LLM (optional, for enhanced NLP)
- `AWS_REGION` - AWS region (us-east-1)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start

# Test database connection
npm run test:connection
```

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
├── index.ts                 # Main entry point
├── routes/
│   ├── health.ts            # Health check endpoint
│   └── search.ts            # Search API endpoints
└── services/
    ├── database.ts          # Database connection and utilities
    ├── mpcService.ts        # MPC orchestration service
    └── search/
        ├── ticketSearch.ts  # Ticket search service
        ├── eventSearch.ts   # Event search service
        ├── priceSearch.ts   # Price search service
        └── locationSearch.ts # Location search service
```

## License

Proprietary - SiTickets Internal Use Only
