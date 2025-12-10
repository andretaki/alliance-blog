/**
 * Single Topic Cluster API
 *
 * GET /api/clusters/[id] - Get cluster by ID
 * PATCH /api/clusters/[id] - Update cluster
 * DELETE /api/clusters/[id] - Delete cluster
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { topicClusters, blogPosts, contentIdeas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UpdateClusterSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  pillarPostId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/clusters/[id]
 * Get a single cluster by ID with all related content
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const cluster = await db.query.topicClusters.findFirst({
      where: eq(topicClusters.id, id),
      with: {
        parent: true,
        children: true,
        pillarPost: true,
        posts: {
          with: {
            author: true,
          },
        },
        ideas: true,
      },
    });

    if (!cluster) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ cluster });
  } catch (error) {
    console.error('Error getting cluster:', error);
    return NextResponse.json(
      { error: 'Failed to get cluster' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clusters/[id]
 * Update a cluster
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.query.topicClusters.findFirst({
      where: eq(topicClusters.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    const parsed = UpdateClusterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Prevent circular parent reference
    if (parsed.data.parentId === id) {
      return NextResponse.json(
        { error: 'Cluster cannot be its own parent' },
        { status: 400 }
      );
    }

    const [updatedCluster] = await db
      .update(topicClusters)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(topicClusters.id, id))
      .returning();

    return NextResponse.json({ cluster: updatedCluster });
  } catch (error) {
    console.error('Error updating cluster:', error);
    return NextResponse.json(
      { error: 'Failed to update cluster' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clusters/[id]
 * Delete a cluster (only if no posts or ideas reference it)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await db.query.topicClusters.findFirst({
      where: eq(topicClusters.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    // Check for posts in cluster
    const clusterPosts = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.clusterTopicId, id),
    });

    if (clusterPosts) {
      return NextResponse.json(
        { error: 'Cannot delete cluster with existing posts. Reassign posts first.' },
        { status: 400 }
      );
    }

    // Check for ideas in cluster
    const clusterIdeas = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.clusterTopicId, id),
    });

    if (clusterIdeas) {
      return NextResponse.json(
        { error: 'Cannot delete cluster with existing ideas. Reassign ideas first.' },
        { status: 400 }
      );
    }

    // Check for child clusters
    const childClusters = await db.query.topicClusters.findFirst({
      where: eq(topicClusters.parentId, id),
    });

    if (childClusters) {
      return NextResponse.json(
        { error: 'Cannot delete cluster with child clusters. Delete or reassign children first.' },
        { status: 400 }
      );
    }

    await db.delete(topicClusters).where(eq(topicClusters.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cluster:', error);
    return NextResponse.json(
      { error: 'Failed to delete cluster' },
      { status: 500 }
    );
  }
}
