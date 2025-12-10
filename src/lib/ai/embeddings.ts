/**
 * Embeddings Service
 *
 * Generate and manage embeddings for blog posts.
 */

import { db } from '@/lib/db/client';
import { blogPostEmbeddings, blogPosts } from '@/lib/db/schema';
import { openaiEmbeddings } from './providers/openai';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { BlogPost, Section } from '@/lib/schema/canonical';
import { EMBEDDING_CONFIG } from '@/lib/config/constants';

/**
 * Embedding chunk for a blog post
 */
interface EmbeddingChunk {
  blogPostId: string;
  chunkIndex: number;
  contentType: 'title' | 'hero' | 'section' | 'faq' | 'full' | 'summary';
  text: string;
  tags: string[];
}

/**
 * Generate all embeddings for a blog post
 */
export async function generatePostEmbeddings(
  post: BlogPost,
  options: { force?: boolean } = {}
): Promise<{ chunks: number; model: string }> {
  // Delete existing embeddings if forcing refresh
  if (options.force) {
    await db
      .delete(blogPostEmbeddings)
      .where(eq(blogPostEmbeddings.blogPostId, post.id));
  } else {
    // Check if embeddings already exist
    const existing = await db.query.blogPostEmbeddings.findFirst({
      where: eq(blogPostEmbeddings.blogPostId, post.id),
    });

    if (existing) {
      return { chunks: 0, model: EMBEDDING_CONFIG.model };
    }
  }

  // Generate chunks
  const chunks = generateChunks(post);

  // Generate embeddings in batch
  const texts = chunks.map((c) => c.text);
  const embeddings = await openaiEmbeddings.embedBatch(texts);

  // Store embeddings
  const records = chunks.map((chunk, i) => ({
    id: uuidv4(),
    blogPostId: post.id,
    chunkIndex: chunk.chunkIndex,
    chunkText: chunk.text,
    embedding: embeddings[i],
    embeddingModel: EMBEDDING_CONFIG.model,
    contentType: chunk.contentType,
    tags: chunk.tags,
    createdAt: new Date(),
  }));

  // Insert in batches to avoid hitting parameter limits
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(blogPostEmbeddings).values(batch);
  }

  return { chunks: chunks.length, model: EMBEDDING_CONFIG.model };
}

/**
 * Generate embedding chunks for a blog post
 */
function generateChunks(post: BlogPost): EmbeddingChunk[] {
  const chunks: EmbeddingChunk[] = [];
  let chunkIndex = 0;

  // 1. Summary chunk: title + summary + primaryKeyword
  chunks.push({
    blogPostId: post.id,
    chunkIndex: chunkIndex++,
    contentType: 'summary',
    text: `${post.title}\n\n${post.summary}\n\nKeyword: ${post.primaryKeyword}`,
    tags: ['summary', post.searchIntent],
  });

  // 2. Hero answer chunk
  chunks.push({
    blogPostId: post.id,
    chunkIndex: chunkIndex++,
    contentType: 'hero',
    text: post.heroAnswer,
    tags: ['hero'],
  });

  // 3. Each section as separate chunk
  for (const section of post.sections) {
    const sectionText = `${section.headingText}\n\n${stripHtml(section.body)}`;

    // Truncate if too long
    const truncated = truncateToTokenLimit(sectionText, EMBEDDING_CONFIG.maxTokensPerText / 2);

    chunks.push({
      blogPostId: post.id,
      chunkIndex: chunkIndex++,
      contentType: 'section',
      text: truncated,
      tags: ['section', section.headingLevel],
    });
  }

  // 4. FAQ as single chunk if exists
  if (post.faq.length > 0) {
    const faqText = post.faq
      .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n');

    const truncated = truncateToTokenLimit(faqText, EMBEDDING_CONFIG.maxTokensPerText / 2);

    chunks.push({
      blogPostId: post.id,
      chunkIndex: chunkIndex++,
      contentType: 'faq',
      text: truncated,
      tags: ['faq'],
    });
  }

  // 5. Full post concatenation
  const fullText = [
    post.title,
    post.heroAnswer,
    ...post.sections.map((s) => `${s.headingText}\n${stripHtml(s.body)}`),
    post.faq.map((f) => `${f.question} ${f.answer}`).join(' '),
  ].join('\n\n');

  const truncatedFull = truncateToTokenLimit(fullText, EMBEDDING_CONFIG.maxTokensPerText);

  chunks.push({
    blogPostId: post.id,
    chunkIndex: chunkIndex++,
    contentType: 'full',
    text: truncatedFull,
    tags: ['full', post.searchIntent, ...(post.secondaryKeywords.slice(0, 3))],
  });

  return chunks;
}

/**
 * Generate embeddings for all posts that don't have them
 */
export async function generateMissingEmbeddings(
  options: {
    limit?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<{ processed: number; total: number }> {
  // Find posts without embeddings
  const postsWithoutEmbeddings = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .leftJoin(
      blogPostEmbeddings,
      eq(blogPosts.id, blogPostEmbeddings.blogPostId)
    )
    .where(sql`${blogPostEmbeddings.id} IS NULL`)
    .limit(options.limit || 1000);

  const total = postsWithoutEmbeddings.length;
  let processed = 0;

  for (const { id } of postsWithoutEmbeddings) {
    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });

    if (post) {
      await generatePostEmbeddings(post as unknown as BlogPost);
    }

    processed++;
    options.onProgress?.(processed, total);
  }

  return { processed, total };
}

/**
 * Delete embeddings for a post
 */
export async function deletePostEmbeddings(postId: string): Promise<void> {
  await db
    .delete(blogPostEmbeddings)
    .where(eq(blogPostEmbeddings.blogPostId, postId));
}

/**
 * Embed a query string for similarity search
 */
export async function embedQuery(query: string): Promise<number[]> {
  return openaiEmbeddings.embed(query);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to approximate token limit
 * Rough estimate: 1 token ≈ 4 characters
 */
function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + '...';
}
