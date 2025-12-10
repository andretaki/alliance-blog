/**
 * Shopify Import API
 *
 * POST /api/import/shopify - Import blog posts from Shopify
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { importFromShopify } from '@/lib/import/pipeline';

const ImportShopifySchema = z.object({
  store: z.string().min(1).max(100),
  accessToken: z.string().min(1),
  blogHandle: z.string().optional(),
  limit: z.number().int().min(1).max(250).default(50),
  authorId: z.string().uuid(),
});

/**
 * POST /api/import/shopify
 * Import blog posts from a Shopify store
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = ImportShopifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { store, accessToken, blogHandle, limit, authorId } = parsed.data;

    const result = await importFromShopify(store, accessToken, {
      defaultAuthorId: authorId,
      blogHandle,
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
    console.error('Error importing from Shopify:', error);
    return NextResponse.json(
      { error: 'Failed to import from Shopify' },
      { status: 500 }
    );
  }
}
