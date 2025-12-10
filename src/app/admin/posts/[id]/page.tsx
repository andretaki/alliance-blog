'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Post {
  id: string;
  slug: string;
  title: string;
  summary: string;
  heroAnswer: string;
  status: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  metaTitle: string;
  metaDescription: string;
  wordCount: number;
  readingTimeMins: number;
  aiAssisted: boolean;
  publishedAt: string | null;
  updatedAt: string;
  sections: Array<{
    id: string;
    headingLevel: string;
    headingText: string;
    body: string;
  }>;
  faq: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
  author: {
    id: string;
    name: string;
    role: string;
  } | null;
  cluster: {
    id: string;
    name: string;
  } | null;
}

interface ValidationReport {
  report: {
    valid: boolean;
    score: number;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  };
  publishReady: boolean;
  publishBlockers: string[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'validation'>('content');

  useEffect(() => {
    if (params.id) {
      fetchPost(params.id as string);
    }
  }, [params.id]);

  async function fetchPost(id: string) {
    try {
      const res = await fetch(`/api/posts/${id}`);
      const data = await res.json();
      setPost(data.post);
    } catch (error) {
      console.error('Failed to fetch post:', error);
    } finally {
      setLoading(false);
    }
  }

  async function validatePost() {
    if (!post) return;

    try {
      const res = await fetch(`/api/posts/${post.id}/validate`);
      const data = await res.json();
      setValidation(data);
      setActiveTab('validation');
    } catch (error) {
      console.error('Failed to validate post:', error);
    }
  }

  async function publishPost() {
    if (!post || !validation?.publishReady) return;

    if (!confirm('Are you sure you want to publish this post?')) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishTo: 'database' }),
      });

      if (res.ok) {
        fetchPost(post.id);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to publish');
      }
    } catch (error) {
      console.error('Failed to publish post:', error);
    } finally {
      setPublishing(false);
    }
  }

  async function deletePost() {
    if (!post) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/posts');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!post) {
    return <div className="p-8 text-center text-gray-500">Post not found</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/posts" className="text-sm text-indigo-600 hover:text-indigo-500">
          &larr; Back to Posts
        </Link>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        {/* Post Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">{post.title}</h1>
                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${STATUS_COLORS[post.status] || 'bg-gray-100 text-gray-800'}`}>
                  {post.status}
                </span>
                {post.aiAssisted && (
                  <span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-purple-100 text-purple-800">
                    AI
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">/{post.slug}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span>{post.wordCount} words</span>
                <span>{post.readingTimeMins} min read</span>
                {post.author && <span>By {post.author.name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {post.status === 'draft' && (
                <>
                  <button
                    onClick={validatePost}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                  >
                    Validate
                  </button>
                  <button
                    onClick={publishPost}
                    disabled={publishing || !validation?.publishReady}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {publishing ? 'Publishing...' : 'Publish'}
                  </button>
                </>
              )}
              <button
                onClick={deletePost}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8">
            {(['content', 'seo', 'validation'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Summary */}
              <div>
                <h3 className="text-sm font-medium text-gray-700">Summary</h3>
                <p className="mt-1 text-sm text-gray-600">{post.summary}</p>
              </div>

              {/* Hero Answer */}
              <div>
                <h3 className="text-sm font-medium text-gray-700">Hero Answer</h3>
                <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-3 rounded">{post.heroAnswer}</p>
              </div>

              {/* Sections */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Sections ({post.sections.length})</h3>
                <div className="space-y-4">
                  {post.sections.map((section, index) => (
                    <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{section.headingLevel}</span>
                        <h4 className="font-medium text-gray-900">{section.headingText}</h4>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3">{section.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQs */}
              {post.faq.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">FAQs ({post.faq.length})</h3>
                  <div className="space-y-3">
                    {post.faq.map((faq) => (
                      <div key={faq.id} className="bg-gray-50 rounded-lg p-4">
                        <p className="font-medium text-gray-900">{faq.question}</p>
                        <p className="mt-1 text-sm text-gray-600">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Primary Keyword</h3>
                  <p className="mt-1 text-sm bg-blue-50 text-blue-800 px-3 py-2 rounded inline-block">{post.primaryKeyword}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Search Intent</h3>
                  <p className="mt-1 text-sm text-gray-600">{post.searchIntent}</p>
                </div>
              </div>

              {post.secondaryKeywords.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Secondary Keywords</h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {post.secondaryKeywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-700">Meta Title</h3>
                <p className="mt-1 text-sm text-gray-600">{post.metaTitle}</p>
                <p className="text-xs text-gray-400">{post.metaTitle.length} characters</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700">Meta Description</h3>
                <p className="mt-1 text-sm text-gray-600">{post.metaDescription}</p>
                <p className="text-xs text-gray-400">{post.metaDescription.length} characters</p>
              </div>

              {post.cluster && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Topic Cluster</h3>
                  <Link href={`/admin/clusters`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-500">
                    {post.cluster.name}
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'validation' && (
            <div>
              {!validation ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Run validation to check SEO and E-E-A-T compliance</p>
                  <button
                    onClick={validatePost}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    Validate Now
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${validation.report.score >= 80 ? 'text-green-600' : validation.report.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {validation.report.score}
                    </div>
                    <div>
                      <p className="font-medium">{validation.report.valid ? 'Valid' : 'Invalid'}</p>
                      <p className="text-sm text-gray-500">
                        {validation.publishReady ? 'Ready to publish' : 'Not ready to publish'}
                      </p>
                    </div>
                  </div>

                  {/* Blockers */}
                  {validation.publishBlockers.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-red-800">Publish Blockers</h4>
                      <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                        {validation.publishBlockers.map((blocker, i) => (
                          <li key={i}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Errors */}
                  {validation.report.errors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-800 mb-2">Errors ({validation.report.errors.length})</h4>
                      <ul className="space-y-2">
                        {validation.report.errors.map((error, i) => (
                          <li key={i} className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded">
                            <span className="font-medium">{error.field}:</span> {error.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {validation.report.warnings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">Warnings ({validation.report.warnings.length})</h4>
                      <ul className="space-y-2">
                        {validation.report.warnings.map((warning, i) => (
                          <li key={i} className="text-sm bg-yellow-50 text-yellow-700 px-3 py-2 rounded">
                            <span className="font-medium">{warning.field}:</span> {warning.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.report.errors.length === 0 && validation.report.warnings.length === 0 && (
                    <p className="text-green-600 text-center py-4">All checks passed!</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
