/**
 * Post Generation Orchestrator
 *
 * Single entry point for generating a complete blog post from a brief.
 * Handles the full pipeline: brief → outline → draft → validation → final post
 */

import { v4 as uuidv4 } from 'uuid';
import { generateDraft, type DraftGenerationInput } from './drafts';
import { generateOutline, validateOutline, outlineToContentBrief } from '@/lib/outline/outline-generator';
import {
  validateContent,
  quickValidate,
  type ValidationResult,
  type ValidationConfig,
} from '../validation/content-validator';
import type {
  BlogPost,
  Brief,
  ContentIdea,
  PostStatus,
  Author,
} from '@/lib/schema/canonical';
import type { ContentOutline, BlogPostReference } from '@/lib/outline/outline-types';
import type { TopicSuggestion } from '@/lib/discovery/topic-finder';

// ============================================================================
// TYPES
// ============================================================================

export interface GenerationOptions {
  /** Use style analysis for generation (slower, higher quality) */
  useStyleAnalysis?: boolean;
  /** Specific opening hook type to use */
  targetOpeningHook?: 'story' | 'problem' | 'statistic' | 'question';
  /** Product links to feature in content */
  productLinks?: Array<{ url: string; name: string }>;
  /** Exemplar posts for style reference */
  exemplarPosts?: BlogPost[];
  /** Existing posts for internal linking */
  existingPosts?: BlogPostReference[];
  /** Target word count */
  targetWordCount?: number;
  /** Number of FAQs to generate */
  faqCount?: number;
  /** Validation configuration */
  validationConfig?: ValidationConfig;
  /** Auto-repair if validation fails (up to N attempts) */
  autoRepairAttempts?: number;
  /** Skip validation entirely */
  skipValidation?: boolean;
}

export interface GenerationResult {
  success: boolean;
  post: BlogPost | null;
  outline: ContentOutline | null;
  validation: ValidationResult | null;
  repairAttempts: number;
  errors: string[];
  warnings: string[];
  /** Time taken in milliseconds */
  duration: number;
}

export interface BriefInput {
  /** Either provide a brief directly... */
  brief?: Brief;
  /** ...or provide a content idea to generate brief from */
  contentIdea?: ContentIdea;
  /** ...or provide a topic suggestion to start from scratch */
  topic?: TopicSuggestion;
}

export interface AuthorInput {
  id: string;
  name: string;
  role: string;
  credentials: string;
  profileUrl?: string | null;
}

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Generate a complete blog post from a brief, content idea, or topic.
 *
 * This is the single entry point for the entire generation pipeline.
 *
 * @example
 * // From an existing brief
 * const result = await generatePostFromBrief(
 *   { brief: myBrief },
 *   { id: 'author-1', name: 'John Doe', role: 'Technical Writer', credentials: '10 years experience' },
 *   { useStyleAnalysis: true }
 * );
 *
 * @example
 * // From a topic suggestion (generates outline and brief)
 * const result = await generatePostFromBrief(
 *   { topic: myTopicSuggestion },
 *   authorInfo,
 *   { targetWordCount: 2000, faqCount: 5 }
 * );
 */
export async function generatePostFromBrief(
  input: BriefInput,
  author: AuthorInput,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let outline: ContentOutline | null = null;
  let post: BlogPost | null = null;
  let validation: ValidationResult | null = null;
  let repairAttempts = 0;

  try {
    // Step 1: Resolve brief
    const brief = await resolveBrief(input, options);
    if (!brief) {
      return {
        success: false,
        post: null,
        outline: null,
        validation: null,
        repairAttempts: 0,
        errors: ['Could not resolve or generate brief from input'],
        warnings: [],
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Generate outline if we started from a topic
    if (input.topic) {
      outline = await generateOutline(input.topic, {
        targetWordCount: options.targetWordCount,
        faqCount: options.faqCount,
        existingPosts: options.existingPosts,
      });

      const outlineValidation = validateOutline(outline);
      if (!outlineValidation.valid) {
        errors.push(...outlineValidation.issues);
      }
      warnings.push(...outlineValidation.warnings);
    }

    // Step 3: Prepare draft generation input
    const draftInput: DraftGenerationInput = {
      brief,
      authorInfo: {
        id: author.id,
        name: author.name,
        role: author.role,
        credentials: author.credentials,
        profileUrl: author.profileUrl,
      },
      exemplarPosts: options.exemplarPosts || [],
      primaryKeyword: brief.suggestedTitle.split(' ').slice(0, 3).join(' '), // Fallback
      searchIntent: 'informational', // Default, should be in brief ideally
      useStyleAnalysis: options.useStyleAnalysis,
      targetOpeningHook: options.targetOpeningHook,
      productLinks: options.productLinks,
    };

    // Extract keyword and intent from content idea if available
    if (input.contentIdea) {
      draftInput.primaryKeyword = input.contentIdea.primaryKeyword;
      draftInput.searchIntent = input.contentIdea.searchIntent;
      draftInput.clusterTopicId = input.contentIdea.clusterTopicId;
    } else if (input.topic) {
      draftInput.primaryKeyword = input.topic.primaryKeyword;
      draftInput.searchIntent = input.topic.searchIntent;
    }

    // Step 4: Generate the draft
    post = await generateDraft(draftInput);

    // Step 5: Validate unless skipped
    if (!options.skipValidation) {
      validation = validateContent(post, options.validationConfig);

      // Step 6: Auto-repair if needed (capped at 2 attempts max)
      const MAX_REPAIR_ATTEMPTS = 2;
      const maxRepairs = Math.min(options.autoRepairAttempts ?? 0, MAX_REPAIR_ATTEMPTS);

      while (!validation.valid && repairAttempts < maxRepairs) {
        repairAttempts++;
        const failingFields = validation.issues
          .filter(i => i.severity === 'error')
          .map(i => i.field)
          .slice(0, 3);
        warnings.push(
          `Validation failed (attempt ${repairAttempts}/${maxRepairs}), ` +
          `repairing: ${failingFields.join(', ')}`
        );

        const repaired = await attemptRepair(post, validation, draftInput);
        if (repaired) {
          post = repaired;
          // Revalidate after each repair attempt
          validation = validateContent(post, options.validationConfig);
        } else {
          warnings.push(`Repair attempt ${repairAttempts} produced no changes`);
          break; // Repair failed, stop trying
        }
      }

      // Final status after all repair attempts
      if (!validation.valid && repairAttempts > 0) {
        warnings.push(
          `Post still has ${validation.issues.filter(i => i.severity === 'error').length} errors ` +
          `after ${repairAttempts} repair attempt(s). Manual review required.`
        );
      }

      // Add validation warnings/errors to result
      for (const issue of validation.issues) {
        if (issue.severity === 'error') {
          errors.push(`[${issue.field}] ${issue.message}`);
        } else if (issue.severity === 'warning') {
          warnings.push(`[${issue.field}] ${issue.message}`);
        }
      }
    }

    return {
      success: validation ? validation.valid : true,
      post,
      outline,
      validation,
      repairAttempts,
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Generation failed: ${errorMessage}`);

    return {
      success: false,
      post,
      outline,
      validation,
      repairAttempts,
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve input to a Brief, generating one if needed
 */
async function resolveBrief(
  input: BriefInput,
  options: GenerationOptions
): Promise<Brief | null> {
  // If brief provided directly, use it
  if (input.brief) {
    return input.brief;
  }

  // If content idea provided, extract/generate brief
  if (input.contentIdea) {
    // Content idea might already have a brief
    if (input.contentIdea.brief) {
      return input.contentIdea.brief;
    }

    // Generate brief from content idea
    return generateBriefFromIdea(input.contentIdea, options);
  }

  // If topic provided, generate outline first then convert to brief
  if (input.topic) {
    const outline = await generateOutline(input.topic, {
      targetWordCount: options.targetWordCount,
      faqCount: options.faqCount,
      existingPosts: options.existingPosts,
    });

    return outlineToBrief(outline, input.topic);
  }

  return null;
}

/**
 * Generate a Brief from a ContentIdea
 */
async function generateBriefFromIdea(
  idea: ContentIdea,
  options: GenerationOptions
): Promise<Brief> {
  // Create a minimal topic suggestion from the idea
  // Note: SearchIntent in topic-finder doesn't include 'navigational', so we map it
  const mappedIntent = idea.searchIntent === 'navigational' ? 'informational' : idea.searchIntent;

  const topicSuggestion: TopicSuggestion = {
    topic: idea.topic,
    primaryKeyword: idea.primaryKeyword,
    angle: 'howto', // Default angle
    searchIntent: mappedIntent,
    eeatScore: { experience: 8, expertise: 8, authority: 8, trust: 8 },
    uniqueAngle: idea.justification || 'Expert chemical supplier perspective',
    relevantProducts: [],
  };

  const outline = await generateOutline(topicSuggestion, {
    targetWordCount: options.targetWordCount,
    faqCount: options.faqCount,
    existingPosts: options.existingPosts,
  });

  return outlineToBrief(outline, topicSuggestion);
}

/**
 * Convert a ContentOutline to a Brief
 */
function outlineToBrief(outline: ContentOutline, topic: TopicSuggestion): Brief {
  return {
    suggestedTitle: outline.meta.topic,
    suggestedSlug: slugify(outline.meta.topic),
    heroAnswerDraft: outline.heroAnswer.keyPoints.join(' '),
    outline: outline.sections.map((section) => ({
      headingLevel: section.headingLevel,
      headingText: section.heading,
      keyPoints: section.keyPoints,
      estimatedWordCount: section.estimatedWords,
    })),
    keyQuestions: outline.faqSection.questions.map((q) => q.question),
    suggestedInternalLinks: outline.sections
      .filter((s) => s.internalLink)
      .map((s) => ({
        targetUrl: s.internalLink!,
        suggestedAnchorText: s.heading,
        placement: s.heading,
        reason: 'Related content',
      })),
    externalReferences: [], // Could be enhanced
    faqSuggestions: outline.faqSection.questions.map((q) => ({
      question: q.question,
      keyPointsForAnswer: q.keyPointsForAnswer,
    })),
    experiencePrompts: outline.meta.eeatHooks.map(
      (hook) => `[PLACEHOLDER: Share specific experience with ${hook}]`
    ),
  };
}

/** Fields that can be surgically repaired without full regeneration */
type RepairableField = 'heroAnswer' | 'sections' | 'faq' | 'experienceEvidence' | 'cta';

/**
 * Attempt to repair a post based on validation issues
 * Surgical repairs: only regenerate failing fields, not the whole post
 */
async function attemptRepair(
  post: BlogPost,
  validation: ValidationResult,
  originalInput: DraftGenerationInput
): Promise<BlogPost | null> {
  // Collect all error-severity repairs grouped by field
  const criticalRepairs = validation.repairSuggestions.filter((r) =>
    validation.issues.some((i) => i.field === r.field && i.severity === 'error')
  );

  if (criticalRepairs.length === 0) {
    return null; // No actionable repairs
  }

  // Group repairs by field type
  const repairsByField = new Map<string, string[]>();
  for (const repair of criticalRepairs) {
    const baseField = repair.field.split('[')[0] as RepairableField;
    if (!repairsByField.has(baseField)) {
      repairsByField.set(baseField, []);
    }
    repairsByField.get(baseField)!.push(repair.prompt);
  }

  // Start with a copy of the post
  const repairedPost = { ...post };

  // Apply targeted repairs based on field type
  for (const [field, prompts] of repairsByField) {
    try {
      switch (field) {
        case 'heroAnswer':
          // Regenerate just the hero answer
          repairedPost.heroAnswer = await regenerateHeroAnswer(
            originalInput,
            prompts.join('\n')
          );
          break;

        case 'sections':
          // Regenerate only the problematic sections
          const sectionIndices = criticalRepairs
            .filter(r => r.field.startsWith('sections['))
            .map(r => {
              const match = r.field.match(/sections\[(\d+)\]/);
              return match ? parseInt(match[1], 10) : -1;
            })
            .filter(i => i >= 0);

          for (const idx of sectionIndices) {
            if (post.sections[idx]) {
              const repaired = await regenerateSection(
                originalInput,
                post.sections[idx],
                prompts.join('\n')
              );
              if (repaired) {
                repairedPost.sections[idx] = repaired;
              }
            }
          }
          break;

        case 'faq':
          // Regenerate FAQs
          repairedPost.faq = await regenerateFaqs(
            originalInput,
            post.faq,
            prompts.join('\n')
          );
          break;

        case 'experienceEvidence':
          // Add experience evidence markers
          repairedPost.experienceEvidence = {
            summary: 'Experience evidence placeholders for editorial review',
            details: null,
            placeholders: originalInput.brief.experiencePrompts.map(
              (prompt, i) => `[EXPERIENCE_EVIDENCE_${i + 1}]: ${prompt}`
            ),
          };
          break;

        default:
          // For other fields, fall back to full regeneration
          console.warn(`Cannot surgically repair field: ${field}, skipping`);
      }
    } catch (error) {
      console.error(`Failed to repair field ${field}:`, error);
      // Continue with other repairs
    }
  }

  return repairedPost;
}

/**
 * Regenerate just the hero answer
 */
async function regenerateHeroAnswer(
  input: DraftGenerationInput,
  repairPrompt: string
): Promise<string> {
  // For now, return a placeholder that signals this needs manual review
  // In a full implementation, this would call the AI to regenerate just this field
  const original = input.brief.heroAnswerDraft;
  return `${original}\n\n[NEEDS_REVIEW: ${repairPrompt}]`;
}

/**
 * Regenerate a specific section
 */
async function regenerateSection(
  input: DraftGenerationInput,
  section: BlogPost['sections'][0],
  repairPrompt: string
): Promise<BlogPost['sections'][0] | null> {
  // Return section with repair marker for now
  // Full implementation would call AI to regenerate just this section
  return {
    ...section,
    body: `${section.body}\n\n<!-- NEEDS_REVIEW: ${repairPrompt} -->`,
  };
}

/**
 * Regenerate FAQs
 */
async function regenerateFaqs(
  input: DraftGenerationInput,
  existingFaqs: BlogPost['faq'],
  repairPrompt: string
): Promise<BlogPost['faq']> {
  // Extend existing FAQs with suggestions from brief
  const faqs = [...existingFaqs];
  const targetCount = input.brief.faqSuggestions.length;

  // Add any missing FAQs from the brief
  for (const suggestion of input.brief.faqSuggestions) {
    if (!faqs.some(f => f.question.toLowerCase().includes(suggestion.question.toLowerCase().slice(0, 20)))) {
      faqs.push({
        id: `faq-repair-${Date.now()}-${faqs.length}`,
        question: suggestion.question,
        answer: `[PLACEHOLDER: Answer based on: ${suggestion.keyPointsForAnswer.join(', ')}]`,
      });
    }
  }

  return faqs.slice(0, Math.max(targetCount, 5));
}

/**
 * Create a URL-safe slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick generation with minimal configuration
 */
export async function quickGenerate(
  topic: string,
  keyword: string,
  author: AuthorInput
): Promise<GenerationResult> {
  const topicSuggestion: TopicSuggestion = {
    topic,
    primaryKeyword: keyword,
    angle: 'howto',
    searchIntent: 'informational',
    eeatScore: { experience: 8, expertise: 8, authority: 8, trust: 8 },
    uniqueAngle: 'Expert chemical supplier perspective',
    relevantProducts: [],
  };

  return generatePostFromBrief(
    { topic: topicSuggestion },
    author,
    { skipValidation: false }
  );
}

/**
 * Generate with full validation and auto-repair
 */
export async function generateWithValidation(
  input: BriefInput,
  author: AuthorInput,
  options: Omit<GenerationOptions, 'skipValidation' | 'autoRepairAttempts'> = {}
): Promise<GenerationResult> {
  return generatePostFromBrief(input, author, {
    ...options,
    skipValidation: false,
    autoRepairAttempts: 2,
  });
}

/**
 * Validate an existing post without regenerating
 */
export function validatePost(
  post: BlogPost,
  config?: ValidationConfig
): ValidationResult {
  return validateContent(post, config);
}

/**
 * Quick check if a post passes basic validation
 */
export function isPostValid(post: BlogPost): boolean {
  const { valid } = quickValidate(post);
  return valid;
}
