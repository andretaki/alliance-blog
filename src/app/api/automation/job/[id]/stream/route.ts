import { NextRequest } from 'next/server';
import { getJob } from '@/lib/automation/auto-writer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/automation/job/[id]/stream
 * Server-Sent Events stream for real-time job updates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get Last-Event-ID for reconnection support
  const lastEventId = request.headers.get('Last-Event-ID');
  const startFromLog = lastEventId ? parseInt(lastEventId, 10) : 0;

  // Check if job exists
  const initialJob = await getJob(id);
  if (!initialJob) {
    return new Response('Job not found', { status: 404 });
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let eventId = startFromLog;

      // Helper to send SSE event with incremental ID
      const sendEvent = (event: string, data: unknown) => {
        eventId++;
        const message = `id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Helper to send heartbeat (comment line)
      const sendHeartbeat = () => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      };

      // Send initial state
      sendEvent('connected', { jobId: id, reconnected: startFromLog > 0 });

      let lastLogCount = startFromLog;
      let isComplete = false;
      let lastHeartbeat = Date.now();

      // Heartbeat interval (every 20 seconds)
      const heartbeatInterval = setInterval(() => {
        const now = Date.now();
        if (now - lastHeartbeat >= 20000) {
          sendHeartbeat();
          lastHeartbeat = now;
        }
      }, 20000);

      // Poll for updates
      const pollInterval = setInterval(async () => {
        try {
          const job = await getJob(id);

          if (!job) {
            sendEvent('error', { message: 'Job not found' });
            clearInterval(pollInterval);
            clearInterval(heartbeatInterval);
            controller.close();
            return;
          }

          // Send new logs
          if (job.logs.length > lastLogCount) {
            const newLogs = job.logs.slice(lastLogCount);
            for (const log of newLogs) {
              sendEvent('log', log);
            }
            lastLogCount = job.logs.length;
          }

          // Send progress update
          sendEvent('progress', {
            status: job.status,
            currentStep: job.currentStep,
            completedSteps: job.completedSteps,
            totalSteps: job.totalSteps,
          });

          // Check if job is complete
          if (
            job.status === 'completed' ||
            job.status === 'failed' ||
            job.status === 'cancelled'
          ) {
            if (!isComplete) {
              isComplete = true;

              // Calculate duration
              const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
              const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
              const durationMs = startedAt ? completedAt - startedAt : undefined;

              // Count validation warnings
              const validationWarningsCount = job.result?.validationIssues?.length ?? 0;

              sendEvent('complete', {
                status: job.status,
                result: job.result,
                errorMessage: job.errorMessage,
                meta: {
                  mode: job.mode,
                  durationMs,
                  validationWarningsCount,
                },
              });

              // Keep connection open briefly to ensure client receives final event
              setTimeout(() => {
                clearInterval(pollInterval);
                clearInterval(heartbeatInterval);
                controller.close();
              }, 500);
            }
          }
        } catch (error) {
          console.error('SSE poll error:', error);
          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, 1000); // Poll every second

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
