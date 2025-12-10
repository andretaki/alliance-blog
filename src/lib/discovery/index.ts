/**
 * Discovery Module
 *
 * Topic discovery and scoring for content gap analysis.
 */

// Topic Finder
export {
  findContentGaps,
  findContentGapsWithDedup,
  generateTopicIdeas,
  generateTopicIdeasWithDedup,
  filterTopicsWithDedup,
  checkTopicDuplicate,
  scoreEEAT,
  suggestAngles,
  angleToContentType,
  getCollectionHandles,
  getCollectionInfo,
  getContentIndex,
  type TopicGap,
  type TopicSuggestion,
  type FilteredTopicSuggestion,
  type FilteredTopicsResult,
  type EEATScore,
  type ContentAngle,
  type SearchIntent,
  type AngleSuggestion,
  type DeduplicationOptions,
  type ContentIndex,
  type ExistingPost,
} from './topic-finder';

// Topic Scorer
export {
  scoreTopic,
  prioritizeTopics,
  filterByThreshold,
  filterByRecommendation,
  groupByPriority,
  getScoringStats,
  formatScoredTopic,
  type ScoredTopic,
  type TopicPriority,
  type ScoringWeights,
} from './topic-scorer';

// Existing Content (deduplication)
export {
  fetchExistingPosts,
  fetchExistingIdeas,
  buildContentIndex,
  isDuplicateTopic,
  findRelatedPosts,
  saveContentIndex,
  loadContentIndex,
  getContentStats,
  levenshteinDistance,
  type DuplicateCheck,
  type ExistingIdea,
} from './existing-content';
