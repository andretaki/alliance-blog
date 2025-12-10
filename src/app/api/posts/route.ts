/**
 * Posts API
 *
 * GET /api/posts - List posts with filters
 * POST /api/posts - Create new post
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { blogPosts, authors } from '@/lib/db/schema';
import { eq, and, or, ilike, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreateBlogPostSchema } from '@/lib/schema/canonical.zod';
import type { PostStatus } from '@/lib/schema/canonical';

/**
 * GET /api/posts
 * List posts with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as PostStatus | null;
    const clusterId = searchParams.get('clusterId');
    const authorId = searchParams.get('authorId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(blogPosts.status, status));
    }

    if (clusterId) {
      conditions.push(eq(blogPosts.clusterTopicId, clusterId));
    }

    if (authorId) {
      conditions.push(eq(blogPosts.authorId, authorId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(blogPosts.title, `%${search}%`),
          ilike(blogPosts.primaryKeyword, `%${search}%`),
          ilike(blogPosts.slug, `%${search}%`)
        )
      );
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Get posts
    const posts = await db.query.blogPosts.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(blogPosts.updatedAt),
      limit,
      offset,
      with: {
        author: true,
        cluster: true,
      },
    });

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + posts.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing posts:', error);
    return NextResponse.json(
      { error: 'Failed to list posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts
 * Create a new post
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parsed = CreateBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate ID if not provided
    const id = data.id || uuidv4();

    // Verify author exists
    const author = await db.query.authors.findFirst({
      where: eq(authors.id, data.authorId),
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingSlug = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.slug, data.slug),
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      );
    }

    // Calculate word count
    let wordCount = data.heroAnswer.split(/\s+/).filter(Boolean).length;
    for (const section of data.sections) {
      wordCount += section.body.split(/\s+/).filter(Boolean).length;
    }

    // Insert post
    const [newPost] = await db
      .insert(blogPosts)
      .values({
        ...data,
        id,
        wordCount,
        readingTimeMins: Math.ceil(wordCount / 200),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as typeof blogPosts.$inferInsert)
      .returning();

    return NextResponse.json({ post: newPost }, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
