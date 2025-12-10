/**
 * Brief Generation API
 *
 * POST /api/ideas/[id]/brief - Generate a brief for an idea
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { contentIdeas, blogPosts, authors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDefaultProvider } from '@/lib/ai/providers';
import { BriefSchema } from '@/lib/schema/canonical.zod';
import { BRIEF_CREATION_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';
import { AI_CONFIG } from '@/lib/config/constants';
import { searchSimilarPosts } from '@/lib/ai/retrieval';
import type { Brief } from '@/lib/schema/canonical';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const GenerateBriefSchema = z.object({
  authorId: z.string().uuid(),
  targetWordCount: z.number().int().min(500).max(5000).default(1500),
  includeInternalLinks: z.boolean().default(true),
  includeFaqs: z.boolean().default(true),
});

/**
 * POST /api/ideas/[id]/brief
 * Generate a content brief for an idea
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const parsed = GenerateBriefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Get the idea
    const idea = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.id, id),
      with: {
        cluster: true,
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }

    // Get the author
    const author = await db.query.authors.findFirst({
      where: eq(authors.id, data.authorId),
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 400 }
      );
    }

    // Get existing published posts for internal linking suggestions
    const existingPosts = await db.query.blogPosts.findMany({
      where: eq(blogPosts.status, 'published'),
      columns: {
        id: true,
        title: true,
        slug: true,
        primaryKeyword: true,
        canonicalUrl: true,
      },
    });

    // Find similar posts for reference
    let similarPosts: typeof existingPosts = [];
    try {
      const results = await searchSimilarPosts(idea.topic, { limit: 3 });
      similarPosts = results.map((r) => ({
        id: r.postId,
        title: '',
        slug: '',
        primaryKeyword: '',
        canonicalUrl: '',
      }));
    } catch {
      // Continue without similar posts if retrieval fails
    }

    // Build the prompt
    const prompt = buildBriefPrompt({
      topic: idea.topic,
      primaryKeyword: idea.primaryKeyword,
      secondaryKeywords: idea.secondaryKeywords || [],
      targetAudience: idea.targetAudience || 'general audience',
      searchIntent: idea.searchIntent,
      funnelStage: idea.funnelStage,
      clusterName: idea.cluster?.name,
      authorName: author.name,
      authorCredentials: author.credentials,
      targetWordCount: data.targetWordCount,
      existingPosts: existingPosts.map((p) => ({
        title: p.title,
        slug: p.slug,
        keyword: p.primaryKeyword,
        url: p.canonicalUrl,
      })),
      includeInternalLinks: data.includeInternalLinks,
      includeFaqs: data.includeFaqs,
    });

    // Generate the brief
    const brief = await getDefaultProvider().generateStructured(prompt, BriefSchema, {
      systemPrompt: BRIEF_CREATION_SYSTEM_PROMPT,
      temperature: AI_CONFIG.temperature.creative,
      maxTokens: AI_CONFIG.maxTokens.brief,
    });

    // Update the idea with the brief
    const [updatedIdea] = await db
      .update(contentIdeas)
      .set({
        brief: brief as Brief,
        status: 'brief',
        updatedAt: new Date(),
      })
      .where(eq(contentIdeas.id, id))
      .returning();

    return NextResponse.json({
      brief,
      idea: updatedIdea,
    });
  } catch (error) {
    console.error('Error generating brief:', error);
    return NextResponse.json(
      { error: 'Failed to generate brief' },
      { status: 500 }
    );
  }
}

interface BriefPromptInput {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  targetAudience: string;
  searchIntent: string;
  funnelStage: string | null;
  clusterName: string | undefined;
  authorName: string;
  authorCredentials: string;
  targetWordCount: number;
  existingPosts: Array<{
    title: string;
    slug: string;
    keyword: string;
    url: string;
  }>;
  includeInternalLinks: boolean;
  includeFaqs: boolean;
}

function buildBriefPrompt(input: BriefPromptInput): string {
  return `
## TOPIC DETAILS

Topic: ${input.topic}
Primary Keyword: ${input.primaryKeyword}
Secondary Keywords: ${input.secondaryKeywords.join(', ') || 'None specified'}
Target Audience: ${input.targetAudience}
Search Intent: ${input.searchIntent}
${input.funnelStage ? `Funnel Stage: ${input.funnelStage}` : ''}
${input.clusterName ? `Topic Cluster: ${input.clusterName}` : ''}

## AUTHOR INFORMATION

Author: ${input.authorName}
Credentials: ${input.authorCredentials}

## CONTENT REQUIREMENTS

Target Word Count: ~${input.targetWordCount} words

## EXISTING CONTENT FOR INTERNAL LINKING

${input.includeInternalLinks && input.existingPosts.length > 0
    ? input.existingPosts
        .map((p) => `- "${p.title}" (${p.url}) - Keyword: ${p.keyword}`)
        .join('\n')
    : 'No existing content available for internal linking'
}

## INSTRUCTIONS

Generate a comprehensive content brief for this topic. Include:

1. A suggested title (optimized for both SEO and click-through)
2. A suggested slug (URL-friendly)
3. A draft hero answer (2-4 sentences directly answering the main question)
4. A detailed outline with:
   - 4-6 main sections (H2s)
   - 2-3 subsections per main section (H3s) where appropriate
   - Key points to cover in each section
   - Estimated word count per section
5. Key questions the content must answer
${input.includeInternalLinks ? '6. Suggested internal links with anchor text and placement' : ''}
7. External references to cite (types of sources, not specific URLs)
${input.includeFaqs ? '8. 3-5 FAQ suggestions with key points for answers' : ''}
9. Experience evidence prompts (what real-world examples/data the author should add)

The brief should help an expert writer create authoritative, helpful content that
demonstrates E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).
`;
}
