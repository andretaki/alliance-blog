/**
 * Environment Configuration
 *
 * Centralized, type-safe access to environment variables.
 * Validates required variables and provides defaults where appropriate.
 */

import { z } from 'zod';

/**
 * Environment variable schema
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // AI Providers
  OPENAI_API_KEY: z.string().min(1).optional(), // Required for embeddings
  ANTHROPIC_API_KEY: z.string().min(1), // Default provider (Claude Sonnet 4.5)

  // Shopify
  SHOPIFY_STORE: z.string().min(1).optional(),
  SHOPIFY_ACCESS_TOKEN: z.string().min(1).optional(),
  SHOPIFY_API_KEY: z.string().min(1).optional(),
  SHOPIFY_API_SECRET: z.string().min(1).optional(),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Organization (for JSON-LD)
  ORGANIZATION_NAME: z.string().default('Alliance Chemical'),
  ORGANIZATION_LOGO_URL: z.string().url().optional(),
  ORGANIZATION_WEBSITE_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

/**
 * Check if we're in a build context (no runtime env vars)
 */
function isBuildTime(): boolean {
  // During build, DATABASE_URL and ANTHROPIC_API_KEY are usually not set
  // We detect this by checking if required vars are missing
  return !process.env.DATABASE_URL && !process.env.ANTHROPIC_API_KEY;
}

/**
 * Parse and validate environment variables
 */
function getEnv(): Env {
  // Skip validation during build time to allow static generation
  if (isBuildTime()) {
    console.warn('Environment variables not validated - build context detected');
    return {
      DATABASE_URL: 'postgres://placeholder:placeholder@localhost:5432/placeholder',
      ANTHROPIC_API_KEY: 'placeholder',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      ORGANIZATION_NAME: 'Alliance Chemical',
    };
  }

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SHOPIFY_STORE: process.env.SHOPIFY_STORE,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    ORGANIZATION_NAME: process.env.ORGANIZATION_NAME,
    ORGANIZATION_LOGO_URL: process.env.ORGANIZATION_LOGO_URL,
    ORGANIZATION_WEBSITE_URL: process.env.ORGANIZATION_WEBSITE_URL,
  });

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

/**
 * Validated environment variables (lazy evaluation)
 */
let _env: Env | null = null;
export function getEnvironment(): Env {
  if (!_env) {
    _env = getEnv();
  }
  return _env;
}

// For backwards compatibility, but prefer getEnvironment() in new code
export const env = getEnv();

/**
 * Check if Shopify integration is configured
 */
export function isShopifyConfigured(): boolean {
  return !!(
    env.SHOPIFY_STORE &&
    env.SHOPIFY_ACCESS_TOKEN
  );
}

/**
 * Check if OpenAI is configured (for embeddings)
 */
export function isOpenAIConfigured(): boolean {
  return !!env.OPENAI_API_KEY;
}

/**
 * Get organization info for JSON-LD
 */
export function getOrganizationInfo() {
  return {
    name: env.ORGANIZATION_NAME,
    logoUrl: env.ORGANIZATION_LOGO_URL || `${env.NEXT_PUBLIC_APP_URL}/logo.png`,
    websiteUrl: env.ORGANIZATION_WEBSITE_URL || env.NEXT_PUBLIC_APP_URL,
  };
}
