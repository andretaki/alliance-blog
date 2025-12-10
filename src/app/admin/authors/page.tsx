'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Author {
  id: string;
  name: string;
  role: string;
  credentials: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuthors();
  }, []);

  async function fetchAuthors() {
    try {
      const res = await fetch('/api/authors');
      const data = await res.json();
      setAuthors(data.authors);
    } catch (error) {
      console.error('Failed to fetch authors:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteAuthor(id: string) {
    if (!confirm('Are you sure you want to delete this author?')) return;

    try {
      const res = await fetch(`/api/authors/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete author');
        return;
      }
      fetchAuthors();
    } catch (error) {
      console.error('Failed to delete author:', error);
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Authors</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage author profiles for E-E-A-T compliance. Each post requires an author with credentials.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/admin/authors/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Add Author
          </Link>
        </div>
      </div>

      {/* Authors Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : authors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No authors</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating an author profile.</p>
            <div className="mt-6">
              <Link
                href="/admin/authors/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Add Author
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => (
              <div key={author.id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {author.avatarUrl ? (
                        <img
                          className="h-12 w-12 rounded-full"
                          src={author.avatarUrl}
                          alt={author.name}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-xl font-medium text-indigo-600">
                            {author.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{author.name}</h3>
                      <p className="text-sm text-gray-500">{author.role}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 line-clamp-3">{author.credentials}</p>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 flex justify-between">
                  <Link
                    href={`/admin/authors/${author.id}`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deleteAuthor(author.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
