/**
 * Intermediate Representation Types
 *
 * These types define the structure for parsed content before normalization
 * to the canonical blog schema.
 */

/**
 * A heading extracted from HTML
 */
export interface ExtractedHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string | null;
}

/**
 * A paragraph extracted from HTML
 */
export interface ExtractedParagraph {
  text: string;
  html: string;
  parentHeadingIndex: number | null;
}

/**
 * A list extracted from HTML
 */
export interface ExtractedList {
  type: 'ul' | 'ol';
  items: string[];
  parentHeadingIndex: number | null;
}

/**
 * A table extracted from HTML
 */
export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  parentHeadingIndex: number | null;
}

/**
 * A link extracted from HTML
 */
export interface ExtractedLink {
  href: string;
  text: string;
  isInternal: boolean;
}

/**
 * An image extracted from HTML
 */
export interface ExtractedImage {
  src: string;
  alt: string | null;
  caption: string | null;
}

/**
 * Shopify-specific article data
 */
export interface ShopifyArticleData {
  articleId: string;
  blogId: string;
  blogHandle: string;
  author: string | null;
  tags: string[];
  publishedAt: string | null;
  handle: string;
  image: {
    url: string;
    altText: string | null;
  } | null;
}

/**
 * Intermediate representation of a blog post
 *
 * This is the normalized structure after parsing HTML
 * but before mapping to the canonical schema.
 */
export interface IntermediatePost {
  // Source identification
  sourceUrl: string;
  sourceType: 'shopify' | 'sitemap' | 'manual';
  fetchedAt: string;

  // Raw content
  rawHtml: string;

  // Extracted metadata
  title: string | null;
  h1: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;

  // Structured content
  headings: ExtractedHeading[];
  paragraphs: ExtractedParagraph[];
  lists: ExtractedList[];
  tables: ExtractedTable[];
  links: ExtractedLink[];
  images: ExtractedImage[];

  // Existing structured data
  jsonLd: object[];

  // Shopify-specific (if applicable)
  shopify?: ShopifyArticleData;
}

/**
 * Validation flags from the normalization process
 */
export interface NormalizationFlags {
  missingTitle: boolean;
  missingMetaDescription: boolean;
  missingAuthor: boolean;
  missingHeroAnswer: boolean;
  fewSections: boolean;
  noFaq: boolean;
  fewInternalLinks: boolean;
  noExperienceEvidence: boolean;
  needsReview: string[];
}

/**
 * Confidence scores for normalized fields
 */
export interface NormalizationConfidence {
  title: number;
  summary: number;
  heroAnswer: number;
  primaryKeyword: number;
  sections: number;
  author: number;
  overall: number;
}

/**
 * Result of normalizing an intermediate post
 */
export interface NormalizationResult {
  post: Partial<import('./canonical').BlogPost>;
  flags: NormalizationFlags;
  confidence: NormalizationConfidence;
}

/**
 * Schema analysis result after importing multiple posts
 */
export interface SchemaAnalysisResult {
  totalPosts: number;

  headingPatterns: {
    avgH2Count: number;
    avgH3Count: number;
    commonH2Patterns: string[];
    postsWithoutH2: number;
  };

  contentPatterns: {
    avgWordCount: number;
    avgSectionCount: number;
    avgParagraphsPerSection: number;
    postsWithLists: number;
    postsWithTables: number;
    postsWithImages: number;
  };

  seoPatterns: {
    postsWithMetaDescription: number;
    avgMetaDescLength: number;
    postsWithCanonical: number;
    postsWithJsonLd: number;
    jsonLdTypes: Record<string, number>;
  };

  eeatPatterns: {
    postsWithAuthor: number;
    postsWithCredentials: number;
    postsWithFaq: number;
    postsWithExperienceSection: number;
  };

  linkingPatterns: {
    avgInternalLinks: number;
    avgExternalLinks: number;
    commonInternalTargets: string[];
  };

  weaknesses: Array<{
    issue: string;
    affectedPosts: number;
    recommendation: string;
  }>;
}
