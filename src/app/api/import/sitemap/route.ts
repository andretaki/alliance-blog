/**
 * Sitemap Import API
 *
 * POST /api/import/sitemap - Import blog posts from sitemap
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { importFromSitemap } from '@/lib/import/pipeline';

const ImportSitemapSchema = z.object({
  sitemapUrl: z.string().url(),
  blogPathPattern: z.string().default('/blog/'),
  limit: z.number().int().min(1).max(100).default(20),
  authorId: z.string().uuid(),
});

/**
 * POST /api/import/sitemap
 * Import blog posts from a sitemap
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = ImportSitemapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sitemapUrl, blogPathPattern, limit, authorId } = parsed.data;

    const result = await importFromSitemap(sitemapUrl, {
      defaultAuthorId: authorId,
      urlPattern: new RegExp(blogPathPattern),
      limit,
    });

    return NextResponse.json({
      success: result.success,
      imported: result.postsCreated,
      updated: result.postsUpdated,
      failed: result.postsFailed,
      errors: result.errors.map(e => e.error),
    });
  } catch (error) {
    console.error('Error importing from sitemap:', error);
    return NextResponse.json(
      { error: 'Failed to import from sitemap' },
      { status: 500 }
    );
  }
}
