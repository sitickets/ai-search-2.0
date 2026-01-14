# AI Search 2.0

Smart search tool with ChatGPT-like interface for querying ticketing data from the SiTickets marketplace database.

## Overview

AI Search 2.0 provides a conversational interface to search through ticket/seat data in the UAT PostgreSQL database, with web-based contextual data enhancement.

## Features

- **Natural Language Queries**: Ask questions in plain English about tickets, seats, orders, events
- **PostgreSQL Integration**: Direct connection to UAT database for real-time data
- **Web Context Enhancement**: Uses web search for additional contextual information
- **Chat-like Interface**: Conversational experience similar to ChatGPT
- **Read-Only Access**: Safe read-only queries against production-like data

## Architecture

- **Backend**: Node.js/TypeScript with PostgreSQL connection
- **LLM Integration**: OpenAI/Anthropic for natural language understanding
- **Vector Database**: For schema/domain knowledge (optional)
- **SQL Query Engine**: LangChain SQL Agent for generating queries
- **Web Search**: Integration for contextual data enhancement

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

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run development server
npm run dev
```

## Environment Variables

See `.env.example` for required configuration:
- `POSTGRES_DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for LLM
- `AWS_REGION` - AWS region (us-east-1)

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

## License

Proprietary - SiTickets Internal Use Only

