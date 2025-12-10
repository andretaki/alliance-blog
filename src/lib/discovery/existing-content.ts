/**
 * Existing Content Module
 *
 * Tracks existing blog posts to prevent duplicate topic suggestions.
 * Uses the database for content indexing and fuzzy matching.
 */

import { db } from '@/lib/db/client';
import { blogPosts, contentIdeas } from '@/lib/db/schema';
import { extractChemicalNames } from '@/lib/shopify/product-matcher';
import type { ShopifyContentType } from '@/lib/shopify/content-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Simplified post representation for deduplication
 */
export interface ExistingPost {
  id: string;
  slug: string;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  chemicals: string[]; // Extracted from title/content
  publishedAt: Date | null;
  status: string;
}

/**
 * Content index for fast lookups
 */
export interface ContentIndex {
  posts: ExistingPost[];
  keywords: Set<string>; // All keywords we've targeted
  chemicals: Set<string>; // All chemicals we've written about
  titles: Set<string>; // Normalized titles
  slugs: Set<string>; // All slugs
  lastUpdated: Date;
}

/**
 * Result of duplicate check
 */
export interface DuplicateCheck {
  isDuplicate: boolean;
  confidence: 'exact' | 'likely' | 'possible' | 'none';
  matchedPost?: ExistingPost;
  reason?: string;
  similarity?: number;
}

/**
 * Content idea from database
 */
export interface ExistingIdea {
  id: string;
  topic: string;
  primaryKeyword: string;
  status: string;
  blogPostId: string | null;
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Fetch all existing posts from the database
 */
export async function fetchExistingPosts(): Promise<ExistingPost[]> {
  const posts = await db.query.blogPosts.findMany({
    columns: {
      id: true,
      slug: true,
      title: true,
      primaryKeyword: true,
      secondaryKeywords: true,
      searchIntent: true,
      publishedAt: true,
      status: true,
    },
  });

  return posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    primaryKeyword: post.primaryKeyword,
    secondaryKeywords: post.secondaryKeywords || [],
    searchIntent: post.searchIntent,
    chemicals: extractChemicalNames(post.title),
    publishedAt: post.publishedAt,
    status: post.status,
  }));
}

/**
 * Fetch existing content ideas (not yet written)
 */
export async function fetchExistingIdeas(): Promise<ExistingIdea[]> {
  const ideas = await db.query.contentIdeas.findMany({
    columns: {
      id: true,
      topic: true,
      primaryKeyword: true,
      status: true,
      blogPostId: true,
    },
  });

  return ideas.map((idea) => ({
    id: idea.id,
    topic: idea.topic,
    primaryKeyword: idea.primaryKeyword,
    status: idea.status,
    blogPostId: idea.blogPostId,
  }));
}

/**
 * Build content index from posts
 */
export function buildContentIndex(posts: ExistingPost[]): ContentIndex {
  const keywords = new Set<string>();
  const chemicals = new Set<string>();
  const titles = new Set<string>();
  const slugs = new Set<string>();

  for (const post of posts) {
    // Add primary keyword
    keywords.add(post.primaryKeyword.toLowerCase());

    // Add secondary keywords
    for (const kw of post.secondaryKeywords) {
      keywords.add(kw.toLowerCase());
    }

    // Add chemicals
    for (const chem of post.chemicals) {
      chemicals.add(chem.toLowerCase());
    }

    // Add normalized title
    titles.add(normalizeText(post.title));

    // Add slug
    slugs.add(post.slug);
  }

  return {
    posts,
    keywords,
    chemicals,
    titles,
    slugs,
    lastUpdated: new Date(),
  };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Check if a topic is a duplicate of existing content
 */
export function isDuplicateTopic(
  topic: string,
  index: ContentIndex,
  options?: {
    strictness?: 'strict' | 'moderate' | 'loose';
    checkKeywordOnly?: boolean;
  }
): DuplicateCheck {
  const strictness = options?.strictness ?? 'moderate';
  const normalizedTopic = normalizeText(topic);
  const topicKeyword = extractPrimaryKeyword(topic);
  const topicChemicals = extractChemicalNames(topic);

  // 1. Exact title match
  if (index.titles.has(normalizedTopic)) {
    const matchedPost = index.posts.find(
      (p) => normalizeText(p.title) === normalizedTopic
    );
    return {
      isDuplicate: true,
      confidence: 'exact',
      matchedPost,
      reason: 'Exact title match',
      similarity: 1.0,
    };
  }

  // 2. Primary keyword match
  if (index.keywords.has(topicKeyword.toLowerCase())) {
    const matchedPost = index.posts.find(
      (p) => p.primaryKeyword.toLowerCase() === topicKeyword.toLowerCase()
    );
    if (matchedPost) {
      // Same keyword = likely duplicate unless different angle
      const sameAngle = hasSimilarAngle(topic, matchedPost.title);
      if (sameAngle || strictness === 'strict') {
        return {
          isDuplicate: true,
          confidence: 'likely',
          matchedPost,
          reason: `Same primary keyword: "${topicKeyword}"`,
          similarity: 0.9,
        };
      }
    }
  }

  if (options?.checkKeywordOnly) {
    return {
      isDuplicate: false,
      confidence: 'none',
      similarity: 0,
    };
  }

  // 3. Fuzzy title match
  for (const post of index.posts) {
    const similarity = calculateSimilarity(normalizedTopic, normalizeText(post.title));

    if (similarity > 0.85) {
      return {
        isDuplicate: true,
        confidence: 'likely',
        matchedPost: post,
        reason: `Very similar title (${Math.round(similarity * 100)}% match)`,
        similarity,
      };
    }

    if (similarity > 0.65 && strictness !== 'loose') {
      return {
        isDuplicate: strictness === 'strict',
        confidence: 'possible',
        matchedPost: post,
        reason: `Similar title (${Math.round(similarity * 100)}% match)`,
        similarity,
      };
    }
  }

  // 4. Same chemical + similar angle
  if (topicChemicals.length > 0) {
    for (const post of index.posts) {
      const sharedChemicals = topicChemicals.filter((c) =>
        post.chemicals.includes(c.toLowerCase())
      );

      if (sharedChemicals.length > 0 && hasSimilarAngle(topic, post.title)) {
        const similarity = 0.6 + sharedChemicals.length * 0.1;
        return {
          isDuplicate: strictness === 'strict',
          confidence: 'possible',
          matchedPost: post,
          reason: `Same chemical (${sharedChemicals.join(', ')}) with similar angle`,
          similarity,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    confidence: 'none',
    similarity: 0,
  };
}

/**
 * Find related posts that could be linked to from a new article
 */
export function findRelatedPosts(
  topic: string,
  index: ContentIndex,
  maxResults: number = 5
): ExistingPost[] {
  const topicChemicals = extractChemicalNames(topic);
  const normalizedTopic = normalizeText(topic);

  const scored: Array<{ post: ExistingPost; score: number }> = [];

  for (const post of index.posts) {
    let score = 0;

    // Chemical overlap
    const sharedChemicals = topicChemicals.filter((c) =>
      post.chemicals.some((pc) => pc.toLowerCase() === c.toLowerCase())
    );
    score += sharedChemicals.length * 3;

    // Title similarity (but not too similar - we want related, not duplicate)
    const similarity = calculateSimilarity(normalizedTopic, normalizeText(post.title));
    if (similarity > 0.3 && similarity < 0.7) {
      score += similarity * 2;
    }

    // Keyword relevance
    const topicWords = normalizedTopic.split(' ');
    for (const word of topicWords) {
      if (word.length > 3 && post.title.toLowerCase().includes(word)) {
        score += 1;
      }
    }

    if (score > 0) {
      scored.push({ post, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.post);
}

// ============================================================================
// TEXT UTILITIES
// ============================================================================

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract likely primary keyword from a topic title
 */
function extractPrimaryKeyword(topic: string): string {
  // Remove common article prefixes
  let keyword = topic
    .toLowerCase()
    .replace(/^(how to|what is|guide to|complete guide|the|a|an)\s+/i, '')
    .replace(/\s+(guide|tutorial|explained|overview|for beginners)$/i, '');

  // If it's a comparison, extract the items
  if (keyword.includes(' vs ') || keyword.includes(' versus ')) {
    const parts = keyword.split(/\s+vs\.?\s+|\s+versus\s+/);
    keyword = parts.join(' vs ');
  }

  return keyword.trim();
}

/**
 * Check if two topics have similar angles
 */
function hasSimilarAngle(topic1: string, topic2: string): boolean {
  const t1 = topic1.toLowerCase();
  const t2 = topic2.toLowerCase();

  // Both are how-to guides
  if ((t1.includes('how to') || t1.includes('guide')) &&
      (t2.includes('how to') || t2.includes('guide'))) {
    return true;
  }

  // Both are comparisons
  if ((t1.includes(' vs ') || t1.includes('compare')) &&
      (t2.includes(' vs ') || t2.includes('compare'))) {
    return true;
  }

  // Both are safety-focused
  if ((t1.includes('safe') || t1.includes('danger') || t1.includes('hazard')) &&
      (t2.includes('safe') || t2.includes('danger') || t2.includes('hazard'))) {
    return true;
  }

  // Both are FAQ-style
  if ((t1.includes('faq') || t1.includes('questions')) &&
      (t2.includes('faq') || t2.includes('questions'))) {
    return true;
  }

  return false;
}

/**
 * Calculate similarity between two strings (Jaccard similarity on words)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(' ').filter((w) => w.length > 2));
  const words2 = new Set(text2.split(' ').filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// ============================================================================
// CACHE/INDEX PERSISTENCE (optional - for CLI use)
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

const INDEX_CACHE_PATH = './data/content-index.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save content index to file cache
 */
export function saveContentIndex(index: ContentIndex, cachePath?: string): void {
  const filePath = cachePath || INDEX_CACHE_PATH;
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const serializable = {
    posts: index.posts,
    keywords: Array.from(index.keywords),
    chemicals: Array.from(index.chemicals),
    titles: Array.from(index.titles),
    slugs: Array.from(index.slugs),
    lastUpdated: index.lastUpdated.toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(serializable, null, 2));
}

/**
 * Load content index from file cache
 */
export function loadContentIndex(cachePath?: string): ContentIndex | null {
  const filePath = cachePath || INDEX_CACHE_PATH;

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const lastUpdated = new Date(parsed.lastUpdated);

    // Check if cache is stale
    if (Date.now() - lastUpdated.getTime() > CACHE_TTL_MS) {
      return null;
    }

    return {
      posts: parsed.posts,
      keywords: new Set(parsed.keywords),
      chemicals: new Set(parsed.chemicals),
      titles: new Set(parsed.titles),
      slugs: new Set(parsed.slugs),
      lastUpdated,
    };
  } catch {
    return null;
  }
}

/**
 * Get or build content index (with caching)
 */
export async function getContentIndex(forceRefresh?: boolean): Promise<ContentIndex> {
  if (!forceRefresh) {
    const cached = loadContentIndex();
    if (cached) {
      return cached;
    }
  }

  const posts = await fetchExistingPosts();
  const index = buildContentIndex(posts);
  saveContentIndex(index);

  return index;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get statistics about existing content
 */
export function getContentStats(index: ContentIndex): {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalKeywords: number;
  totalChemicals: number;
  chemicalCoverage: string[];
  recentPosts: ExistingPost[];
} {
  const publishedPosts = index.posts.filter((p) => p.status === 'published');
  const draftPosts = index.posts.filter((p) => p.status === 'draft');
  const recentPosts = [...index.posts]
    .filter((p) => p.publishedAt)
    .sort((a, b) => {
      const dateA = a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt!);
      const dateB = b.publishedAt instanceof Date ? b.publishedAt : new Date(b.publishedAt!);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  return {
    totalPosts: index.posts.length,
    publishedPosts: publishedPosts.length,
    draftPosts: draftPosts.length,
    totalKeywords: index.keywords.size,
    totalChemicals: index.chemicals.size,
    chemicalCoverage: Array.from(index.chemicals).sort(),
    recentPosts,
  };
}
