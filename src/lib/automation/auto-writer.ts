/**
 * Auto Writer - Job-Based Architecture
 *
 * Production-grade autopilot content generation with:
 * - Job persistence and status tracking
 * - Structured logging
 * - Concurrency control
 * - Rate limiting
 * - Dry-run mode
 * - Validation gates
 */

import { db } from '@/lib/db/client';
import {
  authors,
  autopilotJobs,
  type AutopilotJob,
  type AutopilotLogEntry,
  type AutopilotJobResult,
  type TopicScoreBreakdown,
} from '@/lib/db/schema';
import { eq, and, lt, or, isNull, sql, desc } from 'drizzle-orm';
import { generateTopicIdeasWithDedup } from '@/lib/discovery/topic-finder';
import { prioritizeTopics, type ScoredTopic } from '@/lib/discovery/topic-scorer';
import { generatePostFromBrief } from '@/lib/ai/generation/orchestrator';
import { getProductCollections, type CollectionData } from '@/lib/shopify/product-matcher';
import { getAutopilotConfig } from '@/lib/config/env';

// ============================================================================
// TYPES
// ============================================================================

export type JobMode = 'dry_run' | 'full';

export interface CreateJobOptions {
  mode?: JobMode;
  collectionHandle?: string;
  targetWordCount?: number;
  triggeredBy?: string;
  idempotencyKey?: string;
  requestId?: string;
}

export interface JobLogger {
  info: (step: string, message: string, payload?: Record<string, unknown>) => Promise<void>;
  warn: (step: string, message: string, payload?: Record<string, unknown>) => Promise<void>;
  error: (step: string, message: string, payload?: Record<string, unknown>) => Promise<void>;
  debug: (step: string, message: string, payload?: Record<string, unknown>) => Promise<void>;
}

// Step definitions for progress tracking
const STEPS = {
  INIT: 'init',
  AUTHOR: 'fetch_author',
  COLLECTION: 'select_collection',
  TOPICS: 'generate_topics',
  SCORING: 'score_topics',
  GENERATION: 'generate_draft',
  VALIDATION: 'validate_content',
  COMPLETE: 'complete',
} as const;

const STEP_ORDER = [
  STEPS.INIT,
  STEPS.AUTHOR,
  STEPS.COLLECTION,
  STEPS.TOPICS,
  STEPS.SCORING,
  STEPS.GENERATION,
  STEPS.VALIDATION,
  STEPS.COMPLETE,
];

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * Create a new autopilot job
 */
export async function createJob(options: CreateJobOptions = {}): Promise<AutopilotJob> {
  const config = getAutopilotConfig();

  // Check kill switch
  if (!config.enabled) {
    throw new Error('Autopilot is disabled');
  }

  // Check idempotency
  if (options.idempotencyKey) {
    const existing = await db.query.autopilotJobs.findFirst({
      where: eq(autopilotJobs.idempotencyKey, options.idempotencyKey),
    });
    if (existing) {
      return existing;
    }
  }

  // Check rate limit
  const recentJobsCount = await checkRateLimit(options.triggeredBy);
  if (recentJobsCount >= config.rateLimitPerHour) {
    throw new Error(`Rate limit exceeded: ${config.rateLimitPerHour} jobs per hour`);
  }

  // Check concurrent jobs
  const runningJobs = await getRunningJobs();
  if (runningJobs.length >= config.maxConcurrentJobs) {
    throw new Error(`Max concurrent jobs reached: ${config.maxConcurrentJobs}`);
  }

  // Create the job
  const [job] = await db
    .insert(autopilotJobs)
    .values({
      mode: options.mode || 'full',
      collectionHandle: options.collectionHandle,
      targetWordCount: options.targetWordCount || 1500,
      triggeredBy: options.triggeredBy,
      idempotencyKey: options.idempotencyKey,
      requestId: options.requestId,
      status: 'pending',
      totalSteps: STEP_ORDER.length,
    })
    .returning();

  return job;
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<AutopilotJob | null> {
  const job = await db.query.autopilotJobs.findFirst({
    where: eq(autopilotJobs.id, jobId),
  });
  return job ?? null;
}

/**
 * Get recent jobs for a user
 */
export async function getRecentJobs(triggeredBy?: string, limit = 10): Promise<AutopilotJob[]> {
  return db.query.autopilotJobs.findMany({
    where: triggeredBy ? eq(autopilotJobs.triggeredBy, triggeredBy) : undefined,
    orderBy: [desc(autopilotJobs.createdAt)],
    limit,
  });
}

/**
 * Get currently running jobs
 */
export async function getRunningJobs(): Promise<AutopilotJob[]> {
  return db.query.autopilotJobs.findMany({
    where: eq(autopilotJobs.status, 'running'),
  });
}

/**
 * Check rate limit for a user
 */
async function checkRateLimit(triggeredBy?: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(autopilotJobs)
    .where(
      and(
        triggeredBy ? eq(autopilotJobs.triggeredBy, triggeredBy) : sql`true`,
        sql`${autopilotJobs.createdAt} > ${oneHourAgo}`
      )
    );

  return Number(result[0]?.count || 0);
}

/**
 * Try to acquire a lock on a job for processing
 */
async function acquireJobLock(jobId: string, timeoutSeconds: number): Promise<boolean> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + timeoutSeconds * 1000);

  const result = await db
    .update(autopilotJobs)
    .set({
      status: 'running',
      startedAt: now,
      lockedUntil: lockUntil,
    })
    .where(
      and(
        eq(autopilotJobs.id, jobId),
        eq(autopilotJobs.status, 'pending'),
        or(
          isNull(autopilotJobs.lockedUntil),
          lt(autopilotJobs.lockedUntil, now)
        )
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Update job progress
 */
async function updateJobProgress(
  jobId: string,
  step: string,
  completedSteps: number
): Promise<void> {
  await db
    .update(autopilotJobs)
    .set({
      currentStep: step,
      completedSteps,
    })
    .where(eq(autopilotJobs.id, jobId));
}

/**
 * Complete a job successfully
 */
async function completeJob(
  jobId: string,
  result: AutopilotJobResult,
  postId?: string
): Promise<void> {
  await db
    .update(autopilotJobs)
    .set({
      status: 'completed',
      result,
      blogPostId: postId,
      completedAt: new Date(),
      currentStep: STEPS.COMPLETE,
      completedSteps: STEP_ORDER.length,
      lockedUntil: null,
    })
    .where(eq(autopilotJobs.id, jobId));
}

/**
 * Fail a job
 */
async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await db
    .update(autopilotJobs)
    .set({
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
      lockedUntil: null,
    })
    .where(eq(autopilotJobs.id, jobId));
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const result = await db
    .update(autopilotJobs)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
      lockedUntil: null,
    })
    .where(
      and(
        eq(autopilotJobs.id, jobId),
        or(
          eq(autopilotJobs.status, 'pending'),
          eq(autopilotJobs.status, 'running')
        )
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Create a logger that persists to the job record
 */
function createJobLogger(jobId: string): JobLogger {
  const addLog = async (
    level: AutopilotLogEntry['level'],
    step: string,
    message: string,
    payload?: Record<string, unknown>
  ) => {
    const entry: AutopilotLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      level,
      message,
      payload,
    };

    await db
      .update(autopilotJobs)
      .set({
        logs: sql`${autopilotJobs.logs} || ${JSON.stringify([entry])}::jsonb`,
      })
      .where(eq(autopilotJobs.id, jobId));
  };

  return {
    info: (step, message, payload) => addLog('info', step, message, payload),
    warn: (step, message, payload) => addLog('warn', step, message, payload),
    error: (step, message, payload) => addLog('error', step, message, payload),
    debug: (step, message, payload) => addLog('debug', step, message, payload),
  };
}

// ============================================================================
// JOB PROCESSING
// ============================================================================

/**
 * Check if job has been cancelled
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  return job?.status === 'cancelled';
}

/**
 * Check for cancellation and throw if cancelled
 */
async function checkCancellation(jobId: string, logger: JobLogger, step: string): Promise<void> {
  if (await isJobCancelled(jobId)) {
    await logger.info(step, 'Job cancelled by user');
    throw new Error('Job cancelled');
  }
}

/**
 * Process a job - the main worker function
 */
export async function processJob(jobId: string): Promise<AutopilotJobResult> {
  const config = getAutopilotConfig();
  const logger = createJobLogger(jobId);

  // Try to acquire lock
  const locked = await acquireJobLock(jobId, config.jobTimeoutSeconds);
  if (!locked) {
    throw new Error('Could not acquire job lock - job may be running or already completed');
  }

  const job = await getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  try {
    await logger.info(STEPS.INIT, 'Starting autopilot cycle');
    await updateJobProgress(jobId, STEPS.INIT, 1);

    // Step 1: Get author
    await logger.info(STEPS.AUTHOR, 'Fetching default author');
    await updateJobProgress(jobId, STEPS.AUTHOR, 2);

    let author = await db.query.authors.findFirst({
      where: eq(authors.name, 'Alliance Chemical Team'),
    });

    if (!author) {
      await logger.warn(STEPS.AUTHOR, '"Alliance Chemical Team" not found, using first available');
      author = await db.query.authors.findFirst();
    }

    if (!author) {
      throw new Error('No authors found in database. Please create an author first.');
    }

    await logger.info(STEPS.AUTHOR, `Using author: ${author.name}`, { authorId: author.id });

    // Update job with author
    await db
      .update(autopilotJobs)
      .set({ authorId: author.id })
      .where(eq(autopilotJobs.id, jobId));

    // Check for cancellation before next step
    await checkCancellation(jobId, logger, STEPS.AUTHOR);

    // Step 2: Select collection
    await logger.info(STEPS.COLLECTION, 'Selecting product collection');
    await updateJobProgress(jobId, STEPS.COLLECTION, 3);

    const collection = await selectCollection(job.collectionHandle, config, logger);
    await logger.info(STEPS.COLLECTION, `Selected: "${collection.name}"`, {
      handle: collection.handle,
    });

    // Check for cancellation before next step
    await checkCancellation(jobId, logger, STEPS.COLLECTION);

    // Step 3: Generate topics
    await logger.info(STEPS.TOPICS, 'Generating and deduplicating topics');
    await updateJobProgress(jobId, STEPS.TOPICS, 4);

    // Use cached index for performance (don't refresh every time)
    const topicResult = await generateTopicIdeasWithDedup(collection.handle, 5, {
      excludeDuplicates: true,
      strictness: 'moderate',
      refreshIndex: false, // Use cached index
    });

    if (topicResult.topics.length === 0) {
      await logger.warn(STEPS.TOPICS, 'No unique topics found for this collection');
      const result: AutopilotJobResult = {
        collection: collection.name,
        topic: undefined,
      };
      await completeJob(jobId, result);
      return result;
    }

    await logger.info(STEPS.TOPICS, `Found ${topicResult.topics.length} unique candidates`, {
      stats: topicResult.stats,
    });

    // Check for cancellation before next step
    await checkCancellation(jobId, logger, STEPS.TOPICS);

    // Step 4: Score topics
    await logger.info(STEPS.SCORING, 'Scoring and ranking topics');
    await updateJobProgress(jobId, STEPS.SCORING, 5);

    const scoredTopics = prioritizeTopics(topicResult.topics);

    // Guard against empty scored topics
    if (scoredTopics.length === 0) {
      await logger.warn(STEPS.SCORING, 'No topics passed scoring threshold');
      const result: AutopilotJobResult = {
        collection: collection.name,
        topic: undefined,
      };
      await completeJob(jobId, result);
      return result;
    }

    const bestTopic = scoredTopics[0];
    const scoreBreakdown: TopicScoreBreakdown = {
      novelty: bestTopic.scoreBreakdown.uniquenessScore,
      searchIntentMatch: bestTopic.scoreBreakdown.contentTypeFitScore,
      conversionPotential: bestTopic.scoreBreakdown.productRelevanceScore,
      internalLinkPotential: 0, // TODO: Calculate from related posts
      eeatScore: bestTopic.scoreBreakdown.eeatScore,
      total: bestTopic.totalScore,
    };

    await logger.info(STEPS.SCORING, `Selected: "${bestTopic.topic}"`, {
      score: bestTopic.totalScore,
      breakdown: scoreBreakdown,
      reasoning: bestTopic.uniqueAngle,
    });

    // Dry run mode stops here
    if (job.mode === 'dry_run') {
      await logger.info(STEPS.COMPLETE, 'Dry run complete - skipping draft generation');
      const result: AutopilotJobResult = {
        topic: bestTopic.topic,
        collection: collection.name,
        scoreBreakdown,
      };
      await completeJob(jobId, result);
      return result;
    }

    // Check for cancellation before expensive draft generation
    await checkCancellation(jobId, logger, STEPS.SCORING);

    // Step 5: Generate draft
    await logger.info(STEPS.GENERATION, 'Generating brief, outline, and draft');
    await updateJobProgress(jobId, STEPS.GENERATION, 6);

    const generationResult = await generatePostFromBrief(
      { topic: bestTopic },
      {
        id: author.id,
        name: author.name,
        role: author.role,
        credentials: author.credentials,
        profileUrl: author.profileUrl,
      },
      {
        targetWordCount: job.targetWordCount,
        useStyleAnalysis: true,
        skipValidation: false,
        autoRepairAttempts: 1,
      }
    );

    // Check for cancellation after generation
    await checkCancellation(jobId, logger, STEPS.GENERATION);

    // Step 6: Validate
    await logger.info(STEPS.VALIDATION, 'Validating generated content');
    await updateJobProgress(jobId, STEPS.VALIDATION, 7);

    const validationPassed = generationResult.success && generationResult.validation?.valid;
    const validationIssues = generationResult.errors.concat(generationResult.warnings);

    if (!generationResult.success || !generationResult.post) {
      await logger.error(STEPS.VALIDATION, 'Generation failed', {
        errors: generationResult.errors,
      });
      throw new Error(`Generation failed: ${generationResult.errors.join(', ')}`);
    }

    await logger.info(STEPS.VALIDATION, `Validation ${validationPassed ? 'passed' : 'has issues'}`, {
      issues: validationIssues,
    });

    // Complete
    await logger.info(STEPS.COMPLETE, `Draft created: "${generationResult.post.title}"`);

    const result: AutopilotJobResult = {
      postId: generationResult.post.id,
      postTitle: generationResult.post.title,
      topic: bestTopic.topic,
      collection: collection.name,
      scoreBreakdown,
      validationPassed,
      validationIssues,
      draftWordCount: generationResult.post.wordCount,
    };

    await completeJob(jobId, result, generationResult.post.id);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error('error', `Job failed: ${errorMessage}`);
    await failJob(jobId, errorMessage);
    throw error;
  }
}

/**
 * Select a collection for content generation
 */
async function selectCollection(
  requestedHandle: string | null,
  config: ReturnType<typeof getAutopilotConfig>,
  logger: JobLogger
): Promise<CollectionData> {
  let collections = getProductCollections();

  // Apply allowlist
  if (config.allowedCollections && config.allowedCollections.length > 0) {
    collections = collections.filter((c) =>
      config.allowedCollections!.includes(c.handle)
    );
    await logger.debug(STEPS.COLLECTION, `Applied allowlist: ${collections.length} collections`);
  }

  // Apply blocklist
  if (config.blockedCollections.length > 0) {
    collections = collections.filter(
      (c) => !config.blockedCollections.includes(c.handle)
    );
    await logger.debug(STEPS.COLLECTION, `Applied blocklist: ${collections.length} collections`);
  }

  if (collections.length === 0) {
    throw new Error('No collections available after filtering');
  }

  // Use requested handle if provided and valid
  if (requestedHandle) {
    const requested = collections.find((c) => c.handle === requestedHandle);
    if (requested) {
      return requested;
    }
    await logger.warn(
      STEPS.COLLECTION,
      `Requested collection "${requestedHandle}" not found or blocked, using random`
    );
  }

  // Random selection
  return collections[Math.floor(Math.random() * collections.length)];
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create and immediately process a job (for simple use cases)
 * Note: This is synchronous and will block - prefer createJob + processJob for production
 */
export async function runAutoWriterCycle(
  options: CreateJobOptions = {}
): Promise<AutopilotJobResult> {
  const job = await createJob(options);
  return processJob(job.id);
}
