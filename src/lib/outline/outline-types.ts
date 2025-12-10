/**
 * Outline Types
 *
 * TypeScript types for content outlines that feed into the article generator.
 */

import type { ShopifyContentType, CalloutType } from '@/lib/shopify/content-types';
import type { ContentAngle, SearchIntent } from '@/lib/discovery/topic-finder';

// ============================================================================
// CONTENT OUTLINE INTERFACES
// ============================================================================

/**
 * Complete content outline for article generation
 */
export interface ContentOutline {
  meta: OutlineMeta;
  openingHook: OpeningHook;
  heroAnswer: HeroAnswer;
  sections: OutlineSection[];
  faqSection: FAQSection;
  ctaSection: CTASection;
}

/**
 * Outline metadata
 */
export interface OutlineMeta {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  contentType: ShopifyContentType;
  searchIntent: SearchIntent;
  targetWordCount: number;
  eeatHooks: string[]; // Specific experience/expertise to demonstrate
}

/**
 * Opening hook configuration
 */
export interface OpeningHook {
  type: 'story' | 'problem' | 'statistic' | 'question';
  description: string; // What the hook should convey
}

/**
 * Hero answer configuration (for featured snippets)
 */
export interface HeroAnswer {
  targetLength: '2-3 sentences';
  keyPoints: string[]; // What must be in the direct answer
}

/**
 * Section component types
 */
export type SectionComponent =
  | 'table'
  | 'steps'
  | 'callout_warning'
  | 'callout_info'
  | 'callout_danger'
  | 'callout_success'
  | 'comparison_table'
  | 'checklist'
  | 'pros_cons';

/**
 * Individual section in the outline
 */
export interface OutlineSection {
  heading: string;
  headingLevel: 'h2' | 'h3';
  keyPoints: string[];
  eeatElement?: string; // What experience/expertise to show here
  internalLink?: string; // Related blog post or product URL
  component?: SectionComponent; // Special component to include
  imageOpportunity?: string; // Description of helpful image
  estimatedWords: number;
}

/**
 * FAQ item in outline
 */
export interface FAQOutlineItem {
  question: string;
  keyPointsForAnswer: string[];
  source?: 'people_also_ask' | 'customer_question' | 'common_search' | 'industry_specific';
}

/**
 * FAQ section configuration
 */
export interface FAQSection {
  questions: FAQOutlineItem[];
}

/**
 * CTA section configuration
 */
export interface CTASection {
  primaryProduct: string; // Product/collection name
  primaryProductUrl?: string; // URL to product/collection
  valueProposition: string; // Why choose Alliance Chemical
  secondaryCTA?: string; // Additional CTA text
}

// ============================================================================
// OUTLINE CONTEXT FOR GENERATION
// ============================================================================

/**
 * Context for generating a section outline
 */
export interface OutlineContext {
  topic: string;
  primaryKeyword: string;
  contentType: ShopifyContentType;
  searchIntent: SearchIntent;
  targetAudience?: string;
  previousSections?: string[]; // Previous section headings for flow
  relevantProducts?: string[]; // Product handles
}

// ============================================================================
// OUTLINE FILE FORMAT
// ============================================================================

/**
 * Format for saving/loading outline files
 */
export interface OutlineFile {
  version: '1.0';
  generatedAt: string;
  outline: ContentOutline;
  sourceTopic?: {
    suggestion: {
      topic: string;
      primaryKeyword: string;
      angle: ContentAngle;
      searchIntent: SearchIntent;
      uniqueAngle: string;
    };
    score?: number;
    ranking?: number;
  };
}

// ============================================================================
// BLOG POST REFERENCE (for internal linking)
// ============================================================================

/**
 * Simplified blog post reference for internal linking
 */
export interface BlogPostReference {
  slug: string;
  title: string;
  url: string;
  primaryKeyword?: string;
  contentType?: ShopifyContentType;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Outline generation options
 */
export interface OutlineGenerationOptions {
  /** Target word count for the full article */
  targetWordCount?: number;
  /** Number of FAQs to include */
  faqCount?: number;
  /** Focus industry for context */
  industryFocus?: string;
  /** Existing posts for internal linking */
  existingPosts?: BlogPostReference[];
  /** Specific E-E-A-T elements to highlight */
  eeatFocus?: ('experience' | 'expertise' | 'authority' | 'trust')[];
  /** Include safety section if applicable */
  includeSafety?: boolean;
}

/**
 * Outline validation result
 */
export interface OutlineValidation {
  valid: boolean;
  issues: string[];
  warnings: string[];
  stats: {
    totalSections: number;
    totalFaqs: number;
    estimatedWordCount: number;
    hasEeatElements: boolean;
    hasInternalLinks: boolean;
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid ContentOutline
 */
export function isContentOutline(value: unknown): value is ContentOutline {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.meta === 'object' &&
    typeof obj.openingHook === 'object' &&
    typeof obj.heroAnswer === 'object' &&
    Array.isArray(obj.sections) &&
    typeof obj.faqSection === 'object' &&
    typeof obj.ctaSection === 'object'
  );
}

/**
 * Check if a value is a valid OutlineFile
 */
export function isOutlineFile(value: unknown): value is OutlineFile {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj.version === '1.0' && typeof obj.generatedAt === 'string' && isContentOutline(obj.outline);
}
