/**
 * URL Import API
 *
 * POST /api/import/urls - Import blog posts from URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { importFromUrls } from '@/lib/import/pipeline';

const ImportUrlsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
  authorId: z.string().uuid(),
});

/**
 * POST /api/import/urls
 * Import blog posts from a list of URLs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = ImportUrlsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { urls, authorId } = parsed.data;

    const result = await importFromUrls(urls, {
      defaultAuthorId: authorId,
    });

    return NextResponse.json({
      success: result.success,
      imported: result.postsCreated,
      updated: result.postsUpdated,
      failed: result.postsFailed,
      errors: result.errors.map(e => e.error),
    });
  } catch (error) {
    console.error('Error importing from URLs:', error);
    return NextResponse.json(
      { error: 'Failed to import from URLs' },
      { status: 500 }
    );
  }
}
