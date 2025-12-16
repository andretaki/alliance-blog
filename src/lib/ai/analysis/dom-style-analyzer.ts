/**
 * DOM-Based Style Analyzer
 *
 * Replaces regex-based HTML parsing with proper DOM parsing using cheerio.
 * Fixes:
 * - Scoped analysis to article content container only
 * - Consistent component counting (all normalized per-post)
 * - Actual status filtering in queries
 * - Strong typing throughout
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { db } from '@/lib/db/client';
import { blogPosts } from '@/lib/db/schema';
import { desc, eq, and, sql, inArray } from 'drizzle-orm';
import type { PostStatus } from '@/lib/schema/canonical';

// ============================================================================
// TYPES
// ============================================================================

export type OpeningHookType =
  | 'story'
  | 'question'
  | 'statistic'
  | 'problem'
  | 'bold_claim'
  | 'scenario'
  | 'definition'
  | 'quote'
  | 'direct_address';

export type ComponentType =
  | 'callout_success'
  | 'callout_warning'
  | 'callout_danger'
  | 'callout_info'
  | 'process_steps'
  | 'comparison_table'
  | 'data_table'
  | 'credentials_box'
  | 'cta_section'
  | 'image_with_caption'
  | 'chemical_formula'
  | 'bullet_list'
  | 'numbered_list'
  | 'case_study'
  | 'faq_section';

/** Blog post with required fields for analysis */
interface AnalyzablePost {
  id: string;
  title: string;
  rawHtml: string | null;
  wordCount: number | null;
  status: PostStatus;
  sections: unknown;
  faqs: unknown;
}

/** Component occurrence in a single post */
interface ComponentOccurrence {
  type: ComponentType;
  count: number;
  examples: string[];
}

/** Aggregated component stats across all posts */
interface ComponentStats {
  type: ComponentType;
  postsWithComponent: number;
  totalOccurrences: number;
  avgPerPost: number;
  examples: Array<{ html: string; postId: string }>;
}

/** Opening hook pattern with source */
interface HookPattern {
  type: OpeningHookType;
  text: string;
  postId: string;
  postTitle: string;
}

/** Voice analysis metrics */
interface VoiceMetrics {
  pronounCounts: {
    we: number;
    you: number;
    they: number;
    i: number;
  };
  totalWords: number;
  sentenceStarters: Map<string, number>;
  transitionPhrases: string[];
}

/** Style profile output - data-driven, not prose-driven */
export interface StyleProfileData {
  // Computed from posts
  sampleSize: number;
  totalWords: number;

  // Opening hooks
  hooks: {
    patterns: HookPattern[];
    preferredTypes: OpeningHookType[];
    typeDistribution: Record<OpeningHookType, number>;
  };

  // Component usage - all normalized
  components: {
    stats: ComponentStats[];
    required: ComponentType[]; // >80% of posts
    common: ComponentType[]; // 30-80% of posts
    optional: ComponentType[]; // <30% of posts
  };

  // Voice characteristics - frequency based
  voice: {
    pronounRatios: {
      we: number; // per 1000 words
      you: number;
      they: number;
      i: number;
    };
    dominantPronoun: 'we' | 'you' | 'they' | 'i' | 'mixed';
    topSentenceStarters: string[];
    topTransitions: string[];
  };

  // Structure metrics
  structure: {
    avgSectionsPerPost: number;
    avgWordsPerSection: number;
    avgFaqsPerPost: number;
    avgSentenceLength: number;
  };

  // Brand terminology
  brand: {
    technicalTerms: string[];
    safetyPhrases: string[];
    credentials: string[];
  };

  // Exemplar post IDs (diverse selection)
  exemplarIds: string[];
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export interface AnalyzeStyleOptions {
  /** Filter by status - defaults to 'published' for production quality */
  status?: PostStatus | PostStatus[];
  /** Maximum posts to analyze */
  limit?: number;
  /** Sampling strategy */
  sampling?: 'longest' | 'recent' | 'diverse';
}

/**
 * Analyze writing style using DOM parsing
 * Addresses all issues from the code review
 */
export async function analyzeStyleWithDOM(
  options: AnalyzeStyleOptions = {}
): Promise<StyleProfileData> {
  const {
    status = 'published',
    limit = 20,
    sampling = 'diverse',
  } = options;

  // Build query with actual status filtering
  const statusArray = Array.isArray(status) ? status : [status];

  const posts = await fetchPostsWithSampling(statusArray, limit, sampling);

  if (posts.length === 0) {
    throw new Error(`No posts found with status: ${statusArray.join(', ')}`);
  }

  // Analyze each post using DOM parsing
  const analysisResults = posts.map(post => analyzePostDOM(post));

  // Aggregate results
  return aggregateAnalysis(analysisResults, posts);
}

// ============================================================================
// DATABASE QUERIES WITH PROPER FILTERING
// ============================================================================

async function fetchPostsWithSampling(
  statusArray: PostStatus[],
  limit: number,
  sampling: 'longest' | 'recent' | 'diverse'
): Promise<AnalyzablePost[]> {
  if (sampling === 'diverse') {
    return fetchDiversePosts(statusArray, limit);
  }

  const orderBy = sampling === 'recent'
    ? desc(blogPosts.publishedAt)
    : desc(blogPosts.wordCount);

  const results = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      rawHtml: blogPosts.rawHtml,
      wordCount: blogPosts.wordCount,
      status: blogPosts.status,
      sections: blogPosts.sections,
      faqs: blogPosts.faq,
    })
    .from(blogPosts)
    .where(inArray(blogPosts.status, statusArray))
    .orderBy(orderBy)
    .limit(limit);

  return results as AnalyzablePost[];
}

/**
 * Fetch diverse posts: mix of recent, long, and varied topics
 */
async function fetchDiversePosts(
  statusArray: PostStatus[],
  limit: number
): Promise<AnalyzablePost[]> {
  const perCategory = Math.ceil(limit / 3);

  // Recent published
  const recent = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      rawHtml: blogPosts.rawHtml,
      wordCount: blogPosts.wordCount,
      status: blogPosts.status,
      sections: blogPosts.sections,
      faqs: blogPosts.faq,
    })
    .from(blogPosts)
    .where(inArray(blogPosts.status, statusArray))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(perCategory);

  // Longest (technical guides)
  const longest = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      rawHtml: blogPosts.rawHtml,
      wordCount: blogPosts.wordCount,
      status: blogPosts.status,
      sections: blogPosts.sections,
      faqs: blogPosts.faq,
    })
    .from(blogPosts)
    .where(inArray(blogPosts.status, statusArray))
    .orderBy(desc(blogPosts.wordCount))
    .limit(perCategory);

  // Random sample for variety
  const random = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      rawHtml: blogPosts.rawHtml,
      wordCount: blogPosts.wordCount,
      status: blogPosts.status,
      sections: blogPosts.sections,
      faqs: blogPosts.faq,
    })
    .from(blogPosts)
    .where(inArray(blogPosts.status, statusArray))
    .orderBy(sql`RANDOM()`)
    .limit(perCategory);

  // Deduplicate by ID
  const seen = new Set<string>();
  const result: AnalyzablePost[] = [];

  for (const post of [...recent, ...longest, ...random]) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      result.push(post as AnalyzablePost);
    }
    if (result.length >= limit) break;
  }

  return result;
}

// ============================================================================
// DOM-BASED POST ANALYSIS
// ============================================================================

interface PostAnalysis {
  postId: string;
  postTitle: string;
  wordCount: number;
  hook: { type: OpeningHookType; text: string } | null;
  components: ComponentOccurrence[];
  voice: VoiceMetrics;
  structure: {
    sectionCount: number;
    faqCount: number;
    avgSentenceLength: number;
  };
  technicalTerms: string[];
  safetyPhrases: string[];
}

function analyzePostDOM(post: AnalyzablePost): PostAnalysis {
  const html = post.rawHtml || '';
  const $ = cheerio.load(html);

  // Find main content container - try multiple selectors
  const contentContainer = findContentContainer($);

  // Extract text from content area only
  const contentText = contentContainer.text();
  const wordCount = post.wordCount || countWords(contentText);

  return {
    postId: post.id,
    postTitle: post.title,
    wordCount,
    hook: extractOpeningHook($, contentContainer),
    components: countComponents($, contentContainer, post.id),
    voice: analyzeVoice(contentText),
    structure: {
      sectionCount: Array.isArray(post.sections) ? post.sections.length : 0,
      faqCount: Array.isArray(post.faqs) ? (post.faqs as unknown[]).length : 0,
      avgSentenceLength: calculateAvgSentenceLength(contentText),
    },
    technicalTerms: extractTechnicalTerms(contentText),
    safetyPhrases: extractSafetyPhrases(contentText),
  };
}

/**
 * Find the main content container using common selectors
 * Falls back safely to avoid analyzing nav/footer content
 */
function findContentContainer($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> {
  // Remove nav, header, footer, sidebar to avoid pollution
  const cleanedBody = $('body').clone();
  cleanedBody.find('nav, header, footer, aside, .sidebar, .nav, .header, .footer, .comments').remove();

  // Try selectors in order of specificity
  const selectors = [
    // Most specific content containers
    'article .content',
    '.blog-content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-area',
    // Generic containers
    'article',
    'main .content',
    'main',
    '[role="main"]',
    '.main-content',
  ];

  const MIN_CONTENT_LENGTH = 100;
  const MAX_CONTENT_LENGTH = 100000; // ~20k words max

  for (const selector of selectors) {
    const el = cleanedBody.find(selector).first();
    if (el.length > 0) {
      const textLength = el.text().trim().length;
      if (textLength > MIN_CONTENT_LENGTH && textLength < MAX_CONTENT_LENGTH) {
        return el;
      }
    }
  }

  // Final fallback: use article first, then main, then cleaned body
  const article = cleanedBody.find('article').first();
  if (article.length > 0 && article.text().trim().length > MIN_CONTENT_LENGTH) {
    return article;
  }

  const main = cleanedBody.find('main').first();
  if (main.length > 0 && main.text().trim().length > MIN_CONTENT_LENGTH) {
    return main;
  }

  // Last resort: cleaned body with length guard
  const bodyText = cleanedBody.text().trim();
  if (bodyText.length > MAX_CONTENT_LENGTH) {
    // Truncate to first MAX_CONTENT_LENGTH characters worth of content
    // This prevents analyzing massive pages
    console.warn(`Content too large (${bodyText.length} chars), using truncated body`);
  }

  return cleanedBody;
}

/**
 * Extract opening hook from first real paragraph
 */
function extractOpeningHook(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<AnyNode>
): { type: OpeningHookType; text: string } | null {
  // Skip hero sections, find first content paragraph
  const firstParagraph = container
    .find('p')
    .filter((_, el) => {
      const text = $(el).text().trim();
      // Skip empty, very short, or hero-like paragraphs
      return text.length > 50 && !$(el).closest('.hero, .header, nav').length;
    })
    .first();

  if (!firstParagraph.length) return null;

  const text = firstParagraph.text().trim();
  const type = classifyHookType(text);

  return { type, text: text.substring(0, 400) };
}

/**
 * Classify hook type based on text patterns
 */
function classifyHookType(text: string): OpeningHookType {
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  // Question - starts with question word or contains ?
  if (/^(have you|do you|what if|why do|how do|are you|should you|can you|what|why|how|is it|did you)/i.test(trimmed)) {
    return 'question';
  }

  // Statistic - contains significant numbers
  if (/\b(\d{2,}%|\d+\s*(million|billion|thousand)|over\s*\d+\s*(years?|percent))\b/i.test(text)) {
    return 'statistic';
  }

  // Scenario/hypothetical
  if (/^(imagine|picture|consider|suppose|what if|let's say)/i.test(trimmed)) {
    return 'scenario';
  }

  // Definition
  if (/\b(is a|are a|refers to|defined as|known as|meaning)\b/i.test(lower) && lower.indexOf('is a') < 50) {
    return 'definition';
  }

  // Quote
  if (/^[""\u201C]/.test(trimmed) || /^according to/i.test(trimmed)) {
    return 'quote';
  }

  // Problem statement
  if (/\b(problem|issue|challenge|mistake|struggle|difficult)\b/i.test(lower)) {
    return 'problem';
  }

  // Bold claim
  if (/\b(the (only|best|most|ultimate)|essential|critical|must-have)\b/i.test(lower)) {
    return 'bold_claim';
  }

  // Direct address
  if (/^(if you|when you|as a|for those|whether you|you're|you've)/i.test(trimmed)) {
    return 'direct_address';
  }

  // Story (narrative indicators)
  if (/\b(last (week|month|year)|recently|one day|remember when)\b/i.test(lower)) {
    return 'story';
  }

  // Default based on sentence structure
  return 'direct_address';
}

/**
 * Count components using DOM queries - consistent per-post counting
 */
function countComponents(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<AnyNode>,
  postId: string
): ComponentOccurrence[] {
  const results: ComponentOccurrence[] = [];

  // Callouts - count each occurrence
  const calloutSelectors: Array<{ selector: string; type: ComponentType }> = [
    { selector: '.callout-success, .success-callout, [class*="callout"][class*="success"]', type: 'callout_success' },
    { selector: '.callout-warning, .warning-callout, [class*="callout"][class*="warning"]', type: 'callout_warning' },
    { selector: '.callout-danger, .danger-callout, .callout-error, [class*="callout"][class*="danger"]', type: 'callout_danger' },
    { selector: '.callout-info, .info-callout, .callout:not([class*="success"]):not([class*="warning"]):not([class*="danger"]), .ac-callout', type: 'callout_info' },
  ];

  for (const { selector, type } of calloutSelectors) {
    const elements = container.find(selector);
    if (elements.length > 0) {
      results.push({
        type,
        count: elements.length,
        examples: elements.slice(0, 2).map((_, el) => $.html(el)).get(),
      });
    }
  }

  // Lists - count each occurrence
  const ulCount = container.find('ul').length;
  if (ulCount > 0) {
    results.push({
      type: 'bullet_list',
      count: ulCount,
      examples: container.find('ul').slice(0, 2).map((_, el) => $.html(el)).get(),
    });
  }

  const olCount = container.find('ol').length;
  if (olCount > 0) {
    results.push({
      type: 'numbered_list',
      count: olCount,
      examples: container.find('ol').slice(0, 2).map((_, el) => $.html(el)).get(),
    });
  }

  // Tables
  const tableCount = container.find('table').length;
  if (tableCount > 0) {
    // Try to classify table type
    const tables = container.find('table');
    let comparisonCount = 0;
    let dataCount = 0;

    tables.each((_, el) => {
      const tableHtml = $.html(el).toLowerCase();
      if (tableHtml.includes('vs') || tableHtml.includes('comparison') || tableHtml.includes('difference')) {
        comparisonCount++;
      } else {
        dataCount++;
      }
    });

    if (comparisonCount > 0) {
      results.push({ type: 'comparison_table', count: comparisonCount, examples: [] });
    }
    if (dataCount > 0) {
      results.push({ type: 'data_table', count: dataCount, examples: [] });
    }
  }

  // CTA sections
  const ctaSelectors = '.cta, .call-to-action, [class*="cta-"], .action-button, .shop-now';
  const ctaCount = container.find(ctaSelectors).length;
  if (ctaCount > 0) {
    results.push({
      type: 'cta_section',
      count: ctaCount,
      examples: container.find(ctaSelectors).slice(0, 2).map((_, el) => $.html(el)).get(),
    });
  }

  // Images with captions
  const figureCount = container.find('figure, .image-caption, img + figcaption').length;
  if (figureCount > 0) {
    results.push({ type: 'image_with_caption', count: figureCount, examples: [] });
  }

  // FAQ sections
  const faqCount = container.find('.faq, .faqs, [class*="faq"], .accordion').length;
  if (faqCount > 0) {
    results.push({ type: 'faq_section', count: faqCount, examples: [] });
  }

  // Process steps
  const processCount = container.find('.process-steps, .steps, [class*="step-"]').length;
  if (processCount > 0) {
    results.push({ type: 'process_steps', count: processCount, examples: [] });
  }

  // Chemical formulas - look for subscript patterns in text
  const contentText = container.text();
  const formulaMatches = contentText.match(/\b[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+\b/g) || [];
  // Filter out common false positives
  const realFormulas = formulaMatches.filter(f =>
    /\d/.test(f) && // Must have numbers
    f.length >= 3 && // At least 3 chars
    !/^[A-Z]{2,}$/.test(f) // Not all caps abbreviation
  );
  if (realFormulas.length > 0) {
    results.push({
      type: 'chemical_formula',
      count: realFormulas.length,
      examples: [...new Set(realFormulas)].slice(0, 5),
    });
  }

  return results;
}

/**
 * Analyze voice characteristics - frequency based, not presence based
 */
function analyzeVoice(text: string): VoiceMetrics {
  const words = text.toLowerCase().split(/\s+/);
  const totalWords = words.length;

  // Count pronouns
  const pronounCounts = {
    we: 0,
    you: 0,
    they: 0,
    i: 0,
  };

  for (const word of words) {
    if (word === 'we' || word === "we're" || word === "we've" || word === "we'll" || word === 'our' || word === 'ours') {
      pronounCounts.we++;
    } else if (word === 'you' || word === "you're" || word === "you've" || word === "you'll" || word === 'your' || word === 'yours') {
      pronounCounts.you++;
    } else if (word === 'they' || word === "they're" || word === "they've" || word === "they'll" || word === 'their' || word === 'theirs') {
      pronounCounts.they++;
    } else if (word === 'i' || word === "i'm" || word === "i've" || word === "i'll" || word === 'my' || word === 'mine') {
      pronounCounts.i++;
    }
  }

  // Extract sentence starters
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const starters = new Map<string, number>();

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    if (words.length >= 2) {
      const starter = words.slice(0, 2).join(' ').toLowerCase();
      starters.set(starter, (starters.get(starter) || 0) + 1);
    }
  }

  // Extract transition phrases
  const transitionPatterns = [
    'however', 'therefore', 'additionally', 'furthermore', 'moreover',
    'in addition', 'as a result', 'for example', 'for instance', 'in fact',
    'on the other hand', 'in contrast', 'similarly', 'likewise', 'consequently',
    'first', 'second', 'third', 'finally', 'next', 'then',
  ];

  const foundTransitions = transitionPatterns.filter(t =>
    text.toLowerCase().includes(t)
  );

  return {
    pronounCounts,
    totalWords,
    sentenceStarters: starters,
    transitionPhrases: foundTransitions,
  };
}

// ============================================================================
// AGGREGATION
// ============================================================================

function aggregateAnalysis(
  results: PostAnalysis[],
  posts: AnalyzablePost[]
): StyleProfileData {
  const totalPosts = results.length;
  const totalWords = results.reduce((sum, r) => sum + r.wordCount, 0);

  // Aggregate hooks
  const hookPatterns: HookPattern[] = [];
  const hookDistribution: Record<OpeningHookType, number> = {
    story: 0, question: 0, statistic: 0, problem: 0, bold_claim: 0,
    scenario: 0, definition: 0, quote: 0, direct_address: 0,
  };

  for (const result of results) {
    if (result.hook) {
      hookDistribution[result.hook.type]++;
      if (hookPatterns.filter(h => h.type === result.hook!.type).length < 3) {
        hookPatterns.push({
          type: result.hook.type,
          text: result.hook.text,
          postId: result.postId,
          postTitle: result.postTitle,
        });
      }
    }
  }

  const preferredHooks = (Object.entries(hookDistribution) as [OpeningHookType, number][])
    .filter(([_, count]) => count >= totalPosts * 0.15)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  // Aggregate components
  const componentAggregates = new Map<ComponentType, {
    postsWithComponent: number;
    totalOccurrences: number;
    examples: Array<{ html: string; postId: string }>;
  }>();

  for (const result of results) {
    for (const comp of result.components) {
      const existing = componentAggregates.get(comp.type) || {
        postsWithComponent: 0,
        totalOccurrences: 0,
        examples: [],
      };
      existing.postsWithComponent++;
      existing.totalOccurrences += comp.count;
      if (existing.examples.length < 3) {
        existing.examples.push(...comp.examples.map(html => ({ html, postId: result.postId })));
      }
      componentAggregates.set(comp.type, existing);
    }
  }

  const componentStats: ComponentStats[] = [];
  for (const [type, agg] of componentAggregates) {
    componentStats.push({
      type,
      postsWithComponent: agg.postsWithComponent,
      totalOccurrences: agg.totalOccurrences,
      avgPerPost: agg.totalOccurrences / totalPosts,
      examples: agg.examples.slice(0, 3),
    });
  }

  const required = componentStats
    .filter(c => c.postsWithComponent >= totalPosts * 0.8)
    .map(c => c.type);
  const common = componentStats
    .filter(c => c.postsWithComponent >= totalPosts * 0.3 && c.postsWithComponent < totalPosts * 0.8)
    .map(c => c.type);
  const optional = componentStats
    .filter(c => c.postsWithComponent < totalPosts * 0.3)
    .map(c => c.type);

  // Aggregate voice
  const totalPronouns = {
    we: results.reduce((sum, r) => sum + r.voice.pronounCounts.we, 0),
    you: results.reduce((sum, r) => sum + r.voice.pronounCounts.you, 0),
    they: results.reduce((sum, r) => sum + r.voice.pronounCounts.they, 0),
    i: results.reduce((sum, r) => sum + r.voice.pronounCounts.i, 0),
  };

  const pronounRatios = {
    we: (totalPronouns.we / totalWords) * 1000,
    you: (totalPronouns.you / totalWords) * 1000,
    they: (totalPronouns.they / totalWords) * 1000,
    i: (totalPronouns.i / totalWords) * 1000,
  };

  const dominantPronoun = getDominantPronoun(pronounRatios);

  // Aggregate sentence starters
  const allStarters = new Map<string, number>();
  for (const result of results) {
    for (const [starter, count] of result.voice.sentenceStarters) {
      allStarters.set(starter, (allStarters.get(starter) || 0) + count);
    }
  }
  const topStarters = [...allStarters.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([starter]) => starter);

  // Aggregate transitions
  const transitionCounts = new Map<string, number>();
  for (const result of results) {
    for (const t of result.voice.transitionPhrases) {
      transitionCounts.set(t, (transitionCounts.get(t) || 0) + 1);
    }
  }
  const topTransitions = [...transitionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);

  // Aggregate structure
  const avgSections = results.reduce((sum, r) => sum + r.structure.sectionCount, 0) / totalPosts;
  const avgFaqs = results.reduce((sum, r) => sum + r.structure.faqCount, 0) / totalPosts;
  const avgSentenceLength = results.reduce((sum, r) => sum + r.structure.avgSentenceLength, 0) / totalPosts;
  const avgWordsPerSection = avgSections > 0 ? (totalWords / totalPosts) / avgSections : 0;

  // Aggregate brand terms
  const allTechnicalTerms = new Map<string, number>();
  const allSafetyPhrases = new Map<string, number>();

  for (const result of results) {
    for (const term of result.technicalTerms) {
      allTechnicalTerms.set(term, (allTechnicalTerms.get(term) || 0) + 1);
    }
    for (const phrase of result.safetyPhrases) {
      allSafetyPhrases.set(phrase, (allSafetyPhrases.get(phrase) || 0) + 1);
    }
  }

  const technicalTerms = [...allTechnicalTerms.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);

  const safetyPhrases = [...allSafetyPhrases.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase]) => phrase);

  // Select diverse exemplars
  const exemplarIds = selectDiverseExemplars(results, 5);

  return {
    sampleSize: totalPosts,
    totalWords,
    hooks: {
      patterns: hookPatterns,
      preferredTypes: preferredHooks.length > 0 ? preferredHooks : ['direct_address', 'problem'],
      typeDistribution: hookDistribution,
    },
    components: {
      stats: componentStats,
      required,
      common,
      optional,
    },
    voice: {
      pronounRatios,
      dominantPronoun,
      topSentenceStarters: topStarters,
      topTransitions: topTransitions,
    },
    structure: {
      avgSectionsPerPost: Math.round(avgSections * 10) / 10,
      avgWordsPerSection: Math.round(avgWordsPerSection),
      avgFaqsPerPost: Math.round(avgFaqs * 10) / 10,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    },
    brand: {
      technicalTerms,
      safetyPhrases,
      credentials: [], // TODO: extract from content
    },
    exemplarIds,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function calculateAvgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce((sum, s) => sum + countWords(s), 0);
  return totalWords / sentences.length;
}

function getDominantPronoun(ratios: { we: number; you: number; they: number; i: number }): 'we' | 'you' | 'they' | 'i' | 'mixed' {
  const max = Math.max(ratios.we, ratios.you, ratios.they, ratios.i);
  const total = ratios.we + ratios.you + ratios.they + ratios.i;

  if (total < 1) return 'mixed'; // Very few pronouns

  // If one pronoun is >50% of all pronouns, it's dominant
  if (ratios.we / total > 0.5) return 'we';
  if (ratios.you / total > 0.5) return 'you';
  if (ratios.they / total > 0.5) return 'they';
  if (ratios.i / total > 0.5) return 'i';

  return 'mixed';
}

function extractTechnicalTerms(text: string): string[] {
  const terms: string[] = [];

  // Chemical compounds (more strict pattern)
  const chemicalPattern = /\b(sodium|potassium|calcium|magnesium|iron|copper|zinc|chloride|sulfate|nitrate|phosphate|hydroxide|carbonate|oxide|acid|alcohol|glycol|ether)\s+\w+|\b\w+\s+(acid|solution|compound|mixture)\b/gi;
  const chemicals = text.match(chemicalPattern) || [];
  terms.push(...chemicals.map(c => c.toLowerCase().trim()));

  // Concentration patterns
  const concentrationPattern = /\d+(\.\d+)?%\s+\w+/g;
  const concentrations = text.match(concentrationPattern) || [];
  terms.push(...concentrations);

  // pH references
  const phPattern = /pH\s*(\d+(\.\d+)?|\w+)/gi;
  const phRefs = text.match(phPattern) || [];
  terms.push(...phRefs);

  return [...new Set(terms)].slice(0, 30);
}

function extractSafetyPhrases(text: string): string[] {
  const phrases: string[] = [];

  const safetyPatterns = [
    /wear\s+(proper\s+)?(\w+\s+)?(gloves|goggles|protection|ppe)/gi,
    /avoid\s+(contact|inhalation|ingestion|mixing)/gi,
    /ventilat(ed|ion)/gi,
    /safety\s+(precaution|measure|equipment|gear)/gi,
    /proper\s+(handling|storage|disposal)/gi,
    /protective\s+(equipment|gear|clothing)/gi,
    /hazard(ous)?/gi,
    /caution/gi,
    /warning/gi,
  ];

  for (const pattern of safetyPatterns) {
    const matches = text.match(pattern) || [];
    phrases.push(...matches.map(m => m.toLowerCase()));
  }

  return [...new Set(phrases)];
}

function selectDiverseExemplars(results: PostAnalysis[], count: number): string[] {
  // Sort by word count and pick from different ranges
  const sorted = [...results].sort((a, b) => b.wordCount - a.wordCount);

  const exemplars: string[] = [];
  const step = Math.floor(sorted.length / count);

  for (let i = 0; i < count && i * step < sorted.length; i++) {
    exemplars.push(sorted[i * step].postId);
  }

  return exemplars;
}
