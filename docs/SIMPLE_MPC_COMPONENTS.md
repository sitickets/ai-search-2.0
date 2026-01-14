# Simple MPC Implementation: Code Components

## What Needs to Change

### Current Architecture (Keyword-Based)
```
mpcService.ts
  ├─ detectQueryType() → regex patterns
  ├─ extractSearchParams() → regex extraction
  └─ handleTicketQuery() → calls predefined SQL
```

### True MPC Architecture (LLM-Based)
```
mpcService.ts
  ├─ LLMIntentAnalyzer → uses LLM
  ├─ SQLAgent → uses LangChain
  ├─ ConversationMemory → stores context
  └─ ResponseFormatter → uses LLM
```

---

## Component 1: LLM Intent Analyzer

### What It Does
Replaces keyword matching with LLM understanding.

### Current Code (Keyword-Based)
```typescript
// src/services/mpcService.ts
private detectQueryType(query: string) {
  if (query.match(/price|cheap/)) return 'price';
  if (query.match(/ticket|seat/)) return 'ticket';
  // ... more regex
}
```

### New Component Needed
```typescript
// src/services/llmIntentAnalyzer.ts
class LLMIntentAnalyzer {
  async analyze(query: string) {
    const result = await this.llm.invoke(`
      Query: "${query}"
      Extract: intent, performer, location, priceRange, dates
      Return JSON
    `);
    return JSON.parse(result);
  }
}
```

**What changes:**
- ❌ Remove: `detectQueryType()` method
- ✅ Add: `LLMIntentAnalyzer` service
- ✅ Change: Call LLM instead of regex

---

## Component 2: SQL Agent

### What It Does
Generates SQL queries dynamically instead of using predefined ones.

### Current Code (Predefined SQL)
```typescript
// src/services/search/ticketSearch.ts
async function searchTickets(params) {
  const sql = `SELECT * FROM tickets WHERE price < $1`; // Hardcoded
  return await query(sql, [params.priceMax]);
}
```

### New Component Needed
```typescript
// src/services/sqlAgent.ts
import { createSqlAgent } from "langchain/agents/toolkits/sql";
import { SqlToolkit } from "langchain/agents/toolkits/sql";

class SQLAgent {
  async generateAndExecute(userQuery: string) {
    // 1. Get schema
    const schema = await getSchemaInfo();
    
    // 2. Create toolkit
    const toolkit = new SqlToolkit(db, this.llm);
    
    // 3. Create agent
    const agent = createSqlAgent({ llm: this.llm, toolkit });
    
    // 4. Generate & execute SQL
    const result = await agent.invoke({ input: userQuery });
    return result;
  }
}
```

**What changes:**
- ❌ Remove: Predefined SQL queries in `ticketSearch.ts`, `eventSearch.ts`, etc.
- ✅ Add: `SQLAgent` service
- ✅ Change: Let LLM generate SQL instead of hardcoding

---

## Component 3: Conversation Memory

### What It Does
Remembers previous queries in a conversation.

### Current Code (Stateless)
```typescript
// src/services/mpcService.ts
async processQuery(mpcQuery: MPCQuery) {
  const { query } = mpcQuery; // No memory
  // Process independently
}
```

### New Component Needed
```typescript
// src/services/conversationMemory.ts
import { BufferMemory } from "langchain/memory";

class ConversationMemory {
  private memories = new Map<string, BufferMemory>();
  
  getMemory(conversationId: string) {
    if (!this.memories.has(conversationId)) {
      this.memories.set(conversationId, new BufferMemory());
    }
    return this.memories.get(conversationId)!;
  }
  
  async save(conversationId: string, input: string, output: string) {
    const memory = this.getMemory(conversationId);
    await memory.saveContext({ input }, { output });
  }
  
  async load(conversationId: string) {
    const memory = this.getMemory(conversationId);
    return await memory.loadMemoryVariables({});
  }
}
```

**What changes:**
- ✅ Add: `ConversationMemory` service
- ✅ Change: Pass conversation context to LLM
- ✅ Change: Store query/response pairs

---

## Component 4: Response Formatter

### What It Does
Formats database results into natural language.

### Current Code (Raw Response)
```typescript
// src/services/mpcService.ts
return {
  answer: `Found ${results.length} tickets`, // Simple string
  results: results // Raw JSON
};
```

### New Component Needed
```typescript
// src/services/responseFormatter.ts
class ResponseFormatter {
  async format(userQuery: string, results: any[]) {
    const formatted = await this.llm.invoke(`
      User asked: "${userQuery}"
      Results: ${JSON.stringify(results)}
      
      Write a natural, helpful response.
    `);
    return formatted;
  }
}
```

**What changes:**
- ✅ Add: `ResponseFormatter` service
- ✅ Change: Use LLM to format all responses
- ✅ Change: Return natural language instead of simple strings

---

## Updated MPC Service Flow

### Current Flow
```typescript
// src/services/mpcService.ts
async processQuery(query: string) {
  // 1. Keyword detection
  const type = this.detectQueryType(query); // regex
  
  // 2. Extract params
  const params = this.extractSearchParams(query); // regex
  
  // 3. Call predefined SQL
  const results = await searchTickets(params); // hardcoded SQL
  
  // 4. Return raw response
  return { answer: `Found ${results.length}`, results };
}
```

### New Flow (True MPC)
```typescript
// src/services/mpcService.ts
async processQuery(query: string, conversationId?: string) {
  // 1. LLM intent analysis
  const intent = await this.intentAnalyzer.analyze(query);
  
  // 2. Load conversation context
  const context = await this.memory.load(conversationId);
  
  // 3. Generate SQL with agent
  const results = await this.sqlAgent.generateAndExecute(
    query, 
    context
  );
  
  // 4. Format with LLM
  const answer = await this.responseFormatter.format(query, results);
  
  // 5. Save to memory
  await this.memory.save(conversationId, query, answer);
  
  return { answer, results };
}
```

---

## File Structure Changes

### Files to Create
```
src/services/
  ├─ llmIntentAnalyzer.ts    ← NEW: LLM query understanding
  ├─ sqlAgent.ts              ← NEW: SQL generation
  ├─ conversationMemory.ts    ← NEW: Context storage
  └─ responseFormatter.ts    ← NEW: Response formatting
```

### Files to Modify
```
src/services/
  ├─ mpcService.ts            ← MODIFY: Use new components
  └─ search/
      ├─ ticketSearch.ts      ← MODIFY: Remove hardcoded SQL (or keep as fallback)
      ├─ eventSearch.ts       ← MODIFY: Remove hardcoded SQL (or keep as fallback)
      └─ ...
```

---

## Simple Implementation Checklist

### Step 1: Add LLM Intent Analyzer
- [ ] Create `src/services/llmIntentAnalyzer.ts`
- [ ] Replace `detectQueryType()` calls with `intentAnalyzer.analyze()`
- [ ] Remove regex-based detection

### Step 2: Add SQL Agent
- [ ] Create `src/services/sqlAgent.ts`
- [ ] Set up LangChain SQL Agent
- [ ] Replace predefined SQL calls with `sqlAgent.generateAndExecute()`
- [ ] Keep old search services as fallback (optional)

### Step 3: Add Conversation Memory
- [ ] Create `src/services/conversationMemory.ts`
- [ ] Add conversationId parameter to `processQuery()`
- [ ] Load context before querying
- [ ] Save context after responding

### Step 4: Add Response Formatter
- [ ] Create `src/services/responseFormatter.ts`
- [ ] Replace simple string responses with `formatter.format()`
- [ ] Format all responses through LLM

### Step 5: Update MPC Service
- [ ] Import all new components
- [ ] Update `processQuery()` to use new flow
- [ ] Remove old keyword-based logic

---

## Dependencies to Add

```json
{
  "langchain": "^0.1.20",
  "@langchain/openai": "^0.0.20",
  "@langchain/community": "^0.0.30"
}
```

---

## Summary: 4 Components to Build

1. **LLMIntentAnalyzer** → Replaces regex with LLM
2. **SQLAgent** → Replaces hardcoded SQL with LLM-generated SQL
3. **ConversationMemory** → Adds context/memory
4. **ResponseFormatter** → Formats responses naturally

**That's it.** These 4 components transform it from keyword-based to true MPC.

