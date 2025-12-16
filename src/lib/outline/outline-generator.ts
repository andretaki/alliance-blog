/**
 * Outline Generator
 *
 * AI-powered outline generation for content planning.
 */

import { z } from 'zod';
import { getDefaultProvider } from '@/lib/ai/providers';
import {
  matchTopicToProducts,
  extractChemicalNames,
  getCollectionByHandle,
} from '@/lib/shopify/product-matcher';
import type { TopicSuggestion, ContentAngle } from '@/lib/discovery/topic-finder';
import { angleToContentType } from '@/lib/discovery/topic-finder';
import type { ShopifyContentType } from '@/lib/shopify/content-types';
import type {
  ContentOutline,
  OutlineMeta,
  OutlineSection,
  OpeningHook,
  HeroAnswer,
  FAQSection,
  FAQOutlineItem,
  CTASection,
  OutlineContext,
  OutlineGenerationOptions,
  OutlineValidation,
  BlogPostReference,
  SectionComponent,
} from './outline-types';

// ============================================================================
// ZODS FOR AI STRUCTURED OUTPUT
// ============================================================================

// Helper to coerce various field names Claude might use
const coerceString = z.union([z.string(), z.any()]).transform((val) => {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    // Handle nested objects with description/content/text fields
    return val.description || val.content || val.text || val.whatToConvey || JSON.stringify(val);
  }
  return String(val ?? '');
});

const coerceHeadingLevel = z.any().transform((val) => {
  if (val === 'h2' || val === 'h3') return val;
  const str = String(val).toLowerCase();
  if (str.includes('2') || str === 'h2') return 'h2' as const;
  return 'h3' as const;
});

const coerceNumber = z.any().transform((val) => {
  if (typeof val === 'number') return val;
  const num = parseInt(String(val), 10);
  return isNaN(num) ? 200 : num; // default 200 words
});

const coerceStringArray = z.any().transform((val) => {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === 'string') return [val];
  if (val && typeof val === 'object') {
    // Handle object with points/items/list
    const arr = val.points || val.items || val.list || val.keyPoints || Object.values(val);
    return Array.isArray(arr) ? arr.map((v: unknown) => String(v)) : [String(val)];
  }
  return [''];
});

const OpeningHookSchema = z.object({
  type: z.any().transform((val) => {
    const str = String(val).toLowerCase();
    if (str.includes('problem')) return 'problem' as const;
    if (str.includes('story') || str.includes('anecdote')) return 'story' as const;
    if (str.includes('stat') || str.includes('number')) return 'statistic' as const;
    if (str.includes('question')) return 'question' as const;
    return 'problem' as const; // default
  }),
  description: coerceString,
}).passthrough().transform((obj) => ({
  type: obj.type,
  description: obj.description || obj.whatToConvey || obj.content || '',
}));

const HeroAnswerSchema = z.object({
  keyPoints: coerceStringArray,
}).passthrough();

const OutlineSectionSchema = z.object({
  heading: coerceString,
  headingLevel: coerceHeadingLevel.default('h2'),
  keyPoints: coerceStringArray,
  eeatElement: coerceString.optional(),
  internalLink: z.string().optional(),
  component: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const valid = ['table', 'steps', 'callout_warning', 'callout_info', 'callout_danger', 'callout_success', 'comparison_table', 'checklist', 'pros_cons'];
    const normalized = val.toLowerCase().replace(/[-\s]/g, '_');
    return valid.includes(normalized) ? normalized : undefined;
  }),
  imageOpportunity: z.string().optional(),
  estimatedWords: coerceNumber.default(200),
}).passthrough();

const FAQSourceSchema = z.any().transform((val) => {
  if (!val) return undefined;
  const str = String(val).toLowerCase().replace(/[\s-]/g, '_');
  const validSources = ['people_also_ask', 'customer_question', 'common_search', 'industry_specific'] as const;
  return validSources.includes(str as (typeof validSources)[number])
    ? (str as (typeof validSources)[number])
    : undefined;
});

const FAQItemSchema = z.object({
  question: coerceString,
  keyPointsForAnswer: coerceStringArray,
  source: FAQSourceSchema.optional(),
}).passthrough();

const CTASectionSchema = z.object({
  primaryProduct: coerceString.default('Contact Alliance Chemical'),
  primaryProductUrl: z.string().optional(),
  valueProposition: coerceString.default('Industrial-grade chemicals with expert support'),
  secondaryCTA: coerceString.optional(),
}).passthrough();

const ContentOutlineResponseSchema = z.object({
  openingHook: OpeningHookSchema,
  heroAnswer: HeroAnswerSchema,
  sections: z.array(OutlineSectionSchema).min(1),
  faqs: z.array(FAQItemSchema).min(1),
  cta: CTASectionSchema.optional().default({
    primaryProduct: 'Muriatic Acid',
    valueProposition: 'Industrial-grade chemicals from Alliance Chemical',
  }),
}).passthrough();

const SectionOutlineResponseSchema = z.object({
  heading: z.string(),
  keyPoints: z.array(z.string()),
  eeatElement: z.string().optional(),
  component: z
    .enum([
      'table',
      'steps',
      'callout_warning',
      'callout_info',
      'callout_danger',
      'callout_success',
      'comparison_table',
      'checklist',
      'pros_cons',
    ])
    .optional(),
  imageOpportunity: z.string().optional(),
  estimatedWords: z.number(),
});

const FAQSuggestionsResponseSchema = z.object({
  faqs: z.array(FAQItemSchema),
});

// ============================================================================
// MAIN GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate a complete outline from a topic suggestion
 */
export async function generateOutline(
  topic: TopicSuggestion,
  options: OutlineGenerationOptions = {}
): Promise<ContentOutline> {
  const targetWordCount = options.targetWordCount ?? 1500;
  const faqCount = options.faqCount ?? 5;

  // Get relevant products
  const products = matchTopicToProducts(topic.topic, { maxResults: 5 });
  const chemicals = extractChemicalNames(topic.topic);

  // Map angle to content type
  const contentType = angleToContentType(topic.angle);

  // Build context for AI
  const productContext = products.length
    ? `Relevant products:\n${products.map((p) => `- ${p.name}: ${p.url}`).join('\n')}`
    : '';

  const chemicalContext = chemicals.length
    ? `Detected chemicals: ${chemicals.join(', ')}`
    : '';

  const existingPostsContext = options.existingPosts?.length
    ? `Available for internal linking:\n${options.existingPosts
        .slice(0, 10)
        .map((p) => `- "${p.title}": ${p.url}`)
        .join('\n')}`
    : '';

  const eeatContext = options.eeatFocus?.length
    ? `Focus E-E-A-T elements: ${options.eeatFocus.join(', ')}`
    : '';

  const systemPrompt = `You are a content architect for Alliance Chemical, a chemical supplier with 20+ years of experience.

You create detailed content outlines that:
1. Demonstrate E-E-A-T (Experience, Expertise, Authority, Trust)
2. Target featured snippets with hero answers
3. Structure content for maximum readability
4. Include natural product/collection links
5. Address user search intent effectively

Alliance Chemical's unique perspective includes:
- Two decades of real customer interactions
- Hands-on experience with chemical applications
- Understanding of safety, compliance, and regulations
- Knowledge of industrial vs lab vs personal use cases

Content type guidelines:
- howto: Step-by-step with numbered steps, safety warnings
- faq: Q&A format with concise answers
- comparison: Tables, pros/cons, recommendation
- technical: Data tables, specifications, formulas
- safety: Warning callouts, PPE requirements, first aid
- educational: Comprehensive coverage, examples, applications`;

  const prompt = `Create a detailed content outline for this topic:

Topic: ${topic.topic}
Primary Keyword: ${topic.primaryKeyword}
Content Type: ${contentType}
Search Intent: ${topic.searchIntent}
Target Word Count: ${targetWordCount}
Unique Angle: ${topic.uniqueAngle}
Number of FAQs: ${faqCount}

${chemicalContext}
${productContext}
${existingPostsContext}
${eeatContext}
${options.industryFocus ? `Industry focus: ${options.industryFocus}` : ''}
${options.includeSafety ? 'Include a dedicated safety section with warnings.' : ''}

Create an outline with:
1. Opening hook type and what it should convey
2. Hero answer key points (2-3 sentence direct answer for featured snippets)
3. Main sections with:
   - Descriptive headings (H2 for main sections, H3 for subsections)
   - 3-5 key points each section should cover
   - E-E-A-T elements to demonstrate (if applicable)
   - Internal link opportunities (if matching posts available)
   - Component suggestions (tables, callouts, steps, etc.)
   - Image opportunities
   - Estimated word count per section
4. FAQ questions with key points for answers
5. CTA section with primary product and value proposition

Ensure sections flow logically and cover the topic comprehensively for the target audience.`;

  const response = await getDefaultProvider().generateStructured(
    prompt,
    ContentOutlineResponseSchema,
    {
      systemPrompt,
      temperature: 0.6,
      maxTokens: 6000,
    }
  );

  // Map internal links to actual posts if available
  const sections = response.sections.map((section) => {
    const mapped: OutlineSection = {
      heading: section.heading,
      headingLevel: section.headingLevel,
      keyPoints: section.keyPoints,
      eeatElement: section.eeatElement,
      component: section.component as SectionComponent | undefined,
      imageOpportunity: section.imageOpportunity,
      estimatedWords: section.estimatedWords,
    };

    // Try to find a matching internal link
    if (section.internalLink && options.existingPosts) {
      const matchedPost = options.existingPosts.find(
        (p) =>
          p.url === section.internalLink ||
          p.slug === section.internalLink ||
          p.title.toLowerCase().includes(section.internalLink?.toLowerCase() ?? '')
      );
      if (matchedPost) {
        mapped.internalLink = matchedPost.url;
      }
    }

    return mapped;
  });

  // Build the complete outline
  const outline: ContentOutline = {
    meta: {
      topic: topic.topic,
      primaryKeyword: topic.primaryKeyword,
      secondaryKeywords: [], // Could be enhanced with keyword research
      contentType,
      searchIntent: topic.searchIntent,
      targetWordCount,
      eeatHooks: extractEeatHooks(response.sections),
    },
    openingHook: {
      type: response.openingHook.type,
      description: response.openingHook.description,
    },
    heroAnswer: {
      targetLength: '2-3 sentences',
      keyPoints: response.heroAnswer.keyPoints,
    },
    sections,
    faqSection: {
      questions: response.faqs.map((faq) => ({
        question: faq.question,
        keyPointsForAnswer: faq.keyPointsForAnswer,
        source: faq.source,
      })),
    },
    ctaSection: {
      primaryProduct: response.cta.primaryProduct,
      primaryProductUrl: response.cta.primaryProductUrl || products[0]?.url,
      valueProposition: response.cta.valueProposition,
      secondaryCTA: response.cta.secondaryCTA,
    },
  };

  return outline;
}

/**
 * Generate outline for a single section
 */
export async function generateSectionOutline(
  sectionHeading: string,
  context: OutlineContext
): Promise<OutlineSection> {
  const systemPrompt = `You are a content architect for Alliance Chemical.
Create detailed section outlines that are specific, actionable, and demonstrate expertise.`;

  const previousContext = context.previousSections?.length
    ? `Previous sections: ${context.previousSections.join(', ')}`
    : '';

  const prompt = `Create a detailed outline for this section:

Section: ${sectionHeading}
Topic: ${context.topic}
Primary Keyword: ${context.primaryKeyword}
Content Type: ${context.contentType}
Search Intent: ${context.searchIntent}
${context.targetAudience ? `Target Audience: ${context.targetAudience}` : ''}
${previousContext}

Provide:
1. Refined heading (can modify for SEO)
2. Key points to cover (3-6 points)
3. E-E-A-T element to demonstrate (optional)
4. Component suggestion (table, steps, callout, etc.)
5. Image opportunity description
6. Estimated word count`;

  const response = await getDefaultProvider().generateStructured(
    prompt,
    SectionOutlineResponseSchema,
    {
      systemPrompt,
      temperature: 0.5,
      maxTokens: 1500,
    }
  );

  return {
    heading: response.heading,
    headingLevel: 'h2',
    keyPoints: response.keyPoints,
    eeatElement: response.eeatElement,
    component: response.component as SectionComponent | undefined,
    imageOpportunity: response.imageOpportunity,
    estimatedWords: response.estimatedWords,
  };
}

/**
 * Suggest FAQs for a topic
 */
export async function suggestFAQs(
  topic: string,
  count: number = 5,
  options?: {
    contentType?: ShopifyContentType;
    industryFocus?: string;
  }
): Promise<FAQOutlineItem[]> {
  const chemicals = extractChemicalNames(topic);

  const systemPrompt = `You are an SEO specialist for Alliance Chemical.
Generate FAQ questions that:
1. Match "People Also Ask" style queries
2. Address real customer concerns
3. Target featured snippet positions
4. Are specific and actionable`;

  const prompt = `Generate ${count} FAQ questions for this topic:

Topic: ${topic}
${chemicals.length ? `Chemicals: ${chemicals.join(', ')}` : ''}
${options?.contentType ? `Content Type: ${options.contentType}` : ''}
${options?.industryFocus ? `Industry: ${options.industryFocus}` : ''}

For each question provide:
1. The question (natural language, as someone would type it)
2. Key points the answer should cover (2-4 points)
3. Source type (people_also_ask, customer_question, common_search, industry_specific)

Focus on questions that Alliance Chemical can uniquely answer with authority.`;

  const response = await getDefaultProvider().generateStructured(
    prompt,
    FAQSuggestionsResponseSchema,
    {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    }
  );

  return response.faqs;
}

/**
 * Map internal links to an outline based on existing posts
 */
export function mapInternalLinks(
  outline: ContentOutline,
  existingPosts: BlogPostReference[]
): ContentOutline {
  // Create a keyword-to-post map for efficient matching
  const keywordMap = new Map<string, BlogPostReference>();
  for (const post of existingPosts) {
    // Index by primary keyword
    if (post.primaryKeyword) {
      keywordMap.set(post.primaryKeyword.toLowerCase(), post);
    }
    // Index by title words
    const titleWords = post.title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 4 && !keywordMap.has(word)) {
        keywordMap.set(word, post);
      }
    }
  }

  // Map sections
  const mappedSections = outline.sections.map((section) => {
    if (section.internalLink) {
      // Already has a link, validate it
      const existingPost = existingPosts.find((p) => p.url === section.internalLink);
      if (existingPost) return section;
    }

    // Try to find a relevant link based on section content
    const sectionText = `${section.heading} ${section.keyPoints.join(' ')}`.toLowerCase();

    for (const [keyword, post] of keywordMap) {
      if (sectionText.includes(keyword)) {
        return {
          ...section,
          internalLink: post.url,
        };
      }
    }

    return section;
  });

  return {
    ...outline,
    sections: mappedSections,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate an outline for completeness
 */
export function validateOutline(outline: ContentOutline): OutlineValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check meta
  if (!outline.meta.topic) issues.push('Missing topic');
  if (!outline.meta.primaryKeyword) issues.push('Missing primary keyword');
  if (outline.meta.targetWordCount < 500) warnings.push('Target word count seems low');

  // Check opening hook
  if (!outline.openingHook.description) warnings.push('Opening hook description is empty');

  // Check hero answer
  if (outline.heroAnswer.keyPoints.length < 2) {
    warnings.push('Hero answer should have at least 2 key points');
  }

  // Check sections
  if (outline.sections.length < 3) {
    issues.push('Outline should have at least 3 sections');
  }

  const h2Count = outline.sections.filter((s) => s.headingLevel === 'h2').length;
  if (h2Count < 2) {
    warnings.push('Consider more H2 sections for better structure');
  }

  // Check for E-E-A-T elements
  const hasEeatElements = outline.sections.some((s) => s.eeatElement);
  if (!hasEeatElements) {
    warnings.push('No E-E-A-T elements specified in sections');
  }

  // Check for internal links
  const hasInternalLinks = outline.sections.some((s) => s.internalLink);

  // Check FAQs
  if (outline.faqSection.questions.length < 2) {
    warnings.push('Consider adding more FAQs');
  }

  // Check CTA
  if (!outline.ctaSection.primaryProduct) {
    warnings.push('CTA section missing primary product');
  }

  // Calculate estimated word count
  const estimatedWordCount = outline.sections.reduce((sum, s) => sum + s.estimatedWords, 0);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    stats: {
      totalSections: outline.sections.length,
      totalFaqs: outline.faqSection.questions.length,
      estimatedWordCount,
      hasEeatElements,
      hasInternalLinks,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract E-E-A-T hooks from sections
 */
function extractEeatHooks(
  sections: Array<{ eeatElement?: string }>
): string[] {
  return sections
    .filter((s) => s.eeatElement)
    .map((s) => s.eeatElement as string);
}

/**
 * Convert outline to ContentBrief format for article generator
 */
export function outlineToContentBrief(
  outline: ContentOutline
): import('@/lib/shopify/content-types').ContentBrief {
  return {
    topic: outline.meta.topic,
    primaryKeyword: outline.meta.primaryKeyword,
    secondaryKeywords: outline.meta.secondaryKeywords,
    contentType: outline.meta.contentType,
    targetWordCount: outline.meta.targetWordCount,
    searchIntent: outline.meta.searchIntent,
    outline: outline.sections.map((s) => ({
      headingLevel: s.headingLevel,
      headingText: s.heading,
      keyPoints: s.keyPoints,
      estimatedWordCount: s.estimatedWords,
      includeCallout: s.component?.startsWith('callout_')
        ? (s.component.replace('callout_', '') as 'warning' | 'info' | 'danger' | 'success')
        : undefined,
      includeTable: s.component === 'table' || s.component === 'comparison_table',
    })),
    faqSuggestions: outline.faqSection.questions.map((q) => ({
      question: q.question,
      answerPoints: q.keyPointsForAnswer,
    })),
    relatedProducts: outline.ctaSection.primaryProductUrl
      ? [
          {
            name: outline.ctaSection.primaryProduct,
            url: outline.ctaSection.primaryProductUrl,
          },
        ]
      : [],
  };
}

/**
 * Format outline for display/logging
 */
export function formatOutline(outline: ContentOutline): string {
  const lines: string[] = [];

  lines.push(`=== CONTENT OUTLINE ===`);
  lines.push(`Topic: ${outline.meta.topic}`);
  lines.push(`Keyword: ${outline.meta.primaryKeyword}`);
  lines.push(`Type: ${outline.meta.contentType} | Intent: ${outline.meta.searchIntent}`);
  lines.push(`Target Words: ${outline.meta.targetWordCount}`);
  lines.push('');

  lines.push(`--- Opening Hook (${outline.openingHook.type}) ---`);
  lines.push(outline.openingHook.description);
  lines.push('');

  lines.push(`--- Hero Answer ---`);
  outline.heroAnswer.keyPoints.forEach((p) => lines.push(`  - ${p}`));
  lines.push('');

  lines.push(`--- Sections (${outline.sections.length}) ---`);
  for (const section of outline.sections) {
    const level = section.headingLevel === 'h2' ? '' : '  ';
    lines.push(`${level}${section.headingLevel.toUpperCase()}: ${section.heading} (~${section.estimatedWords} words)`);
    section.keyPoints.forEach((p) => lines.push(`${level}  - ${p}`));
    if (section.eeatElement) lines.push(`${level}  [E-E-A-T: ${section.eeatElement}]`);
    if (section.component) lines.push(`${level}  [Component: ${section.component}]`);
    if (section.internalLink) lines.push(`${level}  [Link: ${section.internalLink}]`);
    lines.push('');
  }

  lines.push(`--- FAQs (${outline.faqSection.questions.length}) ---`);
  for (const faq of outline.faqSection.questions) {
    lines.push(`Q: ${faq.question}`);
    faq.keyPointsForAnswer.forEach((p) => lines.push(`  - ${p}`));
  }
  lines.push('');

  lines.push(`--- CTA ---`);
  lines.push(`Product: ${outline.ctaSection.primaryProduct}`);
  lines.push(`Value Prop: ${outline.ctaSection.valueProposition}`);

  return lines.join('\n');
}
