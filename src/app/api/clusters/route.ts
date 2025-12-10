/**
 * Topic Clusters API
 *
 * GET /api/clusters - List all topic clusters
 * POST /api/clusters - Create new topic cluster
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { topicClusters } from '@/lib/db/schema';
import { z } from 'zod';

const CreateClusterSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  parentId: z.string().uuid().optional().nullable(),
  pillarPostId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/clusters
 * List all topic clusters with their posts and ideas
 */
export async function GET() {
  try {
    const clusters = await db.query.topicClusters.findMany({
      with: {
        parent: true,
        children: true,
        pillarPost: {
          columns: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
        posts: {
          columns: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
        ideas: {
          columns: {
            id: true,
            topic: true,
            status: true,
          },
        },
      },
      orderBy: (clusters, { asc }) => [asc(clusters.name)],
    });

    return NextResponse.json({ clusters });
  } catch (error) {
    console.error('Error listing clusters:', error);
    return NextResponse.json(
      { error: 'Failed to list clusters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clusters
 * Create a new topic cluster
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = CreateClusterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [newCluster] = await db
      .insert(topicClusters)
      .values({
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        pillarPostId: data.pillarPostId,
      })
      .returning();

    return NextResponse.json({ cluster: newCluster }, { status: 201 });
  } catch (error) {
    console.error('Error creating cluster:', error);
    return NextResponse.json(
      { error: 'Failed to create cluster' },
      { status: 500 }
    );
  }
}
