/**
 * Single Post API
 *
 * GET /api/posts/[id] - Get post by ID
 * PATCH /api/posts/[id] - Update post
 * DELETE /api/posts/[id] - Delete post
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { blogPosts, blogPostEmbeddings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UpdateBlogPostSchema } from '@/lib/schema/canonical.zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/[id]
 * Get a single post by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
      with: {
        author: true,
        cluster: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error getting post:', error);
    return NextResponse.json(
      { error: 'Failed to get post' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/posts/[id]
 * Update a post
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check post exists
    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Validate input
    const parsed = UpdateBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existing.slug) {
      const existingSlug = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.slug, data.slug),
      });

      if (existingSlug) {
        return NextResponse.json(
          { error: 'Slug already exists' },
          { status: 400 }
        );
      }
    }

    // Recalculate word count if content changed
    let wordCount = existing.wordCount;
    if (data.heroAnswer || data.sections) {
      const heroAnswer = data.heroAnswer || existing.heroAnswer;
      const sections = data.sections || existing.sections;

      wordCount = heroAnswer.split(/\s+/).filter(Boolean).length;
      for (const section of sections) {
        wordCount += section.body.split(/\s+/).filter(Boolean).length;
      }
    }

    // Prepare update data, converting string dates if present
    const updateData: Record<string, unknown> = {
      wordCount,
      readingTimeMins: Math.ceil(wordCount / 200),
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Copy allowed fields from validated data
    if (data.slug) updateData.slug = data.slug;
    if (data.title) updateData.title = data.title;
    if (data.summary) updateData.summary = data.summary;
    if (data.heroAnswer) updateData.heroAnswer = data.heroAnswer;
    if (data.sections) updateData.sections = data.sections;
    if (data.faq) updateData.faq = data.faq;
    if (data.primaryKeyword) updateData.primaryKeyword = data.primaryKeyword;
    if (data.secondaryKeywords) updateData.secondaryKeywords = data.secondaryKeywords;
    if (data.searchIntent) updateData.searchIntent = data.searchIntent;
    if (data.metaTitle) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription) updateData.metaDescription = data.metaDescription;
    if (data.status) updateData.status = data.status;
    if (data.focusQuestions) updateData.focusQuestions = data.focusQuestions;
    if (data.internalLinks) updateData.internalLinks = data.internalLinks;

    // Update post
    const [updatedPost] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning();

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]
 * Delete a post
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check post exists
    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Delete embeddings first (foreign key constraint)
    await db
      .delete(blogPostEmbeddings)
      .where(eq(blogPostEmbeddings.blogPostId, id));

    // Delete post
    await db.delete(blogPosts).where(eq(blogPosts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
