'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Cluster {
  id: string;
  name: string;
  description: string | null;
  parent: { id: string; name: string } | null;
  children: Array<{ id: string; name: string }>;
  pillarPost: { id: string; title: string; slug: string; status: string } | null;
  posts: Array<{ id: string; title: string; slug: string; status: string }>;
  ideas: Array<{ id: string; topic: string; status: string }>;
}

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCluster, setNewCluster] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchClusters();
  }, []);

  async function fetchClusters() {
    try {
      const res = await fetch('/api/clusters');
      const data = await res.json();
      setClusters(data.clusters);
    } catch (error) {
      console.error('Failed to fetch clusters:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCluster(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCluster),
      });

      if (res.ok) {
        setNewCluster({ name: '', description: '' });
        setShowNewForm(false);
        fetchClusters();
      }
    } catch (error) {
      console.error('Failed to create cluster:', error);
    }
  }

  async function deleteCluster(id: string) {
    if (!confirm('Are you sure you want to delete this cluster?')) return;

    try {
      const res = await fetch(`/api/clusters/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete cluster');
        return;
      }
      fetchClusters();
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Topic Clusters</h1>
          <p className="mt-2 text-sm text-gray-700">
            Organize content into topical clusters for SEO authority building.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            New Cluster
          </button>
        </div>
      </div>

      {/* New Cluster Form */}
      {showNewForm && (
        <div className="mt-6 bg-white shadow sm:rounded-lg p-6">
          <form onSubmit={handleCreateCluster}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Cluster Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={newCluster.name}
                  onChange={(e) => setNewCluster({ ...newCluster, name: e.target.value })}
                  placeholder="e.g., Industrial Cleaning Solutions"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={newCluster.description}
                  onChange={(e) => setNewCluster({ ...newCluster, description: e.target.value })}
                  placeholder="Brief description of this topic area"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clusters Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No clusters</h3>
            <p className="mt-1 text-sm text-gray-500">Create topic clusters to organize your content strategy.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowNewForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Create Cluster
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{cluster.name}</h3>
                      {cluster.description && (
                        <p className="mt-1 text-sm text-gray-500">{cluster.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCluster(cluster.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Pillar Post */}
                  {cluster.pillarPost && (
                    <div className="mt-4 p-3 bg-indigo-50 rounded-md">
                      <div className="flex items-center">
                        <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <span className="ml-2 text-sm font-medium text-indigo-600">Pillar Post</span>
                      </div>
                      <Link href={`/admin/posts/${cluster.pillarPost.id}`} className="mt-1 block text-sm text-gray-900 hover:text-indigo-600">
                        {cluster.pillarPost.title}
                      </Link>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{cluster.posts.length}</span>
                      <span className="text-gray-500 ml-1">posts</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{cluster.ideas.length}</span>
                      <span className="text-gray-500 ml-1">ideas</span>
                    </div>
                    {cluster.children.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-900">{cluster.children.length}</span>
                        <span className="text-gray-500 ml-1">sub-clusters</span>
                      </div>
                    )}
                  </div>

                  {/* Recent Posts */}
                  {cluster.posts.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Posts</h4>
                      <ul className="mt-2 space-y-1">
                        {cluster.posts.slice(0, 3).map((post) => (
                          <li key={post.id} className="text-sm">
                            <Link href={`/admin/posts/${post.id}`} className="text-gray-700 hover:text-indigo-600">
                              {post.title}
                            </Link>
                          </li>
                        ))}
                        {cluster.posts.length > 3 && (
                          <li className="text-sm text-gray-500">+{cluster.posts.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
