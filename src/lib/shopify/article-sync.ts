/**
 * Shopify Article Sync
 *
 * Syncs our canonical BlogPost to Shopify articles with proper metafields
 * for the Liquid template to render correctly.
 */

import type { BlogPost, FAQ, Section, SearchIntent } from '@/lib/schema/canonical';

// ============================================================================
// TYPES
// ============================================================================

interface ShopifyArticleInput {
  title: string;
  author: string;
  body_html: string;
  summary_html?: string;
  tags?: string;
  published?: boolean;
  published_at?: string;
  image?: {
    src: string;
    alt?: string;
  };
  metafields?: ShopifyMetafield[];
}

interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

interface ShopifyFAQItem {
  question: string;
  answer: string;
}

interface ShopifyHowToStep {
  name: string;
  text: string;
}

interface SyncResult {
  success: boolean;
  articleId?: string;
  articleHandle?: string;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================

/**
 * Detect content type tags from post content and metadata
 */
function detectContentTypeTags(post: BlogPost): string[] {
  const tags: string[] = [];
  const contentLower = (post.rawHtml || '').toLowerCase();
  const titleLower = post.title.toLowerCase();

  // Search intent mapping
  if (post.searchIntent === 'informational') {
    if (
      contentLower.includes('step 1') ||
      contentLower.includes('how to') ||
      titleLower.includes('how to') ||
      titleLower.includes('guide')
    ) {
      tags.push('howto');
    }
  }

  if (post.searchIntent === 'commercial') {
    if (titleLower.includes('vs') || contentLower.includes('comparison')) {
      tags.push('comparison');
    }
  }

  // FAQ detection
  if (post.faq.length > 0) {
    tags.push('faq');
  }

  // Safety content detection
  const safetyPatterns = [
    'safety',
    'hazard',
    'warning',
    'caution',
    'ppe',
    'protective equipment',
    'sds',
    'msds',
    'emergency',
  ];
  if (safetyPatterns.some((p) => contentLower.includes(p))) {
    tags.push('safety');
  }

  // Technical content detection
  const technicalPatterns = [
    'specification',
    'cas number',
    'chemical formula',
    'molecular weight',
    'concentration',
    'ph level',
    'boiling point',
    'flash point',
  ];
  if (technicalPatterns.some((p) => contentLower.includes(p))) {
    tags.push('technical');
  }

  // Educational
  if (titleLower.includes('what is') || titleLower.includes('understanding')) {
    tags.push('educational');
  }

  return [...new Set(tags)]; // Dedupe
}

/**
 * Extract HowTo steps from sections if content is a how-to guide
 */
function extractHowToSteps(post: BlogPost): ShopifyHowToStep[] | null {
  const contentLower = (post.rawHtml || '').toLowerCase();
  const titleLower = post.title.toLowerCase();

  // Only extract if this is actually a how-to
  const isHowTo =
    titleLower.includes('how to') ||
    contentLower.includes('step 1') ||
    contentLower.includes('step-by-step');

  if (!isHowTo) return null;

  const steps: ShopifyHowToStep[] = [];

  for (const section of post.sections) {
    // Look for numbered sections or "Step X" patterns
    const headingLower = section.headingText.toLowerCase();
    if (
      /^step\s*\d/i.test(section.headingText) ||
      /^\d+\.\s/.test(section.headingText) ||
      headingLower.includes('first') ||
      headingLower.includes('next') ||
      headingLower.includes('then') ||
      headingLower.includes('finally')
    ) {
      steps.push({
        name: section.headingText.replace(/^step\s*\d+[:\s]*/i, '').trim() || section.headingText,
        text: stripHtml(section.body).substring(0, 500),
      });
    }
  }

  return steps.length >= 2 ? steps : null;
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform our BlogPost to Shopify article input format
 */
export function transformToShopifyArticle(
  post: BlogPost,
  options: {
    blogId: string;
    publish?: boolean;
  }
): ShopifyArticleInput {
  // Build tags array
  const allTags = [
    post.primaryKeyword,
    ...post.secondaryKeywords,
    ...detectContentTypeTags(post),
  ].filter(Boolean);

  // Build metafields
  const metafields: ShopifyMetafield[] = [];

  // FAQ metafield
  if (post.faq.length > 0) {
    const faqItems: ShopifyFAQItem[] = post.faq.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }));
    metafields.push({
      namespace: 'custom',
      key: 'faq_items',
      value: JSON.stringify(faqItems),
      type: 'json',
    });
  }

  // Author job title
  if (post.author.role) {
    metafields.push({
      namespace: 'custom',
      key: 'author_job_title',
      value: post.author.role,
      type: 'single_line_text_field',
    });
  }

  // Author bio (combine credentials + any additional info)
  const authorBio = [post.author.credentials, post.experienceEvidence.summary]
    .filter(Boolean)
    .join('\n\n');
  if (authorBio) {
    metafields.push({
      namespace: 'custom',
      key: 'author_bio',
      value: authorBio,
      type: 'multi_line_text_field',
    });
  }

  // HowTo steps (if applicable)
  const howToSteps = extractHowToSteps(post);
  if (howToSteps) {
    metafields.push({
      namespace: 'custom',
      key: 'howto_steps',
      value: JSON.stringify(howToSteps),
      type: 'json',
    });
  }

  return {
    title: post.title,
    author: post.author.name,
    body_html: post.rawHtml || renderSectionsToHtml(post),
    summary_html: post.summary,
    tags: allTags.join(', '),
    published: options.publish ?? false,
    published_at: post.publishedAt || undefined,
    metafields,
  };
}

/**
 * Render sections to HTML if rawHtml is not available
 */
function renderSectionsToHtml(post: BlogPost): string {
  const parts: string[] = [];

  // Hero answer
  if (post.heroAnswer) {
    parts.push(`<div class="hero-answer"><p><strong>${post.heroAnswer}</strong></p></div>`);
  }

  // Sections
  for (const section of post.sections) {
    const tag = section.headingLevel === 'h2' ? 'h2' : 'h3';
    parts.push(`<${tag}>${section.headingText}</${tag}>`);
    parts.push(section.body);
  }

  // FAQ section (also stored in metafield for schema)
  if (post.faq.length > 0) {
    parts.push('<section class="faq-section">');
    parts.push('<h2>Frequently Asked Questions</h2>');
    for (const faq of post.faq) {
      parts.push(`<div class="faq-item">`);
      parts.push(`<h3>${faq.question}</h3>`);
      parts.push(`<p>${faq.answer}</p>`);
      parts.push(`</div>`);
    }
    parts.push('</section>');
  }

  return parts.join('\n');
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ============================================================================
// SHOPIFY API SYNC
// ============================================================================

/**
 * Sync a BlogPost to Shopify
 */
export async function syncToShopify(
  post: BlogPost,
  options: {
    blogId: string;
    shopifyDomain: string;
    accessToken: string;
    publish?: boolean;
    existingArticleId?: string;
  }
): Promise<SyncResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const articleInput = transformToShopifyArticle(post, {
      blogId: options.blogId,
      publish: options.publish,
    });

    const endpoint = options.existingArticleId
      ? `https://${options.shopifyDomain}/admin/api/2024-01/articles/${options.existingArticleId}.json`
      : `https://${options.shopifyDomain}/admin/api/2024-01/blogs/${options.blogId}/articles.json`;

    const method = options.existingArticleId ? 'PUT' : 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': options.accessToken,
      },
      body: JSON.stringify({ article: articleInput }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      errors.push(`Shopify API error: ${response.status} - ${JSON.stringify(errorData)}`);
      return { success: false, errors, warnings };
    }

    const result = await response.json();
    const article = result.article;

    // Sync metafields separately (Shopify API quirk)
    if (articleInput.metafields && articleInput.metafields.length > 0) {
      const metafieldErrors = await syncMetafields(
        article.id,
        articleInput.metafields,
        options
      );
      if (metafieldErrors.length > 0) {
        warnings.push(...metafieldErrors.map((e) => `Metafield warning: ${e}`));
      }
    }

    return {
      success: true,
      articleId: article.id.toString(),
      articleHandle: article.handle,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Sync metafields for an article
 */
async function syncMetafields(
  articleId: number,
  metafields: ShopifyMetafield[],
  options: { shopifyDomain: string; accessToken: string }
): Promise<string[]> {
  const errors: string[] = [];

  for (const metafield of metafields) {
    try {
      const response = await fetch(
        `https://${options.shopifyDomain}/admin/api/2024-01/articles/${articleId}/metafields.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': options.accessToken,
          },
          body: JSON.stringify({
            metafield: {
              namespace: metafield.namespace,
              key: metafield.key,
              value: metafield.value,
              type: metafield.type,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        errors.push(`${metafield.key}: ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      errors.push(`${metafield.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return errors;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a BlogPost has all required fields for Shopify sync
 */
export function validateForShopifySync(post: BlogPost): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!post.title) errors.push('Missing title');
  if (!post.author?.name) errors.push('Missing author name');
  if (!post.rawHtml && post.sections.length === 0) {
    errors.push('Missing content (rawHtml or sections)');
  }

  // Recommended fields
  if (!post.summary) warnings.push('Missing summary/excerpt');
  if (!post.primaryKeyword) warnings.push('Missing primary keyword');
  if (post.faq.length === 0) warnings.push('No FAQs - consider adding for rich results');
  if (!post.author.role) warnings.push('Missing author role/job title');

  // Content quality checks
  if (post.rawHtml) {
    const wordCount = stripHtml(post.rawHtml).split(/\s+/).length;
    if (wordCount < 300) warnings.push(`Low word count (${wordCount}) - aim for 1500+`);
  }

  // Check for placeholder markers
  if (post.rawHtml?.includes('[PLACEHOLDER') || post.rawHtml?.includes('[NEEDS_')) {
    warnings.push('Content contains placeholder markers that need editorial review');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  ShopifyArticleInput,
  ShopifyMetafield,
  ShopifyFAQItem,
  ShopifyHowToStep,
  SyncResult,
};
