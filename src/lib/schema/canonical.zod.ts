/**
 * Zod Validation Schemas for Canonical Blog Schema
 *
 * These schemas provide runtime validation and can be used to generate JSON Schema for AI outputs.
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PostStatusSchema = z.enum([
  'idea',
  'brief',
  'draft',
  'reviewing',
  'scheduled',
  'published',
  'archived',
]);

export const SearchIntentSchema = z.enum([
  'informational',
  'commercial',
  'transactional',
  'navigational',
]);

export const LinkTypeSchema = z.enum([
  'product',
  'collection',
  'blog_post',
  'category',
  'external',
]);

export const HeadingLevelSchema = z.enum(['h2', 'h3']);

export const ContentSourceSchema = z.enum(['shopify', 'custom_nextjs', 'manual']);

export const FunnelStageSchema = z.enum([
  'awareness',
  'consideration',
  'decision',
  'retention',
]);

export const ContentIdeaStatusSchema = z.enum([
  'idea',
  'approved',
  'brief_created',
  'draft_created',
  'rejected',
]);

// ============================================================================
// EMBEDDED OBJECTS
// ============================================================================

export const AuthorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  role: z.string().min(2).max(100),
  credentials: z.string().min(10).max(500),
  profileUrl: z.string().url().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export const ReviewerSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().min(2).max(100),
  role: z.string().min(2).max(100),
  credentials: z.string().min(10).max(500),
});

export const SectionSchema = z.object({
  id: z.string().uuid(),
  headingText: z.string().min(5).max(150),
  headingLevel: HeadingLevelSchema,
  body: z.string().min(50),
  wordCount: z.number().int().min(0),
});

export const FAQSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(10).max(300).refine(
    (q) => q.trim().endsWith('?'),
    { message: 'Question must end with a question mark' }
  ),
  answer: z.string().min(50).max(1000),
});

export const InternalLinkSchema = z.object({
  href: z.string().min(1),
  anchorText: z.string().min(2).max(100),
  linkType: LinkTypeSchema,
  targetPostId: z.string().uuid().nullable(),
});

export const ExperienceEvidenceSchema = z.object({
  summary: z.string().min(20).max(500),
  details: z.string().max(2000).nullable(),
  placeholders: z.array(z.string()),
});

export const ArticleJsonLdSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.enum(['Article', 'BlogPosting']),
  headline: z.string().min(10).max(110),
  description: z.string().min(50).max(300),
  image: z.string().url().nullable(),
  author: z.object({
    '@type': z.literal('Person'),
    name: z.string(),
    url: z.string().url().nullable(),
    jobTitle: z.string().optional(),
    description: z.string().optional(),
  }),
  publisher: z.object({
    '@type': z.literal('Organization'),
    name: z.string(),
    logo: z.object({
      '@type': z.literal('ImageObject'),
      url: z.string().url(),
    }),
  }),
  datePublished: z.string().datetime().nullable(),
  dateModified: z.string().datetime().nullable(),
  mainEntityOfPage: z.object({
    '@type': z.literal('WebPage'),
    '@id': z.string().url(),
  }),
  keywords: z.string().optional(),
});

export const FaqPageJsonLdSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('FAQPage'),
  mainEntity: z.array(
    z.object({
      '@type': z.literal('Question'),
      name: z.string(),
      acceptedAnswer: z.object({
        '@type': z.literal('Answer'),
        text: z.string(),
      }),
    })
  ).min(2),
});

export const PerformanceMetricsSchema = z.object({
  clicks: z.number().int().min(0).nullable(),
  impressions: z.number().int().min(0).nullable(),
  averagePosition: z.number().min(0).nullable(),
  ctr: z.number().min(0).max(1).nullable(),
  conversionEvents: z.number().int().min(0).nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
});

// ============================================================================
// MAIN BLOG POST SCHEMA
// ============================================================================

export const BlogPostSchema = z.object({
  // --- Identification and Routing ---
  id: z.string().uuid(),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: 'Slug must be lowercase with hyphens only',
    }),
  sourceUrl: z.string().url().nullable(),
  source: ContentSourceSchema,
  status: PostStatusSchema,
  version: z.number().int().min(1),

  // --- Core Content ---
  title: z.string().min(10).max(100),
  summary: z.string().min(50).max(300),
  heroAnswer: z.string().min(100).max(500),
  sections: z.array(SectionSchema).min(2),
  faq: z.array(FAQSchema).max(10),

  // --- SEO Metadata ---
  primaryKeyword: z.string().min(2).max(50),
  secondaryKeywords: z.array(z.string().min(2).max(50)).max(10),
  searchIntent: SearchIntentSchema,
  metaTitle: z.string().min(30).max(70),
  metaDescription: z.string().min(100).max(170),
  canonicalUrl: z.string().url(),
  focusQuestions: z.array(z.string().min(10).max(200)).min(1).max(5),

  // --- Internal Linking ---
  internalLinks: z.array(InternalLinkSchema),

  // --- E-E-A-T Fields ---
  authorId: z.string().uuid(),
  author: AuthorSchema,
  reviewedBy: ReviewerSchema.nullable(),
  experienceEvidence: ExperienceEvidenceSchema,

  // --- Structured Data ---
  ldJsonArticle: ArticleJsonLdSchema,
  ldJsonFaqPage: FaqPageJsonLdSchema.nullable(),

  // --- Topic Clustering ---
  clusterTopicId: z.string().uuid().nullable(),
  parentPostId: z.string().uuid().nullable(),

  // --- Content Metadata ---
  rawHtml: z.string().nullable(),
  wordCount: z.number().int().min(0),
  readingTimeMinutes: z.number().int().min(0),
  aiAssisted: z.boolean(),
  aiModel: z.string().max(100).nullable(),

  // --- Timestamps ---
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  scheduledFor: z.string().datetime().nullable(),

  // --- Performance ---
  primaryTargetQuery: z.string().max(200).nullable(),
  performance: PerformanceMetricsSchema,
});

// ============================================================================
// PARTIAL SCHEMAS FOR CREATION/UPDATE
// ============================================================================

/**
 * Schema for creating a new blog post (some fields auto-generated)
 */
export const CreateBlogPostSchema = BlogPostSchema.omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  wordCount: true,
  readingTimeMinutes: true,
  performance: true,
}).extend({
  id: z.string().uuid().optional(),
  version: z.number().int().min(1).optional(),
});

/**
 * Schema for updating a blog post (all fields optional)
 */
export const UpdateBlogPostSchema = BlogPostSchema.partial().omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// CONTENT IDEA SCHEMA
// ============================================================================

export const BriefOutlineItemSchema = z.object({
  headingLevel: HeadingLevelSchema,
  headingText: z.string().min(5).max(150),
  keyPoints: z.array(z.string().min(10).max(300)).min(1),
  estimatedWordCount: z.number().int().min(50).max(2000),
});

export const BriefInternalLinkSchema = z.object({
  targetUrl: z.string().url(),
  suggestedAnchorText: z.string().min(2).max(100),
  placement: z.string().min(5).max(200),
  reason: z.string().min(10).max(300),
});

export const BriefExternalReferenceSchema = z.object({
  type: z.enum(['standard', 'regulation', 'study', 'authority']),
  description: z.string().min(10).max(300),
  reason: z.string().min(10).max(300),
});

export const BriefFaqSuggestionSchema = z.object({
  question: z.string().min(10).max(300),
  keyPointsForAnswer: z.array(z.string().min(10).max(300)).min(1),
});

export const BriefSchema = z.object({
  suggestedTitle: z.string().min(10).max(100),
  suggestedSlug: z.string().min(3).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  heroAnswerDraft: z.string().min(50).max(500),
  outline: z.array(BriefOutlineItemSchema).min(2),
  keyQuestions: z.array(z.string().min(10).max(300)).min(1).max(10),
  suggestedInternalLinks: z.array(BriefInternalLinkSchema),
  externalReferences: z.array(BriefExternalReferenceSchema),
  faqSuggestions: z.array(BriefFaqSuggestionSchema),
  experiencePrompts: z.array(z.string().min(20).max(500)),
});

export const ContentIdeaSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(10).max(300),
  primaryKeyword: z.string().min(2).max(100),
  secondaryKeywords: z.array(z.string().min(2).max(50)),
  targetAudience: z.string().max(200).nullable(),
  searchIntent: SearchIntentSchema,
  suggestedSlug: z.string().max(100).nullable(),
  clusterTopicId: z.string().uuid().nullable(),
  funnelStage: FunnelStageSchema.nullable(),
  status: ContentIdeaStatusSchema,
  justification: z.string().max(1000).nullable(),
  notes: z.string().max(2000).nullable(),
  brief: BriefSchema.nullable(),
  blogPostId: z.string().uuid().nullable(),
  aiGenerated: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================================================
// TOPIC CLUSTER SCHEMA
// ============================================================================

export const TopicClusterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(200),
  description: z.string().max(1000).nullable(),
  pillarPostId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================================================
// AI GENERATION SCHEMAS
// ============================================================================

export const TopicSuggestionInputSchema = z.object({
  productLine: z.string().min(3).max(200),
  targetAudience: z.string().min(10).max(300),
  funnelStage: FunnelStageSchema,
  existingTopics: z.array(z.string()),
  clusterContext: z
    .object({
      existingClusters: z.array(z.string()),
      preferNewCluster: z.boolean(),
    })
    .optional(),
  count: z.number().int().min(1).max(20),
});

export const TopicSuggestionSchema = z.object({
  topic: z.string().min(10).max(200),
  primaryKeyword: z.string().min(2).max(50),
  searchIntent: SearchIntentSchema,
  estimatedSearchVolume: z.enum(['high', 'medium', 'low']),
  clusterTopic: z.string().min(3).max(100),
  justification: z.string().min(50).max(500),
  targetQuery: z.string().min(5).max(200),
  competitiveAngle: z.string().min(20).max(300),
});

export const TopicSuggestionOutputSchema = z.object({
  suggestions: z.array(TopicSuggestionSchema),
});

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const ValidationResultSchema = z.object({
  field: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  suggestion: z.string().optional(),
});

export const PostValidationReportSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(ValidationResultSchema),
  warnings: z.array(ValidationResultSchema),
  info: z.array(ValidationResultSchema),
  score: z.object({
    seoScore: z.number().min(0).max(100),
    eeatScore: z.number().min(0).max(100),
    structureScore: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }),
});

// ============================================================================
// TYPE EXPORTS (inferred from Zod schemas)
// ============================================================================

export type BlogPostZ = z.infer<typeof BlogPostSchema>;
export type CreateBlogPostZ = z.infer<typeof CreateBlogPostSchema>;
export type UpdateBlogPostZ = z.infer<typeof UpdateBlogPostSchema>;
export type ContentIdeaZ = z.infer<typeof ContentIdeaSchema>;
export type BriefZ = z.infer<typeof BriefSchema>;
export type TopicClusterZ = z.infer<typeof TopicClusterSchema>;
export type TopicSuggestionInputZ = z.infer<typeof TopicSuggestionInputSchema>;
export type TopicSuggestionOutputZ = z.infer<typeof TopicSuggestionOutputSchema>;
export type ValidationResultZ = z.infer<typeof ValidationResultSchema>;
export type PostValidationReportZ = z.infer<typeof PostValidationReportSchema>;
