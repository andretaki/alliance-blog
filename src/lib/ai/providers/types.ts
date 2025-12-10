/**
 * AI Provider Types
 *
 * Common interfaces for AI providers.
 */

import type { z } from 'zod';

/**
 * Options for text generation
 */
export interface GenerationOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * AI provider interface
 */
export interface AIProvider {
  name: string;

  /**
   * Generate structured output that conforms to a Zod schema
   */
  generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions
  ): Promise<T>;

  /**
   * Generate plain text
   */
  generateText(prompt: string, options?: GenerationOptions): Promise<string>;

  /**
   * Stream text generation
   */
  streamText(
    prompt: string,
    options?: GenerationOptions
  ): AsyncIterable<string>;
}

/**
 * Embedding model interface
 */
export interface EmbeddingProvider {
  name: string;
  dimensions: number;

  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}
