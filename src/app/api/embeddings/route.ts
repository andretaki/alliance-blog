/**
 * Embeddings API
 *
 * POST /api/embeddings - Generate embeddings for a post
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { generatePostEmbeddings, deletePostEmbeddings } from '@/lib/ai/embeddings';
import type { BlogPost } from '@/lib/schema/canonical';

const GenerateEmbeddingsSchema = z.object({
  postId: z.string().uuid(),
  force: z.boolean().default(false),
});

/**
 * POST /api/embeddings
 * Generate embeddings for a blog post
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = GenerateEmbeddingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { postId, force } = parsed.data;

    // Get the post
    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, postId),
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Generate embeddings using the library function
    const result = await generatePostEmbeddings(post as unknown as BlogPost, { force });

    return NextResponse.json({
      success: true,
      postId,
      chunks: result.chunks,
      model: result.model,
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to generate embeddings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/embeddings
 * Delete embeddings for a post
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'postId is required' },
        { status: 400 }
      );
    }

    await deletePostEmbeddings(postId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to delete embeddings' },
      { status: 500 }
    );
  }
}
