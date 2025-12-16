import { NextRequest, NextResponse } from 'next/server';
import { getJob, cancelJob } from '@/lib/automation/auto-writer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/automation/job/[id]
 * Get job status and logs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        mode: job.mode,
        currentStep: job.currentStep,
        completedSteps: job.completedSteps,
        totalSteps: job.totalSteps,
        result: job.result,
        errorMessage: job.errorMessage,
        logs: job.logs,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    console.error('Failed to get job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automation/job/[id]
 * Cancel a running or pending job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cancelled = await cancelJob(id);

    if (!cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found or cannot be cancelled (already completed/failed)',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('Failed to cancel job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
