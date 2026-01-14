# Approach to Make It a True MPC LLM-Based System

## Overview

To transform the current hybrid system into a true **Model-Powered Chat (MPC)** server, we need to replace keyword-based logic with LLM-powered intelligence at every step.

---

## 1. LLM-Powered Query Understanding

### Current Approach (Keyword Matching)
```typescript
// Simple regex patterns
if (query.match(/price|cheap|expensive/)) return 'price';
```

### True MPC Approach
```typescript
// Use LLM to understand intent
const intent = await llm.invoke(`
  Analyze this user query: "${query}"
  
  Determine the primary intent:
  - ticket: User wants to find/buy tickets
  - event: User wants event information
  - price: User is asking about pricing
  - location: User wants location-based results
  - general: General inquiry
  
  Also extract:
  - Performer/artist name
  - Location (city, state, venue)
  - Price range
  - Date range
  - Other specific requirements
  
  Return JSON: { intent, performer?, location?, priceMin?, priceMax?, dateFrom?, dateTo? }
`);
```

**Benefits:**
- Understands complex, conversational queries
- Handles variations in phrasing
- Extracts multiple parameters intelligently
- Can handle ambiguous queries

---

## 2. LangChain SQL Agent for Query Generation

### Current Approach (Predefined SQL)
```typescript
// Hardcoded SQL queries
const sql = `SELECT * FROM tickets WHERE price < $1`;
```

### True MPC Approach
```typescript
// LangChain SQL Agent generates SQL dynamically
import { createSqlAgent } from "langchain/agents/toolkits/sql";
import { SqlToolkit } from "langchain/agents/toolkits/sql";

// 1. Get database schema
const schema = await getSchemaInfo();

// 2. Create SQL toolkit with schema context
const toolkit = new SqlToolkit(db, llm);

// 3. Create agent
const agent = createSqlAgent({
  llm,
  toolkit,
  verbose: true
});

// 4. Let LLM generate and execute SQL
const result = await agent.invoke({
  input: "Find tickets for Taylor Swift concerts under $200 in New York"
});

// LLM will:
// - Understand the query
// - Look at schema
// - Generate appropriate SQL
// - Execute it
// - Return results
```

**Benefits:**
- Handles complex, multi-table queries
- Adapts to schema changes
- Can combine multiple conditions intelligently
- Generates optimized queries

---

## 3. Conversational Memory & Context

### Current Approach (Stateless)
```typescript
// Each query is independent
POST /api/search { query: "Taylor Swift tickets" }
```

### True MPC Approach
```typescript
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";

// Store conversation history
const memory = new BufferMemory({
  returnMessages: true,
  memoryKey: "chat_history"
});

// Multi-turn conversation
const chain = new ConversationChain({
  llm,
  memory
});

// First query
await chain.call({
  input: "Find Taylor Swift tickets"
});

// Follow-up (remembers context)
await chain.call({
  input: "What about under $150?"  // LLM knows we're still talking about Taylor Swift
});

// Another follow-up
await chain.call({
  input: "Show me ones in New York"  // LLM knows: Taylor Swift + under $150 + New York
});
```

**Benefits:**
- Natural conversation flow
- Remembers previous context
- Handles follow-up questions
- More user-friendly experience

---

## 4. LLM-Powered Response Formatting

### Current Approach (Raw JSON)
```typescript
return {
  answer: `Found ${results.length} tickets`,
  results: [...raw data...]
};
```

### True MPC Approach
```typescript
// LLM formats results into natural language
const formattedResponse = await llm.invoke(`
  User asked: "${userQuery}"
  
  Database results:
  ${JSON.stringify(results, null, 2)}
  
  Format this into a natural, conversational response:
  - Summarize the findings
  - Highlight key information (prices, dates, locations)
  - Make it sound natural and helpful
  - Include specific details from the results
  - If no results, suggest alternatives
  
  Keep it concise but informative.
`);

return {
  answer: formattedResponse,  // Natural language response
  results: results,            // Still include raw data
  metadata: {...}
};
```

**Benefits:**
- Natural, conversational responses
- Highlights important information
- Explains results in context
- More engaging user experience

---

## 5. RAG (Retrieval Augmented Generation) for Schema Context

### Current Approach (Static Schema)
```typescript
// Schema info retrieved once
const schema = await getSchemaInfo();
```

### True MPC Approach
```typescript
// Store schema in vector database
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";

// 1. Embed schema information
const embeddings = new OpenAIEmbeddings();
const schemaChunks = chunkSchema(schema);
const vectors = await embeddings.embedDocuments(schemaChunks);

// 2. Store in vector DB
await pinecone.upsert({
  vectors: vectors.map((v, i) => ({
    id: `schema-${i}`,
    values: v,
    metadata: { chunk: schemaChunks[i] }
  }))
});

// 3. Retrieve relevant schema context for each query
const queryEmbedding = await embeddings.embedQuery(userQuery);
const relevantSchema = await pinecone.query({
  vector: queryEmbedding,
  topK: 5,
  includeMetadata: true
});

// 4. Provide schema context to LLM
const sqlAgent = createSqlAgent({
  llm,
  toolkit,
  systemMessage: `Use this schema context: ${relevantSchema}`
});
```

**Benefits:**
- Only relevant schema parts used
- Better SQL generation
- Handles large schemas efficiently
- Context-aware query building

---

## 6. Hybrid Approach (Recommended)

### Best of Both Worlds

**Simple Queries → Fast Path (Keyword-based)**
```typescript
if (isSimpleQuery(query)) {
  // Use keyword matching + predefined SQL (fast, cheap)
  return await fastSearch(query);
}
```

**Complex Queries → LLM Path**
```typescript
else {
  // Use LLM SQL Agent (intelligent, flexible)
  return await llmSearch(query);
}
```

**Always Format with LLM**
```typescript
// Always use LLM for response formatting (user-friendly)
const formattedAnswer = await formatWithLLM(results, query);
```

**Benefits:**
- Speed for common queries
- Intelligence for complex queries
- Natural responses always
- Cost-efficient

---

## 7. Implementation Architecture

### Flow Diagram

```
User Query
    ↓
[LLM Intent Detection]
    ├─→ Simple? → [Keyword Router] → [Predefined SQL] → Results
    └─→ Complex? → [LangChain SQL Agent] → [Generated SQL] → Results
    ↓
[Conversational Memory]
    ├─→ Store query/response
    └─→ Load context for follow-ups
    ↓
[Web Search Enhancement] (optional)
    └─→ Add contextual data
    ↓
[LLM Response Formatting]
    └─→ Natural language answer
    ↓
Response (Natural Language + Structured Data)
```

---

## 8. Required Components

### Dependencies to Add
```json
{
  "langchain": "^0.1.20",
  "@langchain/openai": "^0.0.20",
  "@langchain/community": "^0.0.30",
  "@langchain/core": "^0.1.0",
  "langchain-community": "^0.0.30"
}
```

### Services to Create
1. **LLMIntentService** - Query understanding
2. **SQLAgentService** - SQL generation
3. **ConversationMemoryService** - Context management
4. **ResponseFormatterService** - Natural language formatting
5. **RAGService** - Schema context retrieval (optional)

### Database Changes
- Add `conversations` table for storing chat history
- Add `conversation_messages` table for message history

---

## 9. Cost Considerations

### Current Approach
- **Cost**: $0 (no LLM calls)
- **Latency**: ~50-200ms
- **Flexibility**: Low

### True MPC Approach
- **Cost**: ~$0.01-0.10 per query (depending on complexity)
- **Latency**: ~500-2000ms (LLM processing)
- **Flexibility**: High

### Hybrid Approach (Recommended)
- **Cost**: ~$0.01-0.05 per query (LLM only for formatting + complex queries)
- **Latency**: ~100-500ms (fast path) or ~1000-2000ms (LLM path)
- **Flexibility**: High

---

## 10. Step-by-Step Implementation Plan

### Phase 1: LLM Query Understanding
1. Replace keyword detection with LLM intent analysis
2. Extract parameters using LLM
3. Test with various query formats

### Phase 2: SQL Agent Integration
1. Set up LangChain SQL Agent
2. Provide database schema context
3. Test SQL generation for complex queries

### Phase 3: Conversational Memory
1. Add conversation storage (database)
2. Implement BufferMemory
3. Test multi-turn conversations

### Phase 4: Response Formatting
1. Add LLM response formatter
2. Format all responses naturally
3. Test response quality

### Phase 5: RAG (Optional)
1. Set up vector database
2. Embed schema information
3. Retrieve relevant context per query

### Phase 6: Hybrid Optimization
1. Implement query complexity detection
2. Route simple queries to fast path
3. Optimize costs and latency

---

## 11. Example: True MPC Flow

### User Query
```
"Find me cheap tickets for Taylor Swift in New York next month"
```

### Step 1: LLM Intent Detection
```json
{
  "intent": "ticket",
  "performer": "Taylor Swift",
  "location": "New York",
  "priceMax": null,  // "cheap" is relative
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31"
}
```

### Step 2: SQL Agent Generation
```sql
-- LLM generates this based on schema understanding
SELECT 
  mtg.*, me.title, me.event_date, v.city, v.state
FROM master_ticketing_groups mtg
JOIN master_events me ON mtg.event_id = me.id
JOIN venues v ON me.venue_id = v.id
WHERE me.title ILIKE '%Taylor Swift%'
  AND v.city = 'New York'
  AND me.event_date BETWEEN '2024-01-01' AND '2024-01-31'
  AND mtg.price < (
    SELECT AVG(price) * 0.8 
    FROM master_ticketing_groups 
    WHERE event_id = me.id
  )  -- "cheap" = below average
ORDER BY mtg.price ASC
LIMIT 20
```

### Step 3: Execute & Format
```typescript
// Execute SQL
const results = await db.query(generatedSQL);

// Format with LLM
const answer = await llm.invoke(`
  User asked: "Find me cheap tickets for Taylor Swift in New York next month"
  
  Found ${results.length} tickets:
  ${JSON.stringify(results)}
  
  Format a natural response highlighting:
  - Number of tickets found
  - Price range
  - Upcoming dates
  - Best deals
`);
```

### Step 4: Response
```
"I found 15 tickets for Taylor Swift concerts in New York next month! 
Prices range from $89 to $250, with the best deals on January 15th and 
22nd at Madison Square Garden. The cheapest tickets are in the upper 
sections starting at $89. Would you like details on any specific date?"
```

---

## Summary

**To make it a true MPC system, we need:**

1. ✅ **LLM for query understanding** (not keywords)
2. ✅ **LangChain SQL Agent** (not predefined SQL)
3. ✅ **Conversational memory** (not stateless)
4. ✅ **LLM response formatting** (not raw JSON)
5. ⚠️ **RAG for schema** (optional but recommended)
6. ✅ **Hybrid approach** (best performance/cost balance)

**The key difference:** Instead of hardcoded logic, the LLM makes intelligent decisions at every step, making the system truly conversational and flexible.

