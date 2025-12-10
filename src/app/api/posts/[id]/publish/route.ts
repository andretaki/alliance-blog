/**
 * Post Publish API
 *
 * POST /api/posts/[id]/publish - Publish or schedule a post
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isPublishReady } from '@/lib/seo/validators';
import type { BlogPost } from '@/lib/schema/canonical';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/posts/[id]/publish
 * Publish or schedule a post
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { publishTo, scheduledFor } = body as {
      publishTo: 'database' | 'shopify' | 'both';
      scheduledFor?: string;
    };

    // Get post
    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check publish readiness
    const readiness = isPublishReady(post as unknown as BlogPost);
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: 'Post is not ready to publish',
          blockers: readiness.blockers,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Handle scheduling vs immediate publish
    if (scheduledFor) {
      const scheduleDate = new Date(scheduledFor);
      if (scheduleDate <= now) {
        return NextResponse.json(
          { error: 'Scheduled date must be in the future' },
          { status: 400 }
        );
      }

      // Schedule for later
      const [updatedPost] = await db
        .update(blogPosts)
        .set({
          status: 'scheduled',
          scheduledFor: scheduleDate,
          updatedAt: now,
        })
        .where(eq(blogPosts.id, id))
        .returning();

      return NextResponse.json({
        success: true,
        status: 'scheduled',
        scheduledFor: scheduleDate.toISOString(),
        post: updatedPost,
      });
    }

    // Immediate publish
    const [updatedPost] = await db
      .update(blogPosts)
      .set({
        status: 'published',
        publishedAt: now,
        scheduledFor: null,
        ldJsonArticle: {
          ...post.ldJsonArticle,
          datePublished: now.toISOString(),
          dateModified: now.toISOString(),
        },
        updatedAt: now,
      })
      .where(eq(blogPosts.id, id))
      .returning();

    // TODO: If publishTo includes 'shopify', push to Shopify
    let shopifyArticleId: string | undefined;
    if (publishTo === 'shopify' || publishTo === 'both') {
      // Placeholder for Shopify publishing
      // shopifyArticleId = await publishToShopify(updatedPost);
      console.log('TODO: Publish to Shopify');
    }

    return NextResponse.json({
      success: true,
      status: 'published',
      publishedAt: now.toISOString(),
      shopifyArticleId,
      post: updatedPost,
    });
  } catch (error) {
    console.error('Error publishing post:', error);
    return NextResponse.json(
      { error: 'Failed to publish post' },
      { status: 500 }
    );
  }
}
