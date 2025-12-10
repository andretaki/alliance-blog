/**
 * AI Topic Generation API
 *
 * POST /api/ideas/generate - Generate topic suggestions using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { contentIdeas, blogPosts, topicClusters } from '@/lib/db/schema';
import { generateTopicSuggestions } from '@/lib/ai/generation/topics';
import { z } from 'zod';
import type { FunnelStage } from '@/lib/schema/canonical';

const GenerateTopicsSchema = z.object({
  productLine: z.string().min(2).max(200),
  targetAudience: z.string().min(10).max(500),
  funnelStage: z.enum(['awareness', 'consideration', 'decision', 'retention']),
  count: z.number().int().min(1).max(10).default(5),
  preferNewCluster: z.boolean().default(false),
  saveToDatabase: z.boolean().default(false),
});

/**
 * POST /api/ideas/generate
 * Generate topic suggestions using AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = GenerateTopicsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Get existing topics and clusters for context
    const existingPosts = await db.query.blogPosts.findMany({
      columns: {
        title: true,
        primaryKeyword: true,
      },
    });

    const existingIdeas = await db.query.contentIdeas.findMany({
      columns: {
        topic: true,
        primaryKeyword: true,
      },
    });

    const clusters = await db.query.topicClusters.findMany({
      columns: {
        name: true,
      },
    });

    const existingTopics = [
      ...existingPosts.map((p) => p.title),
      ...existingIdeas.map((i) => i.topic),
    ];

    const existingClusters = clusters.map((c) => c.name);

    // Generate suggestions
    const result = await generateTopicSuggestions({
      productLine: data.productLine,
      targetAudience: data.targetAudience,
      funnelStage: data.funnelStage as FunnelStage,
      count: data.count,
      existingTopics,
      clusterContext: {
        existingClusters,
        preferNewCluster: data.preferNewCluster,
      },
    });

    // Optionally save to database
    if (data.saveToDatabase && result.suggestions.length > 0) {
      const ideaValues = result.suggestions.map((s) => ({
        topic: s.topic,
        primaryKeyword: s.primaryKeyword,
        secondaryKeywords: [] as string[],
        targetAudience: data.targetAudience,
        searchIntent: s.searchIntent,
        suggestedSlug: s.topic
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 100),
        funnelStage: data.funnelStage,
        justification: s.justification,
        aiGenerated: true,
        status: 'idea',
      }));

      await db.insert(contentIdeas).values(ideaValues);
    }

    return NextResponse.json({
      suggestions: result.suggestions,
      savedToDatabase: data.saveToDatabase,
    });
  } catch (error) {
    console.error('Error generating topics:', error);
    return NextResponse.json(
      { error: 'Failed to generate topics' },
      { status: 500 }
    );
  }
}
