/**
 * Topic Suggestion Generation
 *
 * Generate blog topic suggestions using AI.
 */

import { getDefaultProvider } from '../providers';
import { TOPIC_SUGGESTION_SYSTEM_PROMPT } from '../prompts/system';
import { TopicSuggestionOutputSchema } from '@/lib/schema/canonical.zod';
import type {
  TopicSuggestionInput,
  TopicSuggestionOutput,
  FunnelStage,
} from '@/lib/schema/canonical';
import { AI_CONFIG } from '@/lib/config/constants';

/**
 * Generate topic suggestions based on product line and audience
 */
export async function generateTopicSuggestions(
  input: TopicSuggestionInput
): Promise<TopicSuggestionOutput> {
  const prompt = buildTopicPrompt(input);

  const result = await getDefaultProvider().generateStructured(
    prompt,
    TopicSuggestionOutputSchema,
    {
      systemPrompt: TOPIC_SUGGESTION_SYSTEM_PROMPT,
      temperature: AI_CONFIG.temperature.creative,
      maxTokens: AI_CONFIG.maxTokens.topicSuggestion,
    }
  );

  return result;
}

/**
 * Build the prompt for topic suggestion
 */
function buildTopicPrompt(input: TopicSuggestionInput): string {
  const funnelStageContext = getFunnelStageContext(input.funnelStage);

  return `
Product line: ${input.productLine}
Target audience: ${input.targetAudience}
Funnel stage: ${input.funnelStage}
${funnelStageContext}

Topics we already cover (avoid duplicates and overlaps):
${input.existingTopics.length > 0 ? input.existingTopics.map((t) => `- ${t}`).join('\n') : '(None yet)'}

${input.clusterContext ? `
Existing topic clusters:
${input.clusterContext.existingClusters.map((c) => `- ${c}`).join('\n')}
${input.clusterContext.preferNewCluster ? '\nPrefer suggesting topics that could form a NEW cluster.' : '\nPrefer fitting topics into existing clusters where appropriate.'}
` : ''}

Generate exactly ${input.count} topic suggestions that would genuinely help our target
audience. Focus on practical problems they face and questions they actually ask.

For each suggestion, provide:
1. A clear topic title
2. A primary keyword to target (2-4 words)
3. The search intent (informational, commercial, transactional, navigational)
4. Estimated search volume (high/medium/low - your best estimate based on topic relevance)
5. Which cluster this belongs to (existing or suggest new)
6. A 2-3 sentence justification explaining HOW this helps the user (not just SEO benefits)
7. An example target query (what someone would actually type in Google)
8. How we can differentiate from competitors (our unique angle)
`;
}

/**
 * Get additional context for funnel stage
 */
function getFunnelStageContext(stage: FunnelStage): string {
  switch (stage) {
    case 'awareness':
      return `
Funnel Stage Context: AWARENESS
- User is learning about a problem or need
- Looking for educational content, not products yet
- Topics should answer "What is...", "Why do I need...", "Understanding..."
- Avoid being too salesy - focus on education and building trust`;

    case 'consideration':
      return `
Funnel Stage Context: CONSIDERATION
- User knows their problem and is exploring solutions
- Looking for comparisons, reviews, how-to guides
- Topics should answer "How to choose...", "Best practices for...", "Comparing..."
- Can mention products but focus on helping them evaluate options`;

    case 'decision':
      return `
Funnel Stage Context: DECISION
- User is ready to buy and looking for specific product info
- Looking for specifications, pricing factors, buying guides
- Topics should answer "Which product for...", "How to order...", "What to expect..."
- Can be more product-focused but still provide genuine value`;

    case 'retention':
      return `
Funnel Stage Context: RETENTION
- User has already purchased, looking for ongoing value
- Looking for usage tips, troubleshooting, advanced techniques
- Topics should answer "How to get the most from...", "Troubleshooting...", "Advanced tips for..."
- Focus on helping them succeed with what they bought`;

    default:
      return '';
  }
}

/**
 * Validate topic suggestions against existing content
 */
export function filterDuplicateTopics(
  suggestions: TopicSuggestionOutput['suggestions'],
  existingTopics: string[],
  similarityThreshold = 0.7
): TopicSuggestionOutput['suggestions'] {
  const lowerExisting = existingTopics.map((t) => t.toLowerCase());

  return suggestions.filter((suggestion) => {
    const lowerTopic = suggestion.topic.toLowerCase();
    const lowerKeyword = suggestion.primaryKeyword.toLowerCase();

    // Check for exact or near matches
    for (const existing of lowerExisting) {
      // Simple similarity check - can be enhanced with fuzzy matching
      if (
        existing.includes(lowerTopic) ||
        lowerTopic.includes(existing) ||
        existing.includes(lowerKeyword)
      ) {
        return false;
      }
    }

    return true;
  });
}
