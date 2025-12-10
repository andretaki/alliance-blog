/**
 * Content Ideas API
 *
 * GET /api/ideas - List content ideas with filters
 * POST /api/ideas - Create new content idea
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { contentIdeas } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const CreateIdeaSchema = z.object({
  topic: z.string().min(10).max(300),
  primaryKeyword: z.string().min(2).max(100),
  secondaryKeywords: z.array(z.string()).default([]),
  targetAudience: z.string().max(200).optional(),
  searchIntent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).default('informational'),
  suggestedSlug: z.string().max(100).optional(),
  clusterTopicId: z.string().uuid().optional().nullable(),
  funnelStage: z.enum(['awareness', 'consideration', 'decision', 'retention']).optional(),
  justification: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  aiGenerated: z.boolean().default(false),
});

/**
 * GET /api/ideas
 * List content ideas with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const clusterId = searchParams.get('clusterId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status) {
      conditions.push(eq(contentIdeas.status, status));
    }

    if (clusterId) {
      conditions.push(eq(contentIdeas.clusterTopicId, clusterId));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentIdeas)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Get ideas
    const ideas = await db.query.contentIdeas.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(contentIdeas.createdAt),
      limit,
      offset,
      with: {
        cluster: true,
        post: {
          columns: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      ideas,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + ideas.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing ideas:', error);
    return NextResponse.json(
      { error: 'Failed to list ideas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ideas
 * Create a new content idea
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = CreateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [newIdea] = await db
      .insert(contentIdeas)
      .values({
        topic: data.topic,
        primaryKeyword: data.primaryKeyword,
        secondaryKeywords: data.secondaryKeywords,
        targetAudience: data.targetAudience,
        searchIntent: data.searchIntent,
        suggestedSlug: data.suggestedSlug,
        clusterTopicId: data.clusterTopicId,
        funnelStage: data.funnelStage,
        justification: data.justification,
        notes: data.notes,
        aiGenerated: data.aiGenerated,
        status: 'idea',
      })
      .returning();

    return NextResponse.json({ idea: newIdea }, { status: 201 });
  } catch (error) {
    console.error('Error creating idea:', error);
    return NextResponse.json(
      { error: 'Failed to create idea' },
      { status: 500 }
    );
  }
}
