/**
 * Drafts API
 *
 * POST /api/drafts - Generate a draft from a brief
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { contentIdeas, blogPosts, authors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateDraft } from '@/lib/ai/generation/drafts';
import { searchSimilarPosts } from '@/lib/ai/retrieval';
import type { BlogPost as CanonicalBlogPost, Brief } from '@/lib/schema/canonical';

const GenerateDraftSchema = z.object({
  ideaId: z.string().uuid(),
  authorId: z.string().uuid(),
});

/**
 * POST /api/drafts
 * Generate a full draft from an idea's brief
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = GenerateDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ideaId, authorId } = parsed.data;

    // Get the idea with brief
    const idea = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.id, ideaId),
      with: {
        cluster: true,
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }

    if (!idea.brief) {
      return NextResponse.json(
        { error: 'Idea does not have a brief. Generate a brief first.' },
        { status: 400 }
      );
    }

    // Get the author
    const author = await db.query.authors.findFirst({
      where: eq(authors.id, authorId),
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 400 }
      );
    }

    // Find similar posts as exemplars
    let exemplarPosts: CanonicalBlogPost[] = [];
    try {
      const similarResults = await searchSimilarPosts(idea.topic, {
        limit: 3,
        minSimilarity: 0.6,
      });

      if (similarResults.length > 0) {
        const postIds = similarResults.map((r) => r.postId);
        const posts = await db.query.blogPosts.findMany({
          where: (posts, { inArray }) => inArray(posts.id, postIds),
          with: {
            author: true,
          },
        });
        exemplarPosts = posts as unknown as CanonicalBlogPost[];
      }
    } catch {
      // Continue without exemplars if retrieval fails
    }

    // Generate the draft
    const draft = await generateDraft({
      brief: idea.brief as Brief,
      authorInfo: {
        id: author.id,
        name: author.name,
        role: author.role,
        credentials: author.credentials,
        profileUrl: author.profileUrl,
      },
      exemplarPosts,
      primaryKeyword: idea.primaryKeyword,
      searchIntent: idea.searchIntent,
      clusterTopicId: idea.clusterTopicId,
    });

    // Save the draft to database
    const [newPost] = await db
      .insert(blogPosts)
      .values({
        id: draft.id,
        slug: draft.slug,
        source: 'manual',
        status: 'draft',
        title: draft.title,
        summary: draft.summary,
        heroAnswer: draft.heroAnswer,
        sections: draft.sections,
        faq: draft.faq,
        primaryKeyword: draft.primaryKeyword,
        secondaryKeywords: draft.secondaryKeywords,
        searchIntent: draft.searchIntent,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        canonicalUrl: draft.canonicalUrl,
        focusQuestions: draft.focusQuestions,
        internalLinks: draft.internalLinks,
        authorId: author.id,
        experienceEvidence: draft.experienceEvidence,
        ldJsonArticle: draft.ldJsonArticle,
        ldJsonFaqPage: draft.ldJsonFaqPage,
        clusterTopicId: idea.clusterTopicId,
        wordCount: draft.wordCount,
        readingTimeMins: draft.readingTimeMinutes,
        aiAssisted: true,
        aiModel: draft.aiModel,
      } as typeof blogPosts.$inferInsert)
      .returning();

    // Update the idea to reference the post
    await db
      .update(contentIdeas)
      .set({
        blogPostId: newPost.id,
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(contentIdeas.id, ideaId));

    return NextResponse.json({
      post: newPost,
      ideaId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating draft:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
