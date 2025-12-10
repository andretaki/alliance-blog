/**
 * Retrieval Service
 *
 * Vector similarity search and exemplar retrieval for AI generation.
 */

import { db, sql as sqlClient } from '@/lib/db/client';
import { blogPostEmbeddings, blogPosts } from '@/lib/db/schema';
import { eq, and, inArray, not, sql, desc } from 'drizzle-orm';
import { embedQuery } from './embeddings';
import type { BlogPost, SearchIntent } from '@/lib/schema/canonical';
import { RETRIEVAL_CONFIG } from '@/lib/config/constants';

/**
 * Search result from vector similarity
 */
export interface RetrievalResult {
  postId: string;
  slug: string;
  title: string;
  heroAnswer: string;
  primaryKeyword: string;
  searchIntent: string;
  similarity: number;
  matchedChunk: string;
  contentType: string;
  performance: {
    clicks: number | null;
    impressions: number | null;
    averagePosition: number | null;
  };
  publishedAt: string | null;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  contentTypes?: string[];
  excludePostIds?: string[];
  clusterTopicId?: string;
  minClicks?: number;
}

/**
 * Search for similar posts using vector similarity
 */
export async function searchSimilarPosts(
  query: string,
  options: SearchOptions = {}
): Promise<RetrievalResult[]> {
  const {
    limit = RETRIEVAL_CONFIG.defaultLimit,
    minSimilarity = RETRIEVAL_CONFIG.defaultMinSimilarity,
    contentTypes,
    excludePostIds,
    clusterTopicId,
    minClicks,
  } = options;

  // Generate embedding for the query
  const queryEmbedding = await embedQuery(query);

  // Build the SQL query using raw SQL for pgvector operations
  // Note: Drizzle doesn't have native pgvector support, so we use raw SQL
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  let sqlQuery = `
    SELECT
      bp.id as post_id,
      bp.slug,
      bp.title,
      bp.hero_answer,
      bp.primary_keyword,
      bp.search_intent,
      bp.performance,
      bp.published_at,
      bpe.chunk_text as matched_chunk,
      bpe.content_type,
      1 - (bpe.embedding <=> '${embeddingStr}'::vector) as similarity
    FROM blog_post_embeddings bpe
    JOIN blog_posts bp ON bp.id = bpe.blog_post_id
    WHERE 1 - (bpe.embedding <=> '${embeddingStr}'::vector) >= ${minSimilarity}
  `;

  // Add filters
  if (contentTypes && contentTypes.length > 0) {
    const types = contentTypes.map((t) => `'${t}'`).join(',');
    sqlQuery += ` AND bpe.content_type IN (${types})`;
  }

  if (excludePostIds && excludePostIds.length > 0) {
    const ids = excludePostIds.map((id) => `'${id}'`).join(',');
    sqlQuery += ` AND bp.id NOT IN (${ids})`;
  }

  if (clusterTopicId) {
    sqlQuery += ` AND bp.cluster_topic_id = '${clusterTopicId}'`;
  }

  if (minClicks !== undefined) {
    sqlQuery += ` AND (bp.performance->>'clicks')::int >= ${minClicks}`;
  }

  sqlQuery += ` ORDER BY similarity DESC LIMIT ${limit}`;

  // Execute raw query
  const results = await sqlClient.unsafe(sqlQuery);

  // Map results
  return results.map((row: Record<string, unknown>) => ({
    postId: row.post_id as string,
    slug: row.slug as string,
    title: row.title as string,
    heroAnswer: row.hero_answer as string,
    primaryKeyword: row.primary_keyword as string,
    searchIntent: row.search_intent as string,
    similarity: row.similarity as number,
    matchedChunk: row.matched_chunk as string,
    contentType: row.content_type as string,
    performance: row.performance as {
      clicks: number | null;
      impressions: number | null;
      averagePosition: number | null;
    },
    publishedAt: row.published_at as string | null,
  }));
}

/**
 * Retrieve exemplar posts for AI generation
 * Uses composite scoring to select the best examples
 */
export async function retrieveExemplars(
  topic: string,
  options: {
    searchIntent?: SearchIntent;
    count?: number;
    excludePostIds?: string[];
    clusterTopicId?: string;
  } = {}
): Promise<BlogPost[]> {
  const {
    count = RETRIEVAL_CONFIG.exemplarCount,
    excludePostIds,
    clusterTopicId,
  } = options;

  // Get more candidates than needed for filtering
  const candidates = await searchSimilarPosts(topic, {
    limit: count * 3,
    minSimilarity: RETRIEVAL_CONFIG.exemplarMinSimilarity,
    contentTypes: ['summary', 'full'],
    excludePostIds,
    clusterTopicId,
  });

  if (candidates.length === 0) {
    return [];
  }

  // Score candidates using composite metric
  const scored = candidates.map((c) => ({
    ...c,
    compositeScore: calculateCompositeScore(c),
  }));

  // Sort by composite score and take top N
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  const topIds = scored.slice(0, count).map((c) => c.postId);

  // Fetch full post data
  const posts = await db.query.blogPosts.findMany({
    where: inArray(blogPosts.id, topIds),
  });

  // Preserve the order from scoring
  const postMap = new Map(posts.map((p) => [p.id, p]));
  return topIds.map((id) => postMap.get(id)).filter(Boolean) as unknown as BlogPost[];
}

/**
 * Calculate composite score for exemplar selection
 */
function calculateCompositeScore(result: RetrievalResult): number {
  const { similarity: similarityWeight, performance: performanceWeight, recency: recencyWeight, completeness: completenessWeight } =
    RETRIEVAL_CONFIG.scoreWeights;

  // Similarity score (already 0-1)
  const similarity = result.similarity;

  // Performance score (normalize)
  const performance = normalizePerformance(
    result.performance.clicks ?? 0,
    result.performance.impressions ?? 0,
    result.performance.averagePosition ?? 100
  );

  // Recency score
  const recency = normalizeRecency(result.publishedAt);

  // Completeness score (based on having key fields)
  const completeness = calculateCompleteness(result);

  return (
    similarity * similarityWeight +
    performance * performanceWeight +
    recency * recencyWeight +
    completeness * completenessWeight
  );
}

/**
 * Normalize performance metrics to 0-1 scale
 */
function normalizePerformance(
  clicks: number,
  impressions: number,
  avgPosition: number
): number {
  // Higher clicks and impressions = better
  // Lower position = better (position 1 is best)
  const clickScore = Math.min(clicks / 1000, 1); // Cap at 1000 clicks
  const impressionScore = Math.min(impressions / 10000, 1); // Cap at 10k impressions
  const positionScore = Math.max(0, 1 - avgPosition / 100); // Position 1 = 1, 100+ = 0

  return (clickScore * 0.5 + impressionScore * 0.3 + positionScore * 0.2);
}

/**
 * Normalize recency to 0-1 scale
 * Posts from last 6 months get higher scores
 */
function normalizeRecency(publishedAt: string | null): number {
  if (!publishedAt) return 0.5; // Neutral score for unknown

  const published = new Date(publishedAt);
  const now = new Date();
  const daysSincePublished = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

  // 0-30 days: 1.0
  // 30-90 days: 0.8
  // 90-180 days: 0.6
  // 180-365 days: 0.4
  // 365+ days: 0.2

  if (daysSincePublished < 30) return 1.0;
  if (daysSincePublished < 90) return 0.8;
  if (daysSincePublished < 180) return 0.6;
  if (daysSincePublished < 365) return 0.4;
  return 0.2;
}

/**
 * Calculate completeness score based on available fields
 */
function calculateCompleteness(result: RetrievalResult): number {
  let score = 0;
  let checks = 0;

  // Check key fields
  if (result.title && result.title.length > 10) {
    score++;
  }
  checks++;

  if (result.heroAnswer && result.heroAnswer.length > 50) {
    score++;
  }
  checks++;

  if (result.primaryKeyword && result.primaryKeyword.length > 2) {
    score++;
  }
  checks++;

  if (result.searchIntent) {
    score++;
  }
  checks++;

  return score / checks;
}

/**
 * Find posts in the same topic cluster
 */
export async function findClusterPosts(
  clusterTopicId: string,
  options: { limit?: number; excludePostId?: string } = {}
): Promise<BlogPost[]> {
  const { limit = 10, excludePostId } = options;

  const conditions = [eq(blogPosts.clusterTopicId, clusterTopicId)];

  if (excludePostId) {
    conditions.push(not(eq(blogPosts.id, excludePostId)));
  }

  const posts = await db.query.blogPosts.findMany({
    where: and(...conditions),
    limit,
    orderBy: desc(blogPosts.publishedAt),
  });

  return posts as unknown as BlogPost[];
}

/**
 * Suggest a cluster for a new post based on embedding similarity
 */
export async function suggestCluster(
  title: string,
  summary: string,
  primaryKeyword: string
): Promise<string | null> {
  const query = `${title} ${summary} ${primaryKeyword}`;

  // Search for similar posts
  const similar = await searchSimilarPosts(query, {
    limit: 5,
    minSimilarity: RETRIEVAL_CONFIG.clusterSimilarityThreshold,
    contentTypes: ['summary'],
  });

  if (similar.length === 0) {
    return null;
  }

  // Get cluster IDs from similar posts
  const postIds = similar.map((s) => s.postId);
  const posts = await db.query.blogPosts.findMany({
    where: inArray(blogPosts.id, postIds),
    columns: { clusterTopicId: true },
  });

  // Find most common cluster
  const clusterCounts = new Map<string, number>();
  for (const post of posts) {
    if (post.clusterTopicId) {
      clusterCounts.set(
        post.clusterTopicId,
        (clusterCounts.get(post.clusterTopicId) || 0) + 1
      );
    }
  }

  // Return cluster with highest count
  let bestCluster: string | null = null;
  let bestCount = 0;

  for (const [clusterId, count] of clusterCounts) {
    if (count > bestCount) {
      bestCluster = clusterId;
      bestCount = count;
    }
  }

  return bestCluster;
}
