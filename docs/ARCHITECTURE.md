# AI-Assisted Blog System Architecture

## Part 1: System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SOURCES                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │   Shopify    │  │  Sitemap.xml │  │  Manual URLs │                       │
│  │  Admin API   │  │              │  │              │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
└─────────┼─────────────────┼─────────────────┼───────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPORT LAYER                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     Content Discovery Service                       │     │
│  │  - ShopifyFetcher                                                  │     │
│  │  - SitemapCrawler                                                  │     │
│  │  - HTMLParser (cheerio/jsdom)                                      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                  Intermediate Representation                        │     │
│  │  - Raw HTML, structured DOM, metadata extraction                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     Schema Normalizer                               │     │
│  │  - Maps IR → Canonical Schema                                      │     │
│  │  - Fills defaults, flags missing fields                            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                      PostgreSQL + pgvector                          │     │
│  │  ┌──────────────┐ ┌────────────────────┐ ┌──────────────────┐     │     │
│  │  │  blog_posts  │ │blog_post_embeddings│ │  content_ideas   │     │     │
│  │  └──────────────┘ └────────────────────┘ └──────────────────┘     │     │
│  │  ┌──────────────┐ ┌────────────────────┐                          │     │
│  │  │   authors    │ │  topic_clusters    │                          │     │
│  │  └──────────────┘ └────────────────────┘                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                         Drizzle ORM                                 │     │
│  │  - Type-safe queries                                               │     │
│  │  - Migration management                                            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI LAYER                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Embedding       │  │  Retrieval       │  │  Generation      │          │
│  │  Service         │  │  Service         │  │  Service         │          │
│  │  (OpenAI)        │  │  (pgvector)      │  │  (Anthropic/     │          │
│  │                  │  │                  │  │   OpenAI)        │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│           │                    │                      │                      │
│           ▼                    ▼                      ▼                      │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    AI Orchestrator                                  │     │
│  │  - Topic suggestion                                                │     │
│  │  - Brief generation                                                │     │
│  │  - Draft generation with structured output                         │     │
│  │  - Revision and optimization                                       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER (Next.js)                           │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                      API Routes / Server Actions                    │     │
│  │  /api/import/*       /api/ideas/*       /api/drafts/*              │     │
│  │  /api/briefs/*       /api/publish/*     /api/embeddings/*          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                      Admin Dashboard                                │     │
│  │  /admin/posts        /admin/ideas       /admin/drafts              │     │
│  │  /admin/briefs       /admin/analytics   /admin/settings            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Dependency Graph

```
lib/
├── schema/                  # Schema definitions (no dependencies)
│   ├── canonical.ts         # Canonical blog schema types
│   ├── canonical.zod.ts     # Zod validation schema
│   └── intermediate.ts      # Intermediate representation types
│
├── config/                  # Configuration (no dependencies)
│   ├── env.ts               # Environment variables
│   └── constants.ts         # App constants
│
├── db/                      # Database layer (depends: schema, config)
│   ├── client.ts            # Drizzle client setup
│   └── schema.ts            # Drizzle table definitions
│
├── import/                  # Import layer (depends: schema, db)
│   ├── fetchers/
│   │   ├── shopify.ts       # Shopify API fetcher
│   │   └── http.ts          # Generic HTTP fetcher with sitemap support
│   ├── parsers/
│   │   └── html.ts          # HTML → IR parser (includes JSON-LD extraction)
│   ├── normalizer.ts        # IR → Canonical schema
│   └── pipeline.ts          # Orchestrates import
│
├── ai/                      # AI layer (depends: schema, db)
│   ├── providers/
│   │   ├── index.ts         # Provider exports
│   │   ├── openai.ts        # OpenAI client wrapper
│   │   ├── anthropic.ts     # Anthropic client wrapper
│   │   └── types.ts         # Provider interface
│   ├── analysis/
│   │   └── style-analyzer.ts # Content style analysis
│   ├── embeddings.ts        # Embedding generation
│   ├── retrieval.ts         # Vector search
│   ├── generation/
│   │   ├── topics.ts        # Topic suggestion
│   │   ├── drafts.ts        # Draft generation
│   │   └── style-aware-prompts.ts # Style-guided content prompts
│   └── prompts/
│       └── system.ts        # System prompts
│
├── discovery/               # Topic discovery (depends: ai, db)
│   ├── index.ts             # Discovery exports
│   ├── topic-finder.ts      # Find new topic opportunities
│   ├── topic-scorer.ts      # Score and rank topics
│   └── existing-content.ts  # Analyze existing content
│
├── outline/                 # Outline generation (depends: ai)
│   ├── index.ts             # Outline exports
│   ├── outline-generator.ts # Generate article outlines
│   └── outline-types.ts     # Outline type definitions
│
├── shopify/                 # Shopify integration (depends: schema, ai)
│   ├── index.ts             # Shopify exports
│   ├── api-client.ts        # Shopify Admin API client
│   ├── article-generator.ts # Generate Shopify-formatted articles
│   ├── article-validator.ts # Validate articles for Shopify
│   ├── content-types.ts     # Shopify content type definitions
│   ├── format-rules.ts      # Shopify HTML formatting rules
│   └── product-matcher.ts   # Match content to products
│
└── seo/                     # SEO layer (depends: schema)
    ├── validators.ts        # SEO field validation
    └── jsonld.ts            # JSON-LD generation
```

### Scripts Directory

```
scripts/
├── analyze-style.ts         # Analyze content style patterns
├── create-author.ts         # Create author records
├── discover-topics.ts       # Run topic discovery pipeline
├── generate-article.ts      # Generate full articles
├── generate-outline.ts      # Generate article outlines
├── import-shopify.ts        # Import from Shopify
├── index-content.ts         # Index content for search
└── test-style-analyzer.ts   # Test style analysis
```

---

## Part 2: Canonical Blog Schema Specification

### Complete Schema Definition

```typescript
// This specification defines every field, type, and constraint.
// Implement as TypeScript type, Zod schema, JSON Schema, and Drizzle columns.

// ============================================================================
// ENUMS
// ============================================================================

PostStatus = "idea" | "brief" | "draft" | "reviewing" | "scheduled" | "published" | "archived"

SearchIntent = "informational" | "commercial" | "transactional" | "navigational"

LinkType = "product" | "collection" | "blog_post" | "category" | "external"

HeadingLevel = "h2" | "h3"

ContentSource = "shopify" | "custom_nextjs" | "manual"

// ============================================================================
// EMBEDDED OBJECTS (stored as JSONB or nested in parent)
// ============================================================================

Author {
  id: string                    // UUID, references authors table
  name: string                  // Required, 2-100 chars
  role: string                  // e.g., "Senior Chemical Engineer"
  credentials: string           // e.g., "10+ years industrial experience"
  profileUrl: string | null     // URL to author bio page
  avatarUrl: string | null      // URL to author image
}

Reviewer {
  id: string | null             // Optional, references authors table
  name: string                  // Required if reviewer exists
  role: string
  credentials: string
}

Section {
  id: string                    // UUID for stable reference
  headingText: string           // The heading text, 5-150 chars
  headingLevel: HeadingLevel    // "h2" or "h3"
  body: string                  // HTML or Markdown content
  wordCount: number             // Computed, for analytics
}

FAQ {
  id: string                    // UUID
  question: string              // 10-300 chars, ends with "?"
  answer: string                // 50-1000 chars, HTML or plain text
}

InternalLink {
  href: string                  // Absolute or relative URL
  anchorText: string            // 2-100 chars
  linkType: LinkType            // Type of destination
  targetPostId: string | null   // If linking to another blog post
}

ExperienceEvidence {
  summary: string               // 1-3 sentences describing first-hand experience
  details: string | null        // Longer explanation, case study, or process detail
  placeholders: string[]        // List of placeholders for editor to fill
                                // e.g., ["[SPECIFIC_CUSTOMER_CASE]", "[QUANTITY_USED]"]
}

ArticleJsonLd {
  "@context": "https://schema.org"
  "@type": "Article" | "BlogPosting"
  headline: string
  description: string
  image: string | null
  author: {
    "@type": "Person"
    name: string
    url: string | null
  }
  publisher: {
    "@type": "Organization"
    name: string
    logo: { "@type": "ImageObject", url: string }
  }
  datePublished: string | null  // ISO 8601
  dateModified: string | null   // ISO 8601
  mainEntityOfPage: string      // Canonical URL
}

FaqPageJsonLd {
  "@context": "https://schema.org"
  "@type": "FAQPage"
  mainEntity: Array<{
    "@type": "Question"
    name: string
    acceptedAnswer: {
      "@type": "Answer"
      text: string
    }
  }>
}

PerformanceMetrics {
  clicks: number | null
  impressions: number | null
  averagePosition: number | null
  ctr: number | null
  conversionEvents: number | null
  lastSyncedAt: string | null   // ISO 8601
}

// ============================================================================
// MAIN BLOG POST SCHEMA
// ============================================================================

BlogPost {
  // --- Identification and Routing ---
  id: string                    // UUID, primary key
  slug: string                  // URL slug, unique, 3-100 chars, lowercase, hyphens only
  sourceUrl: string | null      // Original URL if imported
  source: ContentSource         // Where this post came from
  status: PostStatus            // Current workflow status
  version: number               // Incremented on each edit, starts at 1

  // --- Core Content ---
  title: string                 // Main title, 10-100 chars
  summary: string               // 1-3 sentence overview, 50-300 chars
  heroAnswer: string            // Direct answer to main query, 100-500 chars
                                // This appears at the top of the article
  sections: Section[]           // Ordered list of content sections
                                // Minimum 2 sections, no maximum
  faq: FAQ[]                    // List of FAQ items, 0-10 items
                                // If 2+ items, generate FAQPage JSON-LD

  // --- SEO Metadata ---
  primaryKeyword: string        // Main target keyword, 2-50 chars
  secondaryKeywords: string[]   // 0-10 additional keywords
  searchIntent: SearchIntent    // Primary search intent
  metaTitle: string             // 50-60 chars (warn if outside range)
  metaDescription: string       // 130-160 chars (warn if outside range)
  canonicalUrl: string          // Full canonical URL
  focusQuestions: string[]      // 1-5 questions we want to rank for

  // --- Internal Linking ---
  internalLinks: InternalLink[] // 3-15 internal links recommended

  // --- E-E-A-T Fields ---
  authorId: string              // Foreign key to authors table
  author: Author                // Denormalized for convenience
  reviewedBy: Reviewer | null   // Optional expert reviewer
  experienceEvidence: ExperienceEvidence  // Required for all posts

  // --- Structured Data ---
  ldJsonArticle: ArticleJsonLd          // Always required
  ldJsonFaqPage: FaqPageJsonLd | null   // Required if faq.length >= 2

  // --- Topic Clustering ---
  clusterTopic: string | null   // Parent topic for clustering
  parentPostId: string | null   // If this is a child of a pillar post

  // --- Content Metadata ---
  rawHtml: string | null        // Original HTML if imported
  wordCount: number             // Total word count, computed
  readingTimeMinutes: number    // Estimated reading time, computed
  aiAssisted: boolean           // True if AI helped generate/edit
  aiModel: string | null        // Which model was used, for audit

  // --- Timestamps ---
  createdAt: string             // ISO 8601
  updatedAt: string             // ISO 8601
  publishedAt: string | null    // ISO 8601, set when status = published
  scheduledFor: string | null   // ISO 8601, if status = scheduled

  // --- Performance ---
  primaryTargetQuery: string | null   // The specific query we're targeting
  performance: PerformanceMetrics     // Analytics data, filled later
}
```

### Validation Constraints Summary

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | string | yes | UUID v4 |
| slug | string | yes | 3-100 chars, lowercase, hyphens, unique |
| title | string | yes | 10-100 chars |
| summary | string | yes | 50-300 chars |
| heroAnswer | string | yes | 100-500 chars |
| sections | Section[] | yes | min 2 items |
| metaTitle | string | yes | 50-60 chars (soft warning) |
| metaDescription | string | yes | 130-160 chars (soft warning) |
| primaryKeyword | string | yes | 2-50 chars |
| authorId | string | yes | valid UUID referencing authors |
| experienceEvidence.summary | string | yes | non-empty |

### JSON Schema Output Specification

When AI generates content, it must output valid JSON matching this structure. The JSON Schema will be passed to the AI model via structured output mode. Key rules:

1. All required fields must be present
2. String lengths must fall within specified ranges
3. Arrays must have at least minimum required items
4. Enum fields must use exact values
5. The output must be a single valid JSON object, no markdown wrapping

---

## Part 3: Database and Drizzle Design

### Table: `authors`

```
Table: authors
Purpose: Store author and reviewer profiles for E-E-A-T compliance

Columns:
  id            uuid          PRIMARY KEY, DEFAULT uuid_generate_v4()
  name          varchar(100)  NOT NULL
  role          varchar(100)  NOT NULL
  credentials   varchar(500)  NOT NULL
  profile_url   varchar(500)  NULL
  avatar_url    varchar(500)  NULL
  bio           text          NULL
  created_at    timestamptz   NOT NULL DEFAULT now()
  updated_at    timestamptz   NOT NULL DEFAULT now()

Indexes:
  - PRIMARY KEY on id
  - UNIQUE on (name, role) -- prevent duplicate authors

Drizzle definition notes:
  - Use pgTable with uuid() for id
  - Use varchar with length constraints
  - Add timestamps with default values
```

### Table: `topic_clusters`

```
Table: topic_clusters
Purpose: Group related posts into topical clusters for authority building

Columns:
  id              uuid          PRIMARY KEY, DEFAULT uuid_generate_v4()
  name            varchar(200)  NOT NULL UNIQUE
  description     text          NULL
  pillar_post_id  uuid          NULL REFERENCES blog_posts(id)
  parent_id       uuid          NULL REFERENCES topic_clusters(id)
  created_at      timestamptz   NOT NULL DEFAULT now()
  updated_at      timestamptz   NOT NULL DEFAULT now()

Indexes:
  - PRIMARY KEY on id
  - UNIQUE on name
  - INDEX on parent_id (for hierarchy queries)
  - INDEX on pillar_post_id

Drizzle definition notes:
  - Self-referential foreign key for hierarchical clusters
  - pillar_post_id references the main pillar content
```

### Table: `blog_posts`

```
Table: blog_posts
Purpose: Main content storage table

Columns:
  -- Identification
  id                  uuid          PRIMARY KEY, DEFAULT uuid_generate_v4()
  slug                varchar(100)  NOT NULL UNIQUE
  source_url          varchar(500)  NULL
  source              varchar(20)   NOT NULL DEFAULT 'manual'
                                    CHECK (source IN ('shopify', 'custom_nextjs', 'manual'))
  status              varchar(20)   NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('idea', 'brief', 'draft', 'reviewing',
                                                      'scheduled', 'published', 'archived'))
  version             integer       NOT NULL DEFAULT 1

  -- Core Content
  title               varchar(200)  NOT NULL
  summary             varchar(500)  NOT NULL
  hero_answer         text          NOT NULL
  sections            jsonb         NOT NULL DEFAULT '[]'
                                    -- Array of Section objects
  faq                 jsonb         NOT NULL DEFAULT '[]'
                                    -- Array of FAQ objects

  -- SEO
  primary_keyword     varchar(100)  NOT NULL
  secondary_keywords  jsonb         NOT NULL DEFAULT '[]'
                                    -- Array of strings
  search_intent       varchar(20)   NOT NULL DEFAULT 'informational'
                                    CHECK (search_intent IN ('informational', 'commercial',
                                                             'transactional', 'navigational'))
  meta_title          varchar(100)  NOT NULL
  meta_description    varchar(200)  NOT NULL
  canonical_url       varchar(500)  NOT NULL
  focus_questions     jsonb         NOT NULL DEFAULT '[]'
                                    -- Array of strings

  -- Internal Linking
  internal_links      jsonb         NOT NULL DEFAULT '[]'
                                    -- Array of InternalLink objects

  -- E-E-A-T
  author_id           uuid          NOT NULL REFERENCES authors(id)
  reviewed_by         jsonb         NULL
                                    -- Reviewer object (nullable)
  experience_evidence jsonb         NOT NULL
                                    -- ExperienceEvidence object

  -- Structured Data
  ld_json_article     jsonb         NOT NULL
  ld_json_faq_page    jsonb         NULL

  -- Clustering
  cluster_topic_id    uuid          NULL REFERENCES topic_clusters(id)
  parent_post_id      uuid          NULL REFERENCES blog_posts(id)

  -- Content Metadata
  raw_html            text          NULL
  word_count          integer       NOT NULL DEFAULT 0
  reading_time_mins   integer       NOT NULL DEFAULT 0
  ai_assisted         boolean       NOT NULL DEFAULT false
  ai_model            varchar(100)  NULL

  -- Performance
  primary_target_query varchar(200) NULL
  performance         jsonb         NOT NULL DEFAULT '{}'
                                    -- PerformanceMetrics object

  -- Timestamps
  created_at          timestamptz   NOT NULL DEFAULT now()
  updated_at          timestamptz   NOT NULL DEFAULT now()
  published_at        timestamptz   NULL
  scheduled_for       timestamptz   NULL

Indexes:
  - PRIMARY KEY on id
  - UNIQUE on slug
  - INDEX on status
  - INDEX on author_id
  - INDEX on cluster_topic_id
  - INDEX on published_at DESC (for listing published posts)
  - INDEX on source_url (for import deduplication)
  - GIN INDEX on secondary_keywords (for jsonb array searches)
  - GIN INDEX on sections (for full-text search in content)

Constraints:
  - slug must match pattern: ^[a-z0-9]+(-[a-z0-9]+)*$
  - sections must be valid JSON array
  - faq must be valid JSON array

Drizzle definition notes:
  - Use pgTable
  - uuid() for id columns
  - varchar() with lengths for string columns
  - text() for unbounded text
  - jsonb() for complex nested objects
  - timestamp() with timezone for dates
  - boolean() for flags
  - integer() for counts
  - Add foreign key references with references()
```

### Table: `blog_post_embeddings`

```
Table: blog_post_embeddings
Purpose: Store vector embeddings for semantic search and retrieval

Columns:
  id              uuid          PRIMARY KEY, DEFAULT uuid_generate_v4()
  blog_post_id    uuid          NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE
  chunk_index     integer       NOT NULL DEFAULT 0
                                -- Which chunk of the post this embedding represents
  chunk_text      text          NOT NULL
                                -- The actual text that was embedded
  embedding       vector(1536)  NOT NULL
                                -- OpenAI ada-002 produces 1536 dimensions
                                -- Adjust for other models
  embedding_model varchar(50)   NOT NULL
                                -- e.g., 'text-embedding-ada-002', 'text-embedding-3-small'
  content_type    varchar(20)   NOT NULL DEFAULT 'full'
                                CHECK (content_type IN ('title', 'hero', 'section',
                                                        'faq', 'full', 'summary'))
  tags            jsonb         NOT NULL DEFAULT '[]'
                                -- Array of strings for filtering
  created_at      timestamptz   NOT NULL DEFAULT now()

Indexes:
  - PRIMARY KEY on id
  - INDEX on blog_post_id
  - UNIQUE on (blog_post_id, chunk_index, content_type)
  - ivfflat INDEX on embedding using vector_cosine_ops
    -- For fast approximate nearest neighbor search
    -- Create with: CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  - GIN INDEX on tags

Drizzle/pgvector notes:
  - Use drizzle-orm/pg-core with customType for vector
  - Embedding dimension depends on model:
    - text-embedding-ada-002: 1536
    - text-embedding-3-small: 1536
    - text-embedding-3-large: 3072
  - Consider using HNSW index for better performance at scale
```

### Table: `content_ideas`

```
Table: content_ideas
Purpose: Store topic suggestions and content ideas before they become posts

Columns:
  id                  uuid          PRIMARY KEY, DEFAULT uuid_generate_v4()
  topic               varchar(300)  NOT NULL
  primary_keyword     varchar(100)  NOT NULL
  secondary_keywords  jsonb         NOT NULL DEFAULT '[]'
  target_audience     varchar(200)  NULL
  search_intent       varchar(20)   NOT NULL DEFAULT 'informational'
  suggested_slug      varchar(100)  NULL
  cluster_topic_id    uuid          NULL REFERENCES topic_clusters(id)
  funnel_stage        varchar(20)   NULL
                                    CHECK (funnel_stage IN ('awareness', 'consideration',
                                                            'decision', 'retention'))
  status              varchar(20)   NOT NULL DEFAULT 'idea'
                                    CHECK (status IN ('idea', 'approved', 'brief_created',
                                                      'draft_created', 'rejected'))
  justification       text          NULL
                                    -- Why this topic was suggested
  notes               text          NULL
  brief               jsonb         NULL
                                    -- Stores the generated brief if created
  blog_post_id        uuid          NULL REFERENCES blog_posts(id)
                                    -- Links to the post if one was created
  ai_generated        boolean       NOT NULL DEFAULT false
  created_at          timestamptz   NOT NULL DEFAULT now()
  updated_at          timestamptz   NOT NULL DEFAULT now()

Indexes:
  - PRIMARY KEY on id
  - INDEX on status
  - INDEX on cluster_topic_id
  - INDEX on blog_post_id
  - INDEX on created_at DESC
```

### Table: `import_logs`

```
Table: import_logs
Purpose: Track import operations for auditability and debugging

Columns:
  id              uuid          PRIMARY KEY, DEFAULT uuid_generate_v4()
  source          varchar(20)   NOT NULL
  source_url      varchar(500)  NOT NULL
  status          varchar(20)   NOT NULL
                                CHECK (status IN ('pending', 'fetched', 'parsed',
                                                  'normalized', 'saved', 'failed'))
  blog_post_id    uuid          NULL REFERENCES blog_posts(id)
  error_message   text          NULL
  raw_response    text          NULL
  metadata        jsonb         NOT NULL DEFAULT '{}'
  created_at      timestamptz   NOT NULL DEFAULT now()
  completed_at    timestamptz   NULL

Indexes:
  - PRIMARY KEY on id
  - INDEX on source_url
  - INDEX on status
  - INDEX on created_at DESC
```

### Drizzle Relations Summary

```typescript
// Relations to define in Drizzle:

authors
  ↓ one-to-many
blog_posts (via author_id)

topic_clusters
  ↓ one-to-many
blog_posts (via cluster_topic_id)
  ↓ self-referential
topic_clusters (via parent_id)

blog_posts
  ↓ one-to-many
blog_post_embeddings (via blog_post_id, CASCADE delete)
  ↓ self-referential
blog_posts (via parent_post_id for pillar/cluster posts)

content_ideas
  ↓ many-to-one
blog_posts (via blog_post_id when converted)
  ↓ many-to-one
topic_clusters (via cluster_topic_id)
```

---

## Part 4: Import Pipeline Design

### Intermediate Representation (IR) Schema

Before mapping to the canonical schema, all imported content passes through this normalized IR:

```typescript
IntermediatePost {
  // Source identification
  sourceUrl: string              // Original URL
  sourceType: "shopify" | "sitemap" | "manual"
  fetchedAt: string              // ISO timestamp

  // Raw content
  rawHtml: string                // Full HTML of the page/article

  // Extracted metadata
  title: string | null           // <title> or og:title
  h1: string | null              // First <h1> found
  metaTitle: string | null       // <title> tag content
  metaDescription: string | null // <meta name="description">
  canonicalUrl: string | null    // <link rel="canonical">
  ogImage: string | null         // og:image

  // Structured content
  headings: Array<{
    level: 1 | 2 | 3 | 4 | 5 | 6
    text: string
    id: string | null            // id attribute if present
  }>

  paragraphs: Array<{
    text: string
    html: string
    parentHeadingIndex: number | null
  }>

  lists: Array<{
    type: "ul" | "ol"
    items: string[]
    parentHeadingIndex: number | null
  }>

  tables: Array<{
    headers: string[]
    rows: string[][]
    parentHeadingIndex: number | null
  }>

  links: Array<{
    href: string
    text: string
    isInternal: boolean
  }>

  images: Array<{
    src: string
    alt: string | null
    caption: string | null
  }>

  // Existing structured data
  jsonLd: Array<object>          // All JSON-LD blocks found

  // Shopify-specific (if applicable)
  shopify?: {
    articleId: string
    blogId: string
    author: string | null
    tags: string[]
    publishedAt: string | null
    handle: string
  }
}
```

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPORT PIPELINE                                  │
│                                                                          │
│  Step 1: Discovery                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Input: source configuration                                        │ │
│  │  Output: List<{ url: string, source: string, metadata?: object }>  │ │
│  │                                                                      │ │
│  │  ShopifyDiscovery:                                                  │ │
│  │    - Query: articles(first: 250) via Admin GraphQL                  │ │
│  │    - Paginate with cursor                                           │ │
│  │    - Extract: id, handle, blog.handle, url                          │ │
│  │                                                                      │ │
│  │  SitemapDiscovery:                                                  │ │
│  │    - Fetch /sitemap.xml                                             │ │
│  │    - Parse XML, extract all <loc> URLs                              │ │
│  │    - Filter by pattern (e.g., /blog/*, /articles/*)                 │ │
│  │                                                                      │ │
│  │  ManualDiscovery:                                                   │ │
│  │    - Read from config file or database                              │ │
│  │    - List of seed URLs                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  Step 2: Fetch                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Input: List of URLs                                                │ │
│  │  Output: List<{ url: string, html: string, status: number }>       │ │
│  │                                                                      │ │
│  │  For Shopify:                                                       │ │
│  │    Option A: Use article.body_html from Admin API directly          │ │
│  │    Option B: Fetch public URL for full page HTML                    │ │
│  │                                                                      │ │
│  │  For HTTP:                                                          │ │
│  │    - Use fetch() with appropriate headers                           │ │
│  │    - Handle redirects, 404s, rate limiting                          │ │
│  │    - Respect robots.txt for external sites                          │ │
│  │    - Implement retry with exponential backoff                       │ │
│  │                                                                      │ │
│  │  Rate limiting:                                                     │ │
│  │    - Max 5 concurrent requests                                      │ │
│  │    - 200ms delay between requests to same domain                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  Step 3: Parse                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Input: Raw HTML                                                    │ │
│  │  Output: IntermediatePost                                           │ │
│  │                                                                      │ │
│  │  Use: cheerio (lightweight) or jsdom (full DOM)                     │ │
│  │                                                                      │ │
│  │  Extract:                                                           │ │
│  │    1. <title>, <meta name="description">, <link rel="canonical">   │ │
│  │    2. Open Graph tags (og:title, og:description, og:image)          │ │
│  │    3. All headings (h1-h6) with hierarchy                           │ │
│  │    4. All paragraphs, associating with parent headings              │ │
│  │    5. Lists (ul, ol) with items                                     │ │
│  │    6. Tables with headers and rows                                  │ │
│  │    7. Links, marking internal vs external                           │ │
│  │    8. Images with alt text                                          │ │
│  │    9. All <script type="application/ld+json"> blocks                │ │
│  │                                                                      │ │
│  │  Content area detection:                                            │ │
│  │    - Look for <article>, <main>, or common class patterns           │ │
│  │    - Exclude nav, footer, sidebar content                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  Step 4: Normalize                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Input: IntermediatePost                                            │ │
│  │  Output: Partial<BlogPost> with validation flags                    │ │
│  │                                                                      │ │
│  │  Mapping rules:                                                     │ │
│  │                                                                      │ │
│  │  slug:                                                              │ │
│  │    - From Shopify handle, or                                        │ │
│  │    - From URL path segment, or                                      │ │
│  │    - slugify(title)                                                 │ │
│  │                                                                      │ │
│  │  title:                                                             │ │
│  │    - Prefer h1 if exists, else metaTitle, else og:title             │ │
│  │                                                                      │ │
│  │  sections:                                                          │ │
│  │    - Group paragraphs under their parent headings                   │ │
│  │    - Each h2/h3 becomes a Section                                   │ │
│  │    - Body = concatenated paragraphs + lists under that heading      │ │
│  │                                                                      │ │
│  │  summary:                                                           │ │
│  │    - metaDescription, or first paragraph truncated to 300 chars     │ │
│  │                                                                      │ │
│  │  heroAnswer:                                                        │ │
│  │    - First 2-3 paragraphs combined, or flag as NEEDS_ATTENTION      │ │
│  │                                                                      │ │
│  │  faq:                                                               │ │
│  │    - Look for existing FAQ JSON-LD                                  │ │
│  │    - Look for headings with "?" or common FAQ patterns              │ │
│  │    - Extract Q&A pairs if found                                     │ │
│  │                                                                      │ │
│  │  primaryKeyword:                                                    │ │
│  │    - Extract from title/h1, or flag as NEEDS_ATTENTION              │ │
│  │                                                                      │ │
│  │  internalLinks:                                                     │ │
│  │    - Filter links for internal domain                               │ │
│  │    - Classify by URL pattern (/products/, /collections/, /blog/)    │ │
│  │                                                                      │ │
│  │  author:                                                            │ │
│  │    - From Shopify author field, or                                  │ │
│  │    - From JSON-LD Person, or                                        │ │
│  │    - Flag as NEEDS_ATTENTION, assign default                        │ │
│  │                                                                      │ │
│  │  ldJsonArticle:                                                     │ │
│  │    - Preserve existing if valid, else generate skeleton             │ │
│  │                                                                      │ │
│  │  Output includes:                                                   │ │
│  │    - validationFlags: string[] listing what needs human review      │ │
│  │    - confidence: object with scores for each field                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  Step 5: Persist                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Input: Partial<BlogPost> with flags                                │ │
│  │  Output: Saved blog_post record                                     │ │
│  │                                                                      │ │
│  │  Upsert logic:                                                      │ │
│  │    1. Check if slug exists in blog_posts                            │ │
│  │    2. If exists:                                                    │ │
│  │       - Compare version/updated_at                                  │ │
│  │       - Update only if source content changed                       │ │
│  │       - Preserve any manual edits (via flag)                        │ │
│  │    3. If not exists:                                                │ │
│  │       - Insert new record                                           │ │
│  │       - Status = 'draft' for imported content                       │ │
│  │                                                                      │ │
│  │  Author handling:                                                   │ │
│  │    - Look up author by name                                         │ │
│  │    - Create if not exists with default credentials                  │ │
│  │    - Flag for credential review                                     │ │
│  │                                                                      │ │
│  │  Log to import_logs:                                                │ │
│  │    - Record source_url, status, any errors                          │ │
│  │    - Link to created blog_post_id                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  Step 6: Embed                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Input: Saved blog_post                                             │ │
│  │  Output: blog_post_embeddings records                               │ │
│  │                                                                      │ │
│  │  Chunking strategy:                                                 │ │
│  │    1. Title + summary (one embedding, type='summary')               │ │
│  │    2. heroAnswer (one embedding, type='hero')                       │ │
│  │    3. Each section (one embedding per section, type='section')      │ │
│  │    4. Full concatenated text (one embedding, type='full')           │ │
│  │                                                                      │ │
│  │  Call embedding API:                                                │ │
│  │    - Batch requests (up to 100 texts per API call)                  │ │
│  │    - Store model name for reproducibility                           │ │
│  │                                                                      │ │
│  │  Idempotency:                                                       │ │
│  │    - Delete existing embeddings for post before inserting           │ │
│  │    - Or use ON CONFLICT with chunk_index                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Shopify Admin GraphQL Query

```graphql
query GetArticles($first: Int!, $after: String) {
  articles(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        handle
        title
        body
        bodyHtml
        summary
        tags
        publishedAt
        author {
          name
        }
        blog {
          id
          handle
          title
        }
        image {
          url
          altText
        }
        seo {
          title
          description
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Pattern Analysis for Schema Inference

After importing all posts, run analysis to identify patterns:

```typescript
SchemaAnalysisResult {
  totalPosts: number

  headingPatterns: {
    avgH2Count: number
    avgH3Count: number
    commonH2Patterns: string[]    // e.g., "What is...", "How to...", "FAQ"
    postsWithoutH2: number
  }

  contentPatterns: {
    avgWordCount: number
    avgSectionCount: number
    avgParagraphsPerSection: number
    postsWithLists: number
    postsWithTables: number
    postsWithImages: number
  }

  seoPatterns: {
    postsWithMetaDescription: number
    avgMetaDescLength: number
    postsWithCanonical: number
    postsWithJsonLd: number
    jsonLdTypes: Record<string, number>  // Count by @type
  }

  eeatPatterns: {
    postsWithAuthor: number
    postsWithCredentials: number
    postsWithFaq: number
    postsWithExperienceSection: number
  }

  linkingPatterns: {
    avgInternalLinks: number
    avgExternalLinks: number
    commonInternalTargets: string[]
  }

  weaknesses: Array<{
    issue: string
    affectedPosts: number
    recommendation: string
  }>
}
```

---

## Part 5: Embeddings and Retrieval Design

### Embedding Strategy

#### What to Embed

```typescript
EmbeddingChunk {
  blogPostId: string
  chunkIndex: number
  contentType: "title" | "hero" | "section" | "faq" | "full" | "summary"
  text: string
  metadata: {
    sectionHeading?: string
    sectionIndex?: number
    wordCount: number
  }
}

// Chunking rules per post:
generateChunks(post: BlogPost): EmbeddingChunk[] {
  chunks = []

  // 1. Summary chunk: title + summary + primaryKeyword
  chunks.push({
    contentType: "summary",
    text: `${post.title}\n\n${post.summary}\n\nKeyword: ${post.primaryKeyword}`,
    chunkIndex: 0
  })

  // 2. Hero answer chunk
  chunks.push({
    contentType: "hero",
    text: post.heroAnswer,
    chunkIndex: 1
  })

  // 3. Each section as separate chunk (for granular retrieval)
  post.sections.forEach((section, i) => {
    chunks.push({
      contentType: "section",
      text: `${section.headingText}\n\n${stripHtml(section.body)}`,
      chunkIndex: i + 2,
      metadata: { sectionHeading: section.headingText, sectionIndex: i }
    })
  })

  // 4. FAQ as single chunk if exists
  if (post.faq.length > 0) {
    faqText = post.faq.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    chunks.push({
      contentType: "faq",
      text: faqText,
      chunkIndex: chunks.length
    })
  }

  // 5. Full post concatenation (for overall similarity)
  fullText = [
    post.title,
    post.heroAnswer,
    ...post.sections.map(s => `${s.headingText}\n${stripHtml(s.body)}`),
    post.faq.map(f => `${f.question} ${f.answer}`).join(' ')
  ].join('\n\n')

  chunks.push({
    contentType: "full",
    text: truncateToTokenLimit(fullText, 8000),  // Stay under model limit
    chunkIndex: chunks.length
  })

  return chunks
}
```

#### Embedding Model Configuration

```typescript
EmbeddingConfig {
  provider: "openai"
  model: "text-embedding-3-small"  // Good balance of cost and quality
  dimensions: 1536
  batchSize: 100                    // Max texts per API call
  maxTokensPerText: 8191            // Model limit
}

// Alternative for higher quality:
EmbeddingConfigHighQuality {
  provider: "openai"
  model: "text-embedding-3-large"
  dimensions: 3072
  batchSize: 100
  maxTokensPerText: 8191
}
```

### Retrieval System Design

#### Query Types

```typescript
RetrievalQuery {
  // For topic/idea exploration
  TopicQuery {
    query: string           // Natural language topic description
    clusterTopicId?: string // Optional filter by cluster
    limit: number           // Default 10
    minSimilarity: number   // Default 0.7
  }

  // For finding similar existing content
  SimilarContentQuery {
    text: string            // Brief, outline, or draft text
    excludePostIds: string[] // Exclude specific posts
    limit: number
    contentTypes: string[]  // Filter by chunk type
  }

  // For style exemplars during generation
  ExemplarQuery {
    topic: string
    searchIntent: SearchIntent
    minPerformanceScore?: number  // Prefer high-performing posts
    limit: number                 // Usually 3-5
  }
}
```

#### Retrieval Implementation

```typescript
// Core retrieval function using pgvector
async function retrieveSimilarPosts(
  queryEmbedding: number[],
  options: {
    limit: number
    minSimilarity: number
    contentTypes?: string[]
    excludePostIds?: string[]
    clusterTopicId?: string
    minClicks?: number
  }
): Promise<RetrievalResult[]> {

  // SQL query structure (Drizzle will generate this):
  /*
  SELECT
    bp.id,
    bp.slug,
    bp.title,
    bp.hero_answer,
    bp.sections,
    bp.primary_keyword,
    bp.performance,
    bpe.chunk_text,
    bpe.content_type,
    1 - (bpe.embedding <=> $queryEmbedding) as similarity
  FROM blog_post_embeddings bpe
  JOIN blog_posts bp ON bp.id = bpe.blog_post_id
  WHERE
    1 - (bpe.embedding <=> $queryEmbedding) >= $minSimilarity
    AND ($contentTypes IS NULL OR bpe.content_type = ANY($contentTypes))
    AND ($excludePostIds IS NULL OR bp.id != ALL($excludePostIds))
    AND ($clusterTopicId IS NULL OR bp.cluster_topic_id = $clusterTopicId)
    AND ($minClicks IS NULL OR (bp.performance->>'clicks')::int >= $minClicks)
  ORDER BY similarity DESC
  LIMIT $limit
  */
}

// Weighted retrieval for generation exemplars
async function retrieveExemplars(
  topic: string,
  options: ExemplarQuery
): Promise<BlogPost[]> {

  // 1. Embed the topic
  topicEmbedding = await embedText(topic)

  // 2. Retrieve candidates (more than needed for filtering)
  candidates = await retrieveSimilarPosts(topicEmbedding, {
    limit: options.limit * 3,
    minSimilarity: 0.6,
    contentTypes: ['summary', 'full']
  })

  // 3. Score and rank by composite metric
  scored = candidates.map(c => ({
    ...c,
    compositeScore: calculateCompositeScore(c, {
      similarityWeight: 0.4,
      performanceWeight: 0.3,  // Clicks, impressions
      recencyWeight: 0.15,     // Prefer recent content
      completenessWeight: 0.15 // Prefer posts with all fields filled
    })
  }))

  // 4. Return top N by composite score
  return scored
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, options.limit)
}

function calculateCompositeScore(
  candidate: RetrievalResult,
  weights: ScoreWeights
): number {
  const similarity = candidate.similarity

  const performance = normalizePerformance({
    clicks: candidate.performance?.clicks ?? 0,
    impressions: candidate.performance?.impressions ?? 0,
    position: candidate.performance?.averagePosition ?? 100
  })

  const recency = normalizeRecency(candidate.publishedAt)

  const completeness = calculateCompleteness(candidate)

  return (
    similarity * weights.similarityWeight +
    performance * weights.performanceWeight +
    recency * weights.recencyWeight +
    completeness * weights.completenessWeight
  )
}
```

### Topical Cluster Tagging

```typescript
// Automatic cluster detection using embeddings
async function suggestCluster(post: BlogPost): Promise<string | null> {
  // Get embedding for the post
  embedding = await embedText(`${post.title} ${post.summary} ${post.primaryKeyword}`)

  // Find centroid of each existing cluster
  clusters = await db.query.topicClusters.findMany({
    with: { posts: { columns: { id: true } } }
  })

  for (cluster of clusters) {
    // Get average embedding of cluster posts
    clusterEmbeddings = await db.query.blogPostEmbeddings.findMany({
      where: and(
        inArray(blogPostId, cluster.posts.map(p => p.id)),
        eq(contentType, 'summary')
      )
    })

    centroid = averageEmbedding(clusterEmbeddings.map(e => e.embedding))
    cluster.centroidSimilarity = cosineSimilarity(embedding, centroid)
  }

  // Return best matching cluster if above threshold
  best = clusters.sort((a, b) => b.centroidSimilarity - a.centroidSimilarity)[0]

  if (best.centroidSimilarity >= 0.75) {
    return best.id
  }

  return null  // No strong cluster match, may be new topic
}

// Manual cluster assignment also supported via UI
```

### Performance-Biased Retrieval

```typescript
// When syncing performance data from Search Console
async function updatePostPerformance(
  slug: string,
  metrics: {
    clicks: number
    impressions: number
    averagePosition: number
    ctr: number
  }
): Promise<void> {
  await db.update(blogPosts)
    .set({
      performance: {
        ...existingPerformance,
        ...metrics,
        lastSyncedAt: new Date().toISOString()
      }
    })
    .where(eq(blogPosts.slug, slug))
}

// In retrieval, posts with higher performance are weighted more heavily
// This biases exemplar selection toward proven content
```

---

## Part 6: AI Integration Design

### Provider Abstraction

```typescript
// lib/ai/providers/types.ts

interface AIProvider {
  name: string

  // Text generation with structured output
  generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: GenerationOptions
  ): Promise<T>

  // Text generation without schema
  generateText(
    prompt: string,
    options: GenerationOptions
  ): Promise<string>

  // Streaming generation
  streamText(
    prompt: string,
    options: GenerationOptions
  ): AsyncIterable<string>
}

interface GenerationOptions {
  systemPrompt?: string
  temperature?: number        // Default 0.7 for creative, 0.3 for structured
  maxTokens?: number
  model?: string              // Override default model
}

// Implementation for each provider
// OpenAI: Use response_format with json_schema
// Anthropic: Use tool_use with schema as tool input
```

### Task 1: Topic and Cluster Suggestion

```typescript
// Input
TopicSuggestionInput {
  productLine: string           // e.g., "Industrial Cleaning Chemicals"
  targetAudience: string        // e.g., "Facility managers and maintenance teams"
  funnelStage: "awareness" | "consideration" | "decision" | "retention"
  existingTopics: string[]      // Topics we already cover (for deduplication)
  clusterContext?: {
    existingClusters: string[]
    preferNewCluster: boolean
  }
  count: number                 // How many suggestions to generate
}

// Output (JSON Schema enforced)
TopicSuggestionOutput {
  suggestions: Array<{
    topic: string               // Descriptive topic title
    primaryKeyword: string      // Main keyword to target
    searchIntent: SearchIntent
    estimatedSearchVolume: "high" | "medium" | "low"  // AI estimate
    clusterTopic: string        // Existing or suggested new cluster
    justification: string       // 2-3 sentences on why this helps users
    targetQuery: string         // Example search query
    competitiveAngle: string    // How we differentiate
  }>
}

// System prompt for topic suggestion
TOPIC_SUGGESTION_SYSTEM_PROMPT = `
You are a content strategist for an ecommerce company. Your job is to suggest
blog topics that help real users solve problems related to our products.

Guidelines:
1. Focus on user problems, not keyword stuffing
2. Each topic should have a clear question it answers
3. Prefer topics where we can demonstrate expertise and experience
4. Consider the buyer's journey stage
5. Avoid topics we already cover (provided in context)
6. Group related topics into clusters for topical authority
7. The justification must explain how this helps the user, not just SEO value

Output valid JSON matching the provided schema exactly.
`

// Example prompt construction
function buildTopicPrompt(input: TopicSuggestionInput): string {
  return `
Product line: ${input.productLine}
Target audience: ${input.targetAudience}
Funnel stage: ${input.funnelStage}
Topics we already cover (avoid duplicates):
${input.existingTopics.map(t => `- ${t}`).join('\n')}

Existing topic clusters:
${input.clusterContext?.existingClusters.map(c => `- ${c}`).join('\n') || 'None yet'}

Generate ${input.count} topic suggestions that would genuinely help our target
audience. Focus on practical problems they face and questions they actually ask.
`
}
```

### Task 2: Brief Creation

```typescript
// Input
BriefCreationInput {
  contentIdea: {
    topic: string
    primaryKeyword: string
    searchIntent: SearchIntent
    targetAudience: string
  }
  existingPosts: Array<{        // From retrieval
    title: string
    slug: string
    sections: Section[]
    heroAnswer: string
  }>
  internalLinkTargets: Array<{  // Available pages to link to
    url: string
    title: string
    type: LinkType
  }>
}

// Output (JSON Schema enforced)
BriefOutput {
  suggestedTitle: string
  suggestedSlug: string
  heroAnswerDraft: string       // 2-4 sentence direct answer

  outline: Array<{
    headingLevel: "h2" | "h3"
    headingText: string
    keyPoints: string[]         // Bullet points to cover
    estimatedWordCount: number
  }>

  keyQuestions: string[]        // Questions the article should answer

  suggestedInternalLinks: Array<{
    targetUrl: string
    suggestedAnchorText: string
    placement: string           // Which section to place the link
    reason: string              // Why this link adds value
  }>

  externalReferences: Array<{
    type: "standard" | "regulation" | "study" | "authority"
    description: string         // What kind of source to find
    reason: string              // Why this adds credibility
  }>

  faqSuggestions: Array<{
    question: string
    keyPointsForAnswer: string[]
  }>

  experiencePrompts: string[]   // Prompts for editor to add real examples
}

// System prompt
BRIEF_CREATION_SYSTEM_PROMPT = `
You are creating a detailed content brief for a blog post. The brief will guide
both AI draft generation and human editors.

Guidelines:
1. The outline should follow a logical flow that answers the main question quickly
2. Start with the direct answer (heroAnswer) - no fluffy introductions
3. Each section should have a clear purpose
4. Suggest internal links that genuinely help readers (not forced)
5. External references should boost credibility (standards, studies, authorities)
6. FAQ suggestions should target real questions people ask
7. Experience prompts should guide editors to add genuine first-hand examples

Reference the provided exemplar posts for style and structure guidance.
Output valid JSON matching the provided schema exactly.
`
```

### Task 3: Full Draft Generation

```typescript
// Input
DraftGenerationInput {
  brief: BriefOutput
  authorInfo: {
    name: string
    role: string
    credentials: string
  }
  exemplarPosts: BlogPost[]      // 3-5 high-performing similar posts
  organizationInfo: {
    name: string
    logoUrl: string
    websiteUrl: string
  }
}

// Output: Complete BlogPost matching canonical schema
// This is the FULL schema defined in Part 2

// System prompt
DRAFT_GENERATION_SYSTEM_PROMPT = `
You are writing a blog post for an ecommerce company's website. Your output must
be a single valid JSON object matching the canonical blog schema exactly.

CRITICAL REQUIREMENTS:

1. STRUCTURE:
   - heroAnswer: Direct, accurate answer in 2-4 sentences. No fluff.
   - sections: Each section has a heading and substantive body content
   - faq: At least 2 FAQs if the brief suggests them

2. STYLE (based on exemplar posts):
   - Match the tone and depth of the provided exemplar posts
   - Be specific and practical, not generic
   - Use concrete numbers, specifications, and examples where appropriate

3. E-E-A-T:
   - experienceEvidence.summary: Write a placeholder that prompts editors to add
     real first-hand experience (use [PLACEHOLDER] markers)
   - Reference the author's credentials naturally in the content
   - Include caveats and limitations where appropriate
   - Do not make claims you cannot support

4. SEO:
   - metaTitle: 50-60 characters, include primary keyword naturally
   - metaDescription: 130-160 characters, compelling and accurate
   - Use focus questions as headings where natural

5. INTERNAL LINKS:
   - Include the suggested internal links from the brief
   - Use natural anchor text, not keyword-stuffed

6. JSON-LD:
   - Generate valid Article/BlogPosting JSON-LD
   - If 2+ FAQs, generate FAQPage JSON-LD

7. CONTENT QUALITY:
   - Answer the main question immediately
   - Provide genuinely useful information
   - Avoid filler content and unnecessary repetition
   - Be helpful first, SEO-optimized second

OUTPUT: A single valid JSON object. No markdown wrapping. No explanatory text.
`

// Prompt construction
function buildDraftPrompt(input: DraftGenerationInput): string {
  return `
BRIEF:
Title: ${input.brief.suggestedTitle}
Slug: ${input.brief.suggestedSlug}
Hero Answer Draft: ${input.brief.heroAnswerDraft}

OUTLINE:
${input.brief.outline.map(o =>
  `${o.headingLevel}: ${o.headingText}\n  Key points: ${o.keyPoints.join(', ')}`
).join('\n')}

KEY QUESTIONS TO ANSWER:
${input.brief.keyQuestions.map(q => `- ${q}`).join('\n')}

SUGGESTED INTERNAL LINKS:
${input.brief.suggestedInternalLinks.map(l =>
  `- ${l.targetUrl} (anchor: "${l.suggestedAnchorText}") in ${l.placement}`
).join('\n')}

FAQ SUGGESTIONS:
${input.brief.faqSuggestions.map(f =>
  `Q: ${f.question}\nPoints: ${f.keyPointsForAnswer.join(', ')}`
).join('\n\n')}

EXPERIENCE PROMPTS (include as placeholders for editors):
${input.brief.experiencePrompts.map(p => `- ${p}`).join('\n')}

AUTHOR INFORMATION:
Name: ${input.authorInfo.name}
Role: ${input.authorInfo.role}
Credentials: ${input.authorInfo.credentials}

ORGANIZATION:
Name: ${input.organizationInfo.name}
Website: ${input.organizationInfo.websiteUrl}
Logo: ${input.organizationInfo.logoUrl}

---

EXEMPLAR POSTS (use these as style and structure references):

${input.exemplarPosts.map((p, i) => `
=== EXEMPLAR ${i + 1}: ${p.title} ===
Hero Answer: ${p.heroAnswer}

Sections:
${p.sections.map(s => `${s.headingLevel}: ${s.headingText}`).join('\n')}

Primary Keyword: ${p.primaryKeyword}
Word Count: ${p.wordCount}
`).join('\n')}

---

Generate the complete blog post as a single JSON object matching the canonical schema.
Include all required fields. Use [PLACEHOLDER_DESCRIPTION] markers where editors
need to add specific real-world examples or data.
`
}
```

### Task 4: Revision and Optimization

```typescript
// Input
RevisionInput {
  post: BlogPost
  revisionType: "expand_section" | "add_faq" | "update_links" | "refresh_content"
  context?: {
    sectionToExpand?: string    // Section heading to expand
    newFaqTopics?: string[]     // Topics for new FAQs
    newLinkTargets?: InternalLink[]  // New pages to link to
    performanceData?: {         // Insights from Search Console
      lowCtrSections?: string[]
      highEngagementSections?: string[]
      missingKeywords?: string[]
    }
  }
}

// Output: Updated sections of the post, not full regeneration
RevisionOutput {
  updatedFields: {
    sections?: Section[]
    faq?: FAQ[]
    internalLinks?: InternalLink[]
    metaTitle?: string
    metaDescription?: string
  }
  changeLog: string[]           // What was changed and why
}

// System prompt
REVISION_SYSTEM_PROMPT = `
You are revising an existing blog post to improve it. Do not regenerate the
entire post - only update the specific fields requested.

Guidelines:
1. Preserve the existing voice and style
2. Make surgical improvements, not wholesale rewrites
3. Document what you changed and why
4. If expanding a section, maintain coherence with surrounding content
5. New FAQs should not duplicate existing content
6. New internal links should be genuinely useful

Output valid JSON with only the updated fields and a change log.
`
```

### Structured Output Enforcement

```typescript
// Using Zod for runtime validation and JSON Schema generation

// 1. Define Zod schema
const DraftOutputSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(10).max(100),
  summary: z.string().min(50).max(300),
  heroAnswer: z.string().min(100).max(500),
  sections: z.array(z.object({
    id: z.string().uuid(),
    headingText: z.string().min(5).max(150),
    headingLevel: z.enum(['h2', 'h3']),
    body: z.string().min(100),
    wordCount: z.number()
  })).min(2),
  // ... all other fields
})

// 2. Generate JSON Schema for AI
const jsonSchema = zodToJsonSchema(DraftOutputSchema)

// 3. In OpenAI call
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'blog_post',
      schema: jsonSchema,
      strict: true
    }
  }
})

// 4. Validate response
const parsed = DraftOutputSchema.safeParse(JSON.parse(response.choices[0].message.content))
if (!parsed.success) {
  // Log validation errors, potentially retry
  throw new ValidationError(parsed.error)
}

return parsed.data
```

### Safety and Human Review

```typescript
// All AI outputs are marked and require human review

interface AIGeneratedContent {
  content: BlogPost | BriefOutput | TopicSuggestionOutput
  metadata: {
    generatedAt: string
    model: string
    promptVersion: string
    status: 'pending_review' | 'approved' | 'rejected'
    reviewedBy?: string
    reviewedAt?: string
  }
}

// Content cannot be published without review
async function publishPost(postId: string, reviewerId: string): Promise<void> {
  const post = await db.query.blogPosts.findFirst({ where: eq(id, postId) })

  if (post.aiAssisted && post.status !== 'approved') {
    throw new Error('AI-assisted posts must be reviewed before publishing')
  }

  // Audit log
  await db.insert(auditLogs).values({
    action: 'publish',
    postId,
    reviewerId,
    timestamp: new Date()
  })

  // Proceed with publishing
}
```

---

## Part 7: SEO, E-E-A-T, and AI Content Constraints

### Validation Rules and Checks

```typescript
// lib/seo/validators.ts

interface ValidationResult {
  field: string
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

interface PostValidationReport {
  isValid: boolean
  errors: ValidationResult[]
  warnings: ValidationResult[]
  score: {
    seoScore: number        // 0-100
    eeatScore: number       // 0-100
    structureScore: number  // 0-100
    overall: number         // 0-100
  }
}

// Main validation function
function validatePost(post: BlogPost): PostValidationReport {
  const results: ValidationResult[] = []

  // === STRUCTURE CHECKS ===

  // Title length
  if (post.title.length < 10) {
    results.push({
      field: 'title',
      severity: 'error',
      message: 'Title is too short (min 10 characters)',
      suggestion: 'Write a more descriptive title that includes your main topic'
    })
  }
  if (post.title.length > 100) {
    results.push({
      field: 'title',
      severity: 'warning',
      message: 'Title may be too long (over 100 characters)'
    })
  }

  // Hero answer
  if (post.heroAnswer.length < 100) {
    results.push({
      field: 'heroAnswer',
      severity: 'error',
      message: 'Hero answer is too short - readers need a clear answer upfront',
      suggestion: 'Provide a 2-4 sentence direct answer to the main question'
    })
  }
  if (!containsAnswerSignals(post.heroAnswer)) {
    results.push({
      field: 'heroAnswer',
      severity: 'warning',
      message: 'Hero answer may not directly answer the main question',
      suggestion: 'Start with phrases like "The answer is...", "You should...", or directly state the key information'
    })
  }

  // Sections
  if (post.sections.length < 2) {
    results.push({
      field: 'sections',
      severity: 'error',
      message: 'Post needs at least 2 content sections'
    })
  }

  post.sections.forEach((section, i) => {
    if (section.body.length < 100) {
      results.push({
        field: `sections[${i}]`,
        severity: 'warning',
        message: `Section "${section.headingText}" is thin on content`,
        suggestion: 'Add more substantive information or merge with another section'
      })
    }
    if (!isQuestionOrActionOriented(section.headingText)) {
      results.push({
        field: `sections[${i}].headingText`,
        severity: 'info',
        message: `Consider making heading "${section.headingText}" more question-oriented`,
        suggestion: 'Question-based headings can improve featured snippet eligibility'
      })
    }
  })

  // === SEO CHECKS ===

  // Meta title
  if (post.metaTitle.length < 50) {
    results.push({
      field: 'metaTitle',
      severity: 'warning',
      message: `Meta title is short (${post.metaTitle.length} chars, aim for 50-60)`
    })
  }
  if (post.metaTitle.length > 60) {
    results.push({
      field: 'metaTitle',
      severity: 'warning',
      message: `Meta title may truncate in search results (${post.metaTitle.length} chars)`
    })
  }
  if (!post.metaTitle.toLowerCase().includes(post.primaryKeyword.toLowerCase())) {
    results.push({
      field: 'metaTitle',
      severity: 'warning',
      message: 'Primary keyword not found in meta title'
    })
  }

  // Meta description
  if (post.metaDescription.length < 130) {
    results.push({
      field: 'metaDescription',
      severity: 'warning',
      message: `Meta description is short (${post.metaDescription.length} chars, aim for 130-160)`
    })
  }
  if (post.metaDescription.length > 160) {
    results.push({
      field: 'metaDescription',
      severity: 'warning',
      message: `Meta description may truncate (${post.metaDescription.length} chars)`
    })
  }

  // Internal links
  if (post.internalLinks.length < 3) {
    results.push({
      field: 'internalLinks',
      severity: 'warning',
      message: 'Post has few internal links (recommend 3-15)',
      suggestion: 'Add links to related products, categories, or blog posts'
    })
  }
  if (post.internalLinks.length > 15) {
    results.push({
      field: 'internalLinks',
      severity: 'info',
      message: 'Post has many internal links - ensure they are all relevant'
    })
  }

  // FAQ for schema markup
  if (post.faq.length >= 2 && !post.ldJsonFaqPage) {
    results.push({
      field: 'ldJsonFaqPage',
      severity: 'error',
      message: 'Post has FAQs but missing FAQPage JSON-LD',
      suggestion: 'Generate FAQPage structured data for rich results'
    })
  }

  // === E-E-A-T CHECKS ===

  // Author
  if (!post.author.name) {
    results.push({
      field: 'author',
      severity: 'error',
      message: 'Post must have an author for E-E-A-T'
    })
  }
  if (!post.author.credentials || post.author.credentials.length < 10) {
    results.push({
      field: 'author.credentials',
      severity: 'warning',
      message: 'Author credentials are missing or too brief',
      suggestion: 'Add specific credentials like years of experience, certifications, or role details'
    })
  }

  // Experience evidence
  if (!post.experienceEvidence.summary) {
    results.push({
      field: 'experienceEvidence',
      severity: 'error',
      message: 'Post missing experience evidence - required for E-E-A-T',
      suggestion: 'Add a section showing first-hand experience with the topic'
    })
  }
  if (post.experienceEvidence.placeholders?.length > 0) {
    results.push({
      field: 'experienceEvidence',
      severity: 'warning',
      message: `Experience section has ${post.experienceEvidence.placeholders.length} unfilled placeholders`,
      suggestion: 'Replace placeholders with real examples before publishing'
    })
  }

  // Reviewer for sensitive topics
  if (isSensitiveTopic(post) && !post.reviewedBy) {
    results.push({
      field: 'reviewedBy',
      severity: 'warning',
      message: 'Consider adding expert reviewer for this topic type',
      suggestion: 'YMYL and safety topics benefit from documented expert review'
    })
  }

  // === CONTENT QUALITY CHECKS ===

  // Word count
  if (post.wordCount < 500) {
    results.push({
      field: 'wordCount',
      severity: 'warning',
      message: `Post is thin (${post.wordCount} words)`,
      suggestion: 'Consider adding more depth or merging with related content'
    })
  }

  // Placeholder check
  const placeholderMatches = JSON.stringify(post).match(/\[PLACEHOLDER[^\]]*\]/g)
  if (placeholderMatches) {
    results.push({
      field: 'content',
      severity: 'error',
      message: `Post contains ${placeholderMatches.length} unfilled placeholder(s)`,
      suggestion: 'Replace all [PLACEHOLDER] markers with real content before publishing'
    })
  }

  // === JSON-LD CHECKS ===

  if (!post.ldJsonArticle) {
    results.push({
      field: 'ldJsonArticle',
      severity: 'error',
      message: 'Missing Article JSON-LD structured data'
    })
  } else {
    if (!post.ldJsonArticle.datePublished && post.status === 'published') {
      results.push({
        field: 'ldJsonArticle.datePublished',
        severity: 'warning',
        message: 'Published post missing datePublished in JSON-LD'
      })
    }
  }

  // Calculate scores
  const errors = results.filter(r => r.severity === 'error')
  const warnings = results.filter(r => r.severity === 'warning')

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: calculateScores(post, results)
  }
}

// Helper functions
function containsAnswerSignals(text: string): boolean {
  const signals = [
    /^(the|a|an) /i,
    /you (should|can|need|must)/i,
    /is (a|the|an)/i,
    /are (typically|usually|generally)/i,
    /^\d+/,  // Starts with number
  ]
  return signals.some(s => s.test(text.trim()))
}

function isQuestionOrActionOriented(heading: string): boolean {
  return (
    heading.endsWith('?') ||
    /^(how|what|why|when|where|which|who)/i.test(heading) ||
    /^(understanding|choosing|selecting|comparing)/i.test(heading)
  )
}

function isSensitiveTopic(post: BlogPost): boolean {
  const ymylKeywords = [
    'safety', 'health', 'medical', 'chemical', 'hazardous',
    'toxic', 'dangerous', 'flammable', 'corrosive', 'legal',
    'compliance', 'regulation', 'OSHA', 'EPA', 'FDA'
  ]
  const fullText = `${post.title} ${post.primaryKeyword} ${post.heroAnswer}`
  return ymylKeywords.some(kw => fullText.toLowerCase().includes(kw))
}
```

### E-E-A-T Content Guidelines (Enforced in Prompts)

```typescript
// lib/ai/prompts/eeat-guidelines.ts

const EEAT_GUIDELINES = `
## E-E-A-T Content Requirements

### Experience (First-Hand Knowledge)
Every post MUST include at least one element demonstrating real experience:
- Specific examples from actual use cases
- Process details that only someone who has done it would know
- Quantitative data from real implementations
- Photos or descriptions of actual products/processes (placeholder for editor)

Format: Use the experienceEvidence field with either real content or clear
[PLACEHOLDER_EXAMPLE_TYPE] markers for editors.

Bad: "Many customers find this product useful"
Good: "In our warehouse facility, we tested three concentrations and found
      [PLACEHOLDER_SPECIFIC_CONCENTRATION] worked best for [PLACEHOLDER_USE_CASE]"

### Expertise
- Author must have relevant credentials displayed
- Content should demonstrate subject matter knowledge
- Use correct terminology for the industry
- Reference relevant standards, regulations, or best practices
- Avoid oversimplification that loses accuracy

### Authoritativeness
- Link to authoritative sources (regulations, studies, standards bodies)
- Reference the organization's experience and track record where relevant
- Cross-link to other authoritative content on your site
- Be specific about claims (numbers, dates, sources)

### Trust
- Include appropriate caveats and limitations
- Don't make claims you can't support
- Be transparent about when content is AI-assisted
- Disclose commercial relationships where relevant
- Provide contact information and ways to verify claims

### Red Flags to Avoid
- Generic content that could be about any company
- Superlatives without evidence ("best", "leading", "top")
- Health/safety claims without proper disclaimers
- Missing author or credentials
- No evidence of actual experience with the topic
`

const HELPFUL_CONTENT_GUIDELINES = `
## Google Helpful Content Guidelines

### People-First Questions (Answer YES to all)
1. Does this content provide original information, analysis, or insight?
2. Does it thoroughly cover the topic, not just skim the surface?
3. Does it provide substantial value compared to other search results?
4. Does it demonstrate first-hand expertise and depth of knowledge?

### Search-First Questions (Answer NO to all)
1. Is this content primarily made for search engines?
2. Are you producing lots of content on many topics hoping some will rank?
3. Are you using automation without adding value?
4. Are you just summarizing what others say without adding perspective?

### Content Quality Signals
- Clear main point/answer stated early
- Substantive depth on the specific topic
- Unique perspective or information
- Well-organized with clear headings
- Written by someone with evident expertise
- No deceptive or manipulative tactics
`
```

### AI Content Disclosure

```typescript
// Metadata tracked for AI-assisted content

interface AIContentMetadata {
  isAiAssisted: boolean
  aiModel: string | null
  aiGenerationDate: string | null
  humanEditedAfter: boolean
  humanEditor: string | null
  lastHumanEditDate: string | null

  // For internal governance
  promptVersion: string | null
  generationId: string | null  // For audit trail
}

// Not externally disclosed, but tracked for:
// 1. Internal quality monitoring
// 2. Identifying patterns in AI vs human content performance
// 3. Audit trail if Google updates AI content guidelines
// 4. Training data for improving prompts

// Current Google guidance (as of 2024):
// - AI-generated content is allowed if it's helpful
// - No requirement to disclose AI use
// - Focus on quality and value, not production method
// - Spam policies still apply (no mass low-quality content)
```

### JSON-LD Generation

```typescript
// lib/seo/jsonld.ts

function generateArticleJsonLd(post: BlogPost, org: Organization): ArticleJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",  // or "BlogPosting"
    "headline": post.title,
    "description": post.summary,
    "image": post.heroImage || org.defaultImage,
    "author": {
      "@type": "Person",
      "name": post.author.name,
      "url": post.author.profileUrl,
      "jobTitle": post.author.role,
      "description": post.author.credentials
    },
    "publisher": {
      "@type": "Organization",
      "name": org.name,
      "logo": {
        "@type": "ImageObject",
        "url": org.logoUrl
      }
    },
    "datePublished": post.publishedAt,
    "dateModified": post.updatedAt,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": post.canonicalUrl
    },
    "keywords": [post.primaryKeyword, ...post.secondaryKeywords].join(', ')
  }
}

function generateFaqPageJsonLd(post: BlogPost): FaqPageJsonLd | null {
  if (post.faq.length < 2) return null

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": post.faq.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
}
```

---

## Part 8: Application Structure and APIs

### Project Directory Structure (Current Implementation)

```
alliance-blog/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── admin/                    # Admin dashboard
│   │   │   ├── layout.tsx            # Admin layout with nav
│   │   │   ├── page.tsx              # Dashboard overview
│   │   │   ├── posts/
│   │   │   │   ├── page.tsx          # All posts list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Post editor
│   │   │   ├── ideas/
│   │   │   │   ├── page.tsx          # Content ideas list
│   │   │   │   └── generate/
│   │   │   │       └── page.tsx      # Generate new ideas
│   │   │   ├── authors/
│   │   │   │   ├── page.tsx          # Author management
│   │   │   │   └── new/
│   │   │   │       └── page.tsx      # Create new author
│   │   │   ├── clusters/
│   │   │   │   └── page.tsx          # Topic cluster management
│   │   │   └── import/
│   │   │       └── page.tsx          # Content import management
│   │   │
│   │   ├── api/                      # API routes
│   │   │   ├── import/
│   │   │   │   ├── shopify/
│   │   │   │   │   └── route.ts      # POST: Start Shopify import
│   │   │   │   ├── sitemap/
│   │   │   │   │   └── route.ts      # POST: Start sitemap crawl
│   │   │   │   └── urls/
│   │   │   │       └── route.ts      # POST: Import from URLs
│   │   │   ├── posts/
│   │   │   │   ├── route.ts          # GET: List, POST: Create
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # GET, PATCH, DELETE
│   │   │   │       ├── publish/
│   │   │   │       │   └── route.ts  # POST: Publish post
│   │   │   │       └── validate/
│   │   │   │           └── route.ts  # GET: Validate post
│   │   │   ├── ideas/
│   │   │   │   ├── route.ts          # GET: List, POST: Create
│   │   │   │   ├── generate/
│   │   │   │   │   └── route.ts      # POST: AI topic generation
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # GET, PATCH, DELETE
│   │   │   │       └── brief/
│   │   │   │           └── route.ts  # POST: Generate brief
│   │   │   ├── drafts/
│   │   │   │   └── route.ts          # POST: Generate draft
│   │   │   ├── embeddings/
│   │   │   │   ├── route.ts          # POST: Compute embeddings
│   │   │   │   └── search/
│   │   │   │       └── route.ts      # POST: Vector search
│   │   │   ├── authors/
│   │   │   │   ├── route.ts          # GET, POST
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # GET, PATCH, DELETE
│   │   │   └── clusters/
│   │   │       ├── route.ts          # GET, POST
│   │   │       └── [id]/
│   │   │           └── route.ts      # GET, PATCH, DELETE
│   │   │
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home page
│   │   └── globals.css
│   │
│   └── lib/                          # Core business logic (see Module Dependency Graph)
│
├── scripts/                          # CLI scripts for automation
│   ├── analyze-style.ts              # Analyze content style
│   ├── create-author.ts              # Create author records
│   ├── discover-topics.ts            # Topic discovery pipeline
│   ├── generate-article.ts           # Full article generation
│   ├── generate-outline.ts           # Outline generation
│   ├── import-shopify.ts             # Shopify import
│   ├── index-content.ts              # Content indexing
│   └── test-style-analyzer.ts        # Style analyzer tests
│
├── drizzle/                          # Database migrations
│   └── migrations/
│       └── *.sql
│
├── generated-articles/               # Output directory for generated content
├── outlines/                         # Generated article outlines
├── data/                             # Data files (content index, etc.)
└── docs/                             # Documentation
    ├── ARCHITECTURE.md               # This file
    └── BLOG_STYLE_GUIDE.md           # Content style guide
```

### Components (Planned)

Components are currently inline in page files. Future extraction:

```
src/components/                       # React components (to be extracted)
├── admin/
│   ├── PostEditor.tsx                # Main post editing interface
│   ├── MetadataPanel.tsx             # SEO metadata sidebar
│   ├── ValidationPanel.tsx           # Real-time validation display
│   └── StatusBadge.tsx               # Post status indicator
├── blog/
│   ├── PostCard.tsx                  # Blog listing card
│   ├── PostContent.tsx               # Rendered post content
│   └── AuthorBio.tsx                 # Author info display
└── ui/                               # Shared UI components
    └── ... (design system)
```

### Lib Directory Structure (Current)

```
src/lib/
├── schema/
│   ├── canonical.ts                  # TypeScript types
│   ├── canonical.zod.ts              # Zod schemas
│   └── intermediate.ts               # Import IR types
├── config/
│   ├── env.ts                        # Environment variables
│   └── constants.ts                  # App constants
├── db/
│   ├── client.ts                     # Drizzle client
│   └── schema.ts                     # Drizzle table definitions
├── import/
│   ├── fetchers/
│   │   ├── shopify.ts                # Shopify API fetcher
│   │   └── http.ts                   # HTTP fetcher with sitemap
│   ├── parsers/
│   │   └── html.ts                   # HTML parser
│   ├── normalizer.ts                 # Schema normalizer
│   └── pipeline.ts                   # Import orchestrator
├── ai/
│   ├── providers/
│   │   ├── index.ts                  # Provider exports
│   │   ├── openai.ts                 # OpenAI client
│   │   ├── anthropic.ts              # Anthropic client
│   │   └── types.ts                  # Provider types
│   ├── analysis/
│   │   └── style-analyzer.ts         # Style analysis
│   ├── embeddings.ts                 # Embedding generation
│   ├── retrieval.ts                  # Vector search
│   ├── generation/
│   │   ├── topics.ts                 # Topic generation
│   │   ├── drafts.ts                 # Draft generation
│   │   └── style-aware-prompts.ts    # Style-guided prompts
│   └── prompts/
│       └── system.ts                 # System prompts
├── discovery/
│   ├── index.ts                      # Discovery exports
│   ├── topic-finder.ts               # Topic discovery
│   ├── topic-scorer.ts               # Topic scoring
│   └── existing-content.ts           # Content analysis
├── outline/
│   ├── index.ts                      # Outline exports
│   ├── outline-generator.ts          # Outline generation
│   └── outline-types.ts              # Outline types
├── shopify/
│   ├── index.ts                      # Shopify exports
│   ├── api-client.ts                 # Shopify Admin API
│   ├── article-generator.ts          # Article generation
│   ├── article-validator.ts          # Article validation
│   ├── content-types.ts              # Content types
│   ├── format-rules.ts               # Formatting rules
│   └── product-matcher.ts            # Product matching
└── seo/
    ├── validators.ts                 # SEO validation
    └── jsonld.ts                     # JSON-LD generation
```

### API Route Specifications

#### Import APIs

```typescript
// POST /api/import/shopify
// Start Shopify import job
Request {
  blogHandle?: string       // Specific blog, or all if omitted
  limit?: number            // Max posts to import
  forceRefresh?: boolean    // Reimport even if exists
}
Response {
  jobId: string
  status: 'started'
  estimatedPosts: number
}

// POST /api/import/sitemap
// Start sitemap crawl
Request {
  sitemapUrl: string
  urlPattern?: string       // Regex to filter URLs
  limit?: number
}
Response {
  jobId: string
  status: 'started'
  discoveredUrls: number
}

// GET /api/import/status/[jobId]
// Check import job status
Response {
  jobId: string
  status: 'running' | 'completed' | 'failed'
  progress: {
    total: number
    processed: number
    succeeded: number
    failed: number
  }
  errors?: Array<{ url: string, error: string }>
  completedAt?: string
}
```

#### Posts APIs

```typescript
// GET /api/posts
Query {
  status?: PostStatus
  clusterId?: string
  authorId?: string
  search?: string
  page?: number
  limit?: number
}
Response {
  posts: BlogPost[]
  pagination: { page: number, total: number, hasMore: boolean }
}

// POST /api/posts
// Create new post
Request: Partial<BlogPost>
Response: BlogPost

// GET /api/posts/[id]
Response: BlogPost

// PATCH /api/posts/[id]
// Update post
Request: Partial<BlogPost>
Response: BlogPost

// DELETE /api/posts/[id]
Response: { success: boolean }

// POST /api/posts/[id]/publish
Request {
  publishTo: 'database' | 'shopify' | 'both'
  scheduledFor?: string     // ISO date for scheduled publish
}
Response {
  success: boolean
  publishedAt: string
  shopifyArticleId?: string
}

// GET /api/posts/[id]/validate
Response: PostValidationReport
```

#### Ideas APIs

```typescript
// POST /api/ideas/generate
// Generate topic suggestions using AI
Request {
  productLine: string
  targetAudience: string
  funnelStage: string
  count: number
}
Response {
  suggestions: TopicSuggestionOutput['suggestions']
  generationId: string
}

// POST /api/ideas/[id]/brief
// Generate brief for an idea
Request {
  includeExemplars?: boolean
  exemplarCount?: number
}
Response: BriefOutput
```

#### Drafts APIs

```typescript
// POST /api/drafts/generate
// Generate full draft from brief
Request {
  ideaId: string
  briefOverrides?: Partial<BriefOutput>
  authorId: string
  exemplarPostIds?: string[]  // Specific posts to use as examples
}
Response: {
  draft: BlogPost
  generationId: string
  validationReport: PostValidationReport
}
// Supports streaming via Accept: text/event-stream

// POST /api/drafts/[id]/revise
// Revise specific aspect of draft
Request {
  revisionType: 'expand_section' | 'add_faq' | 'update_links' | 'refresh_content'
  context: RevisionInput['context']
}
Response: RevisionOutput
```

#### Embeddings APIs

```typescript
// POST /api/embeddings/compute
// Compute embeddings for a post
Request {
  postId: string
  force?: boolean           // Recompute even if exists
}
Response {
  chunks: number
  model: string
}

// POST /api/embeddings/search
// Vector similarity search
Request {
  query: string
  limit?: number
  minSimilarity?: number
  filters?: {
    contentTypes?: string[]
    clusterTopicId?: string
    excludePostIds?: string[]
  }
}
Response {
  results: Array<{
    postId: string
    title: string
    slug: string
    similarity: number
    matchedChunk: string
    contentType: string
  }>
}
```

### Server Actions (Alternative to API Routes)

```typescript
// lib/actions/posts.ts
'use server'

import { db } from '@/lib/db/client'
import { blogPosts } from '@/lib/db/schema'
import { BlogPostSchema } from '@/lib/schema/canonical.zod'
import { revalidatePath } from 'next/cache'

export async function createPost(data: unknown) {
  const parsed = BlogPostSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const post = await db.insert(blogPosts).values(parsed.data).returning()
  revalidatePath('/admin/posts')
  return { post: post[0] }
}

export async function updatePost(id: string, data: unknown) {
  // ... validation and update
}

export async function publishPost(id: string, options: PublishOptions) {
  // ... publish logic
}
```

### Admin Dashboard Pages

#### Posts List Page (`/admin/posts`)

```
┌──────────────────────────────────────────────────────────────────┐
│ Posts                                              [Import] [New]│
├──────────────────────────────────────────────────────────────────┤
│ Filter: [Status ▼] [Cluster ▼] [Author ▼]    Search: [________] │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ □ How to Clean Industrial Equipment     Published  2024-01  │ │
│ │   /blog/clean-industrial-equipment      ✓ Valid    1.2k     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ □ Choosing the Right Solvent            Draft      2024-01  │ │
│ │   /blog/choosing-solvent                ⚠ 3 warnings        │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

Features:
- Filter by status, cluster, author
- Full-text search
- Bulk actions (publish, archive, delete)
- Quick validation status indicator
- Performance metrics preview

#### Post Editor Page (`/admin/posts/[id]`)

```
┌────────────────────────────────────────┬─────────────────────────┐
│ [← Back]  Edit Post    [Preview] [Save]│  Metadata               │
├────────────────────────────────────────┼─────────────────────────┤
│                                        │  Status: [Draft ▼]      │
│ Title:                                 │                         │
│ [How to Clean Industrial Equipment   ] │  Primary Keyword:       │
│                                        │  [industrial cleaning]  │
│ Slug:                                  │                         │
│ [clean-industrial-equipment          ] │  Search Intent:         │
│                                        │  [Informational ▼]      │
│ ─────────────────────────────────────  │                         │
│                                        │  Meta Title (52 chars): │
│ Hero Answer:                           │  [How to Clean...]      │
│ ┌────────────────────────────────────┐ │                         │
│ │ The most effective way to clean    │ │  Meta Desc (145 chars): │
│ │ industrial equipment is...         │ │  [Learn the best...]    │
│ └────────────────────────────────────┘ │                         │
│                                        │  ───────────────────    │
│ ─────────────────────────────────────  │                         │
│                                        │  Author:                │
│ Sections:                              │  [John Smith ▼]         │
│ ┌────────────────────────────────────┐ │                         │
│ │ H2: Why Proper Cleaning Matters    │ │  Reviewer:              │
│ │ [Rich text editor..................│ │  [None ▼]               │
│ │ ..................................│ │                         │
│ └────────────────────────────────────┘ │  ───────────────────    │
│ [+ Add Section]                        │                         │
│                                        │  Cluster:               │
│ ─────────────────────────────────────  │  [Cleaning Guide ▼]     │
│                                        │                         │
│ FAQs:                                  │  ───────────────────    │
│ ┌────────────────────────────────────┐ │                         │
│ │ Q: How often should I clean?       │ │  Validation:            │
│ │ A: Industrial equipment should...  │ │  ✓ Title                │
│ └────────────────────────────────────┘ │  ✓ Hero Answer          │
│ [+ Add FAQ]                            │  ⚠ Experience (has      │
│                                        │     placeholders)       │
│ ─────────────────────────────────────  │  ✓ Author               │
│                                        │  ✓ JSON-LD              │
│ Experience Evidence:                   │                         │
│ ┌────────────────────────────────────┐ │  [AI Assist ▼]          │
│ │ Summary: In our experience...      │ │  • Regenerate section   │
│ │ [PLACEHOLDER_SPECIFIC_CASE]        │ │  • Add FAQs             │
│ └────────────────────────────────────┘ │  • Suggest links        │
│                                        │                         │
│ ─────────────────────────────────────  │  [Publish ▼]            │
│                                        │  • Save Draft           │
│ Internal Links:                        │  • Schedule             │
│ • /products/cleaner-a - "our cleaner"  │  • Publish Now          │
│ • /blog/safety-tips - "safety guide"   │  • Publish to Shopify   │
│ [+ Add Link]                           │                         │
└────────────────────────────────────────┴─────────────────────────┘
```

Features:
- Real-time validation in sidebar
- Rich text editing for body content
- Drag-and-drop section reordering
- AI assistance panel for regenerating sections
- Internal link picker with search
- Preview mode
- Autosave

#### Ideas Page (`/admin/ideas`)

```
┌──────────────────────────────────────────────────────────────────┐
│ Content Ideas                                    [Generate New]  │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Best Practices for Chemical Storage          Idea            │ │
│ │ Keyword: chemical storage safety                             │ │
│ │ Intent: Informational | Cluster: Safety Guides               │ │
│ │ "Facility managers need clear guidance..."                   │ │
│ │                                  [Create Brief] [Reject]     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

#### Generate Ideas Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ Generate Topic Ideas                                       [X]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Product Line:                                                    │
│ [Industrial Cleaning Chemicals                              ▼]   │
│                                                                  │
│ Target Audience:                                                 │
│ [Facility managers and maintenance professionals            ]    │
│                                                                  │
│ Funnel Stage:                                                    │
│ ○ Awareness  ○ Consideration  ○ Decision  ○ Retention           │
│                                                                  │
│ Number of suggestions: [5]                                       │
│                                                                  │
│ [Generate Ideas]                                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 9: Implementation Roadmap and Checklist

### Phase 1: Project Setup and Infrastructure ✅

#### 1.1 Initialize Next.js Project
- [x] Create Next.js 14+ project with App Router
- [x] Configure TypeScript strict mode in `tsconfig.json`
- [x] Set up path aliases (`@/lib`, `@/components`, etc.)
- [x] Install core dependencies (drizzle-orm, zod, openai, anthropic, cheerio)

#### 1.2 Environment Configuration
- [x] Create `.env.local` with required variables
- [x] Create `lib/config/env.ts` with typed environment access
- [x] Create `lib/config/constants.ts` with app constants

#### 1.3 Database Setup
- [x] Set up PostgreSQL database
- [x] Enable pgvector extension
- [x] Configure Drizzle in `drizzle.config.ts`
- [x] Create database client in `lib/db/client.ts`

### Phase 2: Schema and Database Implementation ✅

#### 2.1 TypeScript Types
- [x] Create `lib/schema/canonical.ts`:
  - Define `PostStatus`, `SearchIntent`, `LinkType`, `HeadingLevel` enums
  - Define `Author`, `Reviewer`, `Section`, `FAQ`, `InternalLink` types
  - Define `ExperienceEvidence`, `ArticleJsonLd`, `FaqPageJsonLd` types
  - Define main `BlogPost` type
  - Define `ContentIdea`, `TopicCluster` types

#### 2.2 Zod Validation Schemas
- [x] Create `lib/schema/canonical.zod.ts`:
  - Create Zod schemas matching each TypeScript type
  - Add all validation constraints (min/max length, patterns)
  - Export validation functions
  - Add custom error messages

#### 2.3 JSON Schema for AI
- [ ] ~~Create `lib/schema/canonical.json-schema.ts`~~ (deferred - using Zod directly with AI providers)

#### 2.4 Drizzle Tables
- [x] Create `lib/db/schema.ts`:
  - Define `authors` table
  - Define `topicClusters` table
  - Define `blogPosts` table with all columns
  - Define `blogPostEmbeddings` table with vector column
  - Define `contentIdeas` table
  - Define `importLogs` table
  - Set up relations between tables

#### 2.5 Migrations
- [x] Generate initial migration
- [x] Review generated SQL
- [x] Run migration
- [x] Create pgvector index for embeddings

#### 2.6 Query Helpers
- [ ] ~~Create separate query helper files~~ (deferred - queries inline in API routes for now)

### Phase 3: Import Pipeline ✅

#### 3.1 Intermediate Representation
- [x] Create `lib/schema/intermediate.ts`:
  - Define `IntermediatePost` type
  - Define shopify-specific fields

#### 3.2 Fetchers
- [x] Create `lib/import/fetchers/shopify.ts`:
  - Shopify API fetcher
  - Rate limiting and error handling
- [x] Create `lib/import/fetchers/http.ts`:
  - Generic HTTP fetcher with retry
  - Concurrent request limiting
  - Sitemap parsing included

#### 3.3 Parsers
- [x] Create `lib/import/parsers/html.ts`:
  - Use cheerio to parse HTML
  - Extract `<title>`, meta tags, canonical
  - Extract headings with hierarchy
  - Extract paragraphs grouped by heading
  - Extract lists and tables
  - Extract internal/external links
  - Detect content area (article, main)
  - JSON-LD extraction included

#### 3.4 Normalizer
- [x] Create `lib/import/normalizer.ts`:
  - `normalizeToCanonical(ir: IntermediatePost): Partial<BlogPost>`
  - Map fields with defaults
  - Generate sections from heading groups
  - Extract FAQs from content
  - Flag missing required fields
  - Calculate word count, reading time

#### 3.5 Pipeline Orchestrator
- [x] Create `lib/import/pipeline.ts`:
  - `runShopifyImport(options)` - full pipeline
  - `runSitemapImport(options)` - full pipeline
  - Transaction handling
  - Progress tracking
  - Error logging
  - Idempotent upsert logic

#### 3.6 Analyzer
- [ ] ~~Create `lib/import/analyzer.ts`~~ (moved to discovery module)

### Phase 4: AI Integration ✅

#### 4.1 Provider Setup
- [x] Create `lib/ai/providers/types.ts`:
  - Define `AIProvider` interface
  - Define `GenerationOptions` type
- [x] Create `lib/ai/providers/openai.ts`:
  - OpenAI client wrapper
  - Structured output support
  - Error handling and retries
- [x] Create `lib/ai/providers/anthropic.ts`:
  - Anthropic client wrapper
  - Tool use for structured output
  - Same interface as OpenAI
- [x] Create `lib/ai/providers/index.ts`:
  - Provider exports and factory

#### 4.2 Embeddings
- [x] Create `lib/ai/embeddings.ts`:
  - `embedText(text: string): Promise<number[]>`
  - `embedBatch(texts: string[]): Promise<number[][]>`
  - Chunking utilities
  - Model configuration

#### 4.3 Retrieval
- [x] Create `lib/ai/retrieval.ts`:
  - `retrieveSimilarPosts(query, options)`
  - `retrieveExemplars(topic, options)`
  - Performance-weighted scoring
  - Cluster filtering

#### 4.4 Generation Modules
- [x] Create `lib/ai/prompts/system.ts`:
  - Base system prompts
  - E-E-A-T guidelines
  - Helpful content guidelines
- [x] Create `lib/ai/generation/topics.ts`:
  - `generateTopicSuggestions(input)`
  - Prompt construction
  - Output validation
- [x] Create `lib/ai/generation/drafts.ts`:
  - `generateDraft(input): Promise<BlogPost>`
  - Full schema compliance
- [x] Create `lib/ai/generation/style-aware-prompts.ts`:
  - Style-guided prompt construction
- [x] Create `lib/ai/analysis/style-analyzer.ts`:
  - Analyze content style patterns
  - Streaming support
- [ ] Create `lib/ai/generation/revision.ts`:
  - `reviseDraft(input): Promise<RevisionOutput>`
  - Section-level updates

### Phase 5: SEO and Validation ✅

#### 5.1 Validators
- [x] Create `lib/seo/validators.ts`:
  - `validatePost(post): PostValidationReport`
  - Structure checks (title, sections, FAQs)
  - SEO checks (meta, keywords, links)
  - E-E-A-T checks (author, experience)
  - Content quality checks (placeholders, length)
  - Score calculation

#### 5.2 JSON-LD Generation
- [x] Create `lib/seo/jsonld.ts`:
  - `generateArticleJsonLd(post, org): ArticleJsonLd`
  - `generateFaqPageJsonLd(post): FaqPageJsonLd`
  - Validation of generated JSON-LD

### Phase 6: API Routes ✅

#### 6.1 Import APIs
- [x] Create `app/api/import/shopify/route.ts`
- [x] Create `app/api/import/sitemap/route.ts`
- [x] Create `app/api/import/urls/route.ts`

#### 6.2 Posts APIs
- [x] Create `app/api/posts/route.ts` (GET, POST)
- [x] Create `app/api/posts/[id]/route.ts` (GET, PATCH, DELETE)
- [x] Create `app/api/posts/[id]/publish/route.ts`
- [x] Create `app/api/posts/[id]/validate/route.ts`

#### 6.3 Ideas APIs
- [x] Create `app/api/ideas/route.ts` (GET, POST)
- [x] Create `app/api/ideas/generate/route.ts`
- [x] Create `app/api/ideas/[id]/route.ts`
- [x] Create `app/api/ideas/[id]/brief/route.ts`

#### 6.4 Drafts APIs
- [x] Create `app/api/drafts/route.ts`

#### 6.5 Embeddings APIs
- [x] Create `app/api/embeddings/route.ts`
- [x] Create `app/api/embeddings/search/route.ts`

#### 6.6 Supporting APIs
- [x] Create `app/api/authors/route.ts` and `[id]/route.ts`
- [x] Create `app/api/clusters/route.ts` and `[id]/route.ts`

### Phase 7: Admin UI ✅

#### 7.1 Layout and Navigation
- [x] Create `app/admin/layout.tsx`:
  - Admin navigation sidebar
- [x] Create `app/admin/page.tsx` - Dashboard overview

#### 7.2 Posts Management
- [x] Create `app/admin/posts/page.tsx`:
  - Posts list with filters
  - Status badges
- [x] Create `app/admin/posts/[id]/page.tsx`:
  - Post editor interface

#### 7.3 Ideas Management
- [x] Create `app/admin/ideas/page.tsx`:
  - Ideas list
- [x] Create `app/admin/ideas/generate/page.tsx`:
  - Generate new ideas

#### 7.4 Authors and Clusters
- [x] Create `app/admin/authors/page.tsx`
- [x] Create `app/admin/authors/new/page.tsx`
- [x] Create `app/admin/clusters/page.tsx`

#### 7.5 Import Management
- [x] Create `app/admin/import/page.tsx`:
  - Import from Shopify, sitemap, or URLs

#### 7.6 Analytics
- [ ] Create `app/admin/analytics/page.tsx` (planned)

### Phase 8: Public Blog (Planned)

#### 8.1 Blog Pages
- [ ] Create `app/(public)/blog/page.tsx`
- [ ] Create `app/(public)/blog/[slug]/page.tsx`

### Phase 9: Additional Modules ✅

#### 9.1 Discovery Module
- [x] Create `lib/discovery/topic-finder.ts`
- [x] Create `lib/discovery/topic-scorer.ts`
- [x] Create `lib/discovery/existing-content.ts`

#### 9.2 Outline Module
- [x] Create `lib/outline/outline-generator.ts`
- [x] Create `lib/outline/outline-types.ts`

#### 9.3 Shopify Integration
- [x] Create `lib/shopify/api-client.ts`
- [x] Create `lib/shopify/article-generator.ts`
- [x] Create `lib/shopify/article-validator.ts`
- [x] Create `lib/shopify/content-types.ts`
- [x] Create `lib/shopify/format-rules.ts`
- [x] Create `lib/shopify/product-matcher.ts`

### Phase 10: CLI Scripts ✅

- [x] Create `scripts/analyze-style.ts`
- [x] Create `scripts/create-author.ts`
- [x] Create `scripts/discover-topics.ts`
- [x] Create `scripts/generate-article.ts`
- [x] Create `scripts/generate-outline.ts`
- [x] Create `scripts/import-shopify.ts`
- [x] Create `scripts/index-content.ts`

### Phase 11: Testing and Documentation (In Progress)

#### 11.1 Manual Validation
- [x] Import actual Shopify blog posts
- [x] Generate topic suggestions
- [x] Create outlines and articles
- [ ] Check JSON-LD with Google's Rich Results Test

#### 11.2 Documentation
- [x] Document architecture (this file)
- [x] Document blog style guide

---

## Acceptance Criteria Checklist

### Content Import
- [ ] All existing Shopify blog posts can be discovered via Admin API
- [ ] Posts are fetched and parsed into intermediate representation
- [ ] Intermediate representation is normalized to canonical schema
- [ ] Posts are stored in PostgreSQL with all required fields
- [ ] Import is idempotent (re-running doesn't duplicate)
- [ ] Import logs capture errors for debugging

### Schema Enforcement
- [ ] TypeScript types match specification exactly
- [ ] Zod schema validates all constraints
- [ ] JSON Schema works with OpenAI structured output
- [ ] Drizzle tables match schema with proper types
- [ ] Validation catches all specified edge cases

### AI Generation
- [ ] Topic suggestions follow provided guidelines
- [ ] Briefs include outline, links, and experience prompts
- [ ] Drafts output valid JSON matching canonical schema
- [ ] AI outputs are validated before storage
- [ ] Streaming works for draft generation

### E-E-A-T Compliance
- [ ] Every post has an author with credentials
- [ ] Experience evidence field is required and prompted
- [ ] Validation warns on missing E-E-A-T elements
- [ ] JSON-LD Article is always present
- [ ] JSON-LD FAQPage generated when FAQs exist

### Workflow
- [ ] Ideas can be created manually or via AI
- [ ] Briefs are generated from ideas
- [ ] Drafts are generated from briefs
- [ ] Posts go through review before publishing
- [ ] Publishing works to database and/or Shopify

### Validation and Quality
- [ ] Meta title length warnings work
- [ ] Meta description length warnings work
- [ ] Placeholder detection prevents publishing
- [ ] Internal link count recommendations shown
- [ ] Overall SEO/E-E-A-T scores calculated
