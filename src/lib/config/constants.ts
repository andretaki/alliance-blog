/**
 * Application Constants
 *
 * Centralized configuration values used throughout the application.
 */

// ============================================================================
// EMBEDDING CONFIGURATION
// ============================================================================

export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
  maxTokensPerText: 8191,
} as const;

// ============================================================================
// AI GENERATION CONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  // Default provider: 'openai' | 'anthropic'
  defaultProvider: 'anthropic' as const,

  // Default models per provider
  models: {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-5-20250929',
  },

  // Temperature settings by task type
  temperature: {
    structured: 0.3,  // For schema-compliant outputs
    creative: 0.7,    // For topic suggestions
    revision: 0.5,    // For content revisions
  },

  // Max tokens by task
  maxTokens: {
    topicSuggestion: 2000,
    brief: 4000,
    draft: 8000,
    revision: 3000,
  },
} as const;

// ============================================================================
// CONTENT VALIDATION THRESHOLDS
// ============================================================================

export const VALIDATION_THRESHOLDS = {
  // Title
  title: {
    minLength: 10,
    maxLength: 100,
  },

  // Meta title (for SEO)
  metaTitle: {
    minLength: 50,
    maxLength: 60,
    warnMin: 50,
    warnMax: 60,
  },

  // Meta description
  metaDescription: {
    minLength: 130,
    maxLength: 160,
    warnMin: 130,
    warnMax: 160,
  },

  // Hero answer
  heroAnswer: {
    minLength: 100,
    maxLength: 500,
  },

  // Sections
  sections: {
    minCount: 2,
    minBodyLength: 100,
  },

  // FAQs
  faq: {
    maxCount: 10,
    minForJsonLd: 2,
    questionMinLength: 10,
    questionMaxLength: 300,
    answerMinLength: 50,
    answerMaxLength: 1000,
  },

  // Internal links
  internalLinks: {
    recommendedMin: 3,
    recommendedMax: 15,
  },

  // Word count
  wordCount: {
    thinContent: 500,
    comprehensive: 1500,
  },

  // Experience evidence
  experienceEvidence: {
    minSummaryLength: 20,
  },

  // Author credentials
  authorCredentials: {
    minLength: 10,
  },
} as const;

// ============================================================================
// IMPORT CONFIGURATION
// ============================================================================

export const IMPORT_CONFIG = {
  // Rate limiting
  maxConcurrentRequests: 5,
  delayBetweenRequests: 200, // ms

  // Retry settings
  maxRetries: 3,
  retryDelay: 1000, // ms

  // Shopify pagination
  shopifyPageSize: 50,

  // Content detection
  contentSelectors: [
    'article',
    'main',
    '.post-content',
    '.article-content',
    '.blog-content',
    '#content',
  ],

  // Elements to exclude
  excludeSelectors: [
    'nav',
    'footer',
    'header',
    '.sidebar',
    '.comments',
    '.related-posts',
    'script',
    'style',
  ],
} as const;

// ============================================================================
// RETRIEVAL CONFIGURATION
// ============================================================================

export const RETRIEVAL_CONFIG = {
  // Default search parameters
  defaultLimit: 10,
  defaultMinSimilarity: 0.7,

  // Exemplar retrieval
  exemplarCount: 5,
  exemplarMinSimilarity: 0.6,

  // Scoring weights
  scoreWeights: {
    similarity: 0.4,
    performance: 0.3,
    recency: 0.15,
    completeness: 0.15,
  },

  // Cluster detection threshold
  clusterSimilarityThreshold: 0.75,
} as const;

// ============================================================================
// POST STATUS CONFIGURATION
// ============================================================================

export const POST_STATUS_CONFIG = {
  idea: {
    label: 'Idea',
    color: 'gray',
    allowedTransitions: ['brief', 'archived'],
  },
  brief: {
    label: 'Brief',
    color: 'blue',
    allowedTransitions: ['draft', 'idea', 'archived'],
  },
  draft: {
    label: 'Draft',
    color: 'yellow',
    allowedTransitions: ['reviewing', 'brief', 'archived'],
  },
  reviewing: {
    label: 'Reviewing',
    color: 'orange',
    allowedTransitions: ['draft', 'scheduled', 'published', 'archived'],
  },
  scheduled: {
    label: 'Scheduled',
    color: 'purple',
    allowedTransitions: ['published', 'reviewing', 'archived'],
  },
  published: {
    label: 'Published',
    color: 'green',
    allowedTransitions: ['reviewing', 'archived'],
  },
  archived: {
    label: 'Archived',
    color: 'red',
    allowedTransitions: ['draft'],
  },
} as const;

// ============================================================================
// SENSITIVE TOPIC KEYWORDS
// ============================================================================

export const YMYL_KEYWORDS = [
  'safety',
  'health',
  'medical',
  'chemical',
  'hazardous',
  'toxic',
  'dangerous',
  'flammable',
  'corrosive',
  'legal',
  'compliance',
  'regulation',
  'osha',
  'epa',
  'fda',
  'sds',
  'msds',
  'ppe',
  'first aid',
  'emergency',
] as const;
