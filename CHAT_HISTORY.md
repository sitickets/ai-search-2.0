# Chat History - AI Search 2.0 Development Session

## Session Date: December 18, 2024

---

## Task 1: Initial Request - Smart Search Tool

**User:** I want to build smart search tool chatgpt like interface to search through the ticketing data for the database and marketplace these repos work upon - how can I best do that with some form of MPC server and interface? just answer dont build

**Response:** Provided architecture recommendation:
- RAG (Retrieval Augmented Generation) approach
- Components: Chat Interface, LLM Service Layer, Vector Database, SQL Query Engine, Query Result Processor
- Technology stack options: Cloud-based (OpenAI/Pinecone), Self-hosted (Llama/Ollama), Hybrid
- Flow: User Query → LLM Service → Context Retrieval → Vector DB + SQL Query Engine → LLM + Context + Results → Natural Language Response

---

## Task 2: Backend Focus - Database Connection

**User:** lets work on the back end for now and simplify we are in AWS , the DB is RDS postgress and the data that is relevant would be ticket/seat data - do you still have the connection strings and logistics for the QA or UAT DB ?

**Response:** Found database configuration patterns but no actual connection strings. Identified:
- PostgreSQL configuration in `lunatix/config/database.php`
- Environment variables: DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD
- Ticket/seat tables: tickets_orders, tickets_orders_items, master_ticketing_groups, etc.
- Need: RDS endpoint, credentials, VPC/security group info

---

## Task 3: Search for Connection Strings

**User:** look through all of the repositories in this workspace as well as going up one directory then look inside all repos in boe dir and see if there are any connection string and credentials for the DBs

**Response:** Searched all repos and found:
- PostgreSQL configs in multiple BOE repos
- MySQL Aurora endpoints for DEV environments:
  - DEV: `bo-ent-dev-rds-db-cluster.cluster-cxvmfvm8jonl.us-west-2.rds.amazonaws.com`
  - SI-DEV: `hn-dev-rds-db-cluster.cluster-ca80jjtsce47.us-west-2.rds.amazonaws.com`
- PostgreSQL uses `POSTGRES_DATABASE_URL` environment variable pattern
- Created `database_connections_summary.md` with findings

---

## Task 4: Add PostgreSQL Config to Connections File

**User:** add the PostGres connection config to the connections file that is here make it an md

**Response:** 
- Created `connections.md` with PostgreSQL connection configuration
- Included connection string formats, environment variables, code examples
- Added key tables for ticket/seat data
- Included security notes and AWS RDS details

---

## Task 5: Test Database Connections

**User:** run a test with config in connections Lunatix/Marketplace:

**Response:** Created `test-postgres-connection.js` and tested UAT connection:
- **Result:** Failed with password authentication error
- Updated test script with better error handling

**User:** try again both the one for the sandbox

**Response:** Updated test script to test both UAT and Sandbox:
- **UAT:** Success! Connected, found 413 tables, 30+ ticket/seat related tables
- **Sandbox:** Success! Connected, but empty database (0 tables)
- Both databases accessible with provided credentials

---

## Task 6: Database Comparison

**User:** is the same amount of data in both databases

**Response:** Created `compare-databases.js`:
- **UAT:** 501 tables, ~685.8M rows, 654 GB
- **Sandbox:** 0 tables, empty database
- **Conclusion:** Very different - UAT has production-like data, Sandbox is empty

**User:** ok is the connection read only?

**Response:** Created `test-readonly.js`:
- **UAT:** Read-only (cannot INSERT/UPDATE/DELETE)
- **Sandbox:** Write access (can create tables, INSERT, UPDATE, DELETE)
- **Conclusion:** UAT is read-only (safe for search), Sandbox has full access

---

## Task 7: Create AI Search 2.0 Repository

**User:** ok so lets build the smart search chat like search ontop of the UAT DB and also lets use the web for additional contextual data - to start with create a git repo in this workspace called ai-search-2.0 inside - look in all repos here and in boe or locally on os to see how to connect to git and create or store the repo

**Response:** 
- Found git pattern: `https://ghp_TOKEN@github.com/sitickets/REPO_NAME.git`
- Created `ai-search-2.0` repository structure:
  - Express.js server with TypeScript
  - PostgreSQL connection service
  - Health check endpoint
  - Search endpoint placeholder
  - Package.json with dependencies
  - README.md, .gitignore, tsconfig.json
- Initialized git repo, configured remote
- Committed initial structure

---

## Task 8: Build MPC Server with Search Capabilities

**User:** ok so now we want to create an MPC server that enables search of tickets, price, location and event data like performer, popularity , type of concert etc

**Response:** Created comprehensive MPC server with:
- **Database Service** (`database.ts`): Connection pool, schema info
- **Search Services:**
  - `ticketSearch.ts`: Search tickets by event, performer, venue, price, date, section, row
  - `eventSearch.ts`: Search events by performer, type, location, popularity, date
  - `priceSearch.ts`: Search by price range, get price statistics
  - `locationSearch.ts`: Search by city, state, venue, zip code
- **MPC Service** (`mpcService.ts`): Orchestrates natural language queries
- **Search Routes** (`search.ts`): API endpoints for all search types
- **Web Search Integration** (`webSearch.ts`): SerpAPI, Google, DuckDuckGo
- **Enhanced Search** (`enhancedSearch.ts`): Combines DB + web results

**API Endpoints Created:**
- `POST /api/search` - Natural language MPC query
- `POST /api/search/tickets` - Direct ticket search
- `POST /api/search/events` - Direct event search
- `POST /api/search/price` - Direct price search
- `POST /api/search/location` - Direct location search
- `POST /api/search/enhanced` - Enhanced search with web context
- `POST /api/search/web` - Direct web search
- `GET /api/health` - Health check

---

## Task 9: Web Search Explanation

**User:** how will it search the web too

**Response:** Explained web search integration:
- **Multi-provider support:** SerpAPI (primary), Google Custom Search (fallback), DuckDuckGo (free fallback)
- **Enhanced search flow:** User Query → Database Search → Web Search → Combined Results
- **Context enhancement:** Performer info (bio, genres, popularity), Event info (descriptions, reviews), Venue info (capacity, address)
- **New services:** `webSearch.ts` and `enhancedSearch.ts`
- **New endpoints:** `/api/search/enhanced` and `/api/search/web`

---

## Task 10: MPC Explanation

**User:** can you explain how this is a "MPC" server

**Response:** Created `docs/MPC_EXPLANATION.md`:
- **Current status:** "MPC-ready" but not true MPC
- **What we have:** Keyword-based detection, predefined SQL, no conversational memory
- **What's missing:** LLM query understanding, SQL Agent, conversational memory, LLM response formatting
- **Current flow:** Keyword Matching → Predefined SQL → Results
- **True MPC flow:** LLM Understanding → LLM Generates SQL → Results → LLM Formats Answer

---

## Task 11: True MPC Implementation Approach

**User:** what could we do to make it a true MPC LLM based

**Response:** Created `docs/TRUE_MPC_APPROACH.md` with detailed approach:
1. LLM-Powered Query Understanding (replace keywords)
2. LangChain SQL Agent (replace predefined SQL)
3. Conversational Memory (add context tracking)
4. LLM Response Formatting (natural language answers)
5. RAG for Schema Context (optional)
6. Hybrid Approach (best of both worlds)

**User:** this doesnt explain it well enough - explain from a code and component perspective what needs to be implemented to make it a true MPC LLM based smart search keep it simple

**Response:** Created `docs/SIMPLE_MPC_COMPONENTS.md`:
- **4 Components to Build:**
  1. LLMIntentAnalyzer → Replaces regex with LLM
  2. SQLAgent → Replaces hardcoded SQL with LLM-generated SQL
  3. ConversationMemory → Adds context/memory
  4. ResponseFormatter → Formats responses naturally
- **Files to create:** 4 new service files
- **Files to modify:** mpcService.ts, search/*.ts files
- Simple code examples showing before/after

---

## Task 12: Cost Questions

**User:** why would it be more costly

**Response:** Created `docs/MPC_COST_EXPLANATION.md`:
- **Current:** $0 (no external APIs)
- **MPC:** ~$0.01 per query (3 LLM API calls)
- **Cost breakdown:** Intent ($0.001) + SQL ($0.003) + Formatting ($0.002)
- **At scale:** 10K queries/day = $300/month, 100K queries/day = $3,000/month
- **Ways to reduce:** Use GPT-3.5, hybrid approach, caching

**User:** what tools are resources are generating the cost

**Response:** Created `docs/MPC_COST_BREAKDOWN.md`:
- **Primary cost:** LLM API calls (OpenAI/Anthropic) - ~$0.006 per query
- **Secondary costs:** Web Search APIs (SerpAPI/Google) - ~$0.01 per query if paid tier
- **Optional costs:** Vector Database (Pinecone) - ~$0.0001 per query if paid tier
- **Free resources:** LangChain library, database queries, code execution
- Detailed breakdown of each component's cost

---

## Task 13: AWS Open-Source Architecture

**User:** is it possible to do in AWS with same architecture but completey open source, I imagine the server space and cost for the LLM would prevent it?

**Response:** Created `docs/AWS_OPENSOURCE_MPC.md`:
- **Yes, it's possible** with trade-offs
- **Open-source LLMs:** Llama 2/3, Mistral, CodeLlama via Ollama
- **AWS options:** EC2 GPU (~$360/month), SageMaker (~$360/month), ECS/EKS with GPU tasks
- **Cost comparison:**
  - Break-even: ~36K-82K queries/month
  - Below break-even: API cheaper
  - Above break-even: Self-hosted cheaper
- **At 100K queries/day:** Self-hosted = $820/month vs API = $30,000/month
- **Recommendation:** Hybrid approach (simple queries = free, complex = self-hosted)

**User:** why Llama 7B instead of Ollama?

**Response:** Created `docs/OLLAMA_VS_LLAMA.md`:
- **Clarification:** Ollama = tool/runtime, Llama 7B = model
- **They work together:** Ollama runs Llama 7B (not alternatives)
- **Ollama** = Docker for LLMs (the tool)
- **Llama 7B** = The actual AI model (the brain)
- **Other models:** Can run Mistral, CodeLlama, etc. via Ollama
- Infrastructure cost same (~$360/month) - just choosing which model to run

---

## Task 14: Open-Source Web Search & Architecture Diagram

**User:** save all our chat histories for this workarea in an md that you can later load if you crash - also create a lucid chart for the open source architecture we discussed - prior to capturing the lucide architecture answer is there an open source way to approach the contextual web search as well?

**Response:** 
- Created `docs/OPENSOURCE_WEB_SEARCH.md`:
  - **SearxNG** (recommended): Self-hosted metasearch engine, ~$15/month
  - **DuckDuckGo**: Free, already implemented as fallback
  - **Brave Search API**: Free tier (2K queries/month)
  - **Bing API**: Free tier (1K queries/month)
  - **Recommendation:** SearxNG for open-source stack (~$15/month vs $50-100/month for SerpAPI)
- Creating chat history (this file)
- Creating Lucid chart architecture diagram

---

## Key Files Created

### Documentation
- `docs/MPC_EXPLANATION.md` - What MPC is and current status
- `docs/TRUE_MPC_APPROACH.md` - Detailed approach to true MPC
- `docs/SIMPLE_MPC_COMPONENTS.md` - Simple component breakdown
- `docs/MPC_COST_EXPLANATION.md` - Why MPC costs more
- `docs/MPC_COST_BREAKDOWN.md` - Detailed cost breakdown
- `docs/AWS_OPENSOURCE_MPC.md` - Open-source AWS architecture
- `docs/OLLAMA_VS_LLAMA.md` - Ollama vs Llama clarification
- `docs/OPENSOURCE_WEB_SEARCH.md` - Open-source web search options

### Code Files
- `src/index.ts` - Express server entry point
- `src/routes/health.ts` - Health check endpoint
- `src/routes/search.ts` - Search API endpoints
- `src/services/database.ts` - PostgreSQL connection
- `src/services/mpcService.ts` - MPC orchestration
- `src/services/webSearch.ts` - Web search service
- `src/services/enhancedSearch.ts` - Enhanced search with web context
- `src/services/search/ticketSearch.ts` - Ticket search service
- `src/services/search/eventSearch.ts` - Event search service
- `src/services/search/priceSearch.ts` - Price search service
- `src/services/search/locationSearch.ts` - Location search service

### Configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variables template
- `.gitignore` - Git ignore rules
- `README.md` - Project documentation

### Test Scripts
- `test-postgres-connection.js` - Database connection test
- `compare-databases.js` - Database comparison
- `test-readonly.js` - Read-only test

### Database Configuration
- `../connections.md` - PostgreSQL connection configs (UAT and Sandbox)

---

## Database Connection Details

### UAT Database
- **Host:** `uat-sitickets-aurora-cluster.cluster-cmzvajts10ys.us-east-1.rds.amazonaws.com`
- **Database:** `uat`
- **User:** `michael_gallina`
- **Password:** `73Do2bB9Fl1SKtAFNiB9`
- **Status:** Read-only, 501 tables, ~685.8M rows, 654 GB

### Sandbox Database
- **Host:** `sandbox-sitickets-aurora-cluster.cluster-cmzvajts10ys.us-east-1.rds.amazonaws.com`
- **Database:** `sitickets`
- **User:** `michael_gallina`
- **Password:** `kL0uBVu4p818TrstTjvcj`
- **Status:** Write access, 0 tables (empty)

---

## Architecture Decisions

### Current Implementation (Hybrid MPC)
- Keyword-based query detection
- Predefined SQL queries
- Web search enhancement (SerpAPI/Google/DuckDuckGo)
- Structured JSON responses

### True MPC Requirements (Not Yet Implemented)
- LLM query understanding (LLMIntentAnalyzer)
- SQL Agent for dynamic SQL generation (SQLAgent)
- Conversational memory (ConversationMemory)
- LLM response formatting (ResponseFormatter)

### Open-Source Stack Option
- **LLM:** Ollama + Llama 7B/Mistral 7B on EC2 GPU (~$360/month)
- **Web Search:** SearxNG self-hosted (~$15/month)
- **Database:** PostgreSQL RDS (existing)
- **Total:** ~$375/month infrastructure (vs $3,000+/month for APIs at scale)

---

## Next Steps

1. Install dependencies: `npm install`
2. Set up `.env` with database credentials
3. Test the server: `npm run dev`
4. Implement true MPC components (if desired):
   - LLMIntentAnalyzer
   - SQLAgent
   - ConversationMemory
   - ResponseFormatter
5. Consider open-source stack for cost savings at scale

---

*Last updated: December 18, 2024*

