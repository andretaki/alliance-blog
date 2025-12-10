/**
 * Single Content Idea API
 *
 * GET /api/ideas/[id] - Get idea by ID
 * PATCH /api/ideas/[id] - Update idea
 * DELETE /api/ideas/[id] - Delete idea
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { contentIdeas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UpdateIdeaSchema = z.object({
  topic: z.string().min(10).max(300).optional(),
  primaryKeyword: z.string().min(2).max(100).optional(),
  secondaryKeywords: z.array(z.string()).optional(),
  targetAudience: z.string().max(200).optional().nullable(),
  searchIntent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).optional(),
  suggestedSlug: z.string().max(100).optional().nullable(),
  clusterTopicId: z.string().uuid().optional().nullable(),
  funnelStage: z.enum(['awareness', 'consideration', 'decision', 'retention']).optional().nullable(),
  status: z.enum(['idea', 'brief', 'draft', 'reviewing', 'scheduled', 'published', 'archived']).optional(),
  justification: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/ideas/[id]
 * Get a single idea by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const idea = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.id, id),
      with: {
        cluster: true,
        post: true,
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ idea });
  } catch (error) {
    console.error('Error getting idea:', error);
    return NextResponse.json(
      { error: 'Failed to get idea' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ideas/[id]
 * Update an idea
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }

    const parsed = UpdateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [updatedIdea] = await db
      .update(contentIdeas)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(contentIdeas.id, id))
      .returning();

    return NextResponse.json({ idea: updatedIdea });
  } catch (error) {
    console.error('Error updating idea:', error);
    return NextResponse.json(
      { error: 'Failed to update idea' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ideas/[id]
 * Delete an idea
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }

    await db.delete(contentIdeas).where(eq(contentIdeas.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting idea:', error);
    return NextResponse.json(
      { error: 'Failed to delete idea' },
      { status: 500 }
    );
  }
}
