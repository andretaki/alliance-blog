/**
 * Article Validator
 *
 * Pre-publish validation to ensure generated articles will parse correctly
 * in the Shopify main-article.liquid template and generate proper schema markup.
 */

import type {
  GeneratedArticle,
  ValidationResult,
  ValidationIssue,
  ShopifyContentType,
} from './content-types';
import {
  validateFAQParseable,
  validateHowToParseable,
  validateExcerpt,
  validateWordCount,
  validateHeadingHierarchy,
  validateProductLinks,
  extractHeadings,
  parseFAQsFromHtml,
  parseStepsFromHtml,
  stripHtml,
} from './format-rules';
import { CONTENT_TYPE_TAGS } from './content-types';

// ============================================================================
// VALIDATION THRESHOLDS
// ============================================================================

const VALIDATION_CONFIG = {
  // Word count thresholds
  minWordCount: 800,
  recommendedWordCount: 1200,
  tocThreshold: 1000,

  // Excerpt thresholds
  minExcerptLength: 100,
  maxExcerptLength: 160,
  recommendedExcerptLength: 155,

  // FAQ thresholds
  minFaqsForSchema: 2,
  maxFaqs: 10,
  minFaqQuestionLength: 10,
  minFaqAnswerLength: 30,

  // How-To thresholds
  minStepsForSchema: 3,
  maxSteps: 15,
  minStepInstructionLength: 20,

  // Heading thresholds
  minHeadings: 3,
  maxHeadingsForToc: 20,

  // Product link thresholds
  minProductLinks: 1,
  maxProductLinks: 10,
};

// ============================================================================
// MAIN VALIDATOR FUNCTION
// ============================================================================

/**
 * Validate a generated article before publishing
 */
export function validateArticle(article: GeneratedArticle): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Run all validations
  validateTags(article, errors, warnings);
  validateExcerptContent(article, errors, warnings);
  validateContent(article, errors, warnings);
  validateSchemaRequirements(article, errors, warnings);
  validateProductLinkContent(article, errors, warnings);
  validateSEO(article, errors, warnings);
  validateVoice(article, errors, warnings);

  // Generate schema preview
  const schemaPreview = generateSchemaPreview(article);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    schemaPreview,
  };
}

// ============================================================================
// TAG VALIDATION
// ============================================================================

function validateTags(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { tags, contentType } = article;

  // Check if any tags present
  if (tags.length === 0) {
    errors.push({
      code: 'NO_TAGS',
      message: 'Article has no tags',
      field: 'tags',
      suggestion: 'Add tags for content type detection and SEO',
    });
    return;
  }

  // Check for content type tag
  const expectedTags = CONTENT_TYPE_TAGS[contentType];
  const hasContentTypeTag = expectedTags.some((tag) =>
    tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  );

  if (!hasContentTypeTag) {
    errors.push({
      code: 'MISSING_CONTENT_TYPE_TAG',
      message: `Missing content type tag. Expected one of: ${expectedTags.join(', ')}`,
      field: 'tags',
      suggestion: `Add "${expectedTags[0]}" tag for proper schema generation`,
    });
  }

  // Check for too few tags
  if (tags.length < 3) {
    warnings.push({
      code: 'FEW_TAGS',
      message: `Only ${tags.length} tags. Consider adding more for discoverability`,
      field: 'tags',
      suggestion: 'Add relevant chemical names, applications, or industry tags',
    });
  }

  // Check for too many tags
  if (tags.length > 15) {
    warnings.push({
      code: 'TOO_MANY_TAGS',
      message: `${tags.length} tags may dilute SEO value`,
      field: 'tags',
      suggestion: 'Keep to 8-12 most relevant tags',
    });
  }
}

// ============================================================================
// EXCERPT VALIDATION
// ============================================================================

function validateExcerptContent(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { excerpt } = article;
  const result = validateExcerpt(excerpt);

  if (excerpt.length === 0) {
    errors.push({
      code: 'EMPTY_EXCERPT',
      message: 'Excerpt is empty',
      field: 'excerpt',
      suggestion: 'Add a 130-155 character excerpt for meta description',
    });
    return;
  }

  if (excerpt.length < VALIDATION_CONFIG.minExcerptLength) {
    warnings.push({
      code: 'SHORT_EXCERPT',
      message: `Excerpt is ${excerpt.length} chars (recommended: ${VALIDATION_CONFIG.recommendedExcerptLength})`,
      field: 'excerpt',
      suggestion: 'Expand excerpt to include more keyword-rich content',
    });
  }

  if (excerpt.length > VALIDATION_CONFIG.maxExcerptLength) {
    errors.push({
      code: 'LONG_EXCERPT',
      message: `Excerpt is ${excerpt.length} chars (max: ${VALIDATION_CONFIG.maxExcerptLength})`,
      field: 'excerpt',
      suggestion: 'Shorten excerpt - it will be truncated in search results',
    });
  }

  // Check if primary keyword is in excerpt
  const primaryKeyword = article.briefUsed.primaryKeyword.toLowerCase();
  if (!excerpt.toLowerCase().includes(primaryKeyword)) {
    warnings.push({
      code: 'KEYWORD_NOT_IN_EXCERPT',
      message: `Primary keyword "${primaryKeyword}" not found in excerpt`,
      field: 'excerpt',
      suggestion: 'Include primary keyword in excerpt for better SEO',
    });
  }
}

// ============================================================================
// CONTENT VALIDATION
// ============================================================================

function validateContent(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { body, wordCount, headings } = article;

  // Word count validation
  if (wordCount < VALIDATION_CONFIG.minWordCount) {
    errors.push({
      code: 'LOW_WORD_COUNT',
      message: `Word count ${wordCount} is below minimum ${VALIDATION_CONFIG.minWordCount}`,
      field: 'body',
      suggestion: 'Expand content for better search visibility',
    });
  } else if (wordCount < VALIDATION_CONFIG.recommendedWordCount) {
    warnings.push({
      code: 'MODERATE_WORD_COUNT',
      message: `Word count ${wordCount} is below recommended ${VALIDATION_CONFIG.recommendedWordCount}`,
      field: 'body',
      suggestion: 'Consider expanding for comprehensive coverage',
    });
  }

  // Heading validation
  const headingResult = validateHeadingHierarchy(body);

  if (headings.length < VALIDATION_CONFIG.minHeadings) {
    warnings.push({
      code: 'FEW_HEADINGS',
      message: `Only ${headings.length} headings found`,
      field: 'body',
      suggestion: 'Add more H2/H3 headings to improve structure and TOC',
    });
  }

  for (const error of headingResult.errors) {
    warnings.push({
      code: 'HEADING_HIERARCHY_ISSUE',
      message: error,
      field: 'body',
      suggestion: 'Fix heading hierarchy for proper TOC generation',
    });
  }

  // TOC check
  if (wordCount > VALIDATION_CONFIG.tocThreshold) {
    if (headings.length < 3) {
      warnings.push({
        code: 'TOC_NEEDS_HEADINGS',
        message: `Long article (${wordCount} words) but only ${headings.length} headings - TOC will be sparse`,
        field: 'body',
        suggestion: 'Add more section headings for better navigation',
      });
    }
  }

  // Check for empty paragraphs or broken HTML
  if (body.includes('<p></p>') || body.includes('<p> </p>')) {
    warnings.push({
      code: 'EMPTY_PARAGRAPHS',
      message: 'Empty paragraphs found in content',
      field: 'body',
      suggestion: 'Remove empty paragraph tags',
    });
  }

  // Check for unclosed tags (basic check)
  const h2Opens = (body.match(/<h2/g) || []).length;
  const h2Closes = (body.match(/<\/h2>/g) || []).length;
  if (h2Opens !== h2Closes) {
    errors.push({
      code: 'UNCLOSED_H2',
      message: `Mismatched H2 tags: ${h2Opens} opens, ${h2Closes} closes`,
      field: 'body',
      suggestion: 'Check HTML for unclosed heading tags',
    });
  }
}

// ============================================================================
// SCHEMA REQUIREMENTS VALIDATION
// ============================================================================

function validateSchemaRequirements(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { contentType, parsedFaqs, parsedSteps, body } = article;

  // FAQ content type validation
  if (contentType === 'faq') {
    const faqResult = validateFAQParseable(body);

    if (parsedFaqs.length < VALIDATION_CONFIG.minFaqsForSchema) {
      errors.push({
        code: 'INSUFFICIENT_FAQS',
        message: `Only ${parsedFaqs.length} FAQs found. FAQPage schema requires at least ${VALIDATION_CONFIG.minFaqsForSchema}`,
        field: 'body',
        suggestion: 'Add more Q:/A: formatted questions',
      });
    }

    for (const error of faqResult.errors) {
      warnings.push({
        code: 'FAQ_PARSE_ISSUE',
        message: error,
        field: 'body',
        suggestion: 'Ensure FAQ format: <p><strong>Q: [question]?</strong></p><p>A: [answer]</p>',
      });
    }

    // Check FAQ quality
    for (const faq of parsedFaqs) {
      if (faq.question.length < VALIDATION_CONFIG.minFaqQuestionLength) {
        warnings.push({
          code: 'SHORT_FAQ_QUESTION',
          message: `FAQ question too short: "${faq.question}"`,
          field: 'body',
        });
      }
      if (faq.answer.length < VALIDATION_CONFIG.minFaqAnswerLength) {
        warnings.push({
          code: 'SHORT_FAQ_ANSWER',
          message: `FAQ answer too short for: "${faq.question}"`,
          field: 'body',
          suggestion: 'Expand answer to be more comprehensive',
        });
      }
    }
  }

  // How-To content type validation
  if (contentType === 'howto') {
    const stepResult = validateHowToParseable(body);

    if (parsedSteps.length < VALIDATION_CONFIG.minStepsForSchema) {
      errors.push({
        code: 'INSUFFICIENT_STEPS',
        message: `Only ${parsedSteps.length} steps found. HowTo schema works best with at least ${VALIDATION_CONFIG.minStepsForSchema}`,
        field: 'body',
        suggestion: 'Add more Step N: formatted steps',
      });
    }

    for (const error of stepResult.errors) {
      warnings.push({
        code: 'STEP_PARSE_ISSUE',
        message: error,
        field: 'body',
        suggestion: 'Ensure step format: <h3>Step N: [title]</h3><p>[instructions]</p>',
      });
    }

    // Check step quality
    for (const step of parsedSteps) {
      if (step.instructions.length < VALIDATION_CONFIG.minStepInstructionLength) {
        warnings.push({
          code: 'SHORT_STEP_INSTRUCTIONS',
          message: `Step ${step.stepNumber} has short instructions`,
          field: 'body',
          suggestion: 'Expand step instructions to be more detailed',
        });
      }
    }
  }

  // Safety content type validation
  if (contentType === 'safety') {
    const hasSafetyWarning =
      body.includes('safety-warning') ||
      body.includes('callout danger') ||
      body.includes('callout warning');

    if (!hasSafetyWarning) {
      warnings.push({
        code: 'NO_SAFETY_CALLOUT',
        message: 'Safety article without prominent safety callouts',
        field: 'body',
        suggestion: 'Add safety warning callouts for critical information',
      });
    }
  }
}

// ============================================================================
// PRODUCT LINK VALIDATION
// ============================================================================

function validateProductLinkContent(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { body, productLinks } = article;
  const linkResult = validateProductLinks(body);

  // Check for product links in body
  const bodyProductLinks = linkResult.links.filter(
    (l) => l.href.includes('/products/') || l.href.includes('/collections/')
  );

  if (bodyProductLinks.length === 0) {
    warnings.push({
      code: 'NO_PRODUCT_LINKS',
      message: 'No product links found in article body',
      field: 'body',
      suggestion: 'Add links to relevant Alliance Chemical products',
    });
  }

  // Validate expected product links were used
  for (const expectedProduct of productLinks) {
    const wasUsed = body.includes(expectedProduct.url);
    if (!wasUsed) {
      warnings.push({
        code: 'UNUSED_PRODUCT_LINK',
        message: `Suggested product "${expectedProduct.name}" not linked in article`,
        field: 'body',
        suggestion: `Consider adding link to ${expectedProduct.url}`,
      });
    }
  }

  // Check for broken links
  for (const link of linkResult.links) {
    if (!link.valid) {
      errors.push({
        code: 'INVALID_PRODUCT_LINK',
        message: `Potentially invalid product link: ${link.href}`,
        field: 'body',
        suggestion: 'Verify this link points to a valid product/collection',
      });
    }
  }
}

// ============================================================================
// SEO VALIDATION
// ============================================================================

function validateSEO(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { title, body, excerpt } = article;
  const primaryKeyword = article.briefUsed.primaryKeyword.toLowerCase();

  // Title validation
  if (title.length > 60) {
    warnings.push({
      code: 'LONG_TITLE',
      message: `Title is ${title.length} chars (recommended: under 60)`,
      field: 'title',
      suggestion: 'Shorten title - it may be truncated in search results',
    });
  }

  if (!title.toLowerCase().includes(primaryKeyword)) {
    warnings.push({
      code: 'KEYWORD_NOT_IN_TITLE',
      message: `Primary keyword "${primaryKeyword}" not in title`,
      field: 'title',
      suggestion: 'Include primary keyword in title for better SEO',
    });
  }

  // Check keyword usage in body
  const bodyText = stripHtml(body).toLowerCase();
  const keywordOccurrences = (bodyText.match(new RegExp(primaryKeyword, 'g')) || []).length;
  const wordCount = article.wordCount;

  if (keywordOccurrences === 0) {
    errors.push({
      code: 'KEYWORD_NOT_IN_BODY',
      message: `Primary keyword "${primaryKeyword}" not found in body`,
      field: 'body',
      suggestion: 'Include primary keyword naturally in content',
    });
  } else {
    const keywordDensity = (keywordOccurrences / wordCount) * 100;
    if (keywordDensity > 3) {
      warnings.push({
        code: 'HIGH_KEYWORD_DENSITY',
        message: `Keyword density ${keywordDensity.toFixed(1)}% may be too high`,
        field: 'body',
        suggestion: 'Reduce keyword repetition to avoid over-optimization',
      });
    }
  }

  // Check first paragraph for keyword
  const firstParagraphMatch = body.match(/<p[^>]*>(.+?)<\/p>/i);
  if (firstParagraphMatch) {
    const firstParagraph = stripHtml(firstParagraphMatch[1]).toLowerCase();
    if (!firstParagraph.includes(primaryKeyword)) {
      warnings.push({
        code: 'KEYWORD_NOT_IN_FIRST_PARAGRAPH',
        message: 'Primary keyword not in first paragraph',
        field: 'body',
        suggestion: 'Include keyword early in the content for better SEO',
      });
    }
  }
}

// ============================================================================
// VOICE VALIDATION
// ============================================================================

function validateVoice(
  article: GeneratedArticle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { body } = article;
  const bodyText = stripHtml(body).toLowerCase();

  // Check for Alliance Chemical voice markers
  const hasWeOur = bodyText.includes(' we ') || bodyText.includes(' our ');
  const hasYouYour = bodyText.includes(' you ') || bodyText.includes(' your ');
  const hasExperienceRef =
    bodyText.includes('years') ||
    bodyText.includes('experience') ||
    bodyText.includes('customers') ||
    bodyText.includes('facilities');

  if (!hasWeOur) {
    warnings.push({
      code: 'NO_WE_VOICE',
      message: 'No "we/our" language found',
      field: 'body',
      suggestion: 'Add first-person plural voice to establish authority',
    });
  }

  if (!hasYouYour) {
    warnings.push({
      code: 'NO_YOU_VOICE',
      message: 'No "you/your" language found',
      field: 'body',
      suggestion: 'Address reader directly for better engagement',
    });
  }

  if (!hasExperienceRef) {
    warnings.push({
      code: 'NO_EXPERIENCE_REFERENCE',
      message: 'No experience/authority references found',
      field: 'body',
      suggestion: 'Add references to years of experience, customer success, etc.',
    });
  }

  // Check for generic content indicators
  const genericPhrases = [
    'in conclusion',
    'to summarize',
    'it is important to note that',
    'it should be noted that',
    'needless to say',
  ];

  for (const phrase of genericPhrases) {
    if (bodyText.includes(phrase)) {
      warnings.push({
        code: 'GENERIC_PHRASE',
        message: `Generic phrase found: "${phrase}"`,
        field: 'body',
        suggestion: 'Replace with more specific, authoritative language',
      });
    }
  }
}

// ============================================================================
// SCHEMA PREVIEW GENERATION
// ============================================================================

function generateSchemaPreview(article: GeneratedArticle): ValidationResult['schemaPreview'] {
  const { title, excerpt, contentType, parsedFaqs, parsedSteps, wordCount } = article;

  // Base Article schema
  const articleSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: excerpt,
    wordCount,
    author: {
      '@type': 'Person',
      name: 'Andre Tipon',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Alliance Chemical',
    },
  };

  const result: ValidationResult['schemaPreview'] = {
    articleSchema,
  };

  // Add FAQ schema if applicable
  if (contentType === 'faq' && parsedFaqs.length >= 2) {
    result.faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: parsedFaqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }

  // Add HowTo schema if applicable
  if (contentType === 'howto' && parsedSteps.length >= 2) {
    result.howToSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: title,
      step: parsedSteps.map((step) => ({
        '@type': 'HowToStep',
        position: step.stepNumber,
        name: step.title,
        text: step.instructions,
      })),
    };
  }

  return result;
}

// ============================================================================
// QUICK VALIDATION
// ============================================================================

/**
 * Quick validation check - returns true/false only
 */
export function isArticleValid(article: GeneratedArticle): boolean {
  const result = validateArticle(article);
  return result.valid;
}

/**
 * Get validation summary
 */
export function getValidationSummary(article: GeneratedArticle): {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  topIssues: string[];
} {
  const result = validateArticle(article);

  return {
    valid: result.valid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    topIssues: [
      ...result.errors.slice(0, 3).map((e) => `ERROR: ${e.message}`),
      ...result.warnings.slice(0, 3).map((w) => `WARNING: ${w.message}`),
    ],
  };
}

/**
 * Fix common issues automatically where possible
 */
export function autoFixArticle(article: GeneratedArticle): {
  article: GeneratedArticle;
  fixes: string[];
} {
  const fixes: string[] = [];
  let { body, tags, excerpt } = article;

  // Auto-fix: Add content type tag if missing
  const expectedTags = CONTENT_TYPE_TAGS[article.contentType];
  const hasContentTypeTag = expectedTags.some((tag) =>
    tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  );

  if (!hasContentTypeTag) {
    tags = [expectedTags[0], ...tags];
    fixes.push(`Added content type tag: ${expectedTags[0]}`);
  }

  // Auto-fix: Truncate excerpt if too long
  if (excerpt.length > VALIDATION_CONFIG.maxExcerptLength) {
    excerpt = excerpt.slice(0, VALIDATION_CONFIG.recommendedExcerptLength - 3) + '...';
    fixes.push(`Truncated excerpt to ${VALIDATION_CONFIG.recommendedExcerptLength} chars`);
  }

  // Auto-fix: Remove empty paragraphs
  const emptyParagraphCount = (body.match(/<p>\s*<\/p>/g) || []).length;
  if (emptyParagraphCount > 0) {
    body = body.replace(/<p>\s*<\/p>/g, '');
    fixes.push(`Removed ${emptyParagraphCount} empty paragraphs`);
  }

  return {
    article: {
      ...article,
      body,
      tags,
      excerpt,
    },
    fixes,
  };
}
