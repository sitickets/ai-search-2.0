/**
 * Web Search Service
 * Enhances search results with contextual data from web searches
 */

import axios from 'axios';
import { config } from '../config/env';

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
  private braveConfig = config.webSearch.brave;
  private serpConfig = config.webSearch.serp;
  private googleConfig = config.webSearch.google;
  private searxngConfig = config.webSearch.searxng;

  constructor() {
    // Config loaded from env.ts
  }

  /**
   * Search the web for contextual information
   */
  async search(params: WebSearchParams): Promise<WebSearchResult[]> {
    const { query, limit = 5, type = 'general' } = params;

    // Try Brave Search API first (open-source index, free tier)
    if (this.braveConfig.apiKey()) {
      try {
        return await this.searchWithBraveAPI(query, limit, type);
      } catch (error) {
        console.error('Brave API search error:', error);
        // Fall through to next option
      }
    }

    // Try SearxNG (self-hosted, if configured)
    if (this.searxngConfig.url()) {
      try {
        return await this.searchWithSearxNG(query, limit, type);
      } catch (error) {
        console.error('SearxNG search error:', error);
        // Fall through to next option
      }
    }

    // Try SerpAPI (more reliable, free tier available)
    if (this.serpConfig.apiKey()) {
      try {
        return await this.searchWithSerpAPI(query, limit, type);
      } catch (error) {
        console.error('SerpAPI search error:', error);
        // Fall through to next option
      }
    }

    // Fallback to Google Custom Search API
    if (this.googleConfig.apiKey() && this.googleConfig.engineId()) {
      try {
        return await this.searchWithGoogleAPI(query, limit, type);
      } catch (error) {
        console.error('Google API search error:', error);
        // Fall through to next option
      }
    }

    // Last resort: Return empty results (don't use unreliable HTML scraping)
    console.warn('All web search APIs unavailable, returning empty results');
    return [];
  }

  /**
   * Search using Brave Search API
   * Free tier: 2,000 queries/month
   * Paid: $3 per 1,000 queries after free tier
   */
  private async searchWithBraveAPI(
    query: string,
    limit: number,
    type: string
  ): Promise<WebSearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQueryForType(query, type);
      const response = await axios.get(this.braveConfig.apiUrl(), {
        headers: {
          'X-Subscription-Token': this.braveConfig.apiKey()!
        },
        params: {
          q: enhancedQuery,
          count: Math.min(limit, 20), // Brave API max is 20 per request
          safesearch: 'moderate',
          freshness: 'pd' // Past day for recent results
        },
        timeout: this.braveConfig.timeout()
      });

      const results: WebSearchResult[] = [];
      if (response.data.web && response.data.web.results) {
        response.data.web.results.slice(0, limit).forEach((result: any) => {
          results.push({
            title: result.title,
            snippet: result.description || '',
            url: result.url,
            source: 'Brave Search'
          });
        });
      }

      return results;
    } catch (error: any) {
      console.error('Brave API search error:', error.message);
      throw error; // Re-throw to allow fallback
    }
  }

  /**
   * Search using SerpAPI (serpapi.com)
   * Free tier: 100 searches/month
   */
  /**
   * Search using SearxNG (self-hosted metasearch engine)
   * Open-source alternative to commercial APIs
   */
  private async searchWithSearxNG(
    query: string,
    limit: number,
    type: string
  ): Promise<WebSearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQueryForType(query, type);
      const searxngUrl = this.searxngConfig.url()!;
      const response = await axios.get(`${searxngUrl}/search`, {
        params: {
          q: enhancedQuery,
          format: 'json',
          engines: 'google,bing,duckduckgo'
        },
        timeout: this.searxngConfig.timeout()
      });

      const results: WebSearchResult[] = [];
      if (response.data.results) {
        response.data.results.slice(0, limit).forEach((result: any) => {
          results.push({
            title: result.title,
            snippet: result.content || '',
            url: result.url,
            source: 'SearxNG'
          });
        });
      }

      return results;
    } catch (error: any) {
      console.error('SearxNG search error:', error.message);
      throw error;
    }
  }

  private async searchWithSerpAPI(
    query: string,
    limit: number,
    type: string
  ): Promise<WebSearchResult[]> {
    try {
      const enhancedQuery = this.enhanceQueryForType(query, type);
      const response = await axios.get(this.serpConfig.apiUrl(), {
        params: {
          api_key: this.serpConfig.apiKey(),
          q: enhancedQuery,
          engine: 'google',
          num: limit,
          hl: 'en',
          gl: 'us'
        },
        timeout: this.serpConfig.timeout()
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
      throw error; // Re-throw to allow fallback
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
      const response = await axios.get(this.googleConfig.apiUrl(), {
        params: {
          key: this.googleConfig.apiKey(),
          cx: this.googleConfig.engineId(),
          q: enhancedQuery,
          num: Math.min(limit, 10) // Google API max is 10 per request
        },
        timeout: this.googleConfig.timeout()
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
      throw error; // Re-throw to allow fallback
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

