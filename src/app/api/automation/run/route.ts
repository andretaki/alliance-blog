import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createJob,
  processJob,
  getJob,
  type CreateJobOptions,
} from '@/lib/automation/auto-writer';
import { isAutopilotEnabled, getAutopilotConfig } from '@/lib/config/env';

// Allow this to run for up to 60 seconds (Vercel Hobby limit is 10s, Pro is 60s)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Standardized API response shape
 */
interface ApiResponse {
  success: boolean;
  requestId: string;
  jobId?: string;
  result?: {
    postId?: string;
    postTitle?: string;
    topic?: string;
    collection?: string;
  };
  logs?: Array<{
    timestamp: string;
    step: string;
    level: string;
    message: string;
  }>;
  error?: string;
}

/**
 * Validate authorization
 */
function validateAuth(request: NextRequest): { valid: boolean; user?: string; error?: string } {
  const config = getAutopilotConfig();

  // Check for admin secret header (for API/cron access)
  const authHeader = request.headers.get('x-autopilot-secret');
  if (authHeader && config.adminSecret) {
    if (authHeader === config.adminSecret) {
      return { valid: true, user: 'api' };
    }
    return { valid: false, error: 'Invalid admin secret' };
  }

  // TODO: Add session-based auth check here
  // For now, allow requests in development without secret
  if (process.env.NODE_ENV === 'development') {
    return { valid: true, user: 'dev' };
  }

  // In production without secret configured, allow (for testing)
  // You should configure AUTOPILOT_ADMIN_SECRET in production!
  if (!config.adminSecret) {
    console.warn('AUTOPILOT_ADMIN_SECRET not configured - allowing unauthenticated access');
    return { valid: true, user: 'anonymous' };
  }

  return { valid: false, error: 'Authentication required' };
}

/**
 * POST /api/automation/run
 * Creates a job and optionally processes it immediately
 */
export async function POST(request: NextRequest) {
  const requestId = uuidv4();

  // Build response helper
  const respond = (data: Partial<ApiResponse>, status = 200): NextResponse => {
    return NextResponse.json({ ...data, requestId }, { status });
  };

  try {
    // Check kill switch
    if (!isAutopilotEnabled()) {
      return respond({ success: false, error: 'Autopilot is disabled' }, 503);
    }

    // Validate auth
    const auth = validateAuth(request);
    if (!auth.valid) {
      return respond({ success: false, error: auth.error }, 401);
    }

    // Parse request body
    let body: {
      mode?: 'dry_run' | 'full';
      collectionHandle?: string;
      targetWordCount?: number;
      idempotencyKey?: string;
      async?: boolean; // If true, return immediately after creating job
    } = {};

    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is OK
    }

    // Get idempotency key from header or body
    const idempotencyKey =
      request.headers.get('idempotency-key') || body.idempotencyKey;

    // Create job options
    const options: CreateJobOptions = {
      mode: body.mode || 'full',
      collectionHandle: body.collectionHandle,
      targetWordCount: body.targetWordCount,
      triggeredBy: auth.user,
      idempotencyKey,
      requestId,
    };

    // Create the job
    const job = await createJob(options);

    // If async mode, return immediately
    if (body.async) {
      return respond({
        success: true,
        jobId: job.id,
      }, 202);
    }

    // Process the job synchronously
    const result = await processJob(job.id);

    // Fetch updated job for logs
    const updatedJob = await getJob(job.id);

    return respond({
      success: true,
      jobId: job.id,
      result: {
        postId: result.postId,
        postTitle: result.postTitle,
        topic: result.topic,
        collection: result.collection,
      },
      logs: updatedJob?.logs || [],
    });
  } catch (error) {
    console.error('Autopilot failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Determine appropriate status code
    let status = 500;
    if (errorMessage.includes('Rate limit')) status = 429;
    if (errorMessage.includes('Max concurrent')) status = 429;
    if (errorMessage.includes('disabled')) status = 503;

    return respond({ success: false, error: errorMessage }, status);
  }
}
