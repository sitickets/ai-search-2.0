/**
 * Environment Configuration
 * Centralized environment variable management with validation
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Database Configuration
  POSTGRES_DATABASE_URL: z.string().url(),
  POSTGRES_DATABASE_URL_RO: z.string().url().or(z.literal('')).optional(), // Read-only endpoint
  DB_POOL_MAX: z.string().regex(/^\d+$/).transform(Number).default('20'),
  DB_POOL_IDLE_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  DB_POOL_CONNECTION_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  DB_QUERY_TIMEOUT_MS: z.string().regex(/^\d+$/).transform(Number).optional(), // Query timeout in milliseconds
  DB_MAX_RESULT_ROWS: z.string().regex(/^\d+$/).transform(Number).optional(), // Maximum rows to return
  DB_MAX_QUERY_LENGTH: z.string().regex(/^\d+$/).transform(Number).optional(), // Maximum query string length
  DB_ENABLE_COMPLEXITY_CHECK: z.string().optional(), // Enable query complexity checks
  DB_ENABLE_STATEMENT_TIMEOUT: z.string().optional(), // Enable PostgreSQL statement_timeout
  
  // LLM Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE_URL: z.string().url().or(z.literal('')).optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_TEMPERATURE: z.string().regex(/^\d+\.?\d*$/).transform(Number).optional(),
  
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_API_BASE_URL: z.string().url().or(z.literal('')).optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  
  // Self-Hosted LLM (Ollama) - Support both LLM_BASE_URL (jira-feature-documentor pattern) and OLLAMA_BASE_URL
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  OLLAMA_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  
  // Web Search APIs
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_URL: z.string().url().or(z.literal('')).optional(),
  BRAVE_SEARCH_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  
  SERP_API_KEY: z.string().optional(),
  SERP_API_URL: z.string().url().or(z.literal('')).optional(),
  SERP_API_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  
  GOOGLE_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),
  GOOGLE_SEARCH_API_URL: z.string().url().or(z.literal('')).optional(),
  GOOGLE_SEARCH_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  
  // Self-Hosted Web Search (SearxNG)
  SEARXNG_URL: z.string().url().or(z.literal('')).optional(),
  SEARXNG_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).optional(),
  
  // Vector Database (Optional - for RAG)
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_ENVIRONMENT: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().optional(),
  PINECONE_API_URL: z.string().url().or(z.literal('')).optional(),
  
  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // CORS Configuration
  CORS_ORIGIN: z.string().default('*'),
  
  // API Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let envConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    envConfig = envSchema.parse(process.env);
  }
  return envConfig;
}

// Export individual config getters for convenience
export const config = {
  server: {
    nodeEnv: () => getEnvConfig().NODE_ENV,
    port: () => getEnvConfig().PORT,
    logLevel: () => getEnvConfig().LOG_LEVEL,
  },
  database: {
    url: () => getEnvConfig().POSTGRES_DATABASE_URL,
    urlRo: () => getEnvConfig().POSTGRES_DATABASE_URL_RO,
    poolMax: () => getEnvConfig().DB_POOL_MAX,
    poolIdleTimeout: () => getEnvConfig().DB_POOL_IDLE_TIMEOUT,
    poolConnectionTimeout: () => getEnvConfig().DB_POOL_CONNECTION_TIMEOUT,
  },
  llm: {
    openai: {
      apiKey: () => getEnvConfig().OPENAI_API_KEY,
      baseUrl: () => getEnvConfig().OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
      model: () => getEnvConfig().OPENAI_MODEL || 'gpt-4',
      temperature: () => getEnvConfig().OPENAI_TEMPERATURE ?? 0,
    },
    anthropic: {
      apiKey: () => getEnvConfig().ANTHROPIC_API_KEY,
      baseUrl: () => getEnvConfig().ANTHROPIC_API_BASE_URL || 'https://api.anthropic.com/v1',
      model: () => getEnvConfig().ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    },
    ollama: {
      // Support both LLM_BASE_URL (jira-feature-documentor pattern) and OLLAMA_BASE_URL (legacy)
      // Only use default if neither is provided, and validate URL if provided
      baseUrl: () => {
        const url = getEnvConfig().LLM_BASE_URL || getEnvConfig().OLLAMA_BASE_URL || 'http://localhost:11434';
        // Validate URL format if not empty
        if (url && url !== 'http://localhost:11434') {
          try {
            new URL(url);
          } catch {
            console.warn(`Invalid LLM_BASE_URL/OLLAMA_BASE_URL: ${url}, using default`);
            return 'http://localhost:11434';
          }
        }
        return url;
      },
      // Support both LLM_MODEL (jira-feature-documentor pattern) and OLLAMA_MODEL (legacy)
      model: () => getEnvConfig().LLM_MODEL || getEnvConfig().OLLAMA_MODEL || 'llama3.2:3b',
      timeout: () => getEnvConfig().OLLAMA_TIMEOUT ?? 30000,
    },
  },
  webSearch: {
    brave: {
      apiKey: () => getEnvConfig().BRAVE_SEARCH_API_KEY,
      apiUrl: () => getEnvConfig().BRAVE_SEARCH_API_URL || 'https://api.search.brave.com/res/v1/web/search',
      timeout: () => getEnvConfig().BRAVE_SEARCH_TIMEOUT ?? 10000,
    },
    serp: {
      apiKey: () => getEnvConfig().SERP_API_KEY,
      apiUrl: () => getEnvConfig().SERP_API_URL || 'https://serpapi.com/search.json',
      timeout: () => getEnvConfig().SERP_API_TIMEOUT ?? 10000,
    },
    google: {
      apiKey: () => getEnvConfig().GOOGLE_SEARCH_API_KEY,
      engineId: () => getEnvConfig().GOOGLE_SEARCH_ENGINE_ID,
      apiUrl: () => getEnvConfig().GOOGLE_SEARCH_API_URL || 'https://www.googleapis.com/customsearch/v1',
      timeout: () => getEnvConfig().GOOGLE_SEARCH_TIMEOUT ?? 10000,
    },
    searxng: {
      url: () => getEnvConfig().SEARXNG_URL,
      timeout: () => getEnvConfig().SEARXNG_TIMEOUT ?? 10000,
    },
  },
  vectorDb: {
    pinecone: {
      apiKey: () => getEnvConfig().PINECONE_API_KEY,
      environment: () => getEnvConfig().PINECONE_ENVIRONMENT,
      indexName: () => getEnvConfig().PINECONE_INDEX_NAME,
      apiUrl: () => getEnvConfig().PINECONE_API_URL || 'https://api.pinecone.io',
    },
  },
  aws: {
    region: () => getEnvConfig().AWS_REGION,
    accessKeyId: () => getEnvConfig().AWS_ACCESS_KEY_ID,
    secretAccessKey: () => getEnvConfig().AWS_SECRET_ACCESS_KEY,
  },
  cors: {
    origin: () => getEnvConfig().CORS_ORIGIN,
  },
  rateLimit: {
    windowMs: () => getEnvConfig().RATE_LIMIT_WINDOW_MS,
    maxRequests: () => getEnvConfig().RATE_LIMIT_MAX_REQUESTS,
  },
};

