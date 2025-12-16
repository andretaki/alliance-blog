'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// Step definitions for progress display
const STEPS = [
  { key: 'init', label: 'Initialize', icon: '1' },
  { key: 'fetch_author', label: 'Fetch Author', icon: '2' },
  { key: 'select_collection', label: 'Select Collection', icon: '3' },
  { key: 'generate_topics', label: 'Generate Topics', icon: '4' },
  { key: 'score_topics', label: 'Score Topics', icon: '5' },
  { key: 'generate_draft', label: 'Generate Draft', icon: '6' },
  { key: 'validate_content', label: 'Validate', icon: '7' },
  { key: 'complete', label: 'Complete', icon: '8' },
];

interface LogEntry {
  timestamp: string;
  step: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  payload?: Record<string, unknown>;
}

interface JobResult {
  postId?: string;
  postTitle?: string;
  topic?: string;
  collection?: string;
  scoreBreakdown?: {
    novelty: number;
    searchIntentMatch: number;
    conversionPotential: number;
    eeatScore: number;
    total: number;
  };
  validationPassed?: boolean;
  validationIssues?: string[];
  draftWordCount?: number;
}

interface JobMeta {
  mode: 'full' | 'dry_run';
  durationMs?: number;
  validationWarningsCount?: number;
}

interface JobState {
  id: string | null;
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: string | null;
  completedSteps: number;
  totalSteps: number;
  logs: LogEntry[];
  result: JobResult | null;
  errorMessage: string | null;
  meta: JobMeta | null;
}

export default function AutopilotPage() {
  const [mode, setMode] = useState<'full' | 'dry_run'>('full');
  const [jobState, setJobState] = useState<JobState>({
    id: null,
    status: 'idle',
    currentStep: null,
    completedSteps: 0,
    totalSteps: 8,
    logs: [],
    result: null,
    errorMessage: null,
    meta: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobState.logs]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const connectToStream = useCallback((jobId: string) => {
    // Close existing connection
    eventSourceRef.current?.close();

    const eventSource = new EventSource(`/api/automation/job/${jobId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      console.log('SSE connected');
    });

    eventSource.addEventListener('log', (event) => {
      const log = JSON.parse(event.data) as LogEntry;
      setJobState((prev) => ({
        ...prev,
        logs: [...prev.logs, log],
      }));
    });

    eventSource.addEventListener('progress', (event) => {
      const progress = JSON.parse(event.data);
      setJobState((prev) => ({
        ...prev,
        status: progress.status,
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
        totalSteps: progress.totalSteps,
      }));
    });

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      setJobState((prev) => ({
        ...prev,
        status: data.status,
        result: data.result,
        errorMessage: data.errorMessage,
        meta: data.meta || null,
      }));
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      console.error('SSE error:', event);
      // Don't close on error - let the server close it
    });
  }, []);

  async function handleRunAutopilot() {
    setJobState({
      id: null,
      status: 'pending',
      currentStep: null,
      completedSteps: 0,
      totalSteps: 8,
      logs: [],
      result: null,
      errorMessage: null,
      meta: { mode },
    });

    try {
      // Create job asynchronously
      const res = await fetch('/api/automation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `manual-${Date.now()}`,
        },
        body: JSON.stringify({
          mode,
          async: true, // Return immediately
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.jobId) {
        throw new Error(data.error || 'Failed to create job');
      }

      setJobState((prev) => ({
        ...prev,
        id: data.jobId,
        status: 'running',
      }));

      // Connect to SSE stream
      connectToStream(data.jobId);

      // Trigger job processing (fire and forget)
      fetch('/api/automation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `manual-${Date.now()}`,
        },
        body: JSON.stringify({
          mode,
          async: false,
        }),
      }).catch(console.error);
    } catch (error) {
      setJobState((prev) => ({
        ...prev,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  async function handleCancel() {
    if (!jobState.id) return;

    try {
      const res = await fetch(`/api/automation/job/${jobState.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        eventSourceRef.current?.close();
        setJobState((prev) => ({
          ...prev,
          status: 'cancelled',
        }));
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  }

  function handleReset() {
    eventSourceRef.current?.close();
    setJobState({
      id: null,
      status: 'idle',
      currentStep: null,
      completedSteps: 0,
      totalSteps: 8,
      logs: [],
      result: null,
      errorMessage: null,
      meta: null,
    });
  }

  const isIdle = jobState.status === 'idle';
  const isRunning = jobState.status === 'running' || jobState.status === 'pending';
  const isComplete = jobState.status === 'completed';
  const isFailed = jobState.status === 'failed';
  const isCancelled = jobState.status === 'cancelled';

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Autopilot</h1>
        <p className="mt-2 text-sm text-gray-700">
          AI-powered content generation. Select a mode and click run to generate a new blog post.
        </p>
      </div>

      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        {/* Mode selector - only show when idle */}
        {isIdle && (
          <div className="border-b border-gray-200 px-6 py-4">
            <label className="text-sm font-medium text-gray-700">Generation Mode</label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="mode"
                  value="full"
                  checked={mode === 'full'}
                  onChange={() => setMode('full')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Full Generation
                  <span className="text-gray-500 ml-1">(creates draft)</span>
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="mode"
                  value="dry_run"
                  checked={mode === 'dry_run'}
                  onChange={() => setMode('dry_run')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Dry Run
                  <span className="text-gray-500 ml-1">(topic selection only)</span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Progress steps */}
        {!isIdle && (
          <div className="border-b border-gray-200 px-6 py-4">
            <nav aria-label="Progress">
              <ol className="flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const stepIndex = STEPS.findIndex((s) => s.key === jobState.currentStep);
                  const isCurrentStep = step.key === jobState.currentStep;
                  const isCompleted = index < jobState.completedSteps;
                  const isFutureStep = index >= jobState.completedSteps && !isCurrentStep;

                  return (
                    <li key={step.key} className="relative flex-1">
                      {index > 0 && (
                        <div
                          className={`absolute top-4 left-0 -ml-px w-full h-0.5 ${
                            isCompleted ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                          style={{ width: 'calc(100% - 2rem)', left: '-50%', marginLeft: '1rem' }}
                        />
                      )}
                      <div className="relative flex flex-col items-center group">
                        <span
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
                            isCompleted
                              ? 'bg-indigo-600 text-white'
                              : isCurrentStep
                                ? 'bg-indigo-100 border-2 border-indigo-600 text-indigo-600'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isCompleted ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            step.icon
                          )}
                        </span>
                        <span
                          className={`mt-2 text-xs ${
                            isCurrentStep ? 'text-indigo-600 font-medium' : 'text-gray-500'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        )}

        {/* Main content area */}
        <div className="p-6">
          {/* Idle state */}
          {isIdle && (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-16 w-16 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Ready to Generate</h3>
              <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                {mode === 'dry_run'
                  ? 'Dry run will find and score topics without creating a draft.'
                  : 'The agent will find a content gap and write a complete blog post draft.'}
              </p>
              <button
                onClick={handleRunAutopilot}
                className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {mode === 'dry_run' ? 'Run Dry Run' : 'Run Autopilot'}
              </button>
            </div>
          )}

          {/* Running state */}
          {isRunning && (
            <div className="space-y-4">
              {/* Logs */}
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
                {jobState.logs.map((log, i) => (
                  <div
                    key={i}
                    className={`mb-1 ${
                      log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'warn'
                          ? 'text-yellow-400'
                          : log.level === 'debug'
                            ? 'text-gray-500'
                            : 'text-green-400'
                    }`}
                  >
                    <span className="text-gray-500">[{log.step}]</span> {log.message}
                  </div>
                ))}
                <div className="animate-pulse text-green-400">_</div>
                <div ref={logsEndRef} />
              </div>

              {/* Cancel button */}
              <div className="text-center">
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Complete/Failed/Cancelled state */}
          {(isComplete || isFailed || isCancelled) && (
            <div className="space-y-6">
              {/* Logs */}
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-48 overflow-y-auto">
                {jobState.logs.map((log, i) => (
                  <div
                    key={i}
                    className={`mb-1 ${
                      log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'warn'
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    }`}
                  >
                    <span className="text-gray-500">[{log.step}]</span> {log.message}
                  </div>
                ))}
              </div>

              {/* Result summary */}
              {isComplete && jobState.result && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-green-400 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-green-800">
                        {jobState.meta?.mode === 'dry_run' ? 'Dry Run Complete' : 'Draft Generated Successfully'}
                      </h3>
                      <div className="mt-2 text-sm text-green-700 space-y-1">
                        {jobState.meta?.mode !== undefined && (
                          <p>
                            <span className="text-gray-600">Mode:</span> {jobState.meta.mode === 'dry_run' ? 'Dry Run' : 'Full Generation'}
                          </p>
                        )}
                        {jobState.result.collection !== undefined && (
                          <p>
                            <span className="text-gray-600">Collection:</span> {jobState.result.collection}
                          </p>
                        )}
                        {jobState.result.topic !== undefined && (
                          <p>
                            <span className="text-gray-600">Topic:</span> {jobState.result.topic}
                          </p>
                        )}
                        {jobState.result.postTitle !== undefined && (
                          <p>
                            <span className="text-gray-600">Title:</span> {jobState.result.postTitle}
                          </p>
                        )}
                        {jobState.result.scoreBreakdown?.total !== undefined && (
                          <p>
                            <span className="text-gray-600">Score:</span> {jobState.result.scoreBreakdown.total}/100
                          </p>
                        )}
                        {jobState.result.draftWordCount !== undefined && (
                          <p>
                            <span className="text-gray-600">Word Count:</span> {jobState.result.draftWordCount}
                          </p>
                        )}
                        {jobState.meta?.durationMs !== undefined && (
                          <p>
                            <span className="text-gray-600">Duration:</span> {(jobState.meta.durationMs / 1000).toFixed(1)}s
                          </p>
                        )}
                        {jobState.meta?.validationWarningsCount !== undefined && jobState.meta.validationWarningsCount > 0 && (
                          <p>
                            <span className="text-gray-600">Validation Warnings:</span> {jobState.meta.validationWarningsCount}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isFailed && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-red-400 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Generation Failed</h3>
                      <p className="mt-1 text-sm text-red-700">
                        {jobState.errorMessage || 'An unknown error occurred'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isCancelled && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <h3 className="ml-3 text-sm font-medium text-yellow-800">Job Cancelled</h3>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 justify-center">
                {isComplete && jobState.result?.postId && (
                  <Link
                    href={`/admin/posts/${jobState.result.postId}`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    View & Edit Draft
                  </Link>
                )}
                <button
                  onClick={handleReset}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  {isComplete ? 'Run Again' : 'Try Again'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
