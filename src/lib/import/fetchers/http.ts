/**
 * HTTP Fetcher
 *
 * Generic HTTP fetcher for crawling web pages with rate limiting and retry logic.
 */

import { IMPORT_CONFIG } from '@/lib/config/constants';

interface FetchResult {
  url: string;
  html: string | null;
  status: number;
  error: string | null;
}

interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Fetch a single URL with retry logic
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeout = 10000,
    headers = {},
    maxRetries = IMPORT_CONFIG.maxRetries,
    retryDelay = IMPORT_CONFIG.retryDelay,
  } = options;

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; AllianceBlogBot/1.0; +https://alliancechemical.com)',
          Accept: 'text/html,application/xhtml+xml',
          ...headers,
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited, wait and retry
          await delay(retryDelay * (attempt + 1));
          continue;
        }

        return {
          url,
          html: null,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();

      return {
        url,
        html,
        status: response.status,
        error: null,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : 'Unknown error';

      if (attempt < maxRetries) {
        await delay(retryDelay * (attempt + 1));
      }
    }
  }

  return {
    url,
    html: null,
    status: 0,
    error: lastError || 'Max retries exceeded',
  };
}

/**
 * Fetch multiple URLs with concurrency control
 */
export async function fetchUrls(
  urls: string[],
  options: FetchOptions & {
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number) => void;
    delayBetweenRequests?: number;
  } = {}
): Promise<FetchResult[]> {
  const {
    maxConcurrent = IMPORT_CONFIG.maxConcurrentRequests,
    onProgress,
    delayBetweenRequests = IMPORT_CONFIG.delayBetweenRequests,
    ...fetchOptions
  } = options;

  const results: FetchResult[] = [];
  const queue = [...urls];
  let completed = 0;

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      const result = await fetchUrl(url, fetchOptions);
      results.push(result);

      completed++;
      if (onProgress) {
        onProgress(completed, urls.length);
      }

      // Delay between requests
      if (queue.length > 0) {
        await delay(delayBetweenRequests);
      }
    }
  }

  // Start workers
  const workers = Array(Math.min(maxConcurrent, urls.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);

  // Sort results to match original URL order
  const urlIndexMap = new Map(urls.map((url, i) => [url, i]));
  results.sort((a, b) => {
    const indexA = urlIndexMap.get(a.url) ?? 0;
    const indexB = urlIndexMap.get(b.url) ?? 0;
    return indexA - indexB;
  });

  return results;
}

/**
 * Fetch and parse sitemap.xml to discover URLs
 */
export async function fetchSitemap(
  sitemapUrl: string,
  options: {
    urlPattern?: RegExp;
    limit?: number;
  } = {}
): Promise<string[]> {
  const result = await fetchUrl(sitemapUrl);

  if (!result.html) {
    throw new Error(`Failed to fetch sitemap: ${result.error}`);
  }

  const urls: string[] = [];

  // Parse sitemap XML
  // Simple regex-based extraction (for production, consider using an XML parser)
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  let match;

  while ((match = locRegex.exec(result.html)) !== null) {
    const url = match[1].trim();

    // Apply filter if provided
    if (options.urlPattern && !options.urlPattern.test(url)) {
      continue;
    }

    urls.push(url);

    if (options.limit && urls.length >= options.limit) {
      break;
    }
  }

  // Check for sitemap index (contains other sitemaps)
  const sitemapIndexRegex = /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g;
  const childSitemaps: string[] = [];

  while ((match = sitemapIndexRegex.exec(result.html)) !== null) {
    childSitemaps.push(match[1].trim());
  }

  // Recursively fetch child sitemaps if this is a sitemap index
  if (childSitemaps.length > 0 && urls.length === 0) {
    for (const childUrl of childSitemaps) {
      const childUrls = await fetchSitemap(childUrl, {
        urlPattern: options.urlPattern,
        limit: options.limit ? options.limit - urls.length : undefined,
      });

      urls.push(...childUrls);

      if (options.limit && urls.length >= options.limit) {
        break;
      }
    }
  }

  return urls;
}

/**
 * Utility to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
