/**
 * OpenAI Provider
 *
 * Implementation of AI provider interface using OpenAI's API.
 */

import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type { AIProvider, EmbeddingProvider, GenerationOptions } from './types';
import { AI_CONFIG, EMBEDDING_CONFIG } from '@/lib/config/constants';

/**
 * Create OpenAI client lazily
 */
function createClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}

/**
 * Get OpenAI client (lazy initialization)
 */
let _openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = createClient();
  }
  return _openaiClient;
}

/**
 * OpenAI text generation provider
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private get client(): OpenAI {
    return getClient();
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: GenerationOptions = {}
  ): Promise<T> {
    const {
      systemPrompt,
      temperature = AI_CONFIG.temperature.structured,
      maxTokens = AI_CONFIG.maxTokens.draft,
      model = AI_CONFIG.models.openai,
    } = options;

    // Convert Zod schema to JSON Schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonSchema = zodToJsonSchema(schema as any, {
      $refStrategy: 'none',
      target: 'openApi3',
    });

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'output',
          schema: jsonSchema as Record<string, unknown>,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse and validate
    const parsed = JSON.parse(content);
    const validated = schema.parse(parsed);

    return validated;
  }

  async generateText(
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    const {
      systemPrompt,
      temperature = AI_CONFIG.temperature.creative,
      maxTokens = AI_CONFIG.maxTokens.draft,
      model = AI_CONFIG.models.openai,
    } = options;

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  }

  async *streamText(
    prompt: string,
    options: GenerationOptions = {}
  ): AsyncIterable<string> {
    const {
      systemPrompt,
      temperature = AI_CONFIG.temperature.creative,
      maxTokens = AI_CONFIG.maxTokens.draft,
      model = AI_CONFIG.models.openai,
    } = options;

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

/**
 * OpenAI embedding provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  dimensions = EMBEDDING_CONFIG.dimensions;
  private get client(): OpenAI {
    return getClient();
  }
  private model = EMBEDDING_CONFIG.model;

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });

    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // OpenAI allows up to 2048 inputs per request, but we batch smaller
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.batchSize) {
      batches.push(texts.slice(i, i + EMBEDDING_CONFIG.batchSize));
    }

    const results: number[][] = [];

    for (const batch of batches) {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });

      for (const item of response.data) {
        results.push(item.embedding);
      }
    }

    return results;
  }
}

// Default instances
export const openaiProvider = new OpenAIProvider();
export const openaiEmbeddings = new OpenAIEmbeddingProvider();
