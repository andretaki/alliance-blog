/**
 * Outline Module
 *
 * Content outline generation and management.
 */

// Types
export {
  type ContentOutline,
  type OutlineMeta,
  type OpeningHook,
  type HeroAnswer,
  type OutlineSection,
  type FAQOutlineItem,
  type FAQSection,
  type CTASection,
  type SectionComponent,
  type OutlineContext,
  type OutlineFile,
  type BlogPostReference,
  type OutlineGenerationOptions,
  type OutlineValidation,
  isContentOutline,
  isOutlineFile,
} from './outline-types';

// Generator
export {
  generateOutline,
  generateSectionOutline,
  suggestFAQs,
  mapInternalLinks,
  validateOutline,
  outlineToContentBrief,
  formatOutline,
} from './outline-generator';
