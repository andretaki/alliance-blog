'use client';

import { useState, useEffect } from 'react';

interface ImportResult {
  success: boolean;
  imported: number;
  updated?: number;
  failed: number;
  errors: string[];
}

interface Author {
  id: string;
  name: string;
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'shopify' | 'urls' | 'sitemap'>('urls');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState('');

  // Form states
  const [urls, setUrls] = useState('');
  const [shopifyStore, setShopifyStore] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [blogPathPattern, setBlogPathPattern] = useState('/blog/');
  const [limit, setLimit] = useState(20);
  
  useEffect(() => {
    fetchAuthors();
  }, []);

  async function fetchAuthors() {
    try {
      const res = await fetch('/api/authors');
      const data = await res.json();
      setAuthors(data.authors);
      if (data.authors.length > 0) {
        setSelectedAuthor(data.authors[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch authors:', error);
    }
  }

  async function handleImport() {
    if (!selectedAuthor) {
      alert('Please select an author first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      switch (activeTab) {
        case 'urls':
          endpoint = '/api/import/urls';
          body = {
            urls: urls.split('\n').map((u) => u.trim()).filter(Boolean),
            authorId: selectedAuthor,
          };
          break;
        case 'shopify':
          endpoint = '/api/import/shopify';
          body = {
            store: shopifyStore,
            accessToken: shopifyToken,
            authorId: selectedAuthor,
            limit,
          };
          break;
        case 'sitemap':
          endpoint = '/api/import/sitemap';
          body = {
            sitemapUrl,
            blogPathPattern,
            authorId: selectedAuthor,
            limit,
          };
          break;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Import failed:', error);
      setResult({
        success: false,
        imported: 0,
        failed: 0,
        errors: ['Import request failed'],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Import Content</h1>
        <p className="mt-2 text-sm text-gray-700">
          Import existing blog content from Shopify, URLs, or sitemaps.
        </p>
      </div>

      {/* Author Selection */}
      {authors.length === 0 ? (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-800">
            Please <a href="/admin/authors/new" className="underline">create an author</a> before importing content.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <label htmlFor="author" className="block text-sm font-medium text-gray-700">
            Assign to Author
          </label>
          <select
            id="author"
            value={selectedAuthor}
            onChange={(e) => setSelectedAuthor(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'urls', label: 'From URLs' },
            { id: 'sitemap', label: 'From Sitemap' },
            { id: 'shopify', label: 'From Shopify' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Import Forms */}
      <div className="mt-6 bg-white shadow sm:rounded-lg p-6">
        {activeTab === 'urls' && (
          <div>
            <label htmlFor="urls" className="block text-sm font-medium text-gray-700">
              URLs (one per line)
            </label>
            <textarea
              id="urls"
              rows={8}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/blog/post-1&#10;https://example.com/blog/post-2&#10;https://example.com/blog/post-3"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
            />
          </div>
        )}

        {activeTab === 'sitemap' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="sitemapUrl" className="block text-sm font-medium text-gray-700">
                Sitemap URL
              </label>
              <input
                type="url"
                id="sitemapUrl"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="blogPathPattern" className="block text-sm font-medium text-gray-700">
                  Blog Path Pattern
                </label>
                <input
                  type="text"
                  id="blogPathPattern"
                  value={blogPathPattern}
                  onChange={(e) => setBlogPathPattern(e.target.value)}
                  placeholder="/blog/"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Only import URLs containing this path</p>
              </div>
              <div>
                <label htmlFor="limit" className="block text-sm font-medium text-gray-700">
                  Max URLs
                </label>
                <input
                  type="number"
                  id="limit"
                  min={1}
                  max={100}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shopify' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="shopifyStore" className="block text-sm font-medium text-gray-700">
                  Store Name
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="shopifyStore"
                    value={shopifyStore}
                    onChange={(e) => setShopifyStore(e.target.value)}
                    placeholder="my-store"
                    className="flex-1 rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
                    .myshopify.com
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="shopifyToken" className="block text-sm font-medium text-gray-700">
                  Access Token
                </label>
                <input
                  type="password"
                  id="shopifyToken"
                  value={shopifyToken}
                  onChange={(e) => setShopifyToken(e.target.value)}
                  placeholder="shpat_..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="shopifyLimit" className="block text-sm font-medium text-gray-700">
                Max Articles
              </label>
              <input
                type="number"
                id="shopifyLimit"
                min={1}
                max={250}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleImport}
            disabled={loading || !selectedAuthor}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import Content'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-8 bg-white shadow sm:rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Import Results</h3>
            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-green-600 font-medium">{result.imported} imported</span>
              {result.updated !== undefined && result.updated > 0 && (
                <span className="text-blue-600 font-medium">{result.updated} updated</span>
              )}
              <span className="text-red-600 font-medium">{result.failed} failed</span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-100">
              <h4 className="text-sm font-medium text-red-800">Errors</h4>
              <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                {result.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {result.imported > 0 && (
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Successfully imported {result.imported} posts.{' '}
                <a href="/admin/posts" className="text-indigo-600 hover:text-indigo-500">
                  View all posts
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
