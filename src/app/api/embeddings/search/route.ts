/**
 * Embedding Search API
 *
 * POST /api/embeddings/search - Search for similar content
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchSimilarPosts } from '@/lib/ai/retrieval';
import { db } from '@/lib/db/client';
import { blogPosts } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

const SearchEmbeddingsSchema = z.object({
  query: z.string().min(3).max(1000),
  limit: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).default(0.5),
  contentType: z.enum(['full', 'summary', 'section']).optional(),
});

/**
 * POST /api/embeddings/search
 * Search for similar content using vector similarity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = SearchEmbeddingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { query, limit, minScore, contentType } = parsed.data;

    // Find similar posts
    const results = await searchSimilarPosts(query, {
      limit,
      minSimilarity: minScore,
      contentTypes: contentType ? [contentType] : undefined,
    });

    if (results.length === 0) {
      return NextResponse.json({
        results: [],
        query,
      });
    }

    // Get full post info for results
    const postIds = [...new Set(results.map((r) => r.postId))];
    const posts = await db.query.blogPosts.findMany({
      where: inArray(blogPosts.id, postIds),
      columns: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        primaryKeyword: true,
        status: true,
        publishedAt: true,
      },
      with: {
        author: {
          columns: {
            name: true,
          },
        },
      },
    });

    const postMap = new Map(posts.map((p) => [p.id, p]));

    const enrichedResults = results.map((r) => ({
      ...r,
      post: postMap.get(r.postId),
    }));

    return NextResponse.json({
      results: enrichedResults,
      query,
    });
  } catch (error) {
    console.error('Error searching embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to search embeddings' },
      { status: 500 }
    );
  }
}
