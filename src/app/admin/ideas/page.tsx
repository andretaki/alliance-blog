'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Idea {
  id: string;
  topic: string;
  primaryKeyword: string;
  searchIntent: string;
  funnelStage: string | null;
  status: string;
  aiGenerated: boolean;
  createdAt: string;
  cluster: {
    name: string;
  } | null;
  post: {
    id: string;
    title: string;
    status: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-gray-100 text-gray-800',
  brief: 'bg-blue-100 text-blue-800',
  draft: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-purple-100 text-purple-800',
  published: 'bg-green-100 text-green-800',
};

const INTENT_LABELS: Record<string, string> = {
  informational: 'Info',
  commercial: 'Commercial',
  transactional: 'Trans',
  navigational: 'Nav',
};

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchIdeas();
  }, [statusFilter]);

  async function fetchIdeas(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/ideas?${params}`);
      const data = await res.json();
      setIdeas(data.ideas);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteIdea(id: string) {
    if (!confirm('Are you sure you want to delete this idea?')) return;

    try {
      await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
      fetchIdeas(pagination?.page || 1);
    } catch (error) {
      console.error('Failed to delete idea:', error);
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Content Ideas</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage topic ideas and generate briefs for new blog posts.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <Link
            href="/admin/ideas/generate"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Generate Ideas
          </Link>
          <Link
            href="/admin/ideas/new"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Add Manually
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">All Statuses</option>
          <option value="idea">Idea</option>
          <option value="brief">Brief Created</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Ideas List */}
      <div className="mt-8">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No ideas yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by generating AI-powered topic suggestions.</p>
            <div className="mt-6">
              <Link
                href="/admin/ideas/generate"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Generate Ideas
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {ideas.map((idea) => (
                <li key={idea.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <Link href={`/admin/ideas/${idea.id}`} className="block hover:bg-gray-50 -m-2 p-2 rounded">
                          <p className="text-sm font-medium text-indigo-600 truncate">{idea.topic}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[idea.status] || 'bg-gray-100 text-gray-800'}`}>
                              {idea.status}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {INTENT_LABELS[idea.searchIntent] || idea.searchIntent}
                            </span>
                            {idea.funnelStage && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {idea.funnelStage}
                              </span>
                            )}
                            {idea.aiGenerated && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                AI Generated
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                      <div className="ml-4 flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">{idea.primaryKeyword}</span>
                        </div>
                        {idea.post ? (
                          <Link
                            href={`/admin/posts/${idea.post.id}`}
                            className="text-xs text-green-600 hover:text-green-800"
                          >
                            View Post
                          </Link>
                        ) : idea.status === 'idea' ? (
                          <Link
                            href={`/admin/ideas/${idea.id}/brief`}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Create Brief
                          </Link>
                        ) : idea.status === 'brief' ? (
                          <Link
                            href={`/admin/ideas/${idea.id}/draft`}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Generate Draft
                          </Link>
                        ) : null}
                        <button
                          onClick={() => deleteIdea(idea.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > pagination.limit && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} ideas
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchIdeas(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => fetchIdeas(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
