/**
 * Writer API - Simple content generation endpoint
 *
 * GET: Returns list of product collections
 * POST actions:
 * - topic: Generate unique topics for a collection
 * - outline: Generate outline from topic
 * - generate: Generate full blog post with context
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTopicIdeasWithDedup, type TopicSuggestion } from '@/lib/discovery/topic-finder';
import { generateOutline } from '@/lib/outline/outline-generator';
import type { ContentOutline, OutlineSection, FAQOutlineItem } from '@/lib/outline/outline-types';
import { generateDraft } from '@/lib/ai/generation/drafts';
import { getProductCollections } from '@/lib/shopify/product-matcher';
import {
  fetchCollectionsGraphQL,
  fetchCollectionProductsGraphQL,
  fetchProductGraphQL,
  fetchAllProductsGraphQL,
} from '@/lib/shopify/api-client';
import { isShopifyConfigured } from '@/lib/config/env';
import { getDefaultProvider } from '@/lib/ai/providers';
import { z as zod } from 'zod';
import { db } from '@/lib/db/client';
import { authors, blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET - Return list of collections and products from Shopify
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collectionHandle = searchParams.get('collection');

  try {
    // If collection=all, return all products from store
    if (collectionHandle === 'all') {
      if (!isShopifyConfigured()) {
        return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 });
      }
      const products = await fetchAllProductsGraphQL(250); // Get up to 250 products
      return NextResponse.json({ products });
    }

    // If specific collection, return products in that collection
    if (collectionHandle) {
      if (!isShopifyConfigured()) {
        return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 });
      }
      const products = await fetchCollectionProductsGraphQL(collectionHandle);
      return NextResponse.json({ products });
    }

    // Otherwise return collections
    if (isShopifyConfigured()) {
      // Fetch live from Shopify
      const shopifyCollections = await fetchCollectionsGraphQL();
      return NextResponse.json({
        collections: shopifyCollections.map((c) => ({
          handle: c.handle,
          name: c.title,
          productsCount: c.productsCount,
        })),
        source: 'shopify',
      });
    } else {
      // Fall back to local data
      const localCollections = getProductCollections();
      return NextResponse.json({
        collections: localCollections.map((c) => ({
          handle: c.handle,
          name: c.name,
          industries: c.industries,
          applications: c.applications,
        })),
        source: 'local',
      });
    }
  } catch (error) {
    console.error('Failed to fetch from Shopify:', error);
    // Fall back to local
    const localCollections = getProductCollections();
    return NextResponse.json({
      collections: localCollections.map((c) => ({
        handle: c.handle,
        name: c.name,
      })),
      source: 'local',
    });
  }
}

// Request schemas
const TopicRequestSchema = z.object({
  action: z.literal('topic'),
  collectionHandle: z.string().optional(), // If not provided, picks random
  productHandle: z.string().optional(), // Specific product to focus on
  count: z.number().min(1).max(5).optional(), // Number of topics to generate (default 3)
});

const OutlineRequestSchema = z.object({
  action: z.literal('outline'),
  topic: z.object({
    topic: z.string(),
    primaryKeyword: z.string(),
    angle: z.enum(['howto', 'comparison', 'safety', 'technical', 'faq', 'application']),
    searchIntent: z.enum(['informational', 'commercial', 'transactional']),
    eeatScore: z.object({
      experience: z.number(),
      expertise: z.number(),
      authority: z.number(),
      trust: z.number(),
    }),
    uniqueAngle: z.string(),
    relevantProducts: z.array(z.string()),
  }),
  targetWordCount: z.number().optional(),
  faqCount: z.number().optional(),
});

const GenerateRequestSchema = z.object({
  action: z.literal('generate'),
  topic: z.object({
    topic: z.string(),
    primaryKeyword: z.string(),
    angle: z.enum(['howto', 'comparison', 'safety', 'technical', 'faq', 'application']),
    searchIntent: z.enum(['informational', 'commercial', 'transactional']),
    eeatScore: z.object({
      experience: z.number(),
      expertise: z.number(),
      authority: z.number(),
      trust: z.number(),
    }),
    uniqueAngle: z.string(),
    relevantProducts: z.array(z.string()),
  }),
  outline: z.any(), // ContentOutline is complex, validate at runtime
  context: z.string().optional(),
  authorId: z.string().optional(),
  saveToDB: z.boolean().optional(),
});

const RequestSchema = z.discriminatedUnion('action', [
  TopicRequestSchema,
  OutlineRequestSchema,
  GenerateRequestSchema,
]);

export const maxDuration = 120; // 2 minutes for long generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Handle each action
    switch (data.action) {
      case 'topic':
        return handleTopicGeneration(data);

      case 'outline':
        return handleOutlineGeneration(data);

      case 'generate':
        return handleContentGeneration(data);

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Writer API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * Schema for LLM topic generation response
 */
const TopicSuggestionResponseSchema = zod.object({
  topics: zod.array(zod.object({
    topic: zod.string().describe('The full topic title'),
    primaryKeyword: zod.string().describe('Main SEO keyword for this topic'),
    angle: zod.enum(['howto', 'comparison', 'safety', 'technical', 'faq', 'application']),
    searchIntent: zod.enum(['informational', 'commercial', 'transactional']),
    eeatScore: zod.object({
      experience: zod.number().min(1).max(10),
      expertise: zod.number().min(1).max(10),
      authority: zod.number().min(1).max(10),
      trust: zod.number().min(1).max(10),
    }),
    uniqueAngle: zod.string().describe('What makes Alliance Chemical\'s take unique'),
    relevantProducts: zod.array(zod.string()).describe('Product handles to link to'),
  })),
});

/**
 * Generate unique topics for a collection
 */
async function handleTopicGeneration(
  data: z.infer<typeof TopicRequestSchema>
) {
  const collections = getProductCollections();

  // Pick collection - use provided or random
  let collectionHandle = data.collectionHandle;
  const isAllProducts = collectionHandle === 'all';

  if (!collectionHandle || collectionHandle === 'random') {
    const randomIndex = Math.floor(Math.random() * collections.length);
    collectionHandle = collections[randomIndex].handle;
  }

  const collection = isAllProducts ? null : collections.find((c) => c.handle === collectionHandle);
  const count = data.count || 3;

  // If specific product selected, fetch its details
  let productContext = '';
  let focusProduct = null;

  if (data.productHandle && isShopifyConfigured()) {
    focusProduct = await fetchProductGraphQL(data.productHandle);
    if (focusProduct) {
      productContext = formatProductContext([focusProduct]);
    }
  }

  // Fetch products from Shopify for context
  let products: Awaited<ReturnType<typeof fetchCollectionProductsGraphQL>> = [];
  if (isShopifyConfigured() && !focusProduct) {
    try {
      if (isAllProducts) {
        // Fetch all products (limit to 50 for context size)
        products = await fetchAllProductsGraphQL(50);
      } else {
        products = await fetchCollectionProductsGraphQL(collectionHandle);
      }
      productContext = formatProductContext(products);
    } catch (err) {
      console.error('Failed to fetch products from Shopify:', err);
    }
  }

  // Use AI to generate topics with full product context
  if (productContext) {
    const collectionName = isAllProducts ? 'All Products' : (collection?.name || collectionHandle);
    const topics = await generateTopicsWithProductContext(
      isAllProducts ? 'all' : collectionHandle,
      collectionName,
      productContext,
      count,
      focusProduct?.handle
    );

    return NextResponse.json({
      topics,
      collection: isAllProducts
        ? { handle: 'all', name: 'All Products' }
        : (collection ? { handle: collection.handle, name: collection.name } : null),
      products: focusProduct ? [focusProduct] : products.slice(0, 10), // Include products for UI
      stats: { total: topics.length, unique: topics.length, duplicates: 0, possible: 0 },
    });
  }

  // Fallback to standard generation without product context
  const result = await generateTopicIdeasWithDedup(collectionHandle, count, {
    excludeDuplicates: true,
    strictness: 'moderate',
    includeRelatedPosts: true,
  });

  if (result.topics.length === 0) {
    return NextResponse.json(
      { error: 'Could not generate unique topics. All suggestions were duplicates.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    topics: result.topics,
    collection: collection ? { handle: collection.handle, name: collection.name } : null,
    stats: result.stats,
  });
}

/**
 * Format products into context string for LLM
 */
function formatProductContext(products: Array<{
  title: string;
  handle: string;
  url: string;
  description: string;
  variants: Array<{ title: string; price: string; url: string }>;
  images: Array<{ url: string; altText: string | null }>;
  tags: string[];
}>): string {
  return products.map((p, i) => `
Product ${i + 1}: ${p.title}
URL: ${p.url}
Description: ${p.description.slice(0, 300)}${p.description.length > 300 ? '...' : ''}
Tags: ${p.tags.join(', ')}
Variants:
${p.variants.slice(0, 5).map(v => `  - ${v.title}: $${v.price} (${v.url})`).join('\n')}
${p.variants.length > 5 ? `  ... and ${p.variants.length - 5} more variants` : ''}
Images: ${p.images.length} available
`).join('\n---\n');
}

/**
 * Generate topics using LLM with full product context
 */
async function generateTopicsWithProductContext(
  collectionHandle: string,
  collectionName: string,
  productContext: string,
  count: number,
  focusProductHandle?: string
): Promise<TopicSuggestion[]> {
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

You have access to the actual product catalog with URLs, prices, and variants.
When suggesting topics, reference specific products and their variants.`;

  const focusContext = focusProductHandle
    ? `\n\nFOCUS: Generate topics specifically about the product "${focusProductHandle}". All topics should directly relate to this product.`
    : '';

  const prompt = `Generate ${count} unique blog topic ideas for Alliance Chemical's "${collectionName}" collection.

PRODUCTS IN THIS COLLECTION:
${productContext}
${focusContext}

For each topic:
1. Create a specific, searchable title
2. Identify the primary SEO keyword
3. Choose the content angle (howto, comparison, safety, technical, faq, application)
4. Determine search intent (informational, commercial, transactional)
5. Score E-E-A-T factors (1-10)
6. Explain what makes Alliance Chemical's take unique
7. List product handles that should be linked in the article

Make topics specific and actionable. Reference actual products from the catalog.
Example: Instead of "How to Use Muriatic Acid", write "How to Dilute Muriatic Acid for Pool pH Adjustment (12-31.45% Concentrations)"`;

  const response = await getDefaultProvider().generateStructured(
    prompt,
    TopicSuggestionResponseSchema,
    {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    }
  );

  return response.topics;
}

/**
 * Generate outline from topic
 */
async function handleOutlineGeneration(
  data: z.infer<typeof OutlineRequestSchema>
) {
  const outline = await generateOutline(data.topic as TopicSuggestion, {
    targetWordCount: data.targetWordCount ?? 1500,
    faqCount: data.faqCount ?? 5,
  });

  return NextResponse.json({ outline });
}

/**
 * Generate full content with context
 */
async function handleContentGeneration(
  data: z.infer<typeof GenerateRequestSchema>
) {
  // Get author (use first author as default)
  let author = await db.query.authors.findFirst({
    where: data.authorId ? eq(authors.id, data.authorId) : undefined,
  });

  if (!author) {
    // Try to get any author
    author = await db.query.authors.findFirst();
  }

  if (!author) {
    return NextResponse.json(
      { error: 'No author found. Please create an author first.' },
      { status: 400 }
    );
  }

  // Convert outline to brief with context injected
  const outline = data.outline as ContentOutline;
  const topic = data.topic as TopicSuggestion;

  // Build brief from outline
  const brief = {
    suggestedTitle: outline.meta.topic,
    suggestedSlug: slugify(outline.meta.topic),
    heroAnswerDraft: outline.heroAnswer.keyPoints.join(' '),
    outline: outline.sections.map((section: OutlineSection) => ({
      headingLevel: section.headingLevel,
      headingText: section.heading,
      keyPoints: section.keyPoints,
      estimatedWordCount: section.estimatedWords,
    })),
    keyQuestions: outline.faqSection.questions.map((q: FAQOutlineItem) => q.question),
    suggestedInternalLinks: outline.sections
      .filter((s: OutlineSection) => s.internalLink)
      .map((s: OutlineSection) => ({
        targetUrl: s.internalLink!,
        suggestedAnchorText: s.heading,
        placement: s.heading,
        reason: 'Related content',
      })),
    externalReferences: [] as Array<{ type: 'authority' | 'standard' | 'regulation' | 'study'; description: string; reason: string }>,
    faqSuggestions: outline.faqSection.questions.map((q: FAQOutlineItem) => ({
      question: q.question,
      keyPointsForAnswer: q.keyPointsForAnswer,
    })),
    experiencePrompts: [
      ...outline.meta.eeatHooks.map(
        (hook: string) => `[PLACEHOLDER: Share specific experience with ${hook}]`
      ),
      // Inject user context
      ...(data.context ? [`Additional context from user:\n${data.context}`] : []),
    ],
  };

  // Generate the draft
  const post = await generateDraft({
    brief,
    authorInfo: {
      id: author.id,
      name: author.name,
      role: author.role || 'Content Writer',
      credentials: author.credentials || '',
      profileUrl: author.profileUrl,
    },
    exemplarPosts: [],
    primaryKeyword: topic.primaryKeyword,
    searchIntent: topic.searchIntent,
    useStyleAnalysis: false, // Keep it fast
  });

  // Optionally save to database
  if (data.saveToDB) {
    await db.insert(blogPosts).values({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      heroAnswer: post.heroAnswer,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      canonicalUrl: post.canonicalUrl,
      primaryKeyword: post.primaryKeyword,
      secondaryKeywords: post.secondaryKeywords,
      searchIntent: post.searchIntent,
      wordCount: post.wordCount,
      readingTimeMins: post.readingTimeMinutes,
      status: 'draft',
      authorId: author.id,
      sections: post.sections,
      faq: post.faq,
      experienceEvidence: post.experienceEvidence || { summary: '', details: null, placeholders: [] },
      ldJsonArticle: post.ldJsonArticle,
      ldJsonFaqPage: post.ldJsonFaqPage,
    });
  }

  return NextResponse.json({
    post,
    saved: data.saveToDB ?? false,
  });
}

/**
 * Create URL slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}
