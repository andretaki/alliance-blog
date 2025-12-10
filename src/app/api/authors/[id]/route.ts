/**
 * Single Author API
 *
 * GET /api/authors/[id] - Get author by ID
 * PATCH /api/authors/[id] - Update author
 * DELETE /api/authors/[id] - Delete author
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { authors, blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UpdateAuthorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.string().min(2).max(100).optional(),
  credentials: z.string().min(10).max(500).optional(),
  profileUrl: z.string().url().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/authors/[id]
 * Get a single author by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const author = await db.query.authors.findFirst({
      where: eq(authors.id, id),
      with: {
        posts: {
          columns: {
            id: true,
            title: true,
            slug: true,
            status: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ author });
  } catch (error) {
    console.error('Error getting author:', error);
    return NextResponse.json(
      { error: 'Failed to get author' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/authors/[id]
 * Update an author
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.query.authors.findFirst({
      where: eq(authors.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
    }

    const parsed = UpdateAuthorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [updatedAuthor] = await db
      .update(authors)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(authors.id, id))
      .returning();

    return NextResponse.json({ author: updatedAuthor });
  } catch (error) {
    console.error('Error updating author:', error);
    return NextResponse.json(
      { error: 'Failed to update author' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/authors/[id]
 * Delete an author (only if no posts reference them)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await db.query.authors.findFirst({
      where: eq(authors.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
    }

    // Check if author has posts
    const authorPosts = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.authorId, id),
    });

    if (authorPosts) {
      return NextResponse.json(
        { error: 'Cannot delete author with existing posts' },
        { status: 400 }
      );
    }

    await db.delete(authors).where(eq(authors.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting author:', error);
    return NextResponse.json(
      { error: 'Failed to delete author' },
      { status: 500 }
    );
  }
}
