'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TopicSuggestion {
  topic: string;
  primaryKeyword: string;
  searchIntent: string;
  estimatedVolume: string;
  clusterSuggestion: string;
  justification: string;
  targetQuery: string;
  differentiation: string;
}

export default function GenerateIdeasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [formData, setFormData] = useState({
    productLine: '',
    targetAudience: '',
    funnelStage: 'awareness',
    count: 5,
    preferNewCluster: false,
  });

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuggestions([]);

    try {
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          saveToDatabase: false,
        }),
      });

      const data = await res.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to generate topics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          saveToDatabase: true,
        }),
      });

      if (res.ok) {
        router.push('/admin/ideas');
      }
    } catch (error) {
      console.error('Failed to save ideas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSingle(suggestion: TopicSuggestion) {
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: suggestion.topic,
          primaryKeyword: suggestion.primaryKeyword,
          searchIntent: suggestion.searchIntent,
          targetAudience: formData.targetAudience,
          funnelStage: formData.funnelStage,
          justification: suggestion.justification,
          aiGenerated: true,
        }),
      });

      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.topic !== suggestion.topic));
      }
    } catch (error) {
      console.error('Failed to save idea:', error);
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Generate Topic Ideas</h1>
        <p className="mt-2 text-sm text-gray-700">
          Use AI to generate blog topic suggestions based on your product line and audience.
        </p>
      </div>

      {/* Generation Form */}
      <form onSubmit={handleGenerate} className="bg-white shadow sm:rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="productLine" className="block text-sm font-medium text-gray-700">
              Product Line / Topic Area
            </label>
            <input
              type="text"
              id="productLine"
              required
              placeholder="e.g., Industrial cleaning chemicals"
              value={formData.productLine}
              onChange={(e) => setFormData({ ...formData, productLine: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700">
              Target Audience
            </label>
            <input
              type="text"
              id="targetAudience"
              required
              placeholder="e.g., Facility managers in manufacturing plants"
              value={formData.targetAudience}
              onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="funnelStage" className="block text-sm font-medium text-gray-700">
              Funnel Stage
            </label>
            <select
              id="funnelStage"
              value={formData.funnelStage}
              onChange={(e) => setFormData({ ...formData, funnelStage: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="awareness">Awareness - Learning about problems</option>
              <option value="consideration">Consideration - Exploring solutions</option>
              <option value="decision">Decision - Ready to buy</option>
              <option value="retention">Retention - Post-purchase support</option>
            </select>
          </div>

          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700">
              Number of Suggestions
            </label>
            <select
              id="count"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value={3}>3 topics</option>
              <option value={5}>5 topics</option>
              <option value={10}>10 topics</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center">
              <input
                id="preferNewCluster"
                type="checkbox"
                checked={formData.preferNewCluster}
                onChange={(e) => setFormData({ ...formData, preferNewCluster: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="preferNewCluster" className="ml-2 block text-sm text-gray-700">
                Prefer topics that could form new clusters (vs fitting into existing ones)
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Topics'}
          </button>
        </div>
      </form>

      {/* Results */}
      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Generated Suggestions</h2>
            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Save All to Ideas
            </button>
          </div>

          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="bg-white shadow sm:rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{suggestion.topic}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {suggestion.primaryKeyword}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {suggestion.searchIntent}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {suggestion.estimatedVolume} volume
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveSingle(suggestion)}
                    className="ml-4 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Save
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Target Query</h4>
                    <p className="mt-1 text-sm text-gray-500">{suggestion.targetQuery}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Cluster</h4>
                    <p className="mt-1 text-sm text-gray-500">{suggestion.clusterSuggestion}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700">Why This Topic?</h4>
                  <p className="mt-1 text-sm text-gray-500">{suggestion.justification}</p>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700">Our Differentiation</h4>
                  <p className="mt-1 text-sm text-gray-500">{suggestion.differentiation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
