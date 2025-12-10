/**
 * HTML Parser
 *
 * Parses HTML content into an intermediate representation using cheerio.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type {
  IntermediatePost,
  ExtractedHeading,
  ExtractedParagraph,
  ExtractedList,
  ExtractedTable,
  ExtractedLink,
  ExtractedImage,
} from '@/lib/schema/intermediate';
import { IMPORT_CONFIG } from '@/lib/config/constants';

/**
 * Parse HTML into intermediate representation
 */
export function parseHtml(
  html: string,
  sourceUrl: string,
  sourceType: 'shopify' | 'sitemap' | 'manual'
): IntermediatePost {
  const $ = cheerio.load(html);

  // Extract metadata
  const title = $('title').text().trim() || null;
  const h1 = $('h1').first().text().trim() || null;
  const metaTitle = $('meta[property="og:title"]').attr('content') || title;
  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    null;
  const canonicalUrl =
    $('link[rel="canonical"]').attr('href') || sourceUrl;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const ogTitle = $('meta[property="og:title"]').attr('content') || null;
  const ogDescription = $('meta[property="og:description"]').attr('content') || null;

  // Find content area
  const contentArea = findContentArea($);

  // Extract headings with hierarchy
  const headings = extractHeadings($, contentArea);

  // Extract paragraphs, associating with parent headings
  const paragraphs = extractParagraphs($, contentArea, headings);

  // Extract lists
  const lists = extractLists($, contentArea, headings);

  // Extract tables
  const tables = extractTables($, contentArea, headings);

  // Extract links
  const links = extractLinks($, contentArea, sourceUrl);

  // Extract images
  const images = extractImages($, contentArea);

  // Extract JSON-LD
  const jsonLd = extractJsonLd($);

  return {
    sourceUrl,
    sourceType,
    fetchedAt: new Date().toISOString(),
    rawHtml: html,
    title,
    h1,
    metaTitle,
    metaDescription,
    canonicalUrl,
    ogImage,
    ogTitle,
    ogDescription,
    headings,
    paragraphs,
    lists,
    tables,
    links,
    images,
    jsonLd,
  };
}

/**
 * Find the main content area of the page
 */
function findContentArea($: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
  // Try common content selectors
  for (const selector of IMPORT_CONFIG.contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      return element.first();
    }
  }

  // Fall back to body
  return $('body');
}

/**
 * Extract headings with hierarchy information
 */
function extractHeadings(
  $: cheerio.CheerioAPI,
  contentArea: cheerio.Cheerio<Element>
): ExtractedHeading[] {
  const headings: ExtractedHeading[] = [];

  contentArea.find('h1, h2, h3, h4, h5, h6').each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;

    // Skip if in excluded area
    if (isInExcludedArea($, $el)) return;

    const text = $el.text().trim();
    if (text) {
      headings.push({
        level,
        text,
        id: $el.attr('id') || null,
      });
    }
  });

  return headings;
}

/**
 * Extract paragraphs and associate with parent headings
 */
function extractParagraphs(
  $: cheerio.CheerioAPI,
  contentArea: cheerio.Cheerio<Element>,
  headings: ExtractedHeading[]
): ExtractedParagraph[] {
  const paragraphs: ExtractedParagraph[] = [];
  let currentHeadingIndex: number | null = null;

  // Build a map of heading positions
  const headingElements = contentArea.find('h1, h2, h3, h4, h5, h6').toArray();
  const headingIndexMap = new Map<Element, number>();
  headingElements.forEach((el, i) => {
    if (i < headings.length) {
      headingIndexMap.set(el, i);
    }
  });

  // Walk through all elements in order
  contentArea.find('h1, h2, h3, h4, h5, h6, p').each((_, element) => {
    const $el = $(element);

    if (isInExcludedArea($, $el)) return;

    const tagName = element.tagName.toLowerCase();

    if (tagName.match(/^h[1-6]$/)) {
      // Update current heading index
      const idx = headingIndexMap.get(element);
      if (idx !== undefined) {
        currentHeadingIndex = idx;
      }
    } else if (tagName === 'p') {
      const text = $el.text().trim();
      const html = $el.html() || '';

      if (text.length > 20) {
        // Skip very short paragraphs
        paragraphs.push({
          text,
          html,
          parentHeadingIndex: currentHeadingIndex,
        });
      }
    }
  });

  return paragraphs;
}

/**
 * Extract lists and associate with parent headings
 */
function extractLists(
  $: cheerio.CheerioAPI,
  contentArea: cheerio.Cheerio<Element>,
  headings: ExtractedHeading[]
): ExtractedList[] {
  const lists: ExtractedList[] = [];

  contentArea.find('ul, ol').each((_, element) => {
    const $el = $(element);

    if (isInExcludedArea($, $el)) return;

    const type = element.tagName.toLowerCase() as 'ul' | 'ol';
    const items: string[] = [];

    $el.find('> li').each((_, li) => {
      const text = $(li).text().trim();
      if (text) {
        items.push(text);
      }
    });

    if (items.length > 0) {
      // Find parent heading
      const parentHeadingIndex = findParentHeadingIndex($, $el, headings);

      lists.push({
        type,
        items,
        parentHeadingIndex,
      });
    }
  });

  return lists;
}

/**
 * Extract tables
 */
function extractTables(
  $: cheerio.CheerioAPI,
  contentArea: cheerio.Cheerio<Element>,
  headings: ExtractedHeading[]
): ExtractedTable[] {
  const tables: ExtractedTable[] = [];

  contentArea.find('table').each((_, element) => {
    const $table = $(element);

    if (isInExcludedArea($, $table)) return;

    const headers: string[] = [];
    const rows: string[][] = [];

    // Extract headers
    $table.find('thead th, thead td, tr:first-child th').each((_, th) => {
      headers.push($(th).text().trim());
    });

    // Extract rows
    $table.find('tbody tr, tr').each((rowIndex, tr) => {
      // Skip header row if we already have headers
      if (rowIndex === 0 && headers.length > 0) return;

      const row: string[] = [];
      $(tr)
        .find('td')
        .each((_, td) => {
          row.push($(td).text().trim());
        });

      if (row.length > 0) {
        rows.push(row);
      }
    });

    if (headers.length > 0 || rows.length > 0) {
      const parentHeadingIndex = findParentHeadingIndex($, $table, headings);

      tables.push({
        headers,
        rows,
        parentHeadingIndex,
      });
    }
  });

  return tables;
}

/**
 * Extract links and classify as internal/external
 */
function extractLinks(
  $: cheerio.CheerioAPI,
  contentArea: cheerio.Cheerio<Element>,
  sourceUrl: string
): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const sourceHost = new URL(sourceUrl).hostname;

  contentArea.find('a[href]').each((_, element) => {
    const $el = $(element);

    if (isInExcludedArea($, $el)) return;

    const href = $el.attr('href');
    if (!href) return;

    const text = $el.text().trim();
    if (!text) return;

    // Determine if internal
    let isInternal = false;
    try {
      if (href.startsWith('/') || href.startsWith('#')) {
        isInternal = true;
      } else {
        const linkHost = new URL(href).hostname;
        isInternal = linkHost === sourceHost;
      }
    } catch {
      // Invalid URL, treat as internal if relative
      isInternal = !href.startsWith('http');
    }

    links.push({
      href,
      text,
      isInternal,
    });
  });

  return links;
}

/**
 * Extract images with alt text and captions
 */
function extractImages(
  $: cheerio.CheerioAPI,
  contentArea: cheerio.Cheerio<Element>
): ExtractedImage[] {
  const images: ExtractedImage[] = [];

  contentArea.find('img[src]').each((_, element) => {
    const $img = $(element);

    if (isInExcludedArea($, $img)) return;

    const src = $img.attr('src');
    if (!src) return;

    const alt = $img.attr('alt') || null;

    // Try to find caption
    let caption: string | null = null;
    const $figure = $img.closest('figure');
    if ($figure.length > 0) {
      const $figcaption = $figure.find('figcaption');
      if ($figcaption.length > 0) {
        caption = $figcaption.text().trim();
      }
    }

    images.push({
      src,
      alt,
      caption,
    });
  });

  return images;
}

/**
 * Extract JSON-LD structured data
 */
function extractJsonLd($: cheerio.CheerioAPI): object[] {
  const jsonLd: object[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).html();
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          jsonLd.push(...parsed);
        } else {
          jsonLd.push(parsed);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  });

  return jsonLd;
}

/**
 * Check if element is inside an excluded area
 */
function isInExcludedArea(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>
): boolean {
  for (const selector of IMPORT_CONFIG.excludeSelectors) {
    if ($el.closest(selector).length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Find the index of the closest preceding heading
 */
function findParentHeadingIndex(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
  headings: ExtractedHeading[]
): number | null {
  // Simple heuristic: find previous sibling headings
  let $prev = $el.prev();
  while ($prev.length > 0) {
    const tagName = $prev.prop('tagName')?.toLowerCase();
    if (tagName && tagName.match(/^h[1-6]$/)) {
      const text = $prev.text().trim();
      const idx = headings.findIndex((h) => h.text === text);
      if (idx >= 0) {
        return idx;
      }
    }
    $prev = $prev.prev();
  }

  // Check parent elements
  const $parent = $el.parent();
  if ($parent.length > 0 && $parent.prop('tagName')?.toLowerCase() !== 'body') {
    return findParentHeadingIndex($, $parent, headings);
  }

  return null;
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string): string {
  return cheerio.load(html).text().trim();
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
