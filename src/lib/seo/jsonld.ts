/**
 * JSON-LD Generation
 *
 * Generate structured data for blog posts.
 */

import type {
  BlogPost,
  ArticleJsonLd,
  FaqPageJsonLd,
  Author,
} from '@/lib/schema/canonical';

/**
 * Organization info for JSON-LD
 */
export interface OrganizationInfo {
  name: string;
  logoUrl: string;
  websiteUrl: string;
}

/**
 * Generate Article/BlogPosting JSON-LD for a blog post
 */
export function generateArticleJsonLd(
  post: BlogPost,
  org: OrganizationInfo
): ArticleJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.slice(0, 110),
    description: post.summary,
    image: null, // TODO: Add hero image support
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.profileUrl,
      jobTitle: post.author.role,
      description: post.author.credentials,
    },
    publisher: {
      '@type': 'Organization',
      name: org.name,
      logo: {
        '@type': 'ImageObject',
        url: org.logoUrl,
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.canonicalUrl,
    },
    keywords: [post.primaryKeyword, ...post.secondaryKeywords.slice(0, 5)].join(
      ', '
    ),
  };
}

/**
 * Generate FAQPage JSON-LD for a blog post with FAQs
 */
export function generateFaqPageJsonLd(
  post: BlogPost
): FaqPageJsonLd | null {
  if (post.faq.length < 2) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripHtml(faq.answer),
      },
    })),
  };
}

/**
 * Generate BreadcrumbList JSON-LD
 */
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate Person JSON-LD for author
 */
export function generateAuthorJsonLd(
  author: Author,
  org: OrganizationInfo
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: author.profileUrl,
    image: author.avatarUrl,
    jobTitle: author.role,
    description: author.credentials,
    worksFor: {
      '@type': 'Organization',
      name: org.name,
      url: org.websiteUrl,
    },
  };
}

/**
 * Combine multiple JSON-LD objects into a graph
 */
export function combineJsonLd(objects: object[]): object {
  return {
    '@context': 'https://schema.org',
    '@graph': objects.map((obj) => {
      // Remove @context from individual objects when combining
      const { '@context': _, ...rest } = obj as { '@context'?: string };
      return rest;
    }),
  };
}

/**
 * Generate all JSON-LD for a blog post
 */
export function generateAllJsonLd(
  post: BlogPost,
  org: OrganizationInfo,
  options: {
    includeBreadcrumbs?: boolean;
    breadcrumbItems?: Array<{ name: string; url: string }>;
  } = {}
): string {
  const objects: object[] = [];

  // Article JSON-LD
  objects.push(generateArticleJsonLd(post, org));

  // FAQ JSON-LD (if applicable)
  const faqJsonLd = generateFaqPageJsonLd(post);
  if (faqJsonLd) {
    objects.push(faqJsonLd);
  }

  // Breadcrumbs (if requested)
  if (options.includeBreadcrumbs && options.breadcrumbItems) {
    objects.push(generateBreadcrumbJsonLd(options.breadcrumbItems));
  }

  // Combine and stringify
  const combined = combineJsonLd(objects);
  return JSON.stringify(combined, null, 2);
}

/**
 * Validate JSON-LD structure
 */
export function validateJsonLd(jsonLd: object): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for @context
  if (!('@context' in jsonLd)) {
    errors.push('Missing @context');
  }

  // Check for @type or @graph
  if (!('@type' in jsonLd) && !('@graph' in jsonLd)) {
    errors.push('Missing @type or @graph');
  }

  // Check Article structure
  if ((jsonLd as { '@type'?: string })['@type'] === 'Article' ||
      (jsonLd as { '@type'?: string })['@type'] === 'BlogPosting') {
    const article = jsonLd as ArticleJsonLd;

    if (!article.headline) {
      errors.push('Article missing headline');
    }
    if (!article.author) {
      errors.push('Article missing author');
    }
    if (!article.publisher) {
      errors.push('Article missing publisher');
    }
  }

  // Check FAQPage structure
  if ((jsonLd as { '@type'?: string })['@type'] === 'FAQPage') {
    const faqPage = jsonLd as FaqPageJsonLd;

    if (!faqPage.mainEntity || faqPage.mainEntity.length === 0) {
      errors.push('FAQPage missing mainEntity');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Strip HTML tags from text (for JSON-LD)
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
