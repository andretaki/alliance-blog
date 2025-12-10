/**
 * Anthropic Provider
 *
 * Implementation of AI provider interface using Anthropic's Claude API.
 * Supports Claude Sonnet 4.5 (claude-sonnet-4-5-20250514)
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type { AIProvider, GenerationOptions } from './types';
import { AI_CONFIG } from '@/lib/config/constants';

/**
 * Create Anthropic client lazily
 */
function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  return new Anthropic({ apiKey });
}

/**
 * Get Anthropic client (lazy initialization)
 */
let _anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropicClient) {
    _anthropicClient = createClient();
  }
  return _anthropicClient;
}

/**
 * Default Claude model
 */
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Key mapping for common variations Claude uses
 */
const KEY_ALIASES: Record<string, string> = {
  // Topic discovery
  blog_topics: 'topics',
  topic_title: 'topic',
  primary_keyword: 'primaryKeyword',
  content_angle: 'angle',
  search_intent: 'searchIntent',
  eeat_scores: 'eeatScore',
  eeat_score: 'eeatScore',
  alliance_unique_angle: 'uniqueAngle',
  unique_alliance_angle: 'uniqueAngle',
  uniqueAllianceAngle: 'uniqueAngle',
  relevant_collections: 'relevantProducts',
  relevantCollections: 'relevantProducts',
  angle_suggestions: 'angles',

  // Outline generation
  opening_hook: 'openingHook',
  hook_type: 'type',
  hookType: 'type',
  what_to_convey: 'description',
  whatToConvey: 'description',
  hero_answer: 'heroAnswer',
  key_points: 'keyPoints',
  key_points_for_answer: 'keyPointsForAnswer',
  keyPointsForAnswer: 'keyPointsForAnswer',
  answer_points: 'keyPointsForAnswer',
  answerPoints: 'keyPointsForAnswer',
  heading_level: 'headingLevel',
  eeat_element: 'eeatElement',
  internal_link: 'internalLink',
  image_opportunity: 'imageOpportunity',
  estimated_words: 'estimatedWords',
  primary_product: 'primaryProduct',
  primary_product_url: 'primaryProductUrl',
  value_proposition: 'valueProposition',
  secondary_cta: 'secondaryCTA',
  secondaryCta: 'secondaryCTA',
};

/**
 * Value normalization for enum-like fields
 */
const VALUE_NORMALIZERS: Record<string, (val: string) => string> = {
  angle: (val: string) => {
    // Normalize angle values
    const normalized = val.toLowerCase().replace(/[-_\s]/g, '');
    if (normalized === 'howto' || normalized === 'how') return 'howto';
    if (normalized === 'faq' || normalized === 'faqs') return 'faq';
    if (normalized === 'technicalguide' || normalized === 'guide') return 'technical';
    if (normalized === 'safetyguide') return 'safety';
    return val.toLowerCase().replace(/[-_\s]/g, '');
  },
  searchIntent: (val: string) => val.toLowerCase().replace(/[-_\s]/g, ''),
  type: (val: string) => {
    // Normalize openingHook type values
    const normalized = val.toLowerCase().replace(/[-_\s]/g, '');
    if (normalized.includes('problem')) return 'problem';
    if (normalized.includes('story') || normalized.includes('anecdote')) return 'story';
    if (normalized.includes('stat') || normalized.includes('number') || normalized.includes('data')) return 'statistic';
    if (normalized.includes('question') || normalized.includes('rhetor')) return 'question';
    return normalized;
  },
  headingLevel: (val: string) => {
    const normalized = val.toLowerCase().replace(/[-_\s]/g, '');
    if (normalized === 'h2' || normalized === '2') return 'h2';
    if (normalized === 'h3' || normalized === '3') return 'h3';
    return val.toLowerCase();
  },
};

/**
 * Transform keys from snake_case to camelCase and apply aliases
 * Also normalizes enum values
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformKeys(obj: any, parentKey?: string): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, parentKey));
  }

  if (obj && typeof obj === 'object') {
    // Special handling for eeatScore - Claude sometimes returns {score: N, justification: "..."}
    // for each field instead of just the number
    if (parentKey === 'eeatScore') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = KEY_ALIASES[key] || snakeToCamel(key);
        // Extract score if it's a nested object with score property
        if (value && typeof value === 'object' && 'score' in (value as object)) {
          result[newKey] = (value as { score: number }).score;
        } else {
          result[newKey] = value;
        }
      }
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // First check aliases, then convert snake_case
      const newKey = KEY_ALIASES[key] || snakeToCamel(key);
      result[newKey] = transformKeys(value, newKey);
    }
    return result;
  }

  // Apply value normalization for string enum fields
  if (typeof obj === 'string' && parentKey && VALUE_NORMALIZERS[parentKey]) {
    return VALUE_NORMALIZERS[parentKey](obj);
  }

  return obj;
}

/**
 * Anthropic text generation provider
 */
export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private get client(): Anthropic {
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
      model = DEFAULT_CLAUDE_MODEL,
    } = options;

    // Convert Zod schema to JSON Schema for the tool
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSchema = zodToJsonSchema(schema as any, {
      $refStrategy: 'none',
      target: 'jsonSchema7',
    }) as Record<string, unknown>;

    // Ensure the schema has type: "object" as required by Anthropic
    // and copy only necessary fields
    const jsonSchema: Record<string, unknown> = {
      type: 'object',
    };

    // Copy properties if they exist
    if (rawSchema.properties) {
      jsonSchema.properties = rawSchema.properties;
    }
    if (rawSchema.required) {
      jsonSchema.required = rawSchema.required;
    }
    if (rawSchema.additionalProperties !== undefined) {
      jsonSchema.additionalProperties = rawSchema.additionalProperties;
    }

    // Use tool_use to get structured output
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || undefined,
      tools: [
        {
          name: 'structured_output',
          description: 'Output the requested data as a JSON object. Fill in actual values, not a schema description. Return real content based on the user prompt.',
          input_schema: jsonSchema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: 'structured_output' },
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract the tool use result
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUseBlock) {
      console.error('Anthropic response:', JSON.stringify(response.content, null, 2));
      throw new Error('No structured output in Anthropic response');
    }

    // Extract the actual data - Claude sometimes nests it under 'data' key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let input = toolUseBlock.input as any;

    // Debug: Log raw input keys
    if (process.env.DEBUG_ANTHROPIC) {
      console.error('Raw tool input keys:', Object.keys(input || {}));
      console.error('Raw tool input:', JSON.stringify(input, null, 2).slice(0, 500));
      console.error('JSON Schema sent:', JSON.stringify(jsonSchema, null, 2).slice(0, 500));
    }

    // Detect if Claude returned the schema instead of data
    // This happens when the response has 'type', 'properties', 'required' at top level
    if (input && typeof input === 'object') {
      const keys = Object.keys(input);
      const schemaIndicators = ['type', 'properties', 'required', 'parameters'];
      if (keys.some(k => schemaIndicators.includes(k)) && !keys.includes('openingHook') && !keys.includes('topics') && !keys.includes('sections')) {
        // This is a schema echo - fall back to text generation with JSON parsing
        console.error('Tool returned schema instead of data. Falling back to text generation...');

        // Build a cleaner schema representation for the prompt
        const schemaDesc = JSON.stringify(jsonSchema, null, 2);

        const textResponse = await this.generateText(
          prompt + `\n\n---\nIMPORTANT: You must respond with ONLY a valid JSON object that matches this exact schema structure:\n\n${schemaDesc}\n\nFill in real, useful content values - do NOT return the schema itself. Return actual data based on the task. No markdown code blocks, no explanation, ONLY the JSON object.`,
          { systemPrompt, temperature, maxTokens, model }
        );

        // Extract JSON from response (handle potential markdown code blocks)
        let jsonStr = textResponse.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Could not extract JSON from text response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const transformed = transformKeys(parsed);
        return schema.parse(transformed);
      }
    }

    // Handle various nested wrappers Claude might use
    // Keep unwrapping single-key objects until we hit actual data
    const unwrapperKeys = ['data', 'properties', 'schema', 'output', 'result', 'response'];
    let unwrapped = true;
    while (unwrapped && input && typeof input === 'object') {
      unwrapped = false;
      const keys = Object.keys(input);

      // If single key and it's a wrapper key, unwrap
      if (keys.length === 1) {
        const key = keys[0];
        if (unwrapperKeys.includes(key)) {
          input = input[key];
          unwrapped = true;
          continue;
        }
        // If single key is an object with nested structure, check if we should unwrap
        const val = input[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Check if the nested object has our expected keys
          const nestedKeys = Object.keys(val);
          if (nestedKeys.some(k => ['openingHook', 'sections', 'topics', 'faqs', 'heroAnswer'].includes(k))) {
            input = val;
            unwrapped = true;
          }
        }
      }
    }

    // Handle Claude using different property names (e.g., blog_topics instead of topics)
    // and convert snake_case to camelCase throughout
    if (input && typeof input === 'object') {
      input = transformKeys(input);
    }

    // Debug: Log transformed input
    if (process.env.DEBUG_ANTHROPIC) {
      console.error('Transformed input keys:', Object.keys(input || {}));
    }

    // Validate with Zod schema
    try {
      const validated = schema.parse(input);
      return validated;
    } catch (err) {
      console.error('Validation failed. Input keys:', Object.keys(input || {}));
      console.error('Input sample:', JSON.stringify(input, null, 2).slice(0, 1000));
      throw err;
    }
  }

  async generateText(
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    const {
      systemPrompt,
      temperature = AI_CONFIG.temperature.creative,
      maxTokens = AI_CONFIG.maxTokens.draft,
      model = DEFAULT_CLAUDE_MODEL,
    } = options;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    return textBlock?.text || '';
  }

  async *streamText(
    prompt: string,
    options: GenerationOptions = {}
  ): AsyncIterable<string> {
    const {
      systemPrompt,
      temperature = AI_CONFIG.temperature.creative,
      maxTokens = AI_CONFIG.maxTokens.draft,
      model = DEFAULT_CLAUDE_MODEL,
    } = options;

    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}

// Default instance
export const anthropicProvider = new AnthropicProvider();
