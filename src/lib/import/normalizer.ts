/**
 * Content Normalizer
 *
 * Converts intermediate representation to canonical blog schema.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  IntermediatePost,
  NormalizationResult,
  NormalizationFlags,
  NormalizationConfidence,
} from '@/lib/schema/intermediate';
import type {
  BlogPost,
  Section,
  FAQ,
  InternalLink,
  ExperienceEvidence,
  ArticleJsonLd,
  SearchIntent,
  ContentSource,
} from '@/lib/schema/canonical';
import { stripHtml, countWords } from './parsers/html';
import { VALIDATION_THRESHOLDS } from '@/lib/config/constants';

/**
 * Normalize an intermediate post to the canonical schema
 */
export function normalizePost(
  ir: IntermediatePost,
  options: NormalizationOptions = {}
): NormalizationResult {
  const flags = initFlags();
  const confidence = initConfidence();

  // Generate ID
  const id = uuidv4();

  // Extract slug
  const slug = extractSlug(ir, options);

  // Extract title
  const title = extractTitle(ir, flags, confidence);

  // Extract summary
  const summary = extractSummary(ir, flags, confidence);

  // Extract hero answer
  const heroAnswer = extractHeroAnswer(ir, flags, confidence);

  // Extract sections
  const sections = extractSections(ir, flags, confidence);

  // Extract FAQs
  const faq = extractFaqs(ir, flags);

  // Extract primary keyword
  const primaryKeyword = extractPrimaryKeyword(ir, flags, confidence);

  // Extract secondary keywords
  const secondaryKeywords = extractSecondaryKeywords(ir);

  // Determine search intent
  const searchIntent = determineSearchIntent(ir);

  // Extract meta fields
  const metaTitle = extractMetaTitle(ir, title, flags);
  const metaDescription = extractMetaDescription(ir, summary, flags);

  // Extract canonical URL
  const canonicalUrl = ir.canonicalUrl || ir.sourceUrl;

  // Extract focus questions
  const focusQuestions = extractFocusQuestions(ir);

  // Extract internal links
  const internalLinks = extractInternalLinks(ir, flags);

  // Create experience evidence placeholder
  const experienceEvidence = createExperienceEvidence(ir, flags);

  // Generate JSON-LD
  const ldJsonArticle = generateArticleJsonLd(ir, title, summary, canonicalUrl);

  // Calculate word count
  const wordCount = calculateWordCount(sections, heroAnswer);

  // Calculate reading time
  const readingTimeMinutes = Math.ceil(wordCount / 200);

  // Determine source
  const source = mapSourceType(ir.sourceType);

  // Calculate overall confidence
  confidence.overall = calculateOverallConfidence(confidence);

  // Build partial blog post
  const post: Partial<BlogPost> = {
    id,
    slug,
    sourceUrl: ir.sourceUrl,
    source,
    status: 'draft',
    version: 1,
    title,
    summary,
    heroAnswer,
    sections,
    faq,
    primaryKeyword,
    secondaryKeywords,
    searchIntent,
    metaTitle,
    metaDescription,
    canonicalUrl,
    focusQuestions,
    internalLinks,
    experienceEvidence,
    ldJsonArticle,
    ldJsonFaqPage: faq.length >= 2 ? generateFaqPageJsonLd(faq) : null,
    rawHtml: ir.rawHtml,
    wordCount,
    readingTimeMinutes,
    aiAssisted: false,
    aiModel: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    performance: {
      clicks: null,
      impressions: null,
      averagePosition: null,
      ctr: null,
      conversionEvents: null,
      lastSyncedAt: null,
    },
  };

  // Add Shopify-specific data if available
  if (ir.shopify) {
    post.publishedAt = ir.shopify.publishedAt || null;
  }

  return { post, flags, confidence };
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

interface NormalizationOptions {
  defaultAuthorId?: string;
  baseUrl?: string;
}

function initFlags(): NormalizationFlags {
  return {
    missingTitle: false,
    missingMetaDescription: false,
    missingAuthor: true, // Always true initially, author must be assigned
    missingHeroAnswer: false,
    fewSections: false,
    noFaq: false,
    fewInternalLinks: false,
    noExperienceEvidence: true,
    needsReview: [],
  };
}

function initConfidence(): NormalizationConfidence {
  return {
    title: 0,
    summary: 0,
    heroAnswer: 0,
    primaryKeyword: 0,
    sections: 0,
    author: 0,
    overall: 0,
  };
}

function extractSlug(ir: IntermediatePost, options: NormalizationOptions): string {
  // Try Shopify handle first
  if (ir.shopify?.handle) {
    return ir.shopify.handle;
  }

  // Try extracting from URL
  try {
    const url = new URL(ir.sourceUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.length >= 3) {
      return slugify(lastPart);
    }
  } catch {
    // Invalid URL
  }

  // Fall back to title
  const title = ir.h1 || ir.title || ir.metaTitle;
  if (title) {
    return slugify(title);
  }

  // Generate random slug
  return `post-${Date.now()}`;
}

function extractTitle(
  ir: IntermediatePost,
  flags: NormalizationFlags,
  confidence: NormalizationConfidence
): string {
  // Prefer H1
  if (ir.h1 && ir.h1.length >= VALIDATION_THRESHOLDS.title.minLength) {
    confidence.title = 0.9;
    return ir.h1;
  }

  // Try meta title
  if (ir.metaTitle && ir.metaTitle.length >= VALIDATION_THRESHOLDS.title.minLength) {
    confidence.title = 0.8;
    return cleanTitle(ir.metaTitle);
  }

  // Try OG title
  if (ir.ogTitle && ir.ogTitle.length >= VALIDATION_THRESHOLDS.title.minLength) {
    confidence.title = 0.7;
    return cleanTitle(ir.ogTitle);
  }

  // Try document title
  if (ir.title && ir.title.length >= VALIDATION_THRESHOLDS.title.minLength) {
    confidence.title = 0.6;
    return cleanTitle(ir.title);
  }

  // Flag and use placeholder
  flags.missingTitle = true;
  flags.needsReview.push('Title is missing or too short');
  confidence.title = 0.1;
  return '[NEEDS_TITLE]';
}

function extractSummary(
  ir: IntermediatePost,
  flags: NormalizationFlags,
  confidence: NormalizationConfidence
): string {
  // Prefer meta description
  if (ir.metaDescription && ir.metaDescription.length >= 50) {
    confidence.summary = 0.9;
    return ir.metaDescription.slice(0, 300);
  }

  // Try OG description
  if (ir.ogDescription && ir.ogDescription.length >= 50) {
    confidence.summary = 0.8;
    return ir.ogDescription.slice(0, 300);
  }

  // Try first paragraph
  if (ir.paragraphs.length > 0) {
    const firstPara = ir.paragraphs[0].text;
    if (firstPara.length >= 50) {
      confidence.summary = 0.6;
      return firstPara.slice(0, 300);
    }
  }

  // Flag and create placeholder
  flags.needsReview.push('Summary could not be extracted');
  confidence.summary = 0.2;
  return '[NEEDS_SUMMARY]';
}

function extractHeroAnswer(
  ir: IntermediatePost,
  flags: NormalizationFlags,
  confidence: NormalizationConfidence
): string {
  // Take first 2-3 paragraphs before first H2
  const introParas = ir.paragraphs.filter(
    (p) => p.parentHeadingIndex === null || p.parentHeadingIndex === 0
  );

  if (introParas.length > 0) {
    const combined = introParas
      .slice(0, 3)
      .map((p) => p.text)
      .join(' ')
      .slice(0, 500);

    if (combined.length >= VALIDATION_THRESHOLDS.heroAnswer.minLength) {
      confidence.heroAnswer = 0.7;
      return combined;
    }
  }

  // Flag
  flags.missingHeroAnswer = true;
  flags.needsReview.push('Hero answer could not be extracted - needs direct answer');
  confidence.heroAnswer = 0.1;
  return '[NEEDS_HERO_ANSWER - Add a direct 2-4 sentence answer to the main question]';
}

function extractSections(
  ir: IntermediatePost,
  flags: NormalizationFlags,
  confidence: NormalizationConfidence
): Section[] {
  const sections: Section[] = [];

  // Group content by H2/H3 headings
  const h2h3Headings = ir.headings.filter((h) => h.level === 2 || h.level === 3);

  for (let i = 0; i < h2h3Headings.length; i++) {
    const heading = h2h3Headings[i];
    const headingIndex = ir.headings.indexOf(heading);

    // Get paragraphs for this section
    const sectionParas = ir.paragraphs.filter(
      (p) => p.parentHeadingIndex === headingIndex
    );

    // Get lists for this section
    const sectionLists = ir.lists.filter(
      (l) => l.parentHeadingIndex === headingIndex
    );

    // Build body content
    let body = sectionParas.map((p) => `<p>${p.html}</p>`).join('\n');

    // Add lists
    for (const list of sectionLists) {
      const listHtml =
        list.type === 'ul'
          ? `<ul>${list.items.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : `<ol>${list.items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
      body += '\n' + listHtml;
    }

    if (body.trim()) {
      sections.push({
        id: uuidv4(),
        headingText: heading.text,
        headingLevel: heading.level === 2 ? 'h2' : 'h3',
        body,
        wordCount: countWords(stripHtml(body)),
      });
    }
  }

  // Check section count
  if (sections.length < VALIDATION_THRESHOLDS.sections.minCount) {
    flags.fewSections = true;
    flags.needsReview.push(
      `Only ${sections.length} sections found, minimum ${VALIDATION_THRESHOLDS.sections.minCount} recommended`
    );
    confidence.sections = 0.4;
  } else {
    confidence.sections = Math.min(1, sections.length / 5);
  }

  return sections;
}

function extractFaqs(ir: IntermediatePost, flags: NormalizationFlags): FAQ[] {
  const faqs: FAQ[] = [];

  // Check for existing FAQ JSON-LD
  const faqJsonLd = ir.jsonLd.find(
    (ld) => (ld as { '@type'?: string })['@type'] === 'FAQPage'
  ) as { mainEntity?: Array<{ name: string; acceptedAnswer?: { text: string } }> } | undefined;

  if (faqJsonLd?.mainEntity) {
    for (const item of faqJsonLd.mainEntity) {
      if (item.name && item.acceptedAnswer?.text) {
        faqs.push({
          id: uuidv4(),
          question: item.name,
          answer: item.acceptedAnswer.text,
        });
      }
    }
  }

  // Look for question-style headings
  if (faqs.length === 0) {
    for (const heading of ir.headings) {
      if (heading.text.includes('?')) {
        // Find the paragraph(s) after this heading
        const headingIndex = ir.headings.indexOf(heading);
        const answerParas = ir.paragraphs
          .filter((p) => p.parentHeadingIndex === headingIndex)
          .slice(0, 2);

        if (answerParas.length > 0) {
          faqs.push({
            id: uuidv4(),
            question: heading.text,
            answer: answerParas.map((p) => p.text).join(' '),
          });
        }
      }
    }
  }

  if (faqs.length === 0) {
    flags.noFaq = true;
    flags.needsReview.push('No FAQs found - consider adding FAQ section');
  }

  return faqs.slice(0, VALIDATION_THRESHOLDS.faq.maxCount);
}

function extractPrimaryKeyword(
  ir: IntermediatePost,
  flags: NormalizationFlags,
  confidence: NormalizationConfidence
): string {
  // Try to extract from title
  const title = ir.h1 || ir.title || ir.metaTitle || '';

  // Simple heuristic: use first few significant words
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);

  if (words.length > 0) {
    confidence.primaryKeyword = 0.5;
    return words.join(' ');
  }

  flags.needsReview.push('Primary keyword could not be determined');
  confidence.primaryKeyword = 0.1;
  return '[NEEDS_KEYWORD]';
}

function extractSecondaryKeywords(ir: IntermediatePost): string[] {
  const keywords: string[] = [];

  // Extract from headings
  for (const heading of ir.headings.slice(0, 5)) {
    const words = heading.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4);

    for (const word of words) {
      if (!keywords.includes(word) && keywords.length < 10) {
        keywords.push(word);
      }
    }
  }

  return keywords;
}

function determineSearchIntent(ir: IntermediatePost): SearchIntent {
  const title = (ir.h1 || ir.title || '').toLowerCase();

  if (title.includes('how to') || title.includes('guide') || title.includes('what is')) {
    return 'informational';
  }
  if (title.includes('best') || title.includes('top') || title.includes('review')) {
    return 'commercial';
  }
  if (title.includes('buy') || title.includes('price') || title.includes('order')) {
    return 'transactional';
  }

  return 'informational';
}

function extractMetaTitle(
  ir: IntermediatePost,
  title: string,
  flags: NormalizationFlags
): string {
  if (ir.metaTitle && ir.metaTitle.length >= 30) {
    return ir.metaTitle.slice(0, 70);
  }

  if (title && !title.startsWith('[')) {
    return title.slice(0, 60);
  }

  flags.needsReview.push('Meta title needs to be written');
  return '[NEEDS_META_TITLE]';
}

function extractMetaDescription(
  ir: IntermediatePost,
  summary: string,
  flags: NormalizationFlags
): string {
  if (ir.metaDescription && ir.metaDescription.length >= 100) {
    return ir.metaDescription.slice(0, 170);
  }

  if (summary && !summary.startsWith('[')) {
    return summary.slice(0, 160);
  }

  flags.missingMetaDescription = true;
  flags.needsReview.push('Meta description needs to be written');
  return '[NEEDS_META_DESCRIPTION]';
}

function extractFocusQuestions(ir: IntermediatePost): string[] {
  const questions: string[] = [];

  // Extract from headings that are questions
  for (const heading of ir.headings) {
    if (heading.text.includes('?') && questions.length < 5) {
      questions.push(heading.text);
    }
  }

  return questions;
}

function extractInternalLinks(
  ir: IntermediatePost,
  flags: NormalizationFlags
): InternalLink[] {
  const internalLinks: InternalLink[] = [];

  for (const link of ir.links.filter((l) => l.isInternal)) {
    // Classify link type
    let linkType: InternalLink['linkType'] = 'blog_post';

    if (link.href.includes('/product')) {
      linkType = 'product';
    } else if (link.href.includes('/collection')) {
      linkType = 'collection';
    } else if (link.href.includes('/categor')) {
      linkType = 'category';
    }

    internalLinks.push({
      href: link.href,
      anchorText: link.text,
      linkType,
      targetPostId: null,
    });
  }

  if (internalLinks.length < VALIDATION_THRESHOLDS.internalLinks.recommendedMin) {
    flags.fewInternalLinks = true;
    flags.needsReview.push(
      `Only ${internalLinks.length} internal links found, recommend ${VALIDATION_THRESHOLDS.internalLinks.recommendedMin}+`
    );
  }

  return internalLinks;
}

function createExperienceEvidence(
  ir: IntermediatePost,
  flags: NormalizationFlags
): ExperienceEvidence {
  // Look for sections that mention experience, case studies, etc.
  const experienceKeywords = [
    'our experience',
    'we found',
    'in practice',
    'case study',
    'real-world',
    'we tested',
    'our team',
  ];

  for (const para of ir.paragraphs) {
    const lowerText = para.text.toLowerCase();
    for (const keyword of experienceKeywords) {
      if (lowerText.includes(keyword)) {
        flags.noExperienceEvidence = false;
        return {
          summary: para.text.slice(0, 500),
          details: null,
          placeholders: [],
        };
      }
    }
  }

  // No experience found, create placeholder
  flags.needsReview.push('Experience evidence section needs to be added');
  return {
    summary:
      '[PLACEHOLDER_EXPERIENCE - Add specific first-hand experience with this topic]',
    details: null,
    placeholders: ['[SPECIFIC_EXAMPLE]', '[QUANTITATIVE_DATA]', '[CASE_STUDY]'],
  };
}

function generateArticleJsonLd(
  ir: IntermediatePost,
  title: string,
  summary: string,
  canonicalUrl: string
): ArticleJsonLd {
  // Check for existing Article JSON-LD
  const existingArticle = ir.jsonLd.find((ld) => {
    const type = (ld as { '@type'?: string })['@type'];
    return type === 'Article' || type === 'BlogPosting';
  }) as ArticleJsonLd | undefined;

  if (existingArticle) {
    return existingArticle;
  }

  // Generate new
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title.slice(0, 110),
    description: summary.slice(0, 300),
    image: ir.ogImage,
    author: {
      '@type': 'Person',
      name: ir.shopify?.author || '[AUTHOR_NAME]',
      url: null,
    },
    publisher: {
      '@type': 'Organization',
      name: '[ORGANIZATION_NAME]',
      logo: {
        '@type': 'ImageObject',
        url: '[LOGO_URL]',
      },
    },
    datePublished: ir.shopify?.publishedAt || null,
    dateModified: null,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  };
}

function generateFaqPageJsonLd(faqs: FAQ[]): import('@/lib/schema/canonical').FaqPageJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

function calculateWordCount(sections: Section[], heroAnswer: string): number {
  const sectionWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
  const heroWords = countWords(heroAnswer);
  return sectionWords + heroWords;
}

function mapSourceType(sourceType: IntermediatePost['sourceType']): ContentSource {
  switch (sourceType) {
    case 'shopify':
      return 'shopify';
    case 'sitemap':
      return 'custom_nextjs';
    case 'manual':
      return 'manual';
    default:
      return 'manual';
  }
}

function calculateOverallConfidence(confidence: NormalizationConfidence): number {
  const weights = {
    title: 0.2,
    summary: 0.15,
    heroAnswer: 0.2,
    primaryKeyword: 0.15,
    sections: 0.2,
    author: 0.1,
  };

  return (
    confidence.title * weights.title +
    confidence.summary * weights.summary +
    confidence.heroAnswer * weights.heroAnswer +
    confidence.primaryKeyword * weights.primaryKeyword +
    confidence.sections * weights.sections +
    confidence.author * weights.author
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function cleanTitle(title: string): string {
  // Remove common suffixes like " | Site Name" or " - Company"
  return title
    .replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '')
    .trim()
    .slice(0, 100);
}
