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
import { parseAIResponse } from '@/lib/utils/json-repair';
import { renderBlogHtml, validateBlogContent, type BlogContent } from '@/lib/templates/blog-renderer';

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

// New article generation with flexible JSON schema
const GenerateArticleRequestSchema = z.object({
  action: z.literal('generate-article'),
  productHandle: z.string(),
  angle: z.enum(['howto', 'comparison', 'safety', 'technical', 'application', 'guide']),
  targetLength: z.enum(['short', 'medium', 'long']), // ~1000 / ~2000 / ~3500 words
  primaryKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).optional(),
  mustInclude: z.array(z.string()).optional(), // e.g., ["safety warnings", "comparison table", "FAQs"]
  tone: z.enum(['professional', 'conversational', 'technical']).optional(),
  additionalNotes: z.string().optional(),
});

// Regenerate a single section
const RegenerateSectionRequestSchema = z.object({
  action: z.literal('regenerate-section'),
  sectionIndex: z.number(),
  sectionType: z.string(),
  context: z.object({
    productHandle: z.string(),
    angle: z.string(),
    primaryKeyword: z.string().optional(),
  }),
  existingSections: z.array(z.any()), // Other sections for context
  instructions: z.string().optional(), // User guidance for regeneration
});

// Render JSON content to HTML
const RenderHtmlRequestSchema = z.object({
  action: z.literal('render-html'),
  content: z.any(), // BlogContent JSON
});

// Save generated article to database
const SaveArticleRequestSchema = z.object({
  action: z.literal('save-article'),
  content: z.any(), // BlogContent JSON
  html: z.string(),
  productHandle: z.string(),
});

const RequestSchema = z.discriminatedUnion('action', [
  TopicRequestSchema,
  OutlineRequestSchema,
  GenerateRequestSchema,
  GenerateArticleRequestSchema,
  RegenerateSectionRequestSchema,
  RenderHtmlRequestSchema,
  SaveArticleRequestSchema,
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

      case 'generate-article':
        return handleArticleGeneration(data);

      case 'regenerate-section':
        return handleSectionRegeneration(data);

      case 'render-html':
        return handleRenderHtml(data);

      case 'save-article':
        return handleSaveArticle(data);

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

    // If we got topics, return them
    if (topics.length > 0) {
      return NextResponse.json({
        topics,
        collection: isAllProducts
          ? { handle: 'all', name: 'All Products' }
          : (collection ? { handle: collection.handle, name: collection.name } : null),
        products: focusProduct ? [focusProduct] : products.slice(0, 10),
        stats: { total: topics.length, unique: topics.length, duplicates: 0, possible: 0 },
      });
    }
    // Otherwise fall through to standard generation
    console.log('Product-based generation returned no topics, falling back to standard generation');
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
 * Format products into context string for LLM (keep concise to avoid context overflow)
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
  // Limit to 15 products max to avoid context overflow
  const limitedProducts = products.slice(0, 15);

  return limitedProducts.map((p, i) =>
`${i + 1}. ${p.title} (${p.handle})
   URL: ${p.url}
   Tags: ${p.tags.slice(0, 5).join(', ')}
   Variants: ${p.variants.slice(0, 3).map(v => v.title).join(', ')}${p.variants.length > 3 ? ` (+${p.variants.length - 3} more)` : ''}`
  ).join('\n\n');
}

/**
 * Generate topics using LLM with full product context (uses text generation for reliability)
 */
async function generateTopicsWithProductContext(
  collectionHandle: string,
  collectionName: string,
  productContext: string,
  count: number,
  focusProductHandle?: string
): Promise<TopicSuggestion[]> {
  const focusContext = focusProductHandle
    ? `\nFOCUS: Generate topics specifically about "${focusProductHandle}".`
    : '';

  const prompt = `You are a content strategist for Alliance Chemical. Generate ${count} blog topic ideas.

PRODUCTS:
${productContext}
${focusContext}

For each topic, output valid JSON in this exact format:
{
  "topics": [
    {
      "topic": "specific article title",
      "primaryKeyword": "main SEO keyword",
      "angle": "howto|comparison|safety|technical|faq|application",
      "searchIntent": "informational|commercial|transactional",
      "eeatScore": {"experience": 8, "expertise": 9, "authority": 8, "trust": 9},
      "uniqueAngle": "what makes this unique",
      "relevantProducts": ["product-handle-1"]
    }
  ]
}

IMPORTANT: Output ONLY valid JSON, no other text. Make titles specific and actionable.`;

  try {
    const response = await getDefaultProvider().generateText(prompt, {
      temperature: 0.7,
      maxTokens: 3000,
    });

    // Extract JSON from response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from response:', jsonStr.slice(0, 200));
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.topics || [];
  } catch (err) {
    console.error('Topic generation failed:', err);
    return [];
  }
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

// =============================================================================
// NEW ARTICLE GENERATION (Flexible JSON → HTML)
// =============================================================================

/**
 * Generate article content as flexible JSON, then render to HTML
 */
async function handleArticleGeneration(
  data: z.infer<typeof GenerateArticleRequestSchema>
) {
  // Fetch product details from Shopify
  let productContext = '';
  let productInfo = null;

  if (isShopifyConfigured()) {
    productInfo = await fetchProductGraphQL(data.productHandle);
    if (productInfo) {
      productContext = `
PRODUCT DETAILS:
- Name: ${productInfo.title}
- Handle: ${productInfo.handle}
- URL: ${productInfo.url}
- Description: ${productInfo.description}
- Tags: ${productInfo.tags.join(', ')}
- Variants: ${productInfo.variants.map(v => `${v.title} ($${v.price})`).join(', ')}
`;
    }
  }

  if (!productContext) {
    return NextResponse.json(
      { error: 'Could not fetch product details' },
      { status: 400 }
    );
  }

  // Build the generation prompt
  const wordTargets = { short: 1000, medium: 2000, long: 3500 };
  const targetWords = wordTargets[data.targetLength];

  const mustIncludeStr = data.mustInclude?.length
    ? `\nMUST INCLUDE: ${data.mustInclude.join(', ')}`
    : '';

  const prompt = buildArticlePrompt({
    productContext,
    productHandle: data.productHandle,
    angle: data.angle,
    targetWords,
    primaryKeyword: data.primaryKeyword,
    secondaryKeywords: data.secondaryKeywords,
    mustInclude: mustIncludeStr,
    tone: data.tone || 'professional',
    additionalNotes: data.additionalNotes,
  });

  try {
    const response = await getDefaultProvider().generateText(prompt, {
      temperature: 0.7,
      maxTokens: 8000, // Allow long responses for full articles
    });

    // Parse the JSON response with repair fallback
    const content = parseAIResponse<BlogContent>(response);

    // Validate the content structure
    if (!validateBlogContent(content)) {
      console.error('Content validation failed:', JSON.stringify(content).slice(0, 500));
      return NextResponse.json(
        { error: 'Generated content failed validation', partial: content },
        { status: 500 }
      );
    }

    // Render to HTML
    const html = renderBlogHtml(content);

    return NextResponse.json({
      content, // The structured JSON
      html,    // The rendered HTML
      meta: {
        productHandle: data.productHandle,
        angle: data.angle,
        targetLength: data.targetLength,
      },
    });
  } catch (error) {
    console.error('Article generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

/**
 * Build the prompt for article generation
 */
function buildArticlePrompt(params: {
  productContext: string;
  productHandle: string;
  angle: string;
  targetWords: number;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  mustInclude: string;
  tone: string;
  additionalNotes?: string;
}): string {
  const angleDescriptions: Record<string, string> = {
    howto: 'A step-by-step guide showing how to use or apply the product',
    comparison: 'Compare this product with alternatives, highlighting key differences',
    safety: 'Focus on safe handling, storage, and regulatory compliance',
    technical: 'Deep dive into technical specifications, chemical properties, and applications',
    application: 'Focus on specific industry applications and use cases',
    guide: 'A comprehensive guide covering multiple aspects of the product',
  };

  const keywordInstruction = params.primaryKeyword
    ? `Primary SEO keyword: "${params.primaryKeyword}"`
    : 'Suggest an appropriate primary SEO keyword';

  const secondaryKeywordsStr = params.secondaryKeywords?.length
    ? `Secondary keywords to include: ${params.secondaryKeywords.join(', ')}`
    : '';

  return `You are writing a blog article for Alliance Chemical, a trusted industrial chemical supplier.

${params.productContext}

ARTICLE REQUIREMENTS:
- Angle: ${params.angle} - ${angleDescriptions[params.angle] || 'General product guide'}
- Target length: ~${params.targetWords} words
- Tone: ${params.tone}
- ${keywordInstruction}
${secondaryKeywordsStr}
${params.mustInclude}
${params.additionalNotes ? `\nADDITIONAL NOTES: ${params.additionalNotes}` : ''}

OUTPUT FORMAT:
Return a JSON object with this exact structure. Use markdown in content fields for formatting (bold, lists, links).

{
  "meta": {
    "title": "Article Title (60 chars max)",
    "metaDescription": "SEO meta description (150-160 chars)",
    "primaryKeyword": "main keyword",
    "secondaryKeywords": ["keyword2", "keyword3"]
  },
  "hero": {
    "subtitle": "One sentence hook that captures attention",
    "badges": ["Badge 1", "Badge 2", "Badge 3"],
    "heroImage": "suggested-image-description"
  },
  "sections": [
    { "type": "text", "heading": "Introduction", "content": "Markdown content..." },
    { "type": "callout", "variant": "warning", "title": "Safety Note", "content": "Important warning..." },
    { "type": "table", "headers": ["Col1", "Col2"], "rows": [["a", "b"]], "caption": "Table description" },
    { "type": "comparison", "items": [{ "title": "Option A", "points": ["point1"], "featured": true }] },
    { "type": "process-steps", "heading": "How to Apply", "steps": [{ "title": "Step 1", "content": "..." }] },
    { "type": "case-study", "title": "Real-World Example", "stats": [{ "value": "50%", "label": "Improvement" }], "content": "..." },
    { "type": "product-grid", "products": [{ "handle": "${params.productHandle}", "title": "Product Name", "description": "..." }] },
    { "type": "image", "suggestion": "Photo description for manual selection", "alt": "alt text", "caption": "..." },
    { "type": "faq", "heading": "Frequently Asked Questions", "questions": [{ "q": "Question?", "a": "Answer..." }] }
  ],
  "cta": {
    "title": "Ready to Order?",
    "text": "CTA description mentioning the product",
    "buttonText": "Shop Now",
    "productHandle": "${params.productHandle}"
  }
}

IMPORTANT RULES:
1. Output ONLY valid JSON, no other text before or after
2. Use varied section types appropriate for the angle
3. Include at least one callout for safety-critical information
4. Include FAQs with 4-6 questions
5. Make content specific to the product, not generic
6. Include product-grid section linking to relevant products
7. For text sections, use markdown: **bold**, *italic*, bullet lists, [links](url)
8. For comparison sections, mark the recommended option with "featured": true`;
}

/**
 * Regenerate a single section
 */
async function handleSectionRegeneration(
  data: z.infer<typeof RegenerateSectionRequestSchema>
) {
  // Get product context
  let productContext = '';
  if (isShopifyConfigured()) {
    const productInfo = await fetchProductGraphQL(data.context.productHandle);
    if (productInfo) {
      productContext = `Product: ${productInfo.title} (${productInfo.handle})`;
    }
  }

  const existingSectionsContext = data.existingSections
    .map((s, i) => `Section ${i + 1}: ${s.type} - ${s.heading || s.title || ''}`)
    .join('\n');

  const prompt = `You are regenerating a single section of a blog article for Alliance Chemical.

CONTEXT:
${productContext}
Article angle: ${data.context.angle}
${data.context.primaryKeyword ? `Primary keyword: ${data.context.primaryKeyword}` : ''}

EXISTING SECTIONS:
${existingSectionsContext}

REGENERATE SECTION:
- Index: ${data.sectionIndex}
- Type: ${data.sectionType}
${data.instructions ? `- Instructions: ${data.instructions}` : ''}

OUTPUT: Return ONLY a valid JSON object for this single section. Match the section type structure exactly.

Example for type "${data.sectionType}":
${getSectionExample(data.sectionType)}`;

  try {
    const response = await getDefaultProvider().generateText(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    const section = parseAIResponse(response);

    return NextResponse.json({
      section,
      sectionIndex: data.sectionIndex,
    });
  } catch (error) {
    console.error('Section regeneration failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regeneration failed' },
      { status: 500 }
    );
  }
}

/**
 * Get example JSON for a section type
 */
function getSectionExample(type: string): string {
  const examples: Record<string, string> = {
    text: '{ "type": "text", "heading": "Section Heading", "content": "Markdown content with **bold** and *italic*..." }',
    callout: '{ "type": "callout", "variant": "warning", "title": "Important", "content": "Warning message..." }',
    table: '{ "type": "table", "headers": ["Col1", "Col2"], "rows": [["a", "b"]], "caption": "Description" }',
    comparison: '{ "type": "comparison", "items": [{ "title": "Option A", "points": ["Point 1"], "featured": true }] }',
    'process-steps': '{ "type": "process-steps", "heading": "Steps", "steps": [{ "title": "Step 1", "content": "..." }] }',
    'case-study': '{ "type": "case-study", "title": "Example", "stats": [{ "value": "50%", "label": "Improvement" }], "content": "..." }',
    'product-grid': '{ "type": "product-grid", "products": [{ "handle": "product-1", "title": "Product", "description": "..." }] }',
    image: '{ "type": "image", "suggestion": "Photo description", "alt": "Alt text", "caption": "Caption" }',
    faq: '{ "type": "faq", "heading": "FAQs", "questions": [{ "q": "Question?", "a": "Answer..." }] }',
  };
  return examples[type] || examples.text;
}

/**
 * Render BlogContent JSON to HTML
 */
async function handleRenderHtml(
  data: z.infer<typeof RenderHtmlRequestSchema>
) {
  try {
    const content = data.content as BlogContent;

    if (!validateBlogContent(content)) {
      return NextResponse.json(
        { error: 'Invalid content structure' },
        { status: 400 }
      );
    }

    const html = renderBlogHtml(content);

    return NextResponse.json({ html });
  } catch (error) {
    console.error('HTML render failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Render failed' },
      { status: 500 }
    );
  }
}

/**
 * Save generated article to database
 */
async function handleSaveArticle(
  data: z.infer<typeof SaveArticleRequestSchema>
) {
  try {
    const content = data.content as BlogContent;

    if (!validateBlogContent(content)) {
      return NextResponse.json(
        { error: 'Invalid content structure' },
        { status: 400 }
      );
    }

    // Get first author (or create default)
    let author = await db.query.authors.findFirst();

    if (!author) {
      // Create a default author
      const [newAuthor] = await db.insert(authors).values({
        name: 'Alliance Chemical',
        role: 'Technical Team',
        credentials: 'Industrial Chemical Supplier',
      }).returning();
      author = newAuthor;
    }

    // Generate slug from title
    const slug = slugify(content.meta.title);

    // Convert sections to schema format (Section type from canonical.ts)
    const dbSections = content.sections.map((section, index) => {
      // Get heading text based on section type
      let headingText: string = section.type;
      if ('heading' in section && section.heading) {
        headingText = section.heading as string;
      } else if ('title' in section && section.title) {
        headingText = section.title as string;
      }

      return {
        id: `section-${index}`,
        headingLevel: (section.type === 'text' ? 'h2' : 'h3') as 'h2' | 'h3',
        headingText,
        body: '', // Content is in rawHtml
        wordCount: 0,
      };
    });

    // Convert FAQs if present (FAQ type from canonical.ts)
    const faqSection = content.sections.find(s => s.type === 'faq');
    const dbFaqs = faqSection && 'questions' in faqSection
      ? (faqSection.questions as Array<{ q: string; a: string }>).map((q, i) => ({
          id: `faq-${i}`,
          question: q.q,
          answer: q.a,
        }))
      : [];

    // Calculate word count (rough estimate from HTML)
    const textContent = data.html.replace(/<[^>]*>/g, ' ');
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;
    const readingTimeMins = Math.ceil(wordCount / 200);

    // Create the blog post
    const [savedPost] = await db.insert(blogPosts).values({
      slug,
      title: content.meta.title,
      summary: content.meta.metaDescription,
      heroAnswer: content.hero.subtitle,
      sections: dbSections,
      faq: dbFaqs,
      primaryKeyword: content.meta.primaryKeyword,
      secondaryKeywords: content.meta.secondaryKeywords || [],
      searchIntent: 'informational',
      metaTitle: content.meta.title.slice(0, 100),
      metaDescription: content.meta.metaDescription.slice(0, 200),
      canonicalUrl: `https://alliancechemical.com/blogs/news/${slug}`,
      rawHtml: data.html,
      wordCount,
      readingTimeMins,
      aiAssisted: true,
      aiModel: 'claude',
      authorId: author.id,
      status: 'draft',
      source: 'writer',
      experienceEvidence: {
        summary: 'Generated by AI Writer',
        details: null,
        placeholders: [],
      },
      ldJsonArticle: {
        '@context': 'https://schema.org' as const,
        '@type': 'Article' as const,
        headline: content.meta.title.slice(0, 110),
        description: content.meta.metaDescription.slice(0, 300),
        image: null,
        author: {
          '@type': 'Person' as const,
          name: author.name,
          url: author.profileUrl,
        },
        publisher: {
          '@type': 'Organization' as const,
          name: 'Alliance Chemical',
          logo: {
            '@type': 'ImageObject' as const,
            url: 'https://alliancechemical.com/logo.png',
          },
        },
        datePublished: null,
        dateModified: null,
        mainEntityOfPage: {
          '@type': 'WebPage' as const,
          '@id': `https://alliancechemical.com/blogs/news/${slug}`,
        },
        keywords: content.meta.primaryKeyword,
      },
    }).returning();

    return NextResponse.json({
      success: true,
      postId: savedPost.id,
      slug: savedPost.slug,
      title: savedPost.title,
    });
  } catch (error) {
    console.error('Save article failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 }
    );
  }
}
