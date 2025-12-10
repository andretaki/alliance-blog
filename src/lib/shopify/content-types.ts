/**
 * Shopify Content Types
 *
 * TypeScript types for Shopify-native blog content generation.
 * These types encode the parsing rules from main-article.liquid template.
 */

// ============================================================================
// CONTENT TYPE ENUMS
// ============================================================================

/**
 * Content types detected from tags by the Shopify template
 * The template checks for these tags to determine schema markup
 */
export type ShopifyContentType =
  | 'howto'      // Tags: howto, how-to, tutorial, guide → HowTo schema
  | 'faq'        // Tags: faq, questions, q&a → FAQPage schema
  | 'technical'  // Tags: technical, specification, sds, msds → Technical article
  | 'safety'     // Tags: safety, hazard, warning → Safety content
  | 'review'     // Tags: review, rating → Review schema
  | 'comparison' // Tags: comparison, vs, compare → Comparison content
  | 'educational' // Tags: educational → Educational article
  | 'news';      // Tags: news → News article

/**
 * Tag mappings for content type detection
 */
export const CONTENT_TYPE_TAGS: Record<ShopifyContentType, string[]> = {
  howto: ['howto', 'how-to', 'tutorial', 'guide'],
  faq: ['faq', 'questions', 'q&a'],
  technical: ['technical', 'specification', 'sds', 'msds'],
  safety: ['safety', 'hazard', 'warning'],
  review: ['review', 'rating'],
  comparison: ['comparison', 'vs', 'compare'],
  educational: ['educational'],
  news: ['news'],
};

/**
 * Get tags for a given content type
 */
export function getTagsForContentType(contentType: ShopifyContentType): string[] {
  return CONTENT_TYPE_TAGS[contentType];
}

/**
 * Detect content type from tags
 */
export function detectContentType(tags: string[]): ShopifyContentType | null {
  const lowerTags = tags.map(t => t.toLowerCase());

  for (const [type, typeTags] of Object.entries(CONTENT_TYPE_TAGS)) {
    if (typeTags.some(tag => lowerTags.includes(tag))) {
      return type as ShopifyContentType;
    }
  }

  return null;
}

// ============================================================================
// ARTICLE STRUCTURES
// ============================================================================

/**
 * FAQ item structure for Shopify template parsing
 */
export interface ShopifyFAQ {
  question: string;
  answer: string;
}

/**
 * How-To step structure for Shopify template parsing
 */
export interface ShopifyHowToStep {
  stepNumber: number;
  title: string;
  instructions: string;
}

/**
 * Comparison item for comparison tables
 */
export interface ComparisonItem {
  name: string;
  properties: Record<string, string>;
  pros?: string[];
  cons?: string[];
}

/**
 * Product link for content
 */
export interface ProductLink {
  name: string;
  url: string;
  collection?: string;
}

/**
 * Callout box types
 */
export type CalloutType = 'warning' | 'danger' | 'info' | 'success';

/**
 * Callout structure
 */
export interface Callout {
  type: CalloutType;
  title?: string;
  content: string;
}

// ============================================================================
// SHOPIFY ARTICLE INTERFACES
// ============================================================================

/**
 * Shopify article as it would be created via Admin API
 */
export interface ShopifyArticle {
  id?: string;
  blogId: string;
  title: string;
  handle: string;
  body: string; // HTML content
  summary: string; // Excerpt - 155 chars for meta description
  tags: string[];
  author?: string;
  publishedAt?: string;
  image?: {
    src: string;
    alt: string;
  };
  metafields?: ShopifyMetafield[];
}

/**
 * Shopify metafield structure
 */
export interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: 'single_line_text_field' | 'multi_line_text_field' | 'number_integer' | 'number_decimal' | 'json';
}

// ============================================================================
// CONTENT BRIEF INTERFACES
// ============================================================================

/**
 * Input brief for article generation
 */
export interface ContentBrief {
  // Core topic
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];

  // Content type and structure
  contentType: ShopifyContentType;
  targetWordCount?: number;

  // Outline (optional - can be auto-generated)
  outline?: OutlineSection[];

  // FAQ suggestions
  faqSuggestions?: Array<{
    question: string;
    answerPoints?: string[];
  }>;

  // How-To steps (for howto content type)
  howToSteps?: Array<{
    title: string;
    keyPoints?: string[];
  }>;

  // Comparison items (for comparison content type)
  comparisonItems?: Array<{
    name: string;
    compareOn: string[];
  }>;

  // Product context
  relatedProducts?: ProductLink[];
  relatedCollections?: string[];

  // Target audience
  targetAudience?: string;
  searchIntent?: 'informational' | 'commercial' | 'transactional';

  // Safety emphasis level
  safetyLevel?: 'none' | 'standard' | 'high' | 'critical';

  // Industry vertical focus
  industryFocus?: string[];
}

/**
 * Outline section for article structure
 */
export interface OutlineSection {
  headingLevel: 'h2' | 'h3';
  headingText: string;
  keyPoints: string[];
  estimatedWordCount?: number;
  includeTable?: boolean;
  includeCallout?: CalloutType;
}

// ============================================================================
// GENERATED ARTICLE INTERFACES
// ============================================================================

/**
 * Complete generated article ready for Shopify
 */
export interface GeneratedArticle {
  // Core content
  title: string;
  slug: string;
  body: string; // HTML formatted for Shopify template
  excerpt: string; // 155 chars max

  // Tags for content type detection
  tags: string[];

  // Extracted data for validation
  parsedFaqs: ShopifyFAQ[];
  parsedSteps: ShopifyHowToStep[];

  // Metadata
  contentType: ShopifyContentType;
  wordCount: number;
  headings: Array<{ level: 'h2' | 'h3'; text: string }>;

  // Product links used
  productLinks: ProductLink[];

  // Schema preview (what the template will generate)
  schemaPreview: {
    type: string;
    data: Record<string, unknown>;
  };

  // Metafields for Shopify
  metafields?: ShopifyMetafield[];

  // Generation metadata
  generatedAt: string;
  aiModel: string;
  briefUsed: ContentBrief;
}

// ============================================================================
// VALIDATION INTERFACES
// ============================================================================

/**
 * Validation result for generated articles
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  schemaPreview: {
    articleSchema: Record<string, unknown>;
    faqSchema?: Record<string, unknown>;
    howToSchema?: Record<string, unknown>;
    reviewSchema?: Record<string, unknown>;
  };
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

/**
 * Shopify REST API article response
 */
export interface ShopifyArticleResponse {
  article: {
    id: number;
    title: string;
    created_at: string;
    body_html: string;
    blog_id: number;
    author: string;
    user_id: number | null;
    published_at: string | null;
    updated_at: string;
    summary_html: string | null;
    template_suffix: string | null;
    handle: string;
    tags: string;
    admin_graphql_api_id: string;
    image?: {
      created_at: string;
      alt: string | null;
      width: number;
      height: number;
      src: string;
    };
  };
}

/**
 * Shopify REST API articles list response
 */
export interface ShopifyArticlesListResponse {
  articles: ShopifyArticleResponse['article'][];
}

/**
 * Shopify blog response
 */
export interface ShopifyBlogResponse {
  blog: {
    id: number;
    handle: string;
    title: string;
    updated_at: string;
    commentable: string;
    feedburner: string | null;
    feedburner_location: string | null;
    created_at: string;
    template_suffix: string | null;
    tags: string;
    admin_graphql_api_id: string;
  };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Article generation options
 */
export interface GenerationOptions {
  /** Use style analysis from existing posts */
  useStyleAnalysis?: boolean;
  /** Specific opening hook type */
  openingHookType?: 'story' | 'question' | 'statistic' | 'problem' | 'bold_claim' | 'scenario' | 'definition' | 'direct_address';
  /** Include safety warnings */
  includeSafetyWarnings?: boolean;
  /** Include product CTAs */
  includeProductCTAs?: boolean;
  /** Maximum FAQ count */
  maxFaqs?: number;
  /** Temperature for AI generation */
  temperature?: number;
}

/**
 * Publishing options
 */
export interface PublishOptions {
  /** Blog ID or handle to publish to */
  blogId: string;
  /** Publish immediately or save as draft */
  publishImmediately?: boolean;
  /** Scheduled publish date */
  scheduledFor?: string;
  /** Author name override */
  authorName?: string;
}
