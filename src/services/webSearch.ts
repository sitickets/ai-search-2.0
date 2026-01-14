/**
 * Web Search Service
 * Enhances search results with contextual data from web searches
 */

import axios from 'axios';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
}

export interface WebSearchParams {
  query: string;
  limit?: number;
  type?: 'performer' | 'event' | 'venue' | 'general';
}

export class WebSearchService {
  private serpApiKey?: string;
  private googleApiKey?: string;
  private googleSearchEngineId?: string;

  constructor() {
    this.serpApiKey = process.env.SERP_API_KEY;
    this.googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  /**
   * Search the web for contextual information
   */
  async search(params: WebSearchParams): Promise<WebSearchResult[]> {
    const { query, limit = 5, type = 'general' } = params;

    // Try SerpAPI first (more reliable, free tier available)
    if (this.serpApiKey) {
      return await this.searchWithSerpAPI(query, limit, type);
    }

    // Fallback to Google Custom Search API
    if (this.googleApiKey && this.googleSearchEngineId) {
      return await this.searchWithGoogleAPI(query, limit, type);
    }

    // Fallback to DuckDuckGo (no API key needed, but less reliable)
    return await this.searchWithDuckDuckGo(query, limit, type);
  }

  /**
   * Search using SerpAPI (serpapi.com)
   * Free tier: 100 searches/month
   */
  private async searchWithSerpAPI(
    query: string,
    limit: number,
    type: string
  ): Promise<WebSearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQueryForType(query, type);
      const response = await axios.get('https://serpapi.com/search.json', {
        params: {
          api_key: this.serpApiKey,
          q: enhancedQuery,
          engine: 'google',
          num: limit,
          hl: 'en',
          gl: 'us'
        },
        timeout: 10000
      });

      const results: WebSearchResult[] = [];
      if (response.data.organic_results) {
        response.data.organic_results.slice(0, limit).forEach((result: any) => {
          results.push({
            title: result.title,
            snippet: result.snippet || '',
            url: result.link,
            source: 'SerpAPI'
          });
        });
      }

      return results;
    } catch (error: any) {
      console.error('SerpAPI search error:', error.message);
      // Fallback to DuckDuckGo
      return await this.searchWithDuckDuckGo(query, limit, type);
    }
  }

  /**
   * Search using Google Custom Search API
   * Requires API key and Search Engine ID
   */
  private async searchWithGoogleAPI(
    query: string,
    limit: number,
    type: string
  ): Promise<WebSearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQueryForType(query, type);
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.googleApiKey,
          cx: this.googleSearchEngineId,
          q: enhancedQuery,
          num: Math.min(limit, 10) // Google API max is 10 per request
        },
        timeout: 10000
      });

      const results: WebSearchResult[] = [];
      if (response.data.items) {
        response.data.items.slice(0, limit).forEach((item: any) => {
          results.push({
            title: item.title,
            snippet: item.snippet || '',
            url: item.link,
            source: 'Google'
          });
        });
      }

      return results;
    } catch (error: any) {
      console.error('Google API search error:', error.message);
      // Fallback to DuckDuckGo
      return await this.searchWithDuckDuckGo(query, limit, type);
    }
  }

  /**
   * Search using DuckDuckGo (no API key required)
   * Uses HTML scraping - less reliable but free
   */
  private async searchWithDuckDuckGo(
    query: string,
    limit: number,
    type: string
  ): Promise<WebSearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQueryForType(query, type);
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: {
          q: enhancedQuery
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      // Parse HTML response (simplified - would need proper HTML parsing in production)
      const results: WebSearchResult[] = [];
      const html = response.data;
      
      // Simple regex-based extraction (for production, use cheerio or similar)
      const titleRegex = /<a class="result__a"[^>]*>([^<]+)<\/a>/g;
      const snippetRegex = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
      const urlRegex = /href="([^"]+)"/g;

      let match;
      let count = 0;
      while ((match = titleRegex.exec(html)) !== null && count < limit) {
        const title = match[1];
        const urlMatch = urlRegex.exec(html.substring(match.index));
        const url = urlMatch ? urlMatch[1] : '';
        
        results.push({
          title: title.trim(),
          snippet: '', // DuckDuckGo HTML parsing is complex
          url: url,
          source: 'DuckDuckGo'
        });
        count++;
      }

      return results;
    } catch (error: any) {
      console.error('DuckDuckGo search error:', error.message);
      return [];
    }
  }

  /**
   * Enhance query based on search type
   */
  private enhanceQueryForType(query: string, type: string): string {
    switch (type) {
      case 'performer':
        return `${query} concert tour tickets`;
      case 'event':
        return `${query} event information`;
      case 'venue':
        return `${query} venue location address`;
      default:
        return query;
    }
  }

  /**
   * Search for performer/artist information
   */
  async searchPerformerInfo(performerName: string): Promise<WebSearchResult[]> {
    return await this.search({
      query: performerName,
      type: 'performer',
      limit: 5
    });
  }

  /**
   * Search for event information
   */
  async searchEventInfo(eventName: string): Promise<WebSearchResult[]> {
    return await this.search({
      query: eventName,
      type: 'event',
      limit: 5
    });
  }

  /**
   * Search for venue information
   */
  async searchVenueInfo(venueName: string, location?: string): Promise<WebSearchResult[]> {
    const query = location ? `${venueName} ${location}` : venueName;
    return await this.search({
      query,
      type: 'venue',
      limit: 5
    });
  }

  /**
   * Get contextual information about a performer
   * Returns summary information from web search
   */
  async getPerformerContext(performerName: string): Promise<{
    bio?: string;
    genres?: string[];
    upcomingTours?: string[];
    popularity?: string;
    webResults: WebSearchResult[];
  }> {
    const webResults = await this.searchPerformerInfo(performerName);
    
    // Extract information from snippets (simplified - could use LLM for better extraction)
    const bio = webResults[0]?.snippet || '';
    const genres: string[] = [];
    const upcomingTours: string[] = [];

    // Simple extraction (in production, use LLM to parse and extract structured data)
    webResults.forEach(result => {
      if (result.snippet.toLowerCase().includes('genre')) {
        // Extract genres from snippet
      }
      if (result.snippet.toLowerCase().includes('tour') || result.snippet.toLowerCase().includes('upcoming')) {
        upcomingTours.push(result.title);
      }
    });

    return {
      bio,
      genres,
      upcomingTours,
      webResults
    };
  }
}

// Export singleton instance
export const webSearchService = new WebSearchService();

