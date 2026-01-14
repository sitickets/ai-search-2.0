# Open-Source Web Search Options

## Yes, There Are Open-Source Alternatives!

### Option 1: SearxNG (Self-Hosted Search Aggregator) ⭐ RECOMMENDED

**What it is:**
- Open-source metasearch engine
- Aggregates results from multiple search engines
- Self-hosted (you control it)
- No API costs

**How it works:**
```
Your MPC Service
  └─ Calls → SearxNG Instance (your server)
      └─ Aggregates → Google, Bing, DuckDuckGo, etc.
      └─ Returns → Combined results
```

**Setup:**
```bash
# Docker deployment
docker run -d -p 8080:8080 \
  -e "BASE_URL=http://localhost:8080/" \
  searxng/searxng:latest
```

**API Usage:**
```typescript
const response = await axios.get('http://your-searx-instance:8080/search', {
  params: {
    q: query,
    format: 'json',
    engines: 'google,bing,duckduckgo'
  }
});
```

**Cost:**
- **Infrastructure:** ~$20-50/month (small EC2 instance)
- **API calls:** $0 (free)
- **Total:** Much cheaper than SerpAPI at scale

**Pros:**
- ✅ Fully open-source
- ✅ No API costs
- ✅ Aggregates multiple sources
- ✅ Privacy-focused
- ✅ Self-hosted (you control it)

**Cons:**
- ❌ Need to host/maintain
- ❌ May violate some search engines' ToS (use responsibly)
- ❌ Requires setup

---

### Option 2: DuckDuckGo HTML API (Free, No API Key)

**What it is:**
- DuckDuckGo's HTML search (no official API)
- Free, no API key needed
- Already implemented in your code as fallback

**Usage:**
```typescript
// Already in your webSearch.ts
const response = await axios.get('https://html.duckduckgo.com/html/', {
  params: { q: query }
});
// Parse HTML response
```

**Cost:**
- **$0** (completely free)

**Pros:**
- ✅ Free
- ✅ No API key
- ✅ Already implemented

**Cons:**
- ❌ HTML parsing (less reliable)
- ❌ Rate limiting (may get blocked)
- ❌ Less structured results

---

### Option 3: Brave Search API (Free Tier)

**What it is:**
- Brave's search API
- Free tier: 2,000 queries/month
- Open-source search index

**Usage:**
```typescript
const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
  headers: {
    'X-Subscription-Token': 'your-api-key'
  },
  params: { q: query }
});
```

**Cost:**
- **Free tier:** 2,000 queries/month
- **Paid:** $3 per 1,000 queries after free tier

**Pros:**
- ✅ Free tier available
- ✅ Good quality results
- ✅ Open-source search index

**Cons:**
- ❌ Limited free tier
- ❌ Costs money after free tier

---

### Option 4: Bing Search API (Free Tier)

**What it is:**
- Microsoft Bing Search API
- Free tier: 1,000 queries/month
- Not open-source, but has free tier

**Usage:**
```typescript
const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
  headers: {
    'Ocp-Apim-Subscription-Key': 'your-key'
  },
  params: { q: query }
});
```

**Cost:**
- **Free tier:** 1,000 queries/month
- **Paid:** $4 per 1,000 queries

**Pros:**
- ✅ Free tier
- ✅ Good quality
- ✅ Reliable

**Cons:**
- ❌ Not fully open-source
- ❌ Limited free tier

---

### Option 5: Web Scraping (Legal Concerns)

**What it is:**
- Directly scrape search results
- Using tools like Puppeteer, Playwright

**Cost:**
- **$0** (but has legal/ethical concerns)

**Pros:**
- ✅ Free
- ✅ Full control

**Cons:**
- ❌ May violate ToS
- ❌ Can get blocked
- ❌ Legal concerns
- ❌ Requires maintenance

**Not recommended** for production.

---

## Recommended Architecture: SearxNG

### Setup on AWS

```
EC2 Instance (t3.small or t3.medium)
  └─ SearxNG (Docker container)
      └─ Port 8080
      └─ Aggregates: Google, Bing, DuckDuckGo, etc.

Your MPC Service
  └─ Calls SearxNG API
      └─ Gets aggregated results
```

**Cost:**
- **EC2 t3.small:** ~$15/month
- **API calls:** $0
- **Total:** ~$15/month (vs $50-100/month for SerpAPI at scale)

---

## Comparison

| Solution | Cost | Open-Source | Quality | Setup |
|----------|------|-------------|---------|-------|
| **SearxNG** | $15/mo | ✅ Yes | ⭐⭐⭐⭐ | Medium |
| **DuckDuckGo** | $0 | ✅ Yes | ⭐⭐⭐ | Easy |
| **Brave API** | Free tier | ⚠️ Partial | ⭐⭐⭐⭐ | Easy |
| **Bing API** | Free tier | ❌ No | ⭐⭐⭐⭐ | Easy |
| **SerpAPI** | $50+/mo | ❌ No | ⭐⭐⭐⭐⭐ | Easy |

---

## Implementation for Your MPC

### Option A: SearxNG (Recommended for Open-Source)

```typescript
// src/services/webSearch.ts
class WebSearchService {
  private searxngUrl = process.env.SEARXNG_URL || 'http://localhost:8080';
  
  async searchWithSearxNG(query: string) {
    const response = await axios.get(`${this.searxngUrl}/search`, {
      params: {
        q: query,
        format: 'json',
        engines: 'google,bing,duckduckgo'
      }
    });
    
    return response.data.results.map(result => ({
      title: result.title,
      snippet: result.content,
      url: result.url,
      source: 'SearxNG'
    }));
  }
}
```

### Option B: Keep Current (DuckDuckGo Fallback)

Your current implementation already uses DuckDuckGo as fallback, which is free and open-source.

---

## Recommendation

**For fully open-source stack:**

1. **Primary:** SearxNG (self-hosted)
   - Best quality
   - Fully open-source
   - ~$15/month infrastructure

2. **Fallback:** DuckDuckGo (already implemented)
   - Free
   - Less reliable but works

**Total cost:** ~$15/month (vs $50-100/month for SerpAPI)

---

## Summary

**Yes, there are open-source web search options:**

1. ✅ **SearxNG** - Best option, self-hosted, ~$15/month
2. ✅ **DuckDuckGo** - Free, already in your code
3. ⚠️ **Brave API** - Free tier, not fully open-source
4. ⚠️ **Bing API** - Free tier, not open-source

**For a fully open-source MPC stack:**
- **LLM:** Ollama + Llama/Mistral (self-hosted)
- **Web Search:** SearxNG (self-hosted)
- **Database:** PostgreSQL (already have)
- **Total:** ~$375/month (vs $3,000+/month for APIs)

