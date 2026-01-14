# MPC Cost Breakdown: Tools & Resources

## What Actually Costs Money

### 1. LLM API Services (Primary Cost)

#### OpenAI API
**Service:** `https://api.openai.com/v1/chat/completions`

**What it does:**
- Processes natural language queries
- Generates SQL queries
- Formats responses

**Cost structure:**
- **GPT-4 Turbo**: $0.01 per 1,000 input tokens + $0.03 per 1,000 output tokens
- **GPT-3.5 Turbo**: $0.0005 per 1,000 input tokens + $0.0015 per 1,000 output tokens

**Example:**
```typescript
// This API call costs money
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Find Taylor Swift tickets" }]
});
// Cost: ~$0.001 per call
```

**Where it's used:**
- Intent analysis
- SQL generation
- Response formatting

---

#### Anthropic Claude API (Alternative)
**Service:** `https://api.anthropic.com/v1/messages`

**What it does:**
- Same as OpenAI (LLM processing)

**Cost structure:**
- **Claude 3 Opus**: $0.015 per 1,000 input tokens + $0.075 per 1,000 output tokens
- **Claude 3 Sonnet**: $0.003 per 1,000 input tokens + $0.015 per 1,000 output tokens

**Example:**
```typescript
// This API call costs money
const response = await anthropic.messages.create({
  model: "claude-3-sonnet-20240229",
  messages: [{ role: "user", content: "Find Taylor Swift tickets" }]
});
// Cost: ~$0.001 per call
```

---

### 2. LangChain Library (Free, but uses LLM APIs)

**What it is:**
- Open-source library (free to use)
- But it makes calls to LLM APIs (which cost money)

**What it does:**
- Provides SQL Agent functionality
- Wraps LLM API calls
- Manages tool calling

**Cost:**
- Library itself: **$0** (free, open-source)
- But it calls LLM APIs: **~$0.003 per SQL generation**

**Example:**
```typescript
// LangChain is free, but this makes LLM API calls (costs money)
import { createSqlAgent } from "langchain/agents/toolkits/sql";

const agent = createSqlAgent({ llm, toolkit });
const result = await agent.invoke({ input: query });
// Under the hood, this calls OpenAI API = costs money
```

---

### 3. Vector Database (Optional, for RAG)

#### Pinecone
**Service:** `https://api.pinecone.io`

**What it does:**
- Stores schema embeddings for RAG
- Retrieves relevant schema context

**Cost structure:**
- **Free tier**: 1 index, 100K vectors
- **Paid**: $70/month + $0.096 per 1M queries

**Example:**
```typescript
// This API call costs money (if over free tier)
const results = await pinecone.query({
  vector: queryEmbedding,
  topK: 5
});
// Cost: ~$0.0001 per query (if paid tier)
```

**Alternatives (Free):**
- **Chroma**: Free, self-hosted
- **Postgres with pgvector**: Free (if you have Postgres)
- **Weaviate**: Free tier available

---

#### Web Search APIs (Already Implemented)

#### SerpAPI
**Service:** `https://serpapi.com/search`

**What it does:**
- Web search for contextual data
- Already implemented in your code

**Cost structure:**
- **Free tier**: 100 searches/month
- **Paid**: $50/month for 5,000 searches

**Example:**
```typescript
// This API call costs money (if over free tier)
const results = await axios.get('https://serpapi.com/search.json', {
  params: { api_key: key, q: query }
});
// Cost: $0.01 per search (if paid tier)
```

---

#### Google Custom Search API
**Service:** `https://www.googleapis.com/customsearch/v1`

**What it does:**
- Web search for contextual data
- Already implemented as fallback

**Cost structure:**
- **Free tier**: 100 searches/day
- **Paid**: $5 per 1,000 searches

**Example:**
```typescript
// This API call costs money (if over free tier)
const results = await axios.get('https://www.googleapis.com/customsearch/v1', {
  params: { key, cx, q: query }
});
// Cost: $0.005 per search (if paid tier)
```

---

## Cost Breakdown Per Query Component

### Component 1: Intent Analysis
**Tool:** OpenAI/Anthropic API  
**Cost:** ~$0.001 per call  
**What happens:**
```typescript
// Makes 1 API call to OpenAI
const intent = await llm.invoke(`
  Analyze query: "${query}"
  Return JSON with intent and parameters
`);
// Charges: ~$0.001
```

---

### Component 2: SQL Generation
**Tool:** LangChain SQL Agent → OpenAI/Anthropic API  
**Cost:** ~$0.003 per call  
**What happens:**
```typescript
// LangChain makes multiple LLM API calls internally
const agent = createSqlAgent({ llm, toolkit });
const result = await agent.invoke({ input: query });
// Under the hood:
//   - Call 1: Analyze query (~$0.001)
//   - Call 2: Generate SQL (~$0.001)
//   - Call 3: Validate SQL (~$0.001)
// Total charges: ~$0.003
```

---

### Component 3: Response Formatting
**Tool:** OpenAI/Anthropic API  
**Cost:** ~$0.002 per call  
**What happens:**
```typescript
// Makes 1 API call to OpenAI
const formatted = await llm.invoke(`
  Format these results: ${JSON.stringify(results)}
  Write natural language response
`);
// Charges: ~$0.002 (more tokens for results)
```

---

### Component 4: Web Search (Optional)
**Tool:** SerpAPI or Google Custom Search  
**Cost:** ~$0.01 per call (if paid tier)  
**What happens:**
```typescript
// Makes 1 API call to SerpAPI
const webResults = await serpApi.search(query);
// Charges: ~$0.01 (if over free tier)
```

---

### Component 5: Vector Database (Optional, for RAG)
**Tool:** Pinecone or similar  
**Cost:** ~$0.0001 per query (if paid tier)  
**What happens:**
```typescript
// Makes 1 API call to Pinecone
const schemaContext = await pinecone.query({ vector: embedding });
// Charges: ~$0.0001 (if over free tier)
```

---

## Total Cost Per Query

### Minimal MPC (No Web Search, No RAG)
```
Intent Analysis:     $0.001
SQL Generation:      $0.003
Response Formatting: $0.002
─────────────────────────────
Total:              $0.006 per query
```

### Full MPC (With Web Search)
```
Intent Analysis:     $0.001
SQL Generation:      $0.003
Response Formatting: $0.002
Web Search:          $0.010 (if paid tier)
─────────────────────────────
Total:              $0.016 per query
```

### Full MPC (With Web Search + RAG)
```
Intent Analysis:     $0.001
SQL Generation:      $0.003
Response Formatting: $0.002
Web Search:          $0.010 (if paid tier)
Vector DB Query:     $0.0001 (if paid tier)
─────────────────────────────
Total:              $0.0161 per query
```

---

## Free Alternatives

### 1. Self-Hosted LLMs (No API Costs)
**Tools:**
- **Ollama** (runs LLMs locally)
- **Llama 2/3** (Meta's open-source models)
- **Mistral** (open-source)

**Cost:** $0 (but requires GPU/server)

**Example:**
```typescript
// Runs locally, no API costs
const llm = new Ollama({ model: "llama2" });
// Cost: $0 (but needs GPU/server infrastructure)
```

---

### 2. Free Vector Databases
- **Chroma**: Free, self-hosted
- **Postgres pgvector**: Free (if you have Postgres)
- **Weaviate Cloud**: Free tier

---

### 3. Free Web Search
- **DuckDuckGo**: Free (already implemented as fallback)
- **SerpAPI**: 100 free searches/month
- **Google Custom Search**: 100 free searches/day

---

## Summary: What Costs Money

### Primary Costs (Required for MPC)
1. **LLM API** (OpenAI/Anthropic) - **~$0.006 per query**
   - Intent analysis
   - SQL generation  
   - Response formatting

### Secondary Costs (Optional)
2. **Web Search API** (SerpAPI/Google) - **~$0.01 per query** (if over free tier)
3. **Vector Database** (Pinecone) - **~$0.0001 per query** (if over free tier)

### Free Resources
- **LangChain library** - Free (but uses paid LLM APIs)
- **Database queries** - Free (your own database)
- **Code execution** - Free
- **DuckDuckGo search** - Free (less reliable)

---

## Cost Optimization Strategies

### 1. Use Free Tiers
- SerpAPI: 100 free searches/month
- Google Custom Search: 100 free searches/day
- Pinecone: Free tier available

### 2. Use Cheaper Models
- GPT-3.5: 10x cheaper than GPT-4
- Claude Sonnet: Cheaper than Claude Opus

### 3. Cache Results
- Cache intent analysis for common queries
- Cache SQL for similar queries
- Reduces API calls

### 4. Hybrid Approach
- Simple queries: No LLM (free)
- Complex queries: Use LLM (costs money)

### 5. Self-Host LLMs
- Run Ollama/Llama locally
- No API costs (but needs infrastructure)

---

**Bottom Line:** The main cost is **LLM API calls** (OpenAI/Anthropic). Everything else is either free or has free tiers available.

