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
// PRODUCT TYPES
// ============================================================================

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: 'active' | 'archived' | 'draft';
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  image: ShopifyImage | null;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  inventory_quantity: number;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  src: string;
  alt: string | null;
  width: number;
  height: number;
}

export interface ShopifyCollection {
  id: number;
  handle: string;
  title: string;
  body_html: string;
  image: ShopifyImage | null;
}

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

/**
 * List all products (with pagination)
 */
export async function listProducts(options?: {
  limit?: number;
  collection_id?: string;
  status?: 'active' | 'archived' | 'draft';
}): Promise<ShopifyProduct[]> {
  const params = new URLSearchParams();
  params.set('limit', String(options?.limit || 50));
  if (options?.collection_id) params.set('collection_id', options.collection_id);
  if (options?.status) params.set('status', options.status);

  const response = await shopifyRest<{ products: ShopifyProduct[] }>(
    'GET',
    `/products.json?${params.toString()}`
  );
  return response.products;
}

/**
 * Get product by ID
 */
export async function getProduct(productId: string): Promise<ShopifyProduct> {
  const response = await shopifyRest<{ product: ShopifyProduct }>(
    'GET',
    `/products/${productId}.json`
  );
  return response.product;
}

/**
 * List all collections
 */
export async function listCollections(type: 'smart' | 'custom' | 'all' = 'all'): Promise<ShopifyCollection[]> {
  const collections: ShopifyCollection[] = [];

  if (type === 'all' || type === 'smart') {
    const smart = await shopifyRest<{ smart_collections: ShopifyCollection[] }>(
      'GET',
      '/smart_collections.json?limit=250'
    );
    collections.push(...smart.smart_collections);
  }

  if (type === 'all' || type === 'custom') {
    const custom = await shopifyRest<{ custom_collections: ShopifyCollection[] }>(
      'GET',
      '/custom_collections.json?limit=250'
    );
    collections.push(...custom.custom_collections);
  }

  return collections;
}

/**
 * Get products in a collection
 */
export async function getCollectionProducts(collectionId: string): Promise<ShopifyProduct[]> {
  return listProducts({ collection_id: collectionId, limit: 250 });
}

/**
 * Get product URL
 */
export function getProductUrl(handle: string, store?: string): string {
  const storeHost = store || 'alliancechemical.com';
  return `https://${storeHost}/products/${handle}`;
}

/**
 * Get variant URL
 */
export function getVariantUrl(productHandle: string, variantId: number, store?: string): string {
  const storeHost = store || 'alliancechemical.com';
  return `https://${storeHost}/products/${productHandle}?variant=${variantId}`;
}

/**
 * Format product for LLM context
 */
export function formatProductForLLM(product: ShopifyProduct, store?: string): {
  title: string;
  handle: string;
  url: string;
  description: string;
  variants: Array<{
    title: string;
    price: string;
    url: string;
  }>;
  images: string[];
  tags: string[];
} {
  const storeHost = store || 'alliancechemical.com';

  return {
    title: product.title,
    handle: product.handle,
    url: getProductUrl(product.handle, storeHost),
    description: product.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || '',
    variants: product.variants.map((v) => ({
      title: v.title,
      price: v.price,
      url: getVariantUrl(product.handle, v.id, storeHost),
    })),
    images: product.images.map((img) => img.src),
    tags: product.tags ? product.tags.split(',').map((t) => t.trim()) : [],
  };
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
export async function shopifyGraphQL<T>(
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

// ============================================================================
// GRAPHQL PRODUCT QUERIES
// ============================================================================

/**
 * Fetch collections with GraphQL
 */
export async function fetchCollectionsGraphQL(): Promise<Array<{
  id: string;
  handle: string;
  title: string;
  productsCount: number;
}>> {
  const query = `
    query GetCollections {
      collections(first: 100) {
        nodes {
          id
          handle
          title
          productsCount
        }
      }
    }
  `;

  const data = await shopifyGraphQL<{
    collections: { nodes: Array<{ id: string; handle: string; title: string; productsCount: number }> };
  }>(query);

  return data.collections.nodes;
}

/**
 * Fetch products in a collection with full details
 */
export async function fetchCollectionProductsGraphQL(collectionHandle: string): Promise<Array<{
  id: string;
  title: string;
  handle: string;
  description: string;
  url: string;
  featuredImage: { url: string; altText: string | null } | null;
  images: Array<{ url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    url: string;
  }>;
  tags: string[];
}>> {
  const query = `
    query GetCollectionProducts($handle: String!) {
      collectionByHandle(handle: $handle) {
        products(first: 50) {
          nodes {
            id
            title
            handle
            description
            featuredImage {
              url
              altText
            }
            images(first: 5) {
              nodes {
                url
                altText
              }
            }
            variants(first: 10) {
              nodes {
                id
                title
                price
              }
            }
            tags
          }
        }
      }
    }
  `;

  const data = await shopifyGraphQL<{
    collectionByHandle: {
      products: {
        nodes: Array<{
          id: string;
          title: string;
          handle: string;
          description: string;
          featuredImage: { url: string; altText: string | null } | null;
          images: { nodes: Array<{ url: string; altText: string | null }> };
          variants: { nodes: Array<{ id: string; title: string; price: string }> };
          tags: string[];
        }>;
      };
    } | null;
  }>(query, { handle: collectionHandle });

  if (!data.collectionByHandle) {
    return [];
  }

  const storeHost = 'alliancechemical.com';

  return data.collectionByHandle.products.nodes.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description || '',
    url: `https://${storeHost}/products/${p.handle}`,
    featuredImage: p.featuredImage,
    images: p.images.nodes,
    variants: p.variants.nodes.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      url: `https://${storeHost}/products/${p.handle}?variant=${v.id.split('/').pop()}`,
    })),
    tags: p.tags,
  }));
}

/**
 * Fetch single product with full details
 */
export async function fetchProductGraphQL(handle: string): Promise<{
  id: string;
  title: string;
  handle: string;
  description: string;
  url: string;
  featuredImage: { url: string; altText: string | null } | null;
  images: Array<{ url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    url: string;
  }>;
  tags: string[];
} | null> {
  const query = `
    query GetProduct($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        images(first: 10) {
          nodes {
            url
            altText
          }
        }
        variants(first: 20) {
          nodes {
            id
            title
            price
          }
        }
        tags
      }
    }
  `;

  const data = await shopifyGraphQL<{
    productByHandle: {
      id: string;
      title: string;
      handle: string;
      description: string;
      featuredImage: { url: string; altText: string | null } | null;
      images: { nodes: Array<{ url: string; altText: string | null }> };
      variants: { nodes: Array<{ id: string; title: string; price: string }> };
      tags: string[];
    } | null;
  }>(query, { handle });

  if (!data.productByHandle) {
    return null;
  }

  const p = data.productByHandle;
  const storeHost = 'alliancechemical.com';

  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description || '',
    url: `https://${storeHost}/products/${p.handle}`,
    featuredImage: p.featuredImage,
    images: p.images.nodes,
    variants: p.variants.nodes.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      url: `https://${storeHost}/products/${p.handle}?variant=${v.id.split('/').pop()}`,
    })),
    tags: p.tags,
  };
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
