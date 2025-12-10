/**
 * Shopify API Client
 *
 * REST and GraphQL clients for Shopify Admin API.
 * Handles article creation, updates, and publishing.
 */

import { getEnvironment, isShopifyConfigured } from '@/lib/config/env';
import type {
  ShopifyArticle,
  ShopifyArticleResponse,
  ShopifyArticlesListResponse,
  ShopifyBlogResponse,
  GeneratedArticle,
  PublishOptions,
} from './content-types';

// ============================================================================
// API CLIENT CONFIGURATION
// ============================================================================

interface ShopifyClientConfig {
  store: string;
  accessToken: string;
  apiVersion: string;
}

function getShopifyConfig(): ShopifyClientConfig {
  const env = getEnvironment();

  if (!env.SHOPIFY_STORE || !env.SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify credentials not configured. Set SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN.');
  }

  return {
    store: env.SHOPIFY_STORE,
    accessToken: env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2024-10',
  };
}

// ============================================================================
// REST API CLIENT
// ============================================================================

/**
 * Make REST API request to Shopify
 */
async function shopifyRest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const config = getShopifyConfig();
  const url = `https://${config.store}/admin/api/${config.apiVersion}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// BLOG OPERATIONS
// ============================================================================

/**
 * List all blogs
 */
export async function listBlogs(): Promise<ShopifyBlogResponse['blog'][]> {
  const response = await shopifyRest<{ blogs: ShopifyBlogResponse['blog'][] }>('GET', '/blogs.json');
  return response.blogs;
}

/**
 * Get blog by ID
 */
export async function getBlog(blogId: string): Promise<ShopifyBlogResponse['blog']> {
  const response = await shopifyRest<ShopifyBlogResponse>('GET', `/blogs/${blogId}.json`);
  return response.blog;
}

/**
 * Get blog by handle
 */
export async function getBlogByHandle(handle: string): Promise<ShopifyBlogResponse['blog'] | null> {
  const blogs = await listBlogs();
  return blogs.find((b) => b.handle === handle) || null;
}

// ============================================================================
// ARTICLE OPERATIONS
// ============================================================================

/**
 * List articles in a blog
 */
export async function listArticles(
  blogId: string,
  options?: {
    limit?: number;
    sinceId?: string;
    publishedStatus?: 'published' | 'unpublished' | 'any';
  }
): Promise<ShopifyArticleResponse['article'][]> {
  const params = new URLSearchParams();

  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.sinceId) params.set('since_id', options.sinceId);
  if (options?.publishedStatus) params.set('published_status', options.publishedStatus);

  const queryString = params.toString();
  const endpoint = `/blogs/${blogId}/articles.json${queryString ? `?${queryString}` : ''}`;

  const response = await shopifyRest<ShopifyArticlesListResponse>('GET', endpoint);
  return response.articles;
}

/**
 * Get article by ID
 */
export async function getArticle(
  blogId: string,
  articleId: string
): Promise<ShopifyArticleResponse['article']> {
  const response = await shopifyRest<ShopifyArticleResponse>(
    'GET',
    `/blogs/${blogId}/articles/${articleId}.json`
  );
  return response.article;
}

/**
 * Create a new article (draft or published)
 */
export async function createArticle(
  blogId: string,
  article: {
    title: string;
    body_html: string;
    author?: string;
    tags?: string;
    summary_html?: string;
    handle?: string;
    published?: boolean;
    published_at?: string;
    image?: {
      src: string;
      alt?: string;
    };
    metafields?: Array<{
      namespace: string;
      key: string;
      value: string;
      type: string;
    }>;
  }
): Promise<ShopifyArticleResponse['article']> {
  const response = await shopifyRest<ShopifyArticleResponse>('POST', `/blogs/${blogId}/articles.json`, {
    article,
  });
  return response.article;
}

/**
 * Update an existing article
 */
export async function updateArticle(
  blogId: string,
  articleId: string,
  updates: Partial<{
    title: string;
    body_html: string;
    author: string;
    tags: string;
    summary_html: string;
    handle: string;
    published: boolean;
    published_at: string;
    image: {
      src: string;
      alt: string;
    };
  }>
): Promise<ShopifyArticleResponse['article']> {
  const response = await shopifyRest<ShopifyArticleResponse>(
    'PUT',
    `/blogs/${blogId}/articles/${articleId}.json`,
    { article: updates }
  );
  return response.article;
}

/**
 * Delete an article
 */
export async function deleteArticle(blogId: string, articleId: string): Promise<void> {
  await shopifyRest<void>('DELETE', `/blogs/${blogId}/articles/${articleId}.json`);
}

/**
 * Publish a draft article
 */
export async function publishArticle(
  blogId: string,
  articleId: string,
  publishAt?: string
): Promise<ShopifyArticleResponse['article']> {
  return updateArticle(blogId, articleId, {
    published: true,
    published_at: publishAt || new Date().toISOString(),
  });
}

/**
 * Unpublish an article (make it a draft)
 */
export async function unpublishArticle(
  blogId: string,
  articleId: string
): Promise<ShopifyArticleResponse['article']> {
  return updateArticle(blogId, articleId, {
    published: false,
  });
}

// ============================================================================
// HIGH-LEVEL PUBLISHING FUNCTIONS
// ============================================================================

/**
 * Publish a generated article to Shopify
 */
export async function publishGeneratedArticle(
  article: GeneratedArticle,
  options: PublishOptions
): Promise<{
  success: boolean;
  articleId?: string;
  articleUrl?: string;
  error?: string;
}> {
  try {
    if (!isShopifyConfigured()) {
      return {
        success: false,
        error: 'Shopify credentials not configured',
      };
    }

    const config = getShopifyConfig();

    // Create the article
    const createdArticle = await createArticle(options.blogId, {
      title: article.title,
      body_html: article.body,
      author: options.authorName || 'Andre Tipon',
      tags: article.tags.join(', '),
      summary_html: `<p>${article.excerpt}</p>`,
      handle: article.slug,
      published: options.publishImmediately || false,
      published_at: options.scheduledFor || undefined,
    });

    const articleUrl = `https://${config.store}/blogs/${options.blogId}/${createdArticle.handle}`;

    return {
      success: true,
      articleId: String(createdArticle.id),
      articleUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create article as draft for review
 */
export async function createDraftArticle(
  article: GeneratedArticle,
  blogId: string,
  authorName?: string
): Promise<{
  success: boolean;
  articleId?: string;
  error?: string;
}> {
  return publishGeneratedArticle(article, {
    blogId,
    publishImmediately: false,
    authorName,
  });
}

/**
 * Schedule article for future publishing
 */
export async function scheduleArticle(
  article: GeneratedArticle,
  blogId: string,
  scheduledFor: Date,
  authorName?: string
): Promise<{
  success: boolean;
  articleId?: string;
  error?: string;
}> {
  return publishGeneratedArticle(article, {
    blogId,
    publishImmediately: true,
    scheduledFor: scheduledFor.toISOString(),
    authorName,
  });
}

// ============================================================================
// COPY-PASTE OUTPUT
// ============================================================================

/**
 * Format article for copy-paste into Shopify admin
 */
export function formatForCopyPaste(article: GeneratedArticle): string {
  const config = isShopifyConfigured() ? getShopifyConfig() : { store: 'alliancechemical.myshopify.com' };

  return `
════════════════════════════════════════════════════════════════════════════════
                          ARTICLE READY FOR SHOPIFY
════════════════════════════════════════════════════════════════════════════════

TITLE (paste in Title field):
${article.title}

HANDLE/URL (paste in Handle field):
${article.slug}

EXCERPT (paste in Excerpt field - this becomes meta description):
${article.excerpt}

TAGS (paste in Tags field, comma-separated):
${article.tags.join(', ')}

AUTHOR:
Andre Tipon

────────────────────────────────────────────────────────────────────────────────
                              PRE-PUBLISH CHECKLIST
────────────────────────────────────────────────────────────────────────────────

[ ] Add featured image
[ ] Verify all product links work
[ ] Check formatting in preview
[ ] Review FAQ section renders correctly
[ ] Verify heading hierarchy for TOC
[ ] Set publish date (or save as draft)

────────────────────────────────────────────────────────────────────────────────
                              ARTICLE STATS
────────────────────────────────────────────────────────────────────────────────

Word Count: ${article.wordCount}
Reading Time: ~${Math.ceil(article.wordCount / 200)} minutes
Content Type: ${article.contentType}
FAQs Detected: ${article.parsedFaqs.length}
Steps Detected: ${article.parsedSteps.length}
Headings: ${article.headings.length}
Product Links: ${article.productLinks.length}

Expected Schema:
- ${article.schemaPreview.type} schema will be generated
${article.contentType === 'faq' ? `- FAQPage schema with ${article.parsedFaqs.length} questions` : ''}
${article.contentType === 'howto' ? `- HowTo schema with ${article.parsedSteps.length} steps` : ''}

────────────────────────────────────────────────────────────────────────────────
              HTML BODY (copy everything below into Content field)
────────────────────────────────────────────────────────────────────────────────

${article.body}

════════════════════════════════════════════════════════════════════════════════
                                END OF ARTICLE
════════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Format article as JSON for API use
 */
export function formatAsJson(article: GeneratedArticle): string {
  return JSON.stringify(
    {
      title: article.title,
      handle: article.slug,
      body_html: article.body,
      summary_html: `<p>${article.excerpt}</p>`,
      tags: article.tags.join(', '),
      author: 'Andre Tipon',
      metadata: {
        wordCount: article.wordCount,
        contentType: article.contentType,
        faqCount: article.parsedFaqs.length,
        stepCount: article.parsedSteps.length,
        generatedAt: article.generatedAt,
        aiModel: article.aiModel,
      },
    },
    null,
    2
  );
}

// ============================================================================
// GRAPHQL CLIENT (for advanced operations)
// ============================================================================

/**
 * Make GraphQL request to Shopify
 */
async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const config = getShopifyConfig();
  const url = `https://${config.store}/admin/api/${config.apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify GraphQL error ${response.status}: ${errorText}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
  }

  return json.data as T;
}

/**
 * Get article count for a blog
 */
export async function getArticleCount(blogId: string): Promise<number> {
  const response = await shopifyRest<{ count: number }>(
    'GET',
    `/blogs/${blogId}/articles/count.json`
  );
  return response.count;
}

/**
 * Search articles by title or handle
 */
export async function searchArticles(
  blogId: string,
  query: string
): Promise<ShopifyArticleResponse['article'][]> {
  // REST API doesn't have search, so we fetch all and filter
  const allArticles = await listArticles(blogId, { limit: 250 });

  const lowerQuery = query.toLowerCase();
  return allArticles.filter(
    (article) =>
      article.title.toLowerCase().includes(lowerQuery) ||
      article.handle.toLowerCase().includes(lowerQuery) ||
      article.tags.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Check if an article with the same handle exists
 */
export async function articleExists(blogId: string, handle: string): Promise<boolean> {
  const articles = await searchArticles(blogId, handle);
  return articles.some((a) => a.handle === handle);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique handle if one already exists
 */
export async function generateUniqueHandle(blogId: string, baseHandle: string): Promise<string> {
  let handle = baseHandle;
  let counter = 1;

  while (await articleExists(blogId, handle)) {
    handle = `${baseHandle}-${counter}`;
    counter++;

    // Safety limit
    if (counter > 100) {
      throw new Error('Could not generate unique handle');
    }
  }

  return handle;
}

/**
 * Validate Shopify configuration
 */
export function validateShopifyConfig(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const env = getEnvironment();

    if (!env.SHOPIFY_STORE) {
      errors.push('SHOPIFY_STORE environment variable not set');
    }

    if (!env.SHOPIFY_ACCESS_TOKEN) {
      errors.push('SHOPIFY_ACCESS_TOKEN environment variable not set');
    }
  } catch (error) {
    errors.push('Failed to read environment configuration');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Test Shopify API connection
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  blogCount?: number;
}> {
  try {
    const blogs = await listBlogs();
    return {
      success: true,
      message: `Connected to Shopify. Found ${blogs.length} blog(s).`,
      blogCount: blogs.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
