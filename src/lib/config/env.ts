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
  GOOGLE_API_KEY: z.string().min(1).optional(), // For Gemini image generation

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

  // Autopilot configuration
  AUTOPILOT_ENABLED: z.coerce.boolean().default(true),
  AUTOPILOT_ADMIN_SECRET: z.string().min(1).optional(), // Required for non-session requests
  AUTOPILOT_RATE_LIMIT_PER_HOUR: z.coerce.number().default(10),
  AUTOPILOT_MAX_CONCURRENT_JOBS: z.coerce.number().default(1),
  AUTOPILOT_JOB_TIMEOUT_SECONDS: z.coerce.number().default(120),
  AUTOPILOT_ALLOWED_COLLECTIONS: z.string().optional(), // Comma-separated allowlist
  AUTOPILOT_BLOCKED_COLLECTIONS: z.string().optional(), // Comma-separated blocklist
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
      AUTOPILOT_ENABLED: false, // Safe default - must be explicitly enabled
      AUTOPILOT_RATE_LIMIT_PER_HOUR: 10,
      AUTOPILOT_MAX_CONCURRENT_JOBS: 1,
      AUTOPILOT_JOB_TIMEOUT_SECONDS: 120,
    };
  }

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    SHOPIFY_STORE: process.env.SHOPIFY_STORE,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    ORGANIZATION_NAME: process.env.ORGANIZATION_NAME,
    ORGANIZATION_LOGO_URL: process.env.ORGANIZATION_LOGO_URL,
    ORGANIZATION_WEBSITE_URL: process.env.ORGANIZATION_WEBSITE_URL,
    AUTOPILOT_ENABLED: process.env.AUTOPILOT_ENABLED,
    AUTOPILOT_ADMIN_SECRET: process.env.AUTOPILOT_ADMIN_SECRET,
    AUTOPILOT_RATE_LIMIT_PER_HOUR: process.env.AUTOPILOT_RATE_LIMIT_PER_HOUR,
    AUTOPILOT_MAX_CONCURRENT_JOBS: process.env.AUTOPILOT_MAX_CONCURRENT_JOBS,
    AUTOPILOT_JOB_TIMEOUT_SECONDS: process.env.AUTOPILOT_JOB_TIMEOUT_SECONDS,
    AUTOPILOT_ALLOWED_COLLECTIONS: process.env.AUTOPILOT_ALLOWED_COLLECTIONS,
    AUTOPILOT_BLOCKED_COLLECTIONS: process.env.AUTOPILOT_BLOCKED_COLLECTIONS,
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
 * Check if Google AI is configured (for image generation)
 */
export function isGoogleAIConfigured(): boolean {
  return !!env.GOOGLE_API_KEY;
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

/**
 * Check if autopilot is enabled
 */
export function isAutopilotEnabled(): boolean {
  return env.AUTOPILOT_ENABLED;
}

/**
 * Get autopilot configuration
 */
export function getAutopilotConfig() {
  const allowedCollections = env.AUTOPILOT_ALLOWED_COLLECTIONS
    ? env.AUTOPILOT_ALLOWED_COLLECTIONS.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  const blockedCollections = env.AUTOPILOT_BLOCKED_COLLECTIONS
    ? env.AUTOPILOT_BLOCKED_COLLECTIONS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    enabled: env.AUTOPILOT_ENABLED,
    adminSecret: env.AUTOPILOT_ADMIN_SECRET,
    rateLimitPerHour: env.AUTOPILOT_RATE_LIMIT_PER_HOUR,
    maxConcurrentJobs: env.AUTOPILOT_MAX_CONCURRENT_JOBS,
    jobTimeoutSeconds: env.AUTOPILOT_JOB_TIMEOUT_SECONDS,
    allowedCollections,
    blockedCollections,
  };
}
