/**
 * Topic Finder
 *
 * Discovers content gaps and generates topic suggestions based on
 * product collections and existing blog content.
 */

import { z } from 'zod';
import { getDefaultProvider } from '@/lib/ai/providers';
import {
  COLLECTIONS,
  getProductCollections,
  getIndustryVerticals,
  matchTopicToProducts,
  extractChemicalNames,
  type CollectionData,
} from '@/lib/shopify/product-matcher';
import type { ShopifyContentType } from '@/lib/shopify/content-types';
import {
  getContentIndex,
  isDuplicateTopic,
  findRelatedPosts,
  type ContentIndex,
  type DuplicateCheck,
  type ExistingPost,
} from './existing-content';

// ============================================================================
// TYPES
// ============================================================================

/**
 * E-E-A-T score for evaluating topic quality
 */
export interface EEATScore {
  experience: number; // 1-10: Can we share real experience?
  expertise: number; // 1-10: Do we have technical knowledge?
  authority: number; // 1-10: Are we credible for this?
  trust: number; // 1-10: Can we demonstrate trustworthiness?
}

/**
 * Content angle types for articles
 */
export type ContentAngle =
  | 'howto'
  | 'comparison'
  | 'safety'
  | 'technical'
  | 'faq'
  | 'application';

/**
 * Search intent classification
 */
export type SearchIntent = 'informational' | 'commercial' | 'transactional';

/**
 * A suggested topic with analysis
 */
export interface TopicSuggestion {
  topic: string;
  primaryKeyword: string;
  angle: ContentAngle;
  searchIntent: SearchIntent;
  eeatScore: EEATScore;
  uniqueAngle: string; // What makes our take different
  relevantProducts: string[]; // Collection handles
}

/**
 * A content gap identified in a collection
 */
export interface TopicGap {
  collection: string;
  collectionUrl: string;
  suggestedTopics: TopicSuggestion[];
  reason: string; // Why this gap exists
}

/**
 * Angle suggestion for a topic
 */
export interface AngleSuggestion {
  angle: ContentAngle;
  title: string;
  description: string;
  searchIntent: SearchIntent;
  competitiveAdvantage: string;
}

/**
 * Extended topic suggestion with deduplication info
 */
export interface FilteredTopicSuggestion extends TopicSuggestion {
  duplicateCheck?: DuplicateCheck;
  relatedExistingPosts?: ExistingPost[];
}

// ============================================================================
// ZODS FOR AI STRUCTURED OUTPUT
// ============================================================================

const TopicSuggestionSchema = z.object({
  topic: z.string().describe('The full topic title'),
  primaryKeyword: z.string().describe('Main SEO keyword for this topic'),
  angle: z.enum(['howto', 'comparison', 'safety', 'technical', 'faq', 'application']),
  searchIntent: z.enum(['informational', 'commercial', 'transactional']),
  eeatScore: z.object({
    experience: z.number().min(1).max(10),
    expertise: z.number().min(1).max(10),
    authority: z.number().min(1).max(10),
    trust: z.number().min(1).max(10),
  }),
  uniqueAngle: z.string().describe('What makes Alliance Chemical\'s take unique'),
  relevantProducts: z.array(z.string()).describe('Collection handles'),
});

const TopicIdeasResponseSchema = z.object({
  topics: z.array(TopicSuggestionSchema),
});

const AngleSuggestionSchema = z.object({
  angle: z.enum(['howto', 'comparison', 'safety', 'technical', 'faq', 'application']),
  title: z.string(),
  description: z.string(),
  searchIntent: z.enum(['informational', 'commercial', 'transactional']),
  competitiveAdvantage: z.string(),
});

const AnglesResponseSchema = z.object({
  angles: z.array(AngleSuggestionSchema),
});

const EEATResponseSchema = z.object({
  experience: z.number().min(1).max(10),
  expertise: z.number().min(1).max(10),
  authority: z.number().min(1).max(10),
  trust: z.number().min(1).max(10),
  reasoning: z.object({
    experienceReason: z.string(),
    expertiseReason: z.string(),
    authorityReason: z.string(),
    trustReason: z.string(),
  }),
});

// ============================================================================
// TOPIC FINDING FUNCTIONS
// ============================================================================

/**
 * Find content gaps by cross-referencing collections vs existing blog posts
 */
export async function findContentGaps(
  existingPosts: string[],
  options?: {
    maxGaps?: number;
    topicsPerGap?: number;
    prioritizeCollections?: string[];
  }
): Promise<TopicGap[]> {
  const maxGaps = options?.maxGaps ?? 10;
  const topicsPerGap = options?.topicsPerGap ?? 3;
  const prioritize = new Set(options?.prioritizeCollections ?? []);

  // Normalize existing posts to lowercase for matching
  const existingLower = existingPosts.map((p) => p.toLowerCase());

  // Get product collections (not industry verticals for primary gaps)
  const productCollections = getProductCollections();

  // Score collections by coverage gap
  const collectionCoverage: Array<{
    collection: CollectionData;
    coverage: number;
    matchedPosts: string[];
  }> = [];

  for (const collection of productCollections) {
    // Find posts that mention this collection's chemicals or keywords
    const matchedPosts: string[] = [];
    for (const post of existingPosts) {
      const postLower = post.toLowerCase();
      const hasChemical = collection.chemicals.some((c) => postLower.includes(c.toLowerCase()));
      const hasKeyword = collection.keywords.some((k) => postLower.includes(k.toLowerCase()));
      if (hasChemical || hasKeyword) {
        matchedPosts.push(post);
      }
    }

    // Coverage is percentage of chemicals covered
    const coverage =
      collection.chemicals.length > 0
        ? matchedPosts.length / Math.max(collection.chemicals.length, 3)
        : matchedPosts.length > 0
          ? 0.5
          : 0;

    collectionCoverage.push({
      collection,
      coverage,
      matchedPosts,
    });
  }

  // Sort by lowest coverage (biggest gaps) first
  // But prioritized collections come first
  collectionCoverage.sort((a, b) => {
    const aPriority = prioritize.has(a.collection.handle) ? 0 : 1;
    const bPriority = prioritize.has(b.collection.handle) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.coverage - b.coverage;
  });

  // Generate gaps for lowest-coverage collections
  const gaps: TopicGap[] = [];
  const topCollections = collectionCoverage.slice(0, maxGaps);

  for (const { collection, coverage, matchedPosts } of topCollections) {
    // Generate topic ideas for this collection
    const topics = await generateTopicIdeas(collection.handle, topicsPerGap, {
      existingPosts: matchedPosts,
    });

    gaps.push({
      collection: collection.handle,
      collectionUrl: collection.url,
      suggestedTopics: topics,
      reason:
        coverage === 0
          ? `No existing content covers ${collection.name}`
          : `Only ${matchedPosts.length} posts cover ${collection.name} - room for more depth`,
    });
  }

  return gaps;
}

/**
 * Generate topic ideas for a specific collection
 */
export async function generateTopicIdeas(
  collectionHandle: string,
  count: number = 5,
  options?: {
    existingPosts?: string[];
    focusAngle?: ContentAngle;
    focusIndustry?: string;
  }
): Promise<TopicSuggestion[]> {
  const collection = COLLECTIONS.find((c) => c.handle === collectionHandle);
  if (!collection) {
    throw new Error(`Collection not found: ${collectionHandle}`);
  }

  // Build context about the collection
  const collectionContext = `
Collection: ${collection.name}
URL: ${collection.url}
Keywords: ${collection.keywords.join(', ')}
Chemicals: ${collection.chemicals.join(', ')}
Industries served: ${collection.industries.join(', ')}
Applications: ${collection.applications.join(', ')}
`;

  const existingContext = options?.existingPosts?.length
    ? `\nExisting posts covering this area:\n${options.existingPosts.slice(0, 10).map((p) => `- ${p}`).join('\n')}\n\nAvoid topics too similar to these.`
    : '';

  const focusContext = options?.focusAngle
    ? `\nFocus on "${options.focusAngle}" style content.`
    : '';

  const industryContext = options?.focusIndustry
    ? `\nFocus on the "${options.focusIndustry}" industry vertical.`
    : '';

  const systemPrompt = `You are a content strategist for Alliance Chemical, a chemical supplier with 20+ years of experience.

You generate high-quality blog topic ideas that:
1. Demonstrate E-E-A-T (Experience, Expertise, Authority, Trust)
2. Target keywords with search volume
3. Provide genuine value to industrial/commercial buyers
4. Naturally link to Alliance Chemical products
5. Have a unique angle that differentiates from competitors

For E-E-A-T scoring:
- Experience (1-10): How well can we share real, hands-on experience with this topic?
- Expertise (1-10): How much technical knowledge can we demonstrate?
- Authority (1-10): How credible is Alliance Chemical for this topic?
- Trust (1-10): Can we provide verifiable facts, safety info, certifications?

Alliance Chemical's unique angles include:
- 20+ years selling chemicals to businesses
- Direct experience with customer questions and applications
- Understanding of regulatory compliance (SDS, DOT shipping, FDA/FCC grades)
- Practical knowledge of quantity needs and industrial vs lab applications`;

  const prompt = `Generate ${count} unique blog topic ideas for Alliance Chemical's "${collection.name}" collection.

${collectionContext}
${existingContext}
${focusContext}
${industryContext}

For each topic provide:
1. A specific, searchable topic title
2. The primary keyword to target
3. The content angle (howto, comparison, safety, technical, faq, application)
4. Search intent (informational, commercial, transactional)
5. E-E-A-T scores with justification
6. What makes Alliance Chemical's take unique
7. Which product collections are relevant (by handle)

Make topics specific and actionable. Avoid generic titles like "Everything About X" - prefer "How to Safely Dilute X for Y Application" or "X vs Y: Which Solvent for Z Industry?"`;

  const response = await getDefaultProvider().generateStructured(
    prompt,
    TopicIdeasResponseSchema,
    {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    }
  );

  return response.topics;
}

/**
 * Score a topic's E-E-A-T potential
 */
export async function scoreEEAT(
  topic: string,
  context?: {
    targetKeyword?: string;
    contentAngle?: ContentAngle;
  }
): Promise<EEATScore & { reasoning: Record<string, string> }> {
  const systemPrompt = `You are an SEO expert evaluating content topics for E-E-A-T (Experience, Expertise, Authority, Trust).

You're evaluating topics for Alliance Chemical, a chemical supplier with:
- 20+ years in the industry
- Direct sales to businesses and individuals
- Technical knowledge of chemical properties, safety, applications
- Understanding of regulatory compliance (SDS, DOT, FDA, etc.)
- Hands-on experience with customer applications and questions

Score each E-E-A-T factor 1-10:
- Experience: Can we demonstrate first-hand experience? (customer stories, practical tips)
- Expertise: Do we have genuine technical knowledge to share?
- Authority: Is Alliance Chemical a credible source for this topic?
- Trust: Can we provide verifiable facts, safety info, certifications?`;

  const prompt = `Evaluate this topic's E-E-A-T potential for Alliance Chemical:

Topic: ${topic}
${context?.targetKeyword ? `Target keyword: ${context.targetKeyword}` : ''}
${context?.contentAngle ? `Content angle: ${context.contentAngle}` : ''}

Provide a score 1-10 for each factor with reasoning.`;

  const response = await getDefaultProvider().generateStructured(prompt, EEATResponseSchema, {
    systemPrompt,
    temperature: 0.3,
    maxTokens: 1500,
  });

  return {
    experience: response.experience,
    expertise: response.expertise,
    authority: response.authority,
    trust: response.trust,
    reasoning: {
      experience: response.reasoning.experienceReason,
      expertise: response.reasoning.expertiseReason,
      authority: response.reasoning.authorityReason,
      trust: response.reasoning.trustReason,
    },
  };
}

/**
 * Suggest multiple angles for a single topic
 */
export async function suggestAngles(
  topic: string,
  options?: {
    maxAngles?: number;
    excludeAngles?: ContentAngle[];
  }
): Promise<AngleSuggestion[]> {
  const maxAngles = options?.maxAngles ?? 4;
  const excludeAngles = options?.excludeAngles ?? [];

  // Extract chemical names from topic for better matching
  const chemicals = extractChemicalNames(topic);
  const products = matchTopicToProducts(topic, { maxResults: 3 });

  const systemPrompt = `You are a content strategist for Alliance Chemical.

Generate different content angles for the same topic. Each angle should:
1. Target a different search intent
2. Provide a unique value proposition
3. Have a competitive advantage for Alliance Chemical

Available angles:
- howto: Step-by-step practical guides
- comparison: X vs Y comparisons
- safety: Safety-focused content with warnings
- technical: Deep technical specifications and data
- faq: Question-and-answer format
- application: Industry or use-case specific guides`;

  const chemicalContext = chemicals.length
    ? `\nDetected chemicals: ${chemicals.join(', ')}`
    : '';

  const productContext = products.length
    ? `\nRelevant products: ${products.map((p) => p.name).join(', ')}`
    : '';

  const excludeContext = excludeAngles.length
    ? `\nExclude these angles: ${excludeAngles.join(', ')}`
    : '';

  const prompt = `Generate ${maxAngles} different content angles for this topic:

Topic: ${topic}
${chemicalContext}
${productContext}
${excludeContext}

For each angle provide:
1. The angle type
2. A specific article title
3. A description of what the article would cover
4. The search intent it targets
5. Why Alliance Chemical has a competitive advantage for this angle`;

  const response = await getDefaultProvider().generateStructured(prompt, AnglesResponseSchema, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 2000,
  });

  return response.angles;
}

/**
 * Map a content angle to the corresponding ShopifyContentType
 */
export function angleToContentType(angle: ContentAngle): ShopifyContentType {
  const mapping: Record<ContentAngle, ShopifyContentType> = {
    howto: 'howto',
    comparison: 'comparison',
    safety: 'safety',
    technical: 'technical',
    faq: 'faq',
    application: 'educational',
  };
  return mapping[angle];
}

/**
 * Get all available collection handles
 */
export function getCollectionHandles(): string[] {
  return COLLECTIONS.map((c) => c.handle);
}

/**
 * Get collection info by handle
 */
export function getCollectionInfo(handle: string): CollectionData | undefined {
  return COLLECTIONS.find((c) => c.handle === handle);
}

// ============================================================================
// DEDUPLICATION-AWARE FUNCTIONS
// ============================================================================

/**
 * Options for deduplication filtering
 */
export interface DeduplicationOptions {
  /** Whether to exclude duplicates (default: true) */
  excludeDuplicates?: boolean;
  /** Strictness of duplicate detection */
  strictness?: 'strict' | 'moderate' | 'loose';
  /** Force refresh of content index */
  refreshIndex?: boolean;
  /** Include related posts for internal linking */
  includeRelatedPosts?: boolean;
}

/**
 * Result of filtered topic generation
 */
export interface FilteredTopicsResult {
  topics: FilteredTopicSuggestion[];
  filtered: Array<{
    topic: TopicSuggestion;
    reason: string;
    matchedPost?: ExistingPost;
  }>;
  stats: {
    total: number;
    unique: number;
    duplicates: number;
    possible: number;
  };
}

/**
 * Generate topic ideas with automatic deduplication
 */
export async function generateTopicIdeasWithDedup(
  collectionHandle: string,
  count: number = 5,
  options?: {
    existingPosts?: string[];
    focusAngle?: ContentAngle;
    focusIndustry?: string;
  } & DeduplicationOptions
): Promise<FilteredTopicsResult> {
  // Get content index
  const index = await getContentIndex(options?.refreshIndex);

  // Generate more topics than requested to account for duplicates
  const generateCount = Math.ceil(count * 1.5);
  const topics = await generateTopicIdeas(collectionHandle, generateCount, {
    existingPosts: options?.existingPosts,
    focusAngle: options?.focusAngle,
    focusIndustry: options?.focusIndustry,
  });

  // Filter and annotate topics
  return filterTopicsWithDedup(topics, index, {
    maxTopics: count,
    excludeDuplicates: options?.excludeDuplicates ?? true,
    strictness: options?.strictness ?? 'moderate',
    includeRelatedPosts: options?.includeRelatedPosts ?? true,
  });
}

/**
 * Filter a list of topics for duplicates
 */
export function filterTopicsWithDedup(
  topics: TopicSuggestion[],
  index: ContentIndex,
  options?: {
    maxTopics?: number;
    excludeDuplicates?: boolean;
    strictness?: 'strict' | 'moderate' | 'loose';
    includeRelatedPosts?: boolean;
  }
): FilteredTopicsResult {
  const excludeDuplicates = options?.excludeDuplicates ?? true;
  const maxTopics = options?.maxTopics ?? topics.length;

  const uniqueTopics: FilteredTopicSuggestion[] = [];
  const filtered: FilteredTopicsResult['filtered'] = [];
  let possibleCount = 0;

  for (const topic of topics) {
    const check = isDuplicateTopic(topic.topic, index, {
      strictness: options?.strictness,
    });

    const filteredTopic: FilteredTopicSuggestion = {
      ...topic,
      duplicateCheck: check,
    };

    // Add related posts for internal linking
    if (options?.includeRelatedPosts) {
      filteredTopic.relatedExistingPosts = findRelatedPosts(topic.topic, index, 3);
    }

    if (check.isDuplicate && excludeDuplicates) {
      filtered.push({
        topic,
        reason: check.reason || 'Duplicate content',
        matchedPost: check.matchedPost,
      });
    } else if (check.confidence === 'possible') {
      possibleCount++;
      // Include possible duplicates but mark them
      if (uniqueTopics.length < maxTopics) {
        uniqueTopics.push(filteredTopic);
      }
    } else {
      if (uniqueTopics.length < maxTopics) {
        uniqueTopics.push(filteredTopic);
      }
    }
  }

  return {
    topics: uniqueTopics.slice(0, maxTopics),
    filtered,
    stats: {
      total: topics.length,
      unique: uniqueTopics.length,
      duplicates: filtered.length,
      possible: possibleCount,
    },
  };
}

/**
 * Check a single topic against existing content
 */
export async function checkTopicDuplicate(
  topic: string,
  options?: {
    refreshIndex?: boolean;
    strictness?: 'strict' | 'moderate' | 'loose';
  }
): Promise<DuplicateCheck & { relatedPosts: ExistingPost[] }> {
  const index = await getContentIndex(options?.refreshIndex);
  const check = isDuplicateTopic(topic, index, {
    strictness: options?.strictness,
  });
  const relatedPosts = findRelatedPosts(topic, index, 5);

  return {
    ...check,
    relatedPosts,
  };
}

/**
 * Find content gaps with automatic deduplication
 */
export async function findContentGapsWithDedup(
  options?: {
    maxGaps?: number;
    topicsPerGap?: number;
    prioritizeCollections?: string[];
  } & DeduplicationOptions
): Promise<TopicGap[]> {
  const index = await getContentIndex(options?.refreshIndex);

  // Use existing post titles from the index
  const existingTitles = index.posts.map((p) => p.title);

  const gaps = await findContentGaps(existingTitles, {
    maxGaps: options?.maxGaps,
    topicsPerGap: options?.topicsPerGap,
    prioritizeCollections: options?.prioritizeCollections,
  });

  // Filter each gap's topics for duplicates
  if (options?.excludeDuplicates !== false) {
    for (const gap of gaps) {
      const result = filterTopicsWithDedup(gap.suggestedTopics, index, {
        excludeDuplicates: true,
        strictness: options?.strictness,
        includeRelatedPosts: options?.includeRelatedPosts,
      });
      gap.suggestedTopics = result.topics;
    }
  }

  return gaps;
}

// Re-export for convenience
export { getContentIndex, type ContentIndex, type ExistingPost };
