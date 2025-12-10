/**
 * Post Validation API
 *
 * GET /api/posts/[id]/validate - Validate post against SEO and E-E-A-T rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validatePost, isPublishReady } from '@/lib/seo/validators';
import type { BlogPost } from '@/lib/schema/canonical';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/[id]/validate
 * Validate a post and return detailed report
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Validate post
    const validationReport = validatePost(post as unknown as BlogPost);

    // Check publish readiness
    const publishReadiness = isPublishReady(post as unknown as BlogPost);

    return NextResponse.json({
      report: validationReport,
      publishReady: publishReadiness.ready,
      publishBlockers: publishReadiness.blockers,
    });
  } catch (error) {
    console.error('Error validating post:', error);
    return NextResponse.json(
      { error: 'Failed to validate post' },
      { status: 500 }
    );
  }
}
