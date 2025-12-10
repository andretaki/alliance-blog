/**
 * Canonical Blog Schema Types
 *
 * These types define the structure for all blog posts in the system.
 * All AI outputs, database records, and UI components must conform to this schema.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type PostStatus =
  | 'idea'
  | 'brief'
  | 'draft'
  | 'reviewing'
  | 'scheduled'
  | 'published'
  | 'archived';

export type SearchIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational';

export type LinkType =
  | 'product'
  | 'collection'
  | 'blog_post'
  | 'category'
  | 'external';

export type HeadingLevel = 'h2' | 'h3';

export type ContentSource = 'shopify' | 'custom_nextjs' | 'manual';

export type FunnelStage = 'awareness' | 'consideration' | 'decision' | 'retention';

export type ContentIdeaStatus = 'idea' | 'approved' | 'brief_created' | 'draft_created' | 'rejected';

// ============================================================================
// EMBEDDED OBJECTS
// ============================================================================

/**
 * Author information for E-E-A-T compliance
 */
export interface Author {
  id: string;
  name: string;
  role: string;
  credentials: string;
  profileUrl: string | null;
  avatarUrl: string | null;
}

/**
 * Optional expert reviewer for sensitive topics
 */
export interface Reviewer {
  id: string | null;
  name: string;
  role: string;
  credentials: string;
}

/**
 * A content section within a blog post
 */
export interface Section {
  id: string;
  headingText: string;
  headingLevel: HeadingLevel;
  body: string;
  wordCount: number;
}

/**
 * FAQ item for FAQ blocks and FAQPage schema
 */
export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

/**
 * Internal link with classification
 */
export interface InternalLink {
  href: string;
  anchorText: string;
  linkType: LinkType;
  targetPostId: string | null;
}

/**
 * Evidence of first-hand experience for E-E-A-T
 */
export interface ExperienceEvidence {
  summary: string;
  details: string | null;
  placeholders: string[];
}

/**
 * JSON-LD structured data for Article/BlogPosting
 */
export interface ArticleJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Article' | 'BlogPosting';
  headline: string;
  description: string;
  image: string | null;
  author: {
    '@type': 'Person';
    name: string;
    url: string | null;
    jobTitle?: string;
    description?: string;
  };
  publisher: {
    '@type': 'Organization';
    name: string;
    logo: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  datePublished: string | null;
  dateModified: string | null;
  mainEntityOfPage: {
    '@type': 'WebPage';
    '@id': string;
  };
  keywords?: string;
}

/**
 * JSON-LD structured data for FAQPage
 */
export interface FaqPageJsonLd {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

/**
 * Performance metrics from Search Console and analytics
 */
export interface PerformanceMetrics {
  clicks: number | null;
  impressions: number | null;
  averagePosition: number | null;
  ctr: number | null;
  conversionEvents: number | null;
  lastSyncedAt: string | null;
}

// ============================================================================
// MAIN BLOG POST SCHEMA
// ============================================================================

/**
 * The canonical blog post schema
 * All posts must conform to this structure
 */
export interface BlogPost {
  // --- Identification and Routing ---
  id: string;
  slug: string;
  sourceUrl: string | null;
  source: ContentSource;
  status: PostStatus;
  version: number;

  // --- Core Content ---
  title: string;
  summary: string;
  heroAnswer: string;
  sections: Section[];
  faq: FAQ[];

  // --- SEO Metadata ---
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  focusQuestions: string[];

  // --- Internal Linking ---
  internalLinks: InternalLink[];

  // --- E-E-A-T Fields ---
  authorId: string;
  author: Author;
  reviewedBy: Reviewer | null;
  experienceEvidence: ExperienceEvidence;

  // --- Structured Data ---
  ldJsonArticle: ArticleJsonLd;
  ldJsonFaqPage: FaqPageJsonLd | null;

  // --- Topic Clustering ---
  clusterTopicId: string | null;
  parentPostId: string | null;

  // --- Content Metadata ---
  rawHtml: string | null;
  wordCount: number;
  readingTimeMinutes: number;
  aiAssisted: boolean;
  aiModel: string | null;

  // --- Timestamps ---
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledFor: string | null;

  // --- Performance ---
  primaryTargetQuery: string | null;
  performance: PerformanceMetrics;
}

// ============================================================================
// CONTENT IDEA SCHEMA
// ============================================================================

/**
 * A content idea before it becomes a post
 */
export interface ContentIdea {
  id: string;
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  targetAudience: string | null;
  searchIntent: SearchIntent;
  suggestedSlug: string | null;
  clusterTopicId: string | null;
  funnelStage: FunnelStage | null;
  status: ContentIdeaStatus;
  justification: string | null;
  notes: string | null;
  brief: Brief | null;
  blogPostId: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A content brief for guiding draft generation
 */
export interface Brief {
  suggestedTitle: string;
  suggestedSlug: string;
  heroAnswerDraft: string;
  outline: Array<{
    headingLevel: HeadingLevel;
    headingText: string;
    keyPoints: string[];
    estimatedWordCount: number;
  }>;
  keyQuestions: string[];
  suggestedInternalLinks: Array<{
    targetUrl: string;
    suggestedAnchorText: string;
    placement: string;
    reason: string;
  }>;
  externalReferences: Array<{
    type: 'standard' | 'regulation' | 'study' | 'authority';
    description: string;
    reason: string;
  }>;
  faqSuggestions: Array<{
    question: string;
    keyPointsForAnswer: string[];
  }>;
  experiencePrompts: string[];
}

// ============================================================================
// TOPIC CLUSTER SCHEMA
// ============================================================================

/**
 * A topic cluster for organizing related content
 */
export interface TopicCluster {
  id: string;
  name: string;
  description: string | null;
  pillarPostId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AI GENERATION TYPES
// ============================================================================

/**
 * Input for topic suggestion generation
 */
export interface TopicSuggestionInput {
  productLine: string;
  targetAudience: string;
  funnelStage: FunnelStage;
  existingTopics: string[];
  clusterContext?: {
    existingClusters: string[];
    preferNewCluster: boolean;
  };
  count: number;
}

/**
 * Output from topic suggestion generation
 */
export interface TopicSuggestionOutput {
  suggestions: Array<{
    topic: string;
    primaryKeyword: string;
    searchIntent: SearchIntent;
    estimatedSearchVolume: 'high' | 'medium' | 'low';
    clusterTopic: string;
    justification: string;
    targetQuery: string;
    competitiveAngle: string;
  }>;
}

/**
 * Input for brief creation
 */
export interface BriefCreationInput {
  contentIdea: {
    topic: string;
    primaryKeyword: string;
    searchIntent: SearchIntent;
    targetAudience: string;
  };
  existingPosts: Array<{
    title: string;
    slug: string;
    sections: Section[];
    heroAnswer: string;
  }>;
  internalLinkTargets: Array<{
    url: string;
    title: string;
    type: LinkType;
  }>;
}

/**
 * Input for draft generation
 */
export interface DraftGenerationInput {
  brief: Brief;
  authorInfo: {
    name: string;
    role: string;
    credentials: string;
  };
  exemplarPosts: BlogPost[];
  organizationInfo: {
    name: string;
    logoUrl: string;
    websiteUrl: string;
  };
}

/**
 * Input for content revision
 */
export interface RevisionInput {
  post: BlogPost;
  revisionType: 'expand_section' | 'add_faq' | 'update_links' | 'refresh_content';
  context?: {
    sectionToExpand?: string;
    newFaqTopics?: string[];
    newLinkTargets?: InternalLink[];
    performanceData?: {
      lowCtrSections?: string[];
      highEngagementSections?: string[];
      missingKeywords?: string[];
    };
  };
}

/**
 * Output from content revision
 */
export interface RevisionOutput {
  updatedFields: {
    sections?: Section[];
    faq?: FAQ[];
    internalLinks?: InternalLink[];
    metaTitle?: string;
    metaDescription?: string;
  };
  changeLog: string[];
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * A single validation result
 */
export interface ValidationResult {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

/**
 * Complete validation report for a post
 */
export interface PostValidationReport {
  isValid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  info: ValidationResult[];
  score: {
    seoScore: number;
    eeatScore: number;
    structureScore: number;
    overall: number;
  };
}

// ============================================================================
// IMPORT TYPES
// ============================================================================

/**
 * Import job status
 */
export interface ImportJob {
  id: string;
  source: ContentSource;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
  };
  errors: Array<{ url: string; error: string }>;
  startedAt: string;
  completedAt: string | null;
}
