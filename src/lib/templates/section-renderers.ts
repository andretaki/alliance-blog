/**
 * Section Renderers for Alliance Chemical Blog Template
 * Each function renders a specific section type to HTML
 */

import { marked } from 'marked';

// Configure marked for safe HTML output
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Convert markdown to HTML
 */
export function md(content: string): string {
  return marked.parse(content) as string;
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface BlogMeta {
  title: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
}

export interface BlogHero {
  subtitle: string;
  badges: string[];
  heroImage?: string;
}

export interface TextSection {
  type: 'text';
  heading: string;
  content: string;
}

export interface CalloutSection {
  type: 'callout';
  variant: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  content: string;
}

export interface TableSection {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
  highlightRows?: number[];
}

export interface ComparisonItem {
  title: string;
  points: string[];
  featured?: boolean;
}

export interface ComparisonSection {
  type: 'comparison';
  items: ComparisonItem[];
}

export interface ProcessStep {
  title: string;
  content: string;
}

export interface ProcessStepsSection {
  type: 'process-steps';
  heading?: string;
  steps: ProcessStep[];
}

export interface Stat {
  value: string;
  label: string;
}

export interface CaseStudySection {
  type: 'case-study';
  title: string;
  stats?: Stat[];
  content: string;
}

export interface ProductItem {
  handle: string;
  title: string;
  description: string;
}

export interface ProductGridSection {
  type: 'product-grid';
  products: ProductItem[];
}

export interface ImageSection {
  type: 'image';
  url?: string;
  suggestion?: string;
  alt: string;
  caption?: string;
  wide?: boolean;
}

export interface FAQItem {
  q: string;
  a: string;
}

export interface FAQSection {
  type: 'faq';
  heading?: string;
  questions: FAQItem[];
}

export interface BlogCTA {
  title: string;
  text: string;
  buttonText: string;
  buttonUrl?: string;
  productHandle?: string;
}

export type BlogSection =
  | TextSection
  | CalloutSection
  | TableSection
  | ComparisonSection
  | ProcessStepsSection
  | CaseStudySection
  | ProductGridSection
  | ImageSection
  | FAQSection;

export interface BlogContent {
  meta: BlogMeta;
  hero: BlogHero;
  sections: BlogSection[];
  cta?: BlogCTA;
}

// =============================================================================
// SECTION RENDERERS
// =============================================================================

/**
 * Render text section with heading and markdown content
 */
export function renderTextSection(section: TextSection): string {
  return `
<section>
  <h2>${escapeHtml(section.heading)}</h2>
  ${md(section.content)}
</section>`;
}

/**
 * Render callout box
 */
export function renderCallout(section: CalloutSection): string {
  const icons: Record<string, string> = {
    info: '💡',
    warning: '⚠️',
    danger: '🚨',
    success: '✓',
  };
  const icon = icons[section.variant] || '';

  return `
<div class="ac-callout ${section.variant}">
  <h4>${icon} ${escapeHtml(section.title)}</h4>
  ${md(section.content)}
</div>`;
}

/**
 * Render table
 */
export function renderTable(section: TableSection): string {
  const headerCells = section.headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('');

  const rows = section.rows
    .map((row, index) => {
      const isHighlight = section.highlightRows?.includes(index);
      const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
      return `<tr${isHighlight ? ' class="highlight-row"' : ''}>${cells}</tr>`;
    })
    .join('\n');

  const caption = section.caption
    ? `<caption>${escapeHtml(section.caption)}</caption>`
    : '';

  return `
<table>
  ${caption}
  <thead>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
}

/**
 * Render comparison grid
 */
export function renderComparison(section: ComparisonSection): string {
  const cards = section.items
    .map((item) => {
      const points = item.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('');
      const featuredClass = item.featured ? ' featured' : '';
      return `
<div class="comparison-card${featuredClass}">
  <h4>${escapeHtml(item.title)}</h4>
  <ul>${points}</ul>
</div>`;
    })
    .join('');

  return `
<div class="comparison-grid">
  ${cards}
</div>`;
}

/**
 * Render process steps
 */
export function renderProcessSteps(section: ProcessStepsSection): string {
  const heading = section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : '';

  const steps = section.steps
    .map(
      (step) => `
<div class="process-step">
  <h4>${escapeHtml(step.title)}</h4>
  ${md(step.content)}
</div>`
    )
    .join('');

  return `
${heading}
<div class="process-steps">
  ${steps}
</div>`;
}

/**
 * Render case study box
 */
export function renderCaseStudy(section: CaseStudySection): string {
  const stats = section.stats
    ? `
<div class="stats">
  ${section.stats
    .map(
      (stat) => `
<div class="stat">
  <div class="stat-number">${escapeHtml(stat.value)}</div>
  <div class="stat-label">${escapeHtml(stat.label)}</div>
</div>`
    )
    .join('')}
</div>`
    : '';

  return `
<div class="case-study">
  <h4>${escapeHtml(section.title)}</h4>
  ${stats}
  ${md(section.content)}
</div>`;
}

/**
 * Render product grid
 */
export function renderProductGrid(section: ProductGridSection): string {
  const cards = section.products
    .map(
      (product) => `
<div class="product-card">
  <h4><a href="https://alliancechemical.com/products/${escapeHtml(product.handle)}">${escapeHtml(product.title)}</a></h4>
  <p>${escapeHtml(product.description)}</p>
</div>`
    )
    .join('');

  return `
<div class="product-grid">
  ${cards}
</div>`;
}

/**
 * Render image or image placeholder
 */
export function renderImage(section: ImageSection): string {
  const containerClass = section.wide ? 'ac-img-wide' : 'ac-img-container';
  const caption = section.caption
    ? `<p class="ac-img-caption">${escapeHtml(section.caption)}</p>`
    : '';

  if (section.url) {
    return `
<div class="${containerClass}">
  <img src="${escapeHtml(section.url)}" alt="${escapeHtml(section.alt)}">
  ${caption}
</div>`;
  }

  // Render placeholder if no URL
  return `
<div class="ac-img-placeholder">
  <p>📷 Image suggestion: ${escapeHtml(section.suggestion || section.alt)}</p>
  ${caption}
</div>`;
}

/**
 * Render FAQ section
 */
export function renderFAQ(section: FAQSection): string {
  const heading = section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : '';

  const faqs = section.questions
    .map(
      (faq) => `
<div class="faq-item">
  <div class="faq-question">${escapeHtml(faq.q)}</div>
  <div class="faq-answer">${md(faq.a)}</div>
</div>`
    )
    .join('');

  return `
${heading}
<div class="faq-section">
  ${faqs}
</div>`;
}

/**
 * Render CTA section
 */
export function renderCTA(cta: BlogCTA): string {
  const buttonUrl = cta.buttonUrl ||
    (cta.productHandle ? `https://alliancechemical.com/products/${cta.productHandle}` : '#');

  return `
<div class="cta-section">
  <h3>${escapeHtml(cta.title)}</h3>
  <p>${escapeHtml(cta.text)}</p>
  <a href="${escapeHtml(buttonUrl)}" class="cta-button">${escapeHtml(cta.buttonText)}</a>
</div>`;
}

/**
 * Render a section based on its type
 */
export function renderSection(section: BlogSection): string {
  switch (section.type) {
    case 'text':
      return renderTextSection(section);
    case 'callout':
      return renderCallout(section);
    case 'table':
      return renderTable(section);
    case 'comparison':
      return renderComparison(section);
    case 'process-steps':
      return renderProcessSteps(section);
    case 'case-study':
      return renderCaseStudy(section);
    case 'product-grid':
      return renderProductGrid(section);
    case 'image':
      return renderImage(section);
    case 'faq':
      return renderFAQ(section);
    default:
      console.warn('Unknown section type:', (section as BlogSection).type);
      return '';
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
