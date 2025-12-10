/**
 * Shopify Format Rules
 *
 * Functions that format content to match the Shopify main-article.liquid template's
 * parsing expectations. The template is the spec - these functions ensure generated
 * content will parse correctly for schema markup.
 *
 * Template Parsing Rules:
 * - FAQs: Q:/A: format on own lines OR H2 headings ending in ? with answer paragraphs
 * - How-To: "Step N:" prefix OR H3 headings with instruction content
 * - TOC: Generated from H2/H3 tags for posts over 1000 words
 * - Tables: Wrapped in responsive div automatically
 */

import type {
  ShopifyFAQ,
  ShopifyHowToStep,
  ComparisonItem,
  Callout,
  CalloutType,
  ProductLink,
} from './content-types';

// ============================================================================
// FAQ FORMATTING
// ============================================================================

/**
 * Format FAQs using Q:/A: format for Shopify template parsing
 * The template looks for Q: followed by question, then A: followed by answer
 */
export function formatFAQContent(faqs: ShopifyFAQ[]): string {
  if (faqs.length === 0) return '';

  const faqHtml = faqs
    .map(
      (faq) => `
<p><strong>Q: ${escapeHtml(faq.question)}</strong></p>
<p>A: ${faq.answer}</p>
`
    )
    .join('\n');

  return `
<h2>Frequently Asked Questions</h2>
${faqHtml}
`;
}

/**
 * Format FAQs using H2 question format (alternative parsing method)
 * Template also parses H2 headings ending in ? as FAQ questions
 */
export function formatFAQAsHeadings(faqs: ShopifyFAQ[]): string {
  if (faqs.length === 0) return '';

  return faqs
    .map(
      (faq) => `
<h2>${escapeHtml(faq.question)}${faq.question.endsWith('?') ? '' : '?'}</h2>
<p>${faq.answer}</p>
`
    )
    .join('\n');
}

/**
 * Parse HTML content to extract FAQs (for validation)
 * Mirrors the template's FAQ parsing logic
 */
export function parseFAQsFromHtml(html: string): ShopifyFAQ[] {
  const faqs: ShopifyFAQ[] = [];

  // Method 1: Q:/A: format
  const qaRegex = /<p>\s*<strong>\s*Q:\s*(.+?)\s*<\/strong>\s*<\/p>\s*<p>\s*A:\s*(.+?)\s*<\/p>/gi;
  let match;
  while ((match = qaRegex.exec(html)) !== null) {
    const question = stripHtml(match[1]).trim();
    const answer = stripHtml(match[2]).trim();
    if (question.length > 10 && answer.length > 10) {
      faqs.push({ question, answer });
    }
  }

  // Method 2: H2 headings ending in ?
  if (faqs.length === 0) {
    const h2Regex = /<h2[^>]*>([^<]+\?)\s*<\/h2>\s*<p>(.+?)<\/p>/gi;
    while ((match = h2Regex.exec(html)) !== null) {
      const question = stripHtml(match[1]).trim();
      const answer = stripHtml(match[2]).trim();
      if (question.length > 10 && answer.length > 10) {
        faqs.push({ question, answer });
      }
    }
  }

  return faqs;
}

// ============================================================================
// HOW-TO FORMATTING
// ============================================================================

/**
 * Format How-To steps using "Step N:" prefix format
 * The template splits on "Step " prefix and extracts numbered steps
 */
export function formatHowToSteps(steps: ShopifyHowToStep[]): string {
  if (steps.length === 0) return '';

  return steps
    .map(
      (step) => `
<h3>Step ${step.stepNumber}: ${escapeHtml(step.title)}</h3>
<p>${step.instructions}</p>
`
    )
    .join('\n');
}

/**
 * Format How-To steps with more detail (includes sub-lists, tips, etc.)
 */
export function formatHowToStepsDetailed(
  steps: ShopifyHowToStep[],
  options?: {
    includeTips?: boolean;
    tips?: Record<number, string>;
  }
): string {
  if (steps.length === 0) return '';

  return steps
    .map((step) => {
      let stepHtml = `
<h3>Step ${step.stepNumber}: ${escapeHtml(step.title)}</h3>
<p>${step.instructions}</p>`;

      if (options?.includeTips && options.tips?.[step.stepNumber]) {
        stepHtml += formatCallout({
          type: 'info',
          title: 'Pro Tip',
          content: escapeHtml(options.tips[step.stepNumber]),
        });
      }

      return stepHtml;
    })
    .join('\n');
}

/**
 * Parse HTML content to extract How-To steps (for validation)
 * Mirrors the template's step parsing logic
 */
export function parseStepsFromHtml(html: string): ShopifyHowToStep[] {
  const steps: ShopifyHowToStep[] = [];

  // Method 1: "Step N:" in H3 headings
  const stepH3Regex = /<h3[^>]*>\s*Step\s+(\d+):\s*(.+?)\s*<\/h3>\s*<p>(.+?)<\/p>/gi;
  let match;
  while ((match = stepH3Regex.exec(html)) !== null) {
    steps.push({
      stepNumber: parseInt(match[1], 10),
      title: stripHtml(match[2]).trim(),
      instructions: stripHtml(match[3]).trim(),
    });
  }

  // Method 2: H3 headings without Step prefix (fall back)
  if (steps.length === 0) {
    const h3Regex = /<h3[^>]*>(.+?)<\/h3>\s*<p>(.+?)<\/p>/gi;
    let stepNum = 1;
    while ((match = h3Regex.exec(html)) !== null) {
      steps.push({
        stepNumber: stepNum++,
        title: stripHtml(match[1]).trim(),
        instructions: stripHtml(match[2]).trim(),
      });
    }
  }

  return steps;
}

// ============================================================================
// COMPARISON TABLE FORMATTING
// ============================================================================

/**
 * Format comparison table HTML
 * The template wraps tables in responsive div automatically
 */
export function formatComparisonTable(
  items: ComparisonItem[],
  properties: string[],
  options?: {
    title?: string;
    includeRecommendation?: boolean;
    recommendedIndex?: number;
  }
): string {
  if (items.length === 0 || properties.length === 0) return '';

  const headerCells = ['', ...items.map((item) => `<th>${escapeHtml(item.name)}</th>`)].join('');

  const rows = properties
    .map((prop) => {
      const cells = items
        .map((item) => `<td>${escapeHtml(item.properties[prop] || '—')}</td>`)
        .join('');
      return `<tr><td><strong>${escapeHtml(prop)}</strong></td>${cells}</tr>`;
    })
    .join('\n');

  let tableHtml = `
<table>
  <thead>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;

  if (options?.title) {
    tableHtml = `<h2>${escapeHtml(options.title)}</h2>\n${tableHtml}`;
  }

  if (options?.includeRecommendation && options.recommendedIndex !== undefined) {
    const recommended = items[options.recommendedIndex];
    if (recommended) {
      tableHtml += `
<div class="callout success">
  <h4>Our Recommendation</h4>
  <p>For most applications, we recommend <strong>${escapeHtml(recommended.name)}</strong>.</p>
</div>`;
    }
  }

  return tableHtml;
}

/**
 * Format pros/cons comparison
 */
export function formatProsConsList(items: ComparisonItem[]): string {
  return items
    .map((item) => {
      const prosHtml = item.pros?.length
        ? `<ul class="pros">${item.pros.map((p) => `<li>✓ ${escapeHtml(p)}</li>`).join('')}</ul>`
        : '';
      const consHtml = item.cons?.length
        ? `<ul class="cons">${item.cons.map((c) => `<li>✗ ${escapeHtml(c)}</li>`).join('')}</ul>`
        : '';

      return `
<h3>${escapeHtml(item.name)}</h3>
${prosHtml}
${consHtml}`;
    })
    .join('\n');
}

// ============================================================================
// CALLOUT FORMATTING
// ============================================================================

/**
 * Inline styles for callouts (works without theme CSS)
 */
const CALLOUT_STYLES: Record<CalloutType, { bg: string; border: string; title: string }> = {
  info: { bg: '#e7f3ff', border: '#0066cc', title: '#0055aa' },
  warning: { bg: '#fff8e6', border: '#f0a000', title: '#b37700' },
  danger: { bg: '#fee2e2', border: '#dc2626', title: '#b91c1c' },
  success: { bg: '#e6f7e6', border: '#28a745', title: '#1e7e34' },
};

/**
 * Format callout box with inline styles
 * Works in Shopify without additional CSS
 */
export function formatCallout(callout: Callout): string {
  const icons: Record<CalloutType, string> = {
    warning: '⚠️',
    danger: '🚨',
    info: '💡',
    success: '✓',
  };

  const titles: Record<CalloutType, string> = {
    warning: 'Warning',
    danger: 'Danger',
    info: 'Pro Tip',
    success: 'Best Practice',
  };

  const style = CALLOUT_STYLES[callout.type];
  const icon = icons[callout.type];
  const title = callout.title || titles[callout.type];

  return `
<div style="background: ${style.bg}; border-left: 4px solid ${style.border}; padding: 1rem 1.25rem; border-radius: 6px; margin: 1.5rem 0;">
  <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: ${style.title};">${icon} ${escapeHtml(title)}</h4>
  <p style="margin: 0; line-height: 1.6;">${callout.content}</p>
</div>`;
}

/**
 * Format safety warning (prominent, for chemical handling)
 */
export function formatSafetyWarning(warning: string, severity: 'caution' | 'warning' | 'danger' = 'warning'): string {
  const icons: Record<string, string> = {
    caution: '⚠️',
    warning: '⚠️',
    danger: '🚨',
  };

  const titles: Record<string, string> = {
    caution: 'Caution',
    warning: 'Safety Warning',
    danger: 'Critical Safety Warning',
  };

  const styles: Record<string, { bg: string; border: string; title: string }> = {
    caution: { bg: '#fff8e6', border: '#f0a000', title: '#b37700' },
    warning: { bg: '#fff3cd', border: '#ff9800', title: '#cc7a00' },
    danger: { bg: '#fee2e2', border: '#dc2626', title: '#b91c1c' },
  };

  const style = styles[severity];

  return `
<div style="background: ${style.bg}; border-left: 4px solid ${style.border}; padding: 1.25rem 1.5rem; border-radius: 6px; margin: 1.5rem 0;">
  <h3 style="margin: 0 0 0.75rem 0; font-size: 1.1rem; color: ${style.title};">${icons[severity]} ${titles[severity]}</h3>
  <p style="margin: 0; line-height: 1.6;">${warning}</p>
</div>`;
}

// ============================================================================
// PRODUCT LINK FORMATTING
// ============================================================================

/**
 * Format product link for inline use
 */
export function formatProductLink(product: ProductLink): string {
  return `<a href="${escapeHtml(product.url)}">${escapeHtml(product.name)}</a>`;
}

/**
 * Format product card block
 */
export function formatProductCard(product: ProductLink, description?: string): string {
  return `
<div class="product-card">
  <h4><a href="${escapeHtml(product.url)}">${escapeHtml(product.name)}</a></h4>
  ${description ? `<p>${escapeHtml(description)}</p>` : ''}
</div>`;
}

/**
 * Format CTA section with product links (inline styles)
 */
export function formatCTASection(
  title: string,
  description: string,
  products: ProductLink[],
  ctaText: string = 'View Products'
): string {
  const buttonStyle = 'display: inline-block; background: white; color: #0066cc; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; margin-top: 1rem;';
  const linkStyle = 'color: white; text-decoration: underline;';

  const productLinks = products.length === 1
    ? `<a href="${escapeHtml(products[0].url)}" style="${buttonStyle}">${escapeHtml(ctaText)}</a>`
    : `<ul style="list-style: none; padding: 0; margin: 1rem 0;">${products.map((p) => `<li style="margin: 0.5rem 0;"><a href="${escapeHtml(p.url)}" style="${linkStyle}">${escapeHtml(p.name)}</a></li>`).join('')}</ul>`;

  return `
<div style="background: linear-gradient(135deg, #0066cc 0%, #004999 100%); color: white; padding: 2rem; border-radius: 8px; margin: 2rem 0;">
  <h2 style="color: white; margin: 0 0 1rem 0; border: none;">${escapeHtml(title)}</h2>
  <p style="color: rgba(255,255,255,0.9); margin: 0 0 1rem 0; line-height: 1.6;">${escapeHtml(description)}</p>
  ${productLinks}
</div>`;
}

// ============================================================================
// AUTHOR CREDENTIALS FORMATTING
// ============================================================================

/**
 * Format author credentials block
 */
export function formatAuthorCredentials(author: {
  name: string;
  role: string;
  credentials: string;
  experience?: string;
}): string {
  return `
<div class="author-credentials">
  <h4>About the Author</h4>
  <p><strong>${escapeHtml(author.name)}</strong> - ${escapeHtml(author.role)}</p>
  <p>${escapeHtml(author.credentials)}</p>
  ${author.experience ? `<p><em>${escapeHtml(author.experience)}</em></p>` : ''}
</div>`;
}

// ============================================================================
// HEADING HIERARCHY
// ============================================================================

/**
 * Extract headings from HTML for TOC validation
 */
export function extractHeadings(html: string): Array<{ level: 'h2' | 'h3'; text: string }> {
  const headings: Array<{ level: 'h2' | 'h3'; text: string }> = [];
  const regex = /<(h2|h3)[^>]*>(.+?)<\/\1>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: match[1].toLowerCase() as 'h2' | 'h3',
      text: stripHtml(match[2]).trim(),
    });
  }

  return headings;
}

/**
 * Validate heading hierarchy
 * TOC requires proper H2/H3 nesting
 */
export function validateHeadingHierarchy(html: string): {
  valid: boolean;
  errors: string[];
  headings: Array<{ level: 'h2' | 'h3'; text: string }>;
} {
  const headings = extractHeadings(html);
  const errors: string[] = [];

  // Check for H3 before any H2
  let foundH2 = false;
  for (const heading of headings) {
    if (heading.level === 'h2') {
      foundH2 = true;
    } else if (heading.level === 'h3' && !foundH2) {
      errors.push(`H3 "${heading.text}" appears before any H2 - may break TOC hierarchy`);
    }
  }

  // Check for empty headings
  for (const heading of headings) {
    if (heading.text.length === 0) {
      errors.push('Empty heading found');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    headings,
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate that FAQ content will parse correctly
 */
export function validateFAQParseable(html: string): {
  valid: boolean;
  faqs: ShopifyFAQ[];
  errors: string[];
} {
  const faqs = parseFAQsFromHtml(html);
  const errors: string[] = [];

  // Check if any FAQs were found
  if (html.toLowerCase().includes('faq') && faqs.length === 0) {
    errors.push('FAQ section found but no parseable Q&A pairs detected');
  }

  // Validate each FAQ
  for (const faq of faqs) {
    if (faq.question.length < 10) {
      errors.push(`FAQ question too short: "${faq.question}"`);
    }
    if (faq.answer.length < 10) {
      errors.push(`FAQ answer too short for: "${faq.question}"`);
    }
  }

  return {
    valid: errors.length === 0,
    faqs,
    errors,
  };
}

/**
 * Validate that How-To steps will parse correctly
 */
export function validateHowToParseable(html: string): {
  valid: boolean;
  steps: ShopifyHowToStep[];
  errors: string[];
} {
  const steps = parseStepsFromHtml(html);
  const errors: string[] = [];

  // Check if step numbers are sequential
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].stepNumber !== i + 1) {
      errors.push(`Step numbering is not sequential at step ${steps[i].stepNumber}`);
    }
  }

  // Check for empty steps
  for (const step of steps) {
    if (step.title.length === 0) {
      errors.push(`Step ${step.stepNumber} has empty title`);
    }
    if (step.instructions.length < 20) {
      errors.push(`Step ${step.stepNumber} has very short instructions`);
    }
  }

  return {
    valid: errors.length === 0,
    steps,
    errors,
  };
}

/**
 * Validate excerpt length for meta description
 */
export function validateExcerpt(excerpt: string): {
  valid: boolean;
  length: number;
  errors: string[];
} {
  const errors: string[] = [];
  const length = excerpt.length;

  if (length === 0) {
    errors.push('Excerpt is empty');
  } else if (length < 100) {
    errors.push(`Excerpt too short (${length} chars, recommended 130-155)`);
  } else if (length > 160) {
    errors.push(`Excerpt too long (${length} chars, max 155-160 for meta description)`);
  }

  return {
    valid: errors.length === 0,
    length,
    errors,
  };
}

/**
 * Validate word count for TOC generation
 * TOC only generates for posts over 1000 words
 */
export function validateWordCount(html: string): {
  wordCount: number;
  willGenerateTOC: boolean;
  headingCount: number;
} {
  const text = stripHtml(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const headings = extractHeadings(html);

  return {
    wordCount,
    willGenerateTOC: wordCount > 1000 && headings.length > 2,
    headingCount: headings.length,
  };
}

/**
 * Validate all product links point to valid URLs
 */
export function validateProductLinks(
  html: string,
  validDomains: string[] = ['alliancechemical.com']
): {
  valid: boolean;
  links: Array<{ href: string; text: string; valid: boolean }>;
  errors: string[];
} {
  const errors: string[] = [];
  const links: Array<{ href: string; text: string; valid: boolean }> = [];

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2];

    // Check if it's a product/collection link
    if (href.includes('/products/') || href.includes('/collections/')) {
      const isValid = validDomains.some((domain) => href.includes(domain));
      links.push({ href, text, valid: isValid });
      if (!isValid) {
        errors.push(`Product link may be invalid: ${href}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    links,
    errors,
  };
}

// ============================================================================
// POST-PROCESSING: CONVERT CLASS-BASED TO INLINE STYLES
// ============================================================================

/**
 * Convert class-based callouts to inline styles
 * This catches any callouts the AI generates with class="callout ..."
 */
export function inlineCalloutStyles(html: string): string {
  const styles: Record<string, { bg: string; border: string; title: string }> = {
    info: { bg: '#e7f3ff', border: '#0066cc', title: '#0055aa' },
    warning: { bg: '#fff8e6', border: '#f0a000', title: '#b37700' },
    danger: { bg: '#fee2e2', border: '#dc2626', title: '#b91c1c' },
    success: { bg: '#e6f7e6', border: '#28a745', title: '#1e7e34' },
  };

  // Match <div class="callout TYPE"> patterns
  let result = html;

  for (const [type, style] of Object.entries(styles)) {
    // Pattern: <div class="callout TYPE">
    const classPattern = new RegExp(
      `<div\\s+class=["']callout\\s+${type}["']\\s*>`,
      'gi'
    );
    result = result.replace(
      classPattern,
      `<div style="background: ${style.bg}; border-left: 4px solid ${style.border}; padding: 1rem 1.25rem; border-radius: 6px; margin: 1.5rem 0;">`
    );
  }

  // Also handle h4 inside callouts that don't have styles
  result = result.replace(
    /<h4>([^<]*)<\/h4>\s*<p>/gi,
    '<h4 style="margin: 0 0 0.5rem 0; font-size: 1rem;">$1</h4><p style="margin: 0; line-height: 1.6;">'
  );

  // Handle h3 inside danger callouts (Critical Safety Warning)
  result = result.replace(
    /<h3>🚨([^<]*)<\/h3>/gi,
    '<h3 style="margin: 0 0 0.75rem 0; font-size: 1.1rem; color: #b91c1c;">🚨$1</h3>'
  );

  return result;
}

/**
 * Convert class-based CTA sections to inline styles
 */
export function inlineCTAStyles(html: string): string {
  // Match <div class="cta-section">
  let result = html.replace(
    /<div\s+class=["']cta-section["']\s*>/gi,
    '<div style="background: linear-gradient(135deg, #0066cc 0%, #004999 100%); color: white; padding: 2rem; border-radius: 8px; margin: 2rem 0;">'
  );

  // Style h2 inside CTA sections
  result = result.replace(
    /(<div style="background: linear-gradient[^"]+">)\s*<h2>/gi,
    '$1<h2 style="color: white; margin: 0 0 1rem 0; border: none;">'
  );

  // Style CTA buttons
  result = result.replace(
    /<a\s+href="([^"]+)"\s+class=["']cta-button["']\s*>/gi,
    '<a href="$1" style="display: inline-block; background: white; color: #0066cc; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; margin-top: 1rem;">'
  );

  return result;
}

/**
 * Apply all inline style conversions to HTML
 * Run this on generated article body before saving
 */
export function applyInlineStyles(html: string): string {
  let result = html;
  result = inlineCalloutStyles(result);
  result = inlineCTAStyles(result);
  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Calculate word count from HTML
 */
export function calculateWordCount(html: string): number {
  const text = stripHtml(html);
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(wordCount: number, wpm: number = 200): number {
  return Math.ceil(wordCount / wpm);
}
