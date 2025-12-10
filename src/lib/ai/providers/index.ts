/**
 * AI Providers Index
 *
 * Exports all AI providers and a helper to get the configured default.
 */

export * from './types';
export { openaiProvider, OpenAIProvider } from './openai';
export { anthropicProvider, AnthropicProvider } from './anthropic';

import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { AI_CONFIG } from '@/lib/config/constants';
import type { AIProvider } from './types';

/**
 * Get the default AI provider based on config
 */
export function getDefaultProvider(): AIProvider {
  return AI_CONFIG.defaultProvider === 'anthropic'
    ? anthropicProvider
    : openaiProvider;
}

/**
 * Get a specific provider by name
 */
export function getProvider(name: 'openai' | 'anthropic'): AIProvider {
  return name === 'anthropic' ? anthropicProvider : openaiProvider;
}
