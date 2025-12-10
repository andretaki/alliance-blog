/**
 * Topic Scorer
 *
 * Scores and prioritizes topics based on E-E-A-T, uniqueness,
 * product relevance, and content type fit.
 */

import {
  matchTopicToProducts,
  extractChemicalNames,
  getCollectionByHandle,
} from '@/lib/shopify/product-matcher';
import type { TopicSuggestion, EEATScore, ContentAngle } from './topic-finder';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Priority recommendation for a topic
 */
export type TopicPriority = 'high_priority' | 'medium_priority' | 'low_priority' | 'skip';

/**
 * A scored topic with ranking and recommendation
 */
export interface ScoredTopic extends TopicSuggestion {
  totalScore: number; // Combined score 0-100
  ranking: number;
  recommendation: TopicPriority;
  scoreBreakdown: {
    eeatScore: number; // 0-40
    uniquenessScore: number; // 0-20
    productRelevanceScore: number; // 0-20
    contentTypeFitScore: number; // 0-20
  };
}

/**
 * Scoring weights
 */
export interface ScoringWeights {
  eeat: number; // Default: 0.4
  uniqueness: number; // Default: 0.2
  productRelevance: number; // Default: 0.2
  contentTypeFit: number; // Default: 0.2
}

// ============================================================================
// DEFAULT WEIGHTS
// ============================================================================

const DEFAULT_WEIGHTS: ScoringWeights = {
  eeat: 0.4,
  uniqueness: 0.2,
  productRelevance: 0.2,
  contentTypeFit: 0.2,
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Score a single topic suggestion
 */
export function scoreTopic(
  topic: TopicSuggestion,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Omit<ScoredTopic, 'ranking'> {
  // Calculate E-E-A-T score (average of 4 factors, scaled to weight)
  const eeatAverage = calculateEEATAverage(topic.eeatScore);
  const eeatScore = eeatAverage * weights.eeat * 10; // 0-40 if weight is 0.4

  // Calculate uniqueness score
  const uniquenessScore = calculateUniquenessScore(topic) * weights.uniqueness * 100;

  // Calculate product relevance score
  const productRelevanceScore =
    calculateProductRelevanceScore(topic) * weights.productRelevance * 100;

  // Calculate content type fit score
  const contentTypeFitScore =
    calculateContentTypeFitScore(topic) * weights.contentTypeFit * 100;

  const totalScore = Math.round(
    eeatScore + uniquenessScore + productRelevanceScore + contentTypeFitScore
  );

  const recommendation = getRecommendation(totalScore);

  return {
    ...topic,
    totalScore,
    recommendation,
    scoreBreakdown: {
      eeatScore: Math.round(eeatScore),
      uniquenessScore: Math.round(uniquenessScore),
      productRelevanceScore: Math.round(productRelevanceScore),
      contentTypeFitScore: Math.round(contentTypeFitScore),
    },
  };
}

/**
 * Score and prioritize a list of topics
 */
export function prioritizeTopics(
  topics: TopicSuggestion[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoredTopic[] {
  // Score all topics
  const scored = topics.map((topic) => scoreTopic(topic, weights));

  // Sort by total score descending
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Add rankings
  return scored.map((topic, index) => ({
    ...topic,
    ranking: index + 1,
  }));
}

/**
 * Filter topics by minimum score threshold
 */
export function filterByThreshold(
  topics: ScoredTopic[],
  minScore: number
): ScoredTopic[] {
  return topics.filter((topic) => topic.totalScore >= minScore);
}

/**
 * Filter topics by recommendation level
 */
export function filterByRecommendation(
  topics: ScoredTopic[],
  allowedPriorities: TopicPriority[]
): ScoredTopic[] {
  return topics.filter((topic) => allowedPriorities.includes(topic.recommendation));
}

/**
 * Get topics grouped by priority
 */
export function groupByPriority(
  topics: ScoredTopic[]
): Record<TopicPriority, ScoredTopic[]> {
  const groups: Record<TopicPriority, ScoredTopic[]> = {
    high_priority: [],
    medium_priority: [],
    low_priority: [],
    skip: [],
  };

  for (const topic of topics) {
    groups[topic.recommendation].push(topic);
  }

  return groups;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate average E-E-A-T score (1-10)
 */
function calculateEEATAverage(eeat: EEATScore): number {
  return (eeat.experience + eeat.expertise + eeat.authority + eeat.trust) / 4;
}

/**
 * Calculate uniqueness score (0-1)
 * Based on quality of unique angle and specificity of topic
 */
function calculateUniquenessScore(topic: TopicSuggestion): number {
  let score = 0.5; // Base score

  // Bonus for having a specific unique angle
  if (topic.uniqueAngle && topic.uniqueAngle.length > 20) {
    score += 0.2;
  }

  // Bonus for specific topic (not generic)
  const topicWords = topic.topic.split(' ').length;
  if (topicWords >= 5 && topicWords <= 12) {
    score += 0.15;
  }

  // Bonus for specific keyword (not just the generic topic)
  if (topic.primaryKeyword !== topic.topic.toLowerCase()) {
    score += 0.1;
  }

  // Check for comparison or specific application focus
  if (
    topic.topic.toLowerCase().includes(' vs ') ||
    topic.topic.toLowerCase().includes(' for ') ||
    topic.topic.toLowerCase().includes(' in ')
  ) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/**
 * Calculate product relevance score (0-1)
 * Based on how well the topic matches our products
 */
function calculateProductRelevanceScore(topic: TopicSuggestion): number {
  let score = 0;

  // Check if relevant products are specified
  if (topic.relevantProducts && topic.relevantProducts.length > 0) {
    // Base score for having products
    score += 0.3;

    // Validate that products actually exist
    const validProducts = topic.relevantProducts.filter(
      (handle) => getCollectionByHandle(handle) !== undefined
    );

    if (validProducts.length > 0) {
      score += 0.3;
    }

    // Bonus for multiple relevant products
    if (validProducts.length >= 2) {
      score += 0.1;
    }
  }

  // Check if topic matches our products via keyword matching
  const matchedProducts = matchTopicToProducts(topic.topic, { maxResults: 5 });
  if (matchedProducts.length > 0) {
    score += 0.2;
  }
  if (matchedProducts.length >= 3) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/**
 * Calculate content type fit score (0-1)
 * Based on how well the angle matches the topic and intent
 */
function calculateContentTypeFitScore(topic: TopicSuggestion): number {
  let score = 0.5; // Base score

  // Check if angle matches search intent
  const angleIntentFit = getAngleIntentFit(topic.angle, topic.searchIntent);
  score += angleIntentFit * 0.3;

  // Check if topic structure matches angle
  const topicLower = topic.topic.toLowerCase();

  switch (topic.angle) {
    case 'howto':
      if (
        topicLower.startsWith('how to') ||
        topicLower.includes('guide') ||
        topicLower.includes('steps')
      ) {
        score += 0.2;
      }
      break;

    case 'comparison':
      if (topicLower.includes(' vs ') || topicLower.includes('compare')) {
        score += 0.2;
      }
      break;

    case 'safety':
      if (
        topicLower.includes('safe') ||
        topicLower.includes('hazard') ||
        topicLower.includes('handling')
      ) {
        score += 0.2;
      }
      break;

    case 'technical':
      if (
        topicLower.includes('specification') ||
        topicLower.includes('properties') ||
        topicLower.includes('data')
      ) {
        score += 0.2;
      }
      break;

    case 'faq':
      if (
        topicLower.includes('questions') ||
        topicLower.includes('faq') ||
        topicLower.endsWith('?')
      ) {
        score += 0.2;
      }
      break;

    case 'application':
      if (
        topicLower.includes(' for ') ||
        topicLower.includes(' in ') ||
        topicLower.includes('uses')
      ) {
        score += 0.2;
      }
      break;
  }

  return Math.min(score, 1);
}

/**
 * Get fit score for angle + intent combination (0-1)
 */
function getAngleIntentFit(
  angle: ContentAngle,
  intent: TopicSuggestion['searchIntent']
): number {
  // Define ideal intent for each angle
  const idealIntents: Record<ContentAngle, TopicSuggestion['searchIntent'][]> = {
    howto: ['informational'],
    comparison: ['commercial', 'informational'],
    safety: ['informational'],
    technical: ['informational', 'commercial'],
    faq: ['informational'],
    application: ['commercial', 'transactional'],
  };

  const ideals = idealIntents[angle];
  if (ideals.includes(intent)) {
    return 1;
  }

  // Partial match for close intents
  if (intent === 'commercial' && ideals.includes('transactional')) {
    return 0.7;
  }
  if (intent === 'transactional' && ideals.includes('commercial')) {
    return 0.7;
  }

  return 0.3;
}

/**
 * Get recommendation based on total score
 */
function getRecommendation(totalScore: number): TopicPriority {
  if (totalScore >= 75) return 'high_priority';
  if (totalScore >= 55) return 'medium_priority';
  if (totalScore >= 35) return 'low_priority';
  return 'skip';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get scoring statistics for a list of topics
 */
export function getScoringStats(topics: ScoredTopic[]): {
  total: number;
  averageScore: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  skipped: number;
  topScorer: ScoredTopic | null;
} {
  if (topics.length === 0) {
    return {
      total: 0,
      averageScore: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      skipped: 0,
      topScorer: null,
    };
  }

  const groups = groupByPriority(topics);
  const totalScore = topics.reduce((sum, t) => sum + t.totalScore, 0);

  return {
    total: topics.length,
    averageScore: Math.round(totalScore / topics.length),
    highPriority: groups.high_priority.length,
    mediumPriority: groups.medium_priority.length,
    lowPriority: groups.low_priority.length,
    skipped: groups.skip.length,
    topScorer: topics[0] ?? null,
  };
}

/**
 * Format a scored topic for display
 */
export function formatScoredTopic(topic: ScoredTopic): string {
  const priorityEmoji: Record<TopicPriority, string> = {
    high_priority: '🟢',
    medium_priority: '🟡',
    low_priority: '🟠',
    skip: '🔴',
  };

  return `${priorityEmoji[topic.recommendation]} #${topic.ranking} [${topic.totalScore}] ${topic.topic}
   Keyword: ${topic.primaryKeyword} | Angle: ${topic.angle} | Intent: ${topic.searchIntent}
   E-E-A-T: ${topic.scoreBreakdown.eeatScore} | Unique: ${topic.scoreBreakdown.uniquenessScore} | Products: ${topic.scoreBreakdown.productRelevanceScore} | Fit: ${topic.scoreBreakdown.contentTypeFitScore}`;
}
