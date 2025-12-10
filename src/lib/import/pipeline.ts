/**
 * Import Pipeline
 *
 * Orchestrates the complete import process from source to database.
 */

import { db } from '@/lib/db/client';
import { blogPosts, authors, importLogs } from '@/lib/db/schema';
import type { IntermediatePost } from '@/lib/schema/intermediate';
import type { BlogPost } from '@/lib/schema/canonical';
import { parseHtml } from './parsers/html';
import { normalizePost } from './normalizer';
import { fetchAllShopifyArticles, fetchShopifyArticle } from './fetchers/shopify';
import { fetchUrls, fetchSitemap } from './fetchers/http';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Import job progress
 */
export interface ImportProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ url: string; error: string }>;
}

/**
 * Import options
 */
interface ImportOptions {
  onProgress?: (progress: ImportProgress) => void;
  defaultAuthorId?: string;
  forceRefresh?: boolean;
}

/**
 * Import result
 */
interface ImportResult {
  success: boolean;
  postsCreated: number;
  postsUpdated: number;
  postsFailed: number;
  errors: Array<{ url: string; error: string }>;
}

// ============================================================================
// SHOPIFY IMPORT
// ============================================================================

/**
 * Import all articles from Shopify
 */
export async function importFromShopify(
  store: string,
  accessToken: string,
  options: ImportOptions & {
    blogHandle?: string;
    limit?: number;
  } = {}
): Promise<ImportResult> {
  const progress: ImportProgress = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  // Ensure default author exists
  const authorId = await ensureDefaultAuthor(options.defaultAuthorId);

  // Fetch articles from Shopify
  const articles = await fetchAllShopifyArticles(store, accessToken, {
    blogHandle: options.blogHandle,
    limit: options.limit,
    onProgress: (fetched) => {
      progress.total = fetched;
      options.onProgress?.(progress);
    },
  });

  progress.total = articles.length;

  // Process each article
  for (const ir of articles) {
    try {
      // Re-parse HTML to extract full structure
      const fullIr = parseHtml(ir.rawHtml, ir.sourceUrl, 'shopify');
      // Merge Shopify-specific data
      fullIr.shopify = ir.shopify;

      await processIntermediatePost(fullIr, authorId, options.forceRefresh);

      progress.succeeded++;
    } catch (error) {
      progress.failed++;
      progress.errors.push({
        url: ir.sourceUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Log the error
      await logImportError(ir.sourceUrl, 'shopify', error);
    }

    progress.processed++;
    options.onProgress?.(progress);
  }

  return {
    success: progress.failed === 0,
    postsCreated: progress.succeeded,
    postsUpdated: 0, // TODO: Track updates separately
    postsFailed: progress.failed,
    errors: progress.errors,
  };
}

// ============================================================================
// SITEMAP IMPORT
// ============================================================================

/**
 * Import blog posts from a sitemap
 */
export async function importFromSitemap(
  sitemapUrl: string,
  options: ImportOptions & {
    urlPattern?: RegExp;
    limit?: number;
  } = {}
): Promise<ImportResult> {
  const progress: ImportProgress = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  // Ensure default author exists
  const authorId = await ensureDefaultAuthor(options.defaultAuthorId);

  // Discover URLs from sitemap
  const urls = await fetchSitemap(sitemapUrl, {
    urlPattern: options.urlPattern,
    limit: options.limit,
  });

  progress.total = urls.length;
  options.onProgress?.(progress);

  // Fetch all URLs
  const fetchResults = await fetchUrls(urls, {
    onProgress: (completed) => {
      progress.processed = completed;
      options.onProgress?.(progress);
    },
  });

  // Process each fetched page
  for (const result of fetchResults) {
    if (result.error || !result.html) {
      progress.failed++;
      progress.errors.push({
        url: result.url,
        error: result.error || 'Empty response',
      });

      await logImportError(result.url, 'sitemap', new Error(result.error || 'Empty response'));
      continue;
    }

    try {
      const ir = parseHtml(result.html, result.url, 'sitemap');
      await processIntermediatePost(ir, authorId, options.forceRefresh);

      progress.succeeded++;
    } catch (error) {
      progress.failed++;
      progress.errors.push({
        url: result.url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await logImportError(result.url, 'sitemap', error);
    }
  }

  return {
    success: progress.failed === 0,
    postsCreated: progress.succeeded,
    postsUpdated: 0,
    postsFailed: progress.failed,
    errors: progress.errors,
  };
}

// ============================================================================
// URL LIST IMPORT
// ============================================================================

/**
 * Import from a list of URLs
 */
export async function importFromUrls(
  urls: string[],
  options: ImportOptions = {}
): Promise<ImportResult> {
  const progress: ImportProgress = {
    total: urls.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  options.onProgress?.(progress);

  // Ensure default author exists
  const authorId = await ensureDefaultAuthor(options.defaultAuthorId);

  // Fetch all URLs
  const fetchResults = await fetchUrls(urls, {
    onProgress: (completed) => {
      progress.processed = completed;
      options.onProgress?.(progress);
    },
  });

  // Process each fetched page
  for (const result of fetchResults) {
    if (result.error || !result.html) {
      progress.failed++;
      progress.errors.push({
        url: result.url,
        error: result.error || 'Empty response',
      });
      continue;
    }

    try {
      const ir = parseHtml(result.html, result.url, 'manual');
      await processIntermediatePost(ir, authorId, options.forceRefresh);

      progress.succeeded++;
    } catch (error) {
      progress.failed++;
      progress.errors.push({
        url: result.url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: progress.failed === 0,
    postsCreated: progress.succeeded,
    postsUpdated: 0,
    postsFailed: progress.failed,
    errors: progress.errors,
  };
}

// ============================================================================
// SINGLE POST IMPORT
// ============================================================================

/**
 * Import a single post from Shopify by handle
 */
export async function importSingleShopifyPost(
  store: string,
  accessToken: string,
  blogHandle: string,
  articleHandle: string,
  options: ImportOptions = {}
): Promise<{ success: boolean; post?: BlogPost; error?: string }> {
  const authorId = await ensureDefaultAuthor(options.defaultAuthorId);

  const ir = await fetchShopifyArticle(store, accessToken, blogHandle, articleHandle);

  if (!ir) {
    return { success: false, error: 'Article not found' };
  }

  // Re-parse for full structure
  const fullIr = parseHtml(ir.rawHtml, ir.sourceUrl, 'shopify');
  fullIr.shopify = ir.shopify;

  try {
    const post = await processIntermediatePost(fullIr, authorId, options.forceRefresh);
    return { success: true, post: post as BlogPost };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// PROCESSING
// ============================================================================

/**
 * Process an intermediate post and save to database
 */
async function processIntermediatePost(
  ir: IntermediatePost,
  authorId: string,
  forceRefresh?: boolean
): Promise<Partial<BlogPost>> {
  // Check if post already exists
  const existingPost = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.sourceUrl, ir.sourceUrl),
  });

  if (existingPost && !forceRefresh) {
    // Update import log
    await db.insert(importLogs).values({
      id: uuidv4(),
      source: ir.sourceType,
      sourceUrl: ir.sourceUrl,
      status: 'saved',
      blogPostId: existingPost.id,
      metadata: { action: 'skipped', reason: 'already_exists' },
    });

    return existingPost as unknown as Partial<BlogPost>;
  }

  // Normalize to canonical schema
  const { post, flags } = normalizePost(ir);

  // Assign author
  post.authorId = authorId;

  // Build author object for denormalized storage
  const author = await db.query.authors.findFirst({
    where: eq(authors.id, authorId),
  });

  if (author) {
    post.author = {
      id: author.id,
      name: author.name,
      role: author.role,
      credentials: author.credentials,
      profileUrl: author.profileUrl,
      avatarUrl: author.avatarUrl,
    };
  }

  // Update JSON-LD with author info
  if (post.ldJsonArticle && author) {
    post.ldJsonArticle.author.name = author.name;
    post.ldJsonArticle.author.url = author.profileUrl;
    post.ldJsonArticle.author.jobTitle = author.role;
    post.ldJsonArticle.author.description = author.credentials;
  }

  // Convert string dates to Date objects for database
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;

  // Prepare database record (exclude fields that need conversion)
  const { createdAt: _, publishedAt: __, ...postData } = post;

  if (existingPost) {
    // Update existing post
    await db
      .update(blogPosts)
      .set({
        ...postData,
        publishedAt,
        version: existingPost.version + 1,
        updatedAt: new Date(),
      } as typeof blogPosts.$inferInsert)
      .where(eq(blogPosts.id, existingPost.id));

    // Log update
    await db.insert(importLogs).values({
      id: uuidv4(),
      source: ir.sourceType,
      sourceUrl: ir.sourceUrl,
      status: 'saved',
      blogPostId: existingPost.id,
      metadata: { action: 'updated', flags },
    });

    return { ...post, id: existingPost.id };
  } else {
    // Insert new post
    const [newPost] = await db
      .insert(blogPosts)
      .values({
        ...postData,
        id: post.id || uuidv4(),
        publishedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as typeof blogPosts.$inferInsert)
      .returning();

    // Log creation
    await db.insert(importLogs).values({
      id: uuidv4(),
      source: ir.sourceType,
      sourceUrl: ir.sourceUrl,
      status: 'saved',
      blogPostId: newPost.id,
      metadata: { action: 'created', flags },
    });

    return newPost as unknown as Partial<BlogPost>;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Ensure a default author exists
 */
async function ensureDefaultAuthor(providedId?: string): Promise<string> {
  if (providedId) {
    const exists = await db.query.authors.findFirst({
      where: eq(authors.id, providedId),
    });
    if (exists) return providedId;
  }

  // Check for existing default author
  const defaultAuthor = await db.query.authors.findFirst({
    where: eq(authors.name, 'Alliance Chemical Team'),
  });

  if (defaultAuthor) {
    return defaultAuthor.id;
  }

  // Create default author
  const [newAuthor] = await db
    .insert(authors)
    .values({
      id: uuidv4(),
      name: 'Alliance Chemical Team',
      role: 'Content Team',
      credentials: 'Expert team with years of experience in industrial chemicals',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newAuthor.id;
}

/**
 * Log an import error to the database
 */
async function logImportError(
  sourceUrl: string,
  source: string,
  error: unknown
): Promise<void> {
  try {
    await db.insert(importLogs).values({
      id: uuidv4(),
      source,
      sourceUrl,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  } catch {
    // Ignore logging errors
    console.error('Failed to log import error:', error);
  }
}
