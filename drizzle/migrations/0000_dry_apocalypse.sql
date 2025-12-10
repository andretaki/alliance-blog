-- Enable pgvector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(100) NOT NULL,
	"credentials" varchar(500) NOT NULL,
	"profile_url" varchar(500),
	"avatar_url" varchar(500),
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_post_id" uuid NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"embedding_model" varchar(50) NOT NULL,
	"content_type" varchar(20) DEFAULT 'full' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"source_url" varchar(500),
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" varchar(500) NOT NULL,
	"hero_answer" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_keyword" varchar(100) NOT NULL,
	"secondary_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_intent" varchar(20) DEFAULT 'informational' NOT NULL,
	"meta_title" varchar(100) NOT NULL,
	"meta_description" varchar(200) NOT NULL,
	"canonical_url" varchar(500) NOT NULL,
	"focus_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"internal_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_id" uuid NOT NULL,
	"reviewed_by" jsonb,
	"experience_evidence" jsonb NOT NULL,
	"ld_json_article" jsonb NOT NULL,
	"ld_json_faq_page" jsonb,
	"cluster_topic_id" uuid,
	"parent_post_id" uuid,
	"raw_html" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"reading_time_mins" integer DEFAULT 0 NOT NULL,
	"ai_assisted" boolean DEFAULT false NOT NULL,
	"ai_model" varchar(100),
	"primary_target_query" varchar(200),
	"performance" jsonb DEFAULT '{"clicks":null,"impressions":null,"averagePosition":null,"ctr":null,"conversionEvents":null,"lastSyncedAt":null}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(300) NOT NULL,
	"primary_keyword" varchar(100) NOT NULL,
	"secondary_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_audience" varchar(200),
	"search_intent" varchar(20) DEFAULT 'informational' NOT NULL,
	"suggested_slug" varchar(100),
	"cluster_topic_id" uuid,
	"funnel_stage" varchar(20),
	"status" varchar(20) DEFAULT 'idea' NOT NULL,
	"justification" text,
	"notes" text,
	"brief" jsonb,
	"blog_post_id" uuid,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(20) NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"status" varchar(20) NOT NULL,
	"blog_post_id" uuid,
	"error_message" text,
	"raw_response" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topic_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"pillar_post_id" uuid,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_clusters_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "blog_post_embeddings" ADD CONSTRAINT "blog_post_embeddings_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_cluster_topic_id_topic_clusters_id_fk" FOREIGN KEY ("cluster_topic_id") REFERENCES "public"."topic_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_parent_fk" FOREIGN KEY ("parent_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_cluster_topic_id_topic_clusters_id_fk" FOREIGN KEY ("cluster_topic_id") REFERENCES "public"."topic_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD CONSTRAINT "topic_clusters_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topic_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_name_role_idx" ON "authors" USING btree ("name","role");--> statement-breakpoint
CREATE INDEX "blog_post_embeddings_blog_post_id_idx" ON "blog_post_embeddings" USING btree ("blog_post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_embeddings_unique_chunk_idx" ON "blog_post_embeddings" USING btree ("blog_post_id","chunk_index","content_type");--> statement-breakpoint
CREATE INDEX "blog_posts_status_idx" ON "blog_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "blog_posts_cluster_topic_id_idx" ON "blog_posts" USING btree ("cluster_topic_id");--> statement-breakpoint
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_source_url_idx" ON "blog_posts" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "content_ideas_status_idx" ON "content_ideas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_ideas_cluster_topic_id_idx" ON "content_ideas" USING btree ("cluster_topic_id");--> statement-breakpoint
CREATE INDEX "content_ideas_blog_post_id_idx" ON "content_ideas" USING btree ("blog_post_id");--> statement-breakpoint
CREATE INDEX "content_ideas_created_at_idx" ON "content_ideas" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "import_logs_source_url_idx" ON "import_logs" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "import_logs_status_idx" ON "import_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_logs_created_at_idx" ON "import_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "topic_clusters_parent_id_idx" ON "topic_clusters" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "topic_clusters_pillar_post_id_idx" ON "topic_clusters" USING btree ("pillar_post_id");