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
  POSTGRES_DATABASE_URL_RO: z.string().url().optional(), // Read-only endpoint
  DB_POOL_MAX: z.string().regex(/^\d+$/).transform(Number).default('20'),
  DB_POOL_IDLE_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  DB_POOL_CONNECTION_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  
  // LLM Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE_URL: z.string().url().optional().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_TEMPERATURE: z.string().regex(/^\d+\.?\d*$/).transform(Number).default('0'),
  
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_API_BASE_URL: z.string().url().optional().default('https://api.anthropic.com/v1'),
  ANTHROPIC_MODEL: z.string().default('claude-3-sonnet-20240229'),
  
  // Self-Hosted LLM (Ollama)
  OLLAMA_BASE_URL: z.string().url().optional().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama2:7b'),
  OLLAMA_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  
  // Web Search APIs
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_URL: z.string().url().optional().default('https://api.search.brave.com/res/v1/web/search'),
  BRAVE_SEARCH_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  
  SERP_API_KEY: z.string().optional(),
  SERP_API_URL: z.string().url().optional().default('https://serpapi.com/search.json'),
  SERP_API_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  
  GOOGLE_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),
  GOOGLE_SEARCH_API_URL: z.string().url().optional().default('https://www.googleapis.com/customsearch/v1'),
  GOOGLE_SEARCH_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  
  // Self-Hosted Web Search (SearxNG)
  SEARXNG_URL: z.string().url().optional(),
  SEARXNG_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  
  // Vector Database (Optional - for RAG)
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_ENVIRONMENT: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().optional(),
  PINECONE_API_URL: z.string().url().optional().default('https://api.pinecone.io'),
  
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
      baseUrl: () => getEnvConfig().OPENAI_API_BASE_URL,
      model: () => getEnvConfig().OPENAI_MODEL,
      temperature: () => getEnvConfig().OPENAI_TEMPERATURE,
    },
    anthropic: {
      apiKey: () => getEnvConfig().ANTHROPIC_API_KEY,
      baseUrl: () => getEnvConfig().ANTHROPIC_API_BASE_URL,
      model: () => getEnvConfig().ANTHROPIC_MODEL,
    },
    ollama: {
      baseUrl: () => getEnvConfig().OLLAMA_BASE_URL,
      model: () => getEnvConfig().OLLAMA_MODEL,
      timeout: () => getEnvConfig().OLLAMA_TIMEOUT,
    },
  },
  webSearch: {
    brave: {
      apiKey: () => getEnvConfig().BRAVE_SEARCH_API_KEY,
      apiUrl: () => getEnvConfig().BRAVE_SEARCH_API_URL,
      timeout: () => getEnvConfig().BRAVE_SEARCH_TIMEOUT,
    },
    serp: {
      apiKey: () => getEnvConfig().SERP_API_KEY,
      apiUrl: () => getEnvConfig().SERP_API_URL,
      timeout: () => getEnvConfig().SERP_API_TIMEOUT,
    },
    google: {
      apiKey: () => getEnvConfig().GOOGLE_SEARCH_API_KEY,
      engineId: () => getEnvConfig().GOOGLE_SEARCH_ENGINE_ID,
      apiUrl: () => getEnvConfig().GOOGLE_SEARCH_API_URL,
      timeout: () => getEnvConfig().GOOGLE_SEARCH_TIMEOUT,
    },
    searxng: {
      url: () => getEnvConfig().SEARXNG_URL,
      timeout: () => getEnvConfig().SEARXNG_TIMEOUT,
    },
  },
  vectorDb: {
    pinecone: {
      apiKey: () => getEnvConfig().PINECONE_API_KEY,
      environment: () => getEnvConfig().PINECONE_ENVIRONMENT,
      indexName: () => getEnvConfig().PINECONE_INDEX_NAME,
      apiUrl: () => getEnvConfig().PINECONE_API_URL,
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

