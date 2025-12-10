/**
 * Shopify Fetcher
 *
 * Fetches blog articles from Shopify Admin GraphQL API.
 */

import type { IntermediatePost, ShopifyArticleData } from '@/lib/schema/intermediate';
import { IMPORT_CONFIG } from '@/lib/config/constants';

/**
 * Shopify article from GraphQL response
 */
interface ShopifyArticleNode {
  id: string;
  handle: string;
  title: string;
  body: string; // HTML content
  summary: string | null;
  tags: string[];
  publishedAt: string | null;
  author: {
    name: string;
  } | null;
  blog: {
    id: string;
    handle: string;
    title: string;
  };
  image: {
    url: string;
    altText: string | null;
  } | null;
}

interface ShopifyArticlesResponse {
  data: {
    articles: {
      edges: Array<{
        cursor: string;
        node: ShopifyArticleNode;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Shopify GraphQL client interface
 */
interface ShopifyClient {
  query<T>(gql: string, variables?: Record<string, unknown>): Promise<T>;
}

/**
 * Create a Shopify GraphQL client
 */
export function createShopifyClient(store: string, accessToken: string): ShopifyClient {
  const endpoint = `https://${store}/admin/api/2024-10/graphql.json`;

  async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: gql, variables }),
    });

    if (!fetchResponse.ok) {
      throw new Error(`Shopify API error: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }

    const json = await fetchResponse.json();

    if (json.errors && json.errors.length > 0) {
      throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
    }

    return json as T;
  }

  return { query };
}

/**
 * GraphQL query to fetch articles
 */
const ARTICLES_QUERY = `
  query GetArticles($first: Int!, $after: String) {
    articles(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          handle
          title
          body
          summary
          tags
          publishedAt
          author {
            name
          }
          blog {
            id
            handle
            title
          }
          image {
            url
            altText
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Fetch all articles from Shopify with pagination
 */
export async function fetchAllShopifyArticles(
  store: string,
  accessToken: string,
  options: {
    blogHandle?: string;
    limit?: number;
    onProgress?: (fetched: number, total: number | null) => void;
  } = {}
): Promise<IntermediatePost[]> {
  const client = createShopifyClient(store, accessToken);
  const articles: IntermediatePost[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  const maxLimit = options.limit || Infinity;

  while (hasMore && articles.length < maxLimit) {
    const batchSize = Math.min(
      IMPORT_CONFIG.shopifyPageSize,
      maxLimit - articles.length
    );

    const articlesResponse: ShopifyArticlesResponse = await client.query<ShopifyArticlesResponse>(ARTICLES_QUERY, {
      first: batchSize,
      after: cursor,
    });

    const { edges, pageInfo } = articlesResponse.data.articles;

    for (const { node } of edges) {
      // Filter by blog handle if specified
      if (options.blogHandle && node.blog.handle !== options.blogHandle) {
        continue;
      }

      const ir = shopifyArticleToIntermediate(node, store);
      articles.push(ir);

      if (articles.length >= maxLimit) {
        break;
      }
    }

    cursor = pageInfo.endCursor;
    hasMore = pageInfo.hasNextPage;

    if (options.onProgress) {
      options.onProgress(articles.length, null);
    }

    // Rate limiting delay
    if (hasMore) {
      await delay(IMPORT_CONFIG.delayBetweenRequests);
    }
  }

  return articles;
}

/**
 * Fetch a single article by handle
 */
export async function fetchShopifyArticle(
  store: string,
  accessToken: string,
  blogHandle: string,
  articleHandle: string
): Promise<IntermediatePost | null> {
  const client = createShopifyClient(store, accessToken);

  const query = `
    query GetArticle($blogHandle: String!, $articleHandle: String!) {
      blogByHandle(handle: $blogHandle) {
        articleByHandle(handle: $articleHandle) {
          id
          handle
          title
          body
          summary
          tags
          publishedAt
          author {
            name
          }
          blog {
            id
            handle
            title
          }
          image {
            url
            altText
          }
        }
      }
    }
  `;

  interface SingleArticleResponse {
    data: {
      blogByHandle: {
        articleByHandle: ShopifyArticleNode | null;
      } | null;
    };
  }

  const response = await client.query<SingleArticleResponse>(query, {
    blogHandle,
    articleHandle,
  });

  const article = response.data.blogByHandle?.articleByHandle;

  if (!article) {
    return null;
  }

  return shopifyArticleToIntermediate(article, store);
}

/**
 * Convert Shopify article to intermediate representation
 */
function shopifyArticleToIntermediate(
  article: ShopifyArticleNode,
  store: string
): IntermediatePost {
  const sourceUrl = `https://${store}/blogs/${article.blog.handle}/${article.handle}`;

  const shopifyData: ShopifyArticleData = {
    articleId: article.id,
    blogId: article.blog.id,
    blogHandle: article.blog.handle,
    author: article.author?.name || null,
    tags: article.tags,
    publishedAt: article.publishedAt,
    handle: article.handle,
    image: article.image
      ? {
          url: article.image.url,
          altText: article.image.altText,
        }
      : null,
  };

  // Build basic HTML structure
  const rawHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(article.title)}</title>
      ${article.summary ? `<meta name="description" content="${escapeHtml(article.summary)}">` : ''}
    </head>
    <body>
      <article>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.body}
      </article>
    </body>
    </html>
  `;

  return {
    sourceUrl,
    sourceType: 'shopify',
    fetchedAt: new Date().toISOString(),
    rawHtml,
    title: article.title,
    h1: article.title,
    metaTitle: article.title,
    metaDescription: article.summary || null,
    canonicalUrl: sourceUrl,
    ogImage: article.image?.url || null,
    ogTitle: article.title,
    ogDescription: article.summary || null,
    headings: [], // Will be populated by HTML parser
    paragraphs: [],
    lists: [],
    tables: [],
    links: [],
    images: article.image
      ? [
          {
            src: article.image.url,
            alt: article.image.altText,
            caption: null,
          },
        ]
      : [],
    jsonLd: [],
    shopify: shopifyData,
  };
}

/**
 * Utility to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
