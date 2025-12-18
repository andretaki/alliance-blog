/**
 * Blog Renderer - Main function to render blog content to HTML
 */

import { BLOG_CSS } from './blog-css';
import {
  renderSection,
  renderCTA,
  escapeHtml,
  type BlogContent,
} from './section-renderers';

/**
 * Render complete blog HTML from structured content
 */
export function renderBlogHtml(content: BlogContent): string {
  // Render hero section
  const hero = renderHero(content);

  // Render all content sections
  const sections = content.sections.map(renderSection).join('\n');

  // Render CTA if present
  const cta = content.cta ? renderCTA(content.cta) : '';

  // Render footer
  const footer = renderFooter();

  return `<style>${BLOG_CSS}</style>

${hero}

<main class="ac-section">
  ${sections}

  ${cta}

  ${footer}
</main>`;
}

/**
 * Render hero section
 */
function renderHero(content: BlogContent): string {
  const badges = content.hero.badges
    .map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`)
    .join(' ');

  // Use inline style for hero image if provided
  const heroStyle = content.hero.heroImage
    ? ` style="--hero-image: url('${escapeHtml(content.hero.heroImage)}');"`
    : '';

  return `<header class="ac-hero"${heroStyle}>
  <h1>${escapeHtml(content.meta.title)}</h1>
  <p>${escapeHtml(content.hero.subtitle)}</p>
  <div class="trust-badges">
    ${badges}
  </div>
</header>`;
}

/**
 * Render footer section
 */
function renderFooter(): string {
  const year = new Date().getFullYear();

  return `<footer class="ac-footer">
  <p><strong>Disclaimer:</strong> This guide is provided for informational purposes based on our experience as a chemical supplier. Always follow manufacturer specifications, local regulations, and proper safety protocols when handling industrial chemicals. Information provided should not be considered a substitute for professional guidance.</p>
  <p style="margin-top: 1rem;">© ${year} Alliance Chemical. All rights reserved.</p>
</footer>`;
}

/**
 * Render just the body content (without CSS and hero)
 * Useful for embedding in existing pages
 */
export function renderBodyOnly(content: BlogContent): string {
  const sections = content.sections.map(renderSection).join('\n');
  const cta = content.cta ? renderCTA(content.cta) : '';
  const footer = renderFooter();

  return `<div class="ac-section">
  ${sections}
  ${cta}
  ${footer}
</div>`;
}

/**
 * Get just the CSS (for separate stylesheet)
 */
export function getBlogCSS(): string {
  return BLOG_CSS;
}

/**
 * Validate blog content structure
 */
export function validateBlogContent(content: unknown): content is BlogContent {
  if (!content || typeof content !== 'object') return false;

  const c = content as Record<string, unknown>;

  // Check required fields
  if (!c.meta || typeof c.meta !== 'object') return false;
  if (!c.hero || typeof c.hero !== 'object') return false;
  if (!Array.isArray(c.sections)) return false;

  // Check meta
  const meta = c.meta as Record<string, unknown>;
  if (typeof meta.title !== 'string') return false;
  if (typeof meta.metaDescription !== 'string') return false;
  if (typeof meta.primaryKeyword !== 'string') return false;

  // Check hero
  const hero = c.hero as Record<string, unknown>;
  if (typeof hero.subtitle !== 'string') return false;
  if (!Array.isArray(hero.badges)) return false;

  return true;
}

// Re-export types for convenience
export type { BlogContent, BlogSection, BlogMeta, BlogHero, BlogCTA } from './section-renderers';
