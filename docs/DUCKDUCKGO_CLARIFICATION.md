# DuckDuckGo API Clarification

## No, DuckDuckGo Does NOT Have a Public Web Search API

### What DuckDuckGo Actually Has

#### 1. Instant Answer API (Limited)
**Endpoint:** `https://api.duckduckgo.com/`

**What it does:**
- Returns structured data for specific queries (definitions, calculations, etc.)
- **NOT** a general web search API
- Only works for specific query types (definitions, facts, calculations)

**Example:**
```typescript
// This works for specific queries only
const response = await axios.get('https://api.duckduckgo.com/', {
  params: {
    q: 'Taylor Swift',  // Returns structured data, not web results
    format: 'json',
    no_html: 1
  }
});
// Returns: Abstract, AbstractText, RelatedTopics (not web search results)
```

**Limitations:**
- ❌ Not for general web search
- ❌ No web results/links
- ❌ Only structured data for specific queries

---

#### 2. HTML Scraping (What I Implemented)

**What I did:**
- Scrapes DuckDuckGo's HTML search results page
- **NOT** an API - just HTML parsing
- Unreliable and may violate ToS

**Code:**
```typescript
// This is HTML scraping, NOT an API
const response = await axios.get('https://html.duckduckgo.com/html/', {
  params: { q: query }
});
// Then parse HTML with regex (unreliable)
```

**Problems:**
- ❌ Not an official API
- ❌ HTML structure can change (breaks parsing)
- ❌ May violate DuckDuckGo's Terms of Service
- ❌ Rate limiting/blocking possible
- ❌ Unreliable parsing

---

## What I Should Have Said

### Corrected Statement:

**DuckDuckGo does NOT have a web search API.**

**What's available:**
1. **Instant Answer API** - Only for structured data (definitions, facts)
2. **HTML Scraping** - Not recommended (unreliable, may violate ToS)

**For open-source web search, use:**
- ✅ **SearxNG** - Best option (self-hosted, aggregates multiple engines)
- ✅ **Brave Search API** - Has free tier (2K queries/month)
- ✅ **Bing API** - Has free tier (1K queries/month)

---

## Updated Recommendation

### Remove DuckDuckGo from Production Code

**Current implementation (not recommended):**
```typescript
// HTML scraping - unreliable
private async searchWithDuckDuckGo(...) {
  const response = await axios.get('https://html.duckduckgo.com/html/', ...);
  // Parse HTML (unreliable)
}
```

**Better alternatives:**

#### Option 1: SearxNG (Recommended)
```typescript
private async searchWithSearxNG(query: string) {
  const response = await axios.get('http://your-searx-instance:8080/search', {
    params: { q: query, format: 'json' }
  });
  return response.data.results; // Proper API response
}
```

#### Option 2: Brave Search API
```typescript
private async searchWithBrave(query: string) {
  const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY },
    params: { q: query }
  });
  return response.data.web.results;
}
```

#### Option 3: Remove DuckDuckGo Fallback
```typescript
// Just fail gracefully if other APIs are unavailable
catch (error) {
  console.error('All search APIs failed');
  return []; // Return empty results instead of unreliable scraping
}
```

---

## Updated Web Search Service

### Recommended Fallback Order:

1. **Primary:** SearxNG (self-hosted, reliable)
2. **Fallback 1:** Brave Search API (free tier)
3. **Fallback 2:** Bing API (free tier)
4. **Fallback 3:** Return empty results (don't use HTML scraping)

**Remove:** DuckDuckGo HTML scraping (unreliable, may violate ToS)

---

## Summary

**Question:** Does DuckDuckGo have an API?

**Answer:** 
- ❌ **No official web search API**
- ✅ **Instant Answer API** exists (but only for structured data, not web search)
- ⚠️ **HTML scraping** is possible but not recommended (unreliable, may violate ToS)

**For production:** Use SearxNG or Brave/Bing APIs instead.

