/**
 * Drizzle ORM Database Schema
 *
 * Defines all tables for the blog system using PostgreSQL with pgvector support.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type {
  Section,
  FAQ,
  InternalLink,
  ExperienceEvidence,
  ArticleJsonLd,
  FaqPageJsonLd,
  PerformanceMetrics,
  Reviewer,
  Brief,
} from '@/lib/schema/canonical';

// ============================================================================
// CUSTOM TYPES
// ============================================================================

/**
 * Custom vector type for pgvector
 * Stores embeddings as float arrays
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'; // OpenAI text-embedding-3-small dimensions
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[1,2,3]" format from postgres
    return JSON.parse(value);
  },
});

// ============================================================================
// AUTHORS TABLE
// ============================================================================

export const authors = pgTable(
  'authors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    role: varchar('role', { length: 100 }).notNull(),
    credentials: varchar('credentials', { length: 500 }).notNull(),
    profileUrl: varchar('profile_url', { length: 500 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('authors_name_role_idx').on(table.name, table.role),
  ]
);

// ============================================================================
// TOPIC CLUSTERS TABLE
// ============================================================================

export const topicClusters = pgTable(
  'topic_clusters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull().unique(),
    description: text('description'),
    pillarPostId: uuid('pillar_post_id'),
    parentId: uuid('parent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('topic_clusters_parent_id_idx').on(table.parentId),
    index('topic_clusters_pillar_post_id_idx').on(table.pillarPostId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'topic_clusters_parent_fk',
    }),
  ]
);

// ============================================================================
// BLOG POSTS TABLE
// ============================================================================

export const blogPosts = pgTable(
  'blog_posts',
  {
    // Identification
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    sourceUrl: varchar('source_url', { length: 500 }),
    source: varchar('source', { length: 20 }).notNull().default('manual'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    version: integer('version').notNull().default(1),

    // Core Content
    title: varchar('title', { length: 200 }).notNull(),
    summary: varchar('summary', { length: 500 }).notNull(),
    heroAnswer: text('hero_answer').notNull(),
    sections: jsonb('sections').$type<Section[]>().notNull().default([]),
    faq: jsonb('faq').$type<FAQ[]>().notNull().default([]),

    // SEO
    primaryKeyword: varchar('primary_keyword', { length: 100 }).notNull(),
    secondaryKeywords: jsonb('secondary_keywords').$type<string[]>().notNull().default([]),
    searchIntent: varchar('search_intent', { length: 20 }).notNull().default('informational'),
    metaTitle: varchar('meta_title', { length: 100 }).notNull(),
    metaDescription: varchar('meta_description', { length: 200 }).notNull(),
    canonicalUrl: varchar('canonical_url', { length: 500 }).notNull(),
    focusQuestions: jsonb('focus_questions').$type<string[]>().notNull().default([]),

    // Internal Linking
    internalLinks: jsonb('internal_links').$type<InternalLink[]>().notNull().default([]),

    // E-E-A-T
    authorId: uuid('author_id').notNull().references(() => authors.id),
    reviewedBy: jsonb('reviewed_by').$type<Reviewer | null>(),
    experienceEvidence: jsonb('experience_evidence').$type<ExperienceEvidence>().notNull(),

    // Structured Data
    ldJsonArticle: jsonb('ld_json_article').$type<ArticleJsonLd>().notNull(),
    ldJsonFaqPage: jsonb('ld_json_faq_page').$type<FaqPageJsonLd | null>(),

    // Clustering
    clusterTopicId: uuid('cluster_topic_id').references(() => topicClusters.id),
    parentPostId: uuid('parent_post_id'),

    // Content Metadata
    rawHtml: text('raw_html'),
    wordCount: integer('word_count').notNull().default(0),
    readingTimeMins: integer('reading_time_mins').notNull().default(0),
    aiAssisted: boolean('ai_assisted').notNull().default(false),
    aiModel: varchar('ai_model', { length: 100 }),

    // Performance
    primaryTargetQuery: varchar('primary_target_query', { length: 200 }),
    performance: jsonb('performance').$type<PerformanceMetrics>().notNull().default({
      clicks: null,
      impressions: null,
      averagePosition: null,
      ctr: null,
      conversionEvents: null,
      lastSyncedAt: null,
    }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  },
  (table) => [
    index('blog_posts_status_idx').on(table.status),
    index('blog_posts_author_id_idx').on(table.authorId),
    index('blog_posts_cluster_topic_id_idx').on(table.clusterTopicId),
    index('blog_posts_published_at_idx').on(table.publishedAt),
    index('blog_posts_source_url_idx').on(table.sourceUrl),
    foreignKey({
      columns: [table.parentPostId],
      foreignColumns: [table.id],
      name: 'blog_posts_parent_fk',
    }),
  ]
);

// ============================================================================
// BLOG POST EMBEDDINGS TABLE
// ============================================================================

export const blogPostEmbeddings = pgTable(
  'blog_post_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blogPostId: uuid('blog_post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull().default(0),
    chunkText: text('chunk_text').notNull(),
    embedding: vector('embedding').notNull(),
    embeddingModel: varchar('embedding_model', { length: 50 }).notNull(),
    contentType: varchar('content_type', { length: 20 }).notNull().default('full'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('blog_post_embeddings_blog_post_id_idx').on(table.blogPostId),
    uniqueIndex('blog_post_embeddings_unique_chunk_idx').on(
      table.blogPostId,
      table.chunkIndex,
      table.contentType
    ),
    // Note: Create IVFFlat or HNSW index manually for vector similarity search
    // CREATE INDEX ON blog_post_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ]
);

// ============================================================================
// CONTENT IDEAS TABLE
// ============================================================================

export const contentIdeas = pgTable(
  'content_ideas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: varchar('topic', { length: 300 }).notNull(),
    primaryKeyword: varchar('primary_keyword', { length: 100 }).notNull(),
    secondaryKeywords: jsonb('secondary_keywords').$type<string[]>().notNull().default([]),
    targetAudience: varchar('target_audience', { length: 200 }),
    searchIntent: varchar('search_intent', { length: 20 }).notNull().default('informational'),
    suggestedSlug: varchar('suggested_slug', { length: 100 }),
    clusterTopicId: uuid('cluster_topic_id').references(() => topicClusters.id),
    funnelStage: varchar('funnel_stage', { length: 20 }),
    status: varchar('status', { length: 20 }).notNull().default('idea'),
    justification: text('justification'),
    notes: text('notes'),
    brief: jsonb('brief').$type<Brief | null>(),
    blogPostId: uuid('blog_post_id').references(() => blogPosts.id),
    aiGenerated: boolean('ai_generated').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('content_ideas_status_idx').on(table.status),
    index('content_ideas_cluster_topic_id_idx').on(table.clusterTopicId),
    index('content_ideas_blog_post_id_idx').on(table.blogPostId),
    index('content_ideas_created_at_idx').on(table.createdAt),
  ]
);

// ============================================================================
// IMPORT LOGS TABLE
// ============================================================================

export const importLogs = pgTable(
  'import_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 20 }).notNull(),
    sourceUrl: varchar('source_url', { length: 500 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    blogPostId: uuid('blog_post_id').references(() => blogPosts.id),
    errorMessage: text('error_message'),
    rawResponse: text('raw_response'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('import_logs_source_url_idx').on(table.sourceUrl),
    index('import_logs_status_idx').on(table.status),
    index('import_logs_created_at_idx').on(table.createdAt),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const authorsRelations = relations(authors, ({ many }) => ({
  posts: many(blogPosts),
}));

export const topicClustersRelations = relations(topicClusters, ({ one, many }) => ({
  parent: one(topicClusters, {
    fields: [topicClusters.parentId],
    references: [topicClusters.id],
    relationName: 'cluster_hierarchy',
  }),
  children: many(topicClusters, { relationName: 'cluster_hierarchy' }),
  pillarPost: one(blogPosts, {
    fields: [topicClusters.pillarPostId],
    references: [blogPosts.id],
  }),
  posts: many(blogPosts),
  ideas: many(contentIdeas),
}));

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  author: one(authors, {
    fields: [blogPosts.authorId],
    references: [authors.id],
  }),
  cluster: one(topicClusters, {
    fields: [blogPosts.clusterTopicId],
    references: [topicClusters.id],
  }),
  parentPost: one(blogPosts, {
    fields: [blogPosts.parentPostId],
    references: [blogPosts.id],
    relationName: 'post_hierarchy',
  }),
  childPosts: many(blogPosts, { relationName: 'post_hierarchy' }),
  embeddings: many(blogPostEmbeddings),
  ideas: many(contentIdeas),
  importLogs: many(importLogs),
}));

export const blogPostEmbeddingsRelations = relations(blogPostEmbeddings, ({ one }) => ({
  post: one(blogPosts, {
    fields: [blogPostEmbeddings.blogPostId],
    references: [blogPosts.id],
  }),
}));

export const contentIdeasRelations = relations(contentIdeas, ({ one }) => ({
  cluster: one(topicClusters, {
    fields: [contentIdeas.clusterTopicId],
    references: [topicClusters.id],
  }),
  post: one(blogPosts, {
    fields: [contentIdeas.blogPostId],
    references: [blogPosts.id],
  }),
}));

export const importLogsRelations = relations(importLogs, ({ one }) => ({
  post: one(blogPosts, {
    fields: [importLogs.blogPostId],
    references: [blogPosts.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;

export type TopicCluster = typeof topicClusters.$inferSelect;
export type NewTopicCluster = typeof topicClusters.$inferInsert;

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

export type BlogPostEmbedding = typeof blogPostEmbeddings.$inferSelect;
export type NewBlogPostEmbedding = typeof blogPostEmbeddings.$inferInsert;

export type ContentIdea = typeof contentIdeas.$inferSelect;
export type NewContentIdea = typeof contentIdeas.$inferInsert;

export type ImportLog = typeof importLogs.$inferSelect;
export type NewImportLog = typeof importLogs.$inferInsert;
