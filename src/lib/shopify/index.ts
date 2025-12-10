/**
 * Shopify Blog Writer
 *
 * Complete system for generating Shopify-native blog articles
 * that work with the main-article.liquid template.
 *
 * @module shopify
 */

// Content types and interfaces
export * from './content-types';

// Format rules for Shopify template parsing
export * from './format-rules';

// Product and collection matching
export * from './product-matcher';

// Article generation
export {
  generateArticle,
  generateFAQArticle,
  generateHowToArticle,
  generateComparisonArticle,
  generateTechnicalArticle,
  generateSafetyArticle,
  generateEducationalArticle,
  generateArticleSectionBySection,
} from './article-generator';

// Article validation
export {
  validateArticle,
  isArticleValid,
  getValidationSummary,
  autoFixArticle,
} from './article-validator';

// Shopify API client
export {
  // Blog operations
  listBlogs,
  getBlog,
  getBlogByHandle,

  // Article operations
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
  unpublishArticle,

  // High-level functions
  publishGeneratedArticle,
  createDraftArticle,
  scheduleArticle,

  // Output formatting
  formatForCopyPaste,
  formatAsJson,

  // Utilities
  getArticleCount,
  searchArticles,
  articleExists,
  generateUniqueHandle,
  validateShopifyConfig,
  testConnection,
} from './api-client';
