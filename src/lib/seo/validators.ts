/**
 * SEO and E-E-A-T Validators
 *
 * Validates blog posts against SEO best practices and E-E-A-T guidelines.
 */

import type {
  BlogPost,
  ValidationResult,
  PostValidationReport,
} from '@/lib/schema/canonical';
import { VALIDATION_THRESHOLDS, YMYL_KEYWORDS } from '@/lib/config/constants';

/**
 * Validate a blog post and generate a comprehensive report
 */
export function validatePost(post: BlogPost): PostValidationReport {
  const results: ValidationResult[] = [];

  // Run all validators
  validateStructure(post, results);
  validateSeo(post, results);
  validateEeat(post, results);
  validateContentQuality(post, results);
  validateJsonLd(post, results);

  // Categorize results
  const errors = results.filter((r) => r.severity === 'error');
  const warnings = results.filter((r) => r.severity === 'warning');
  const info = results.filter((r) => r.severity === 'info');

  // Calculate scores
  const score = calculateScores(post, results);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
    score,
  };
}

// ============================================================================
// STRUCTURE VALIDATION
// ============================================================================

function validateStructure(post: BlogPost, results: ValidationResult[]): void {
  // Title
  if (post.title.length < VALIDATION_THRESHOLDS.title.minLength) {
    results.push({
      field: 'title',
      severity: 'error',
      message: `Title is too short (${post.title.length} chars, min ${VALIDATION_THRESHOLDS.title.minLength})`,
      suggestion: 'Write a more descriptive title that includes your main topic',
    });
  }
  if (post.title.length > VALIDATION_THRESHOLDS.title.maxLength) {
    results.push({
      field: 'title',
      severity: 'warning',
      message: `Title may be too long (${post.title.length} chars)`,
    });
  }

  // Hero answer
  if (post.heroAnswer.length < VALIDATION_THRESHOLDS.heroAnswer.minLength) {
    results.push({
      field: 'heroAnswer',
      severity: 'error',
      message: 'Hero answer is too short - readers need a clear answer upfront',
      suggestion: 'Provide a 2-4 sentence direct answer to the main question',
    });
  }
  if (!containsAnswerSignals(post.heroAnswer)) {
    results.push({
      field: 'heroAnswer',
      severity: 'warning',
      message: 'Hero answer may not directly answer the main question',
      suggestion:
        'Start with a direct statement of the answer, not background info',
    });
  }

  // Sections
  if (post.sections.length < VALIDATION_THRESHOLDS.sections.minCount) {
    results.push({
      field: 'sections',
      severity: 'error',
      message: `Post needs at least ${VALIDATION_THRESHOLDS.sections.minCount} content sections`,
    });
  }

  post.sections.forEach((section, i) => {
    if (section.body.length < VALIDATION_THRESHOLDS.sections.minBodyLength) {
      results.push({
        field: `sections[${i}]`,
        severity: 'warning',
        message: `Section "${section.headingText}" is thin on content (${section.body.length} chars)`,
        suggestion:
          'Add more substantive information or merge with another section',
      });
    }

    if (!isQuestionOrActionOriented(section.headingText)) {
      results.push({
        field: `sections[${i}].headingText`,
        severity: 'info',
        message: `Consider making heading more question-oriented: "${section.headingText}"`,
        suggestion:
          'Question-based headings can improve featured snippet eligibility',
      });
    }
  });
}

// ============================================================================
// SEO VALIDATION
// ============================================================================

function validateSeo(post: BlogPost, results: ValidationResult[]): void {
  // Meta title
  if (post.metaTitle.length < VALIDATION_THRESHOLDS.metaTitle.warnMin) {
    results.push({
      field: 'metaTitle',
      severity: 'warning',
      message: `Meta title is short (${post.metaTitle.length} chars, aim for 50-60)`,
    });
  }
  if (post.metaTitle.length > VALIDATION_THRESHOLDS.metaTitle.warnMax) {
    results.push({
      field: 'metaTitle',
      severity: 'warning',
      message: `Meta title may truncate in search results (${post.metaTitle.length} chars)`,
    });
  }

  // Check if primary keyword is in meta title
  if (
    !post.metaTitle.toLowerCase().includes(post.primaryKeyword.toLowerCase())
  ) {
    results.push({
      field: 'metaTitle',
      severity: 'warning',
      message: 'Primary keyword not found in meta title',
      suggestion: 'Include the primary keyword naturally in the meta title',
    });
  }

  // Meta description
  if (
    post.metaDescription.length < VALIDATION_THRESHOLDS.metaDescription.warnMin
  ) {
    results.push({
      field: 'metaDescription',
      severity: 'warning',
      message: `Meta description is short (${post.metaDescription.length} chars, aim for 130-160)`,
    });
  }
  if (
    post.metaDescription.length > VALIDATION_THRESHOLDS.metaDescription.warnMax
  ) {
    results.push({
      field: 'metaDescription',
      severity: 'warning',
      message: `Meta description may truncate (${post.metaDescription.length} chars)`,
    });
  }

  // Internal links
  if (
    post.internalLinks.length <
    VALIDATION_THRESHOLDS.internalLinks.recommendedMin
  ) {
    results.push({
      field: 'internalLinks',
      severity: 'warning',
      message: `Post has few internal links (${post.internalLinks.length}, recommend ${VALIDATION_THRESHOLDS.internalLinks.recommendedMin}+)`,
      suggestion: 'Add links to related products, categories, or blog posts',
    });
  }
  if (
    post.internalLinks.length >
    VALIDATION_THRESHOLDS.internalLinks.recommendedMax
  ) {
    results.push({
      field: 'internalLinks',
      severity: 'info',
      message: 'Post has many internal links - ensure they are all relevant',
    });
  }

  // FAQ for schema markup
  if (
    post.faq.length >= VALIDATION_THRESHOLDS.faq.minForJsonLd &&
    !post.ldJsonFaqPage
  ) {
    results.push({
      field: 'ldJsonFaqPage',
      severity: 'error',
      message: 'Post has FAQs but missing FAQPage JSON-LD',
      suggestion: 'Generate FAQPage structured data for rich results',
    });
  }

  // Focus questions
  if (post.focusQuestions.length === 0) {
    results.push({
      field: 'focusQuestions',
      severity: 'warning',
      message: 'No focus questions defined',
      suggestion:
        'Add 1-5 questions this post should rank for or be cited for',
    });
  }

  // Canonical URL
  if (!post.canonicalUrl) {
    results.push({
      field: 'canonicalUrl',
      severity: 'error',
      message: 'Missing canonical URL',
    });
  }
}

// ============================================================================
// E-E-A-T VALIDATION
// ============================================================================

function validateEeat(post: BlogPost, results: ValidationResult[]): void {
  // Author
  if (!post.author.name) {
    results.push({
      field: 'author',
      severity: 'error',
      message: 'Post must have an author for E-E-A-T',
    });
  }

  if (
    !post.author.credentials ||
    post.author.credentials.length <
      VALIDATION_THRESHOLDS.authorCredentials.minLength
  ) {
    results.push({
      field: 'author.credentials',
      severity: 'warning',
      message: 'Author credentials are missing or too brief',
      suggestion:
        'Add specific credentials like years of experience, certifications, or role details',
    });
  }

  // Experience evidence
  if (!post.experienceEvidence.summary) {
    results.push({
      field: 'experienceEvidence',
      severity: 'error',
      message: 'Post missing experience evidence - required for E-E-A-T',
      suggestion: 'Add a section showing first-hand experience with the topic',
    });
  }

  if (
    post.experienceEvidence.placeholders &&
    post.experienceEvidence.placeholders.length > 0
  ) {
    results.push({
      field: 'experienceEvidence',
      severity: 'warning',
      message: `Experience section has ${post.experienceEvidence.placeholders.length} unfilled placeholder(s)`,
      suggestion: 'Replace placeholders with real examples before publishing',
    });
  }

  // Reviewer for sensitive topics
  if (isSensitiveTopic(post) && !post.reviewedBy) {
    results.push({
      field: 'reviewedBy',
      severity: 'warning',
      message: 'Consider adding expert reviewer for this topic type',
      suggestion: 'YMYL and safety topics benefit from documented expert review',
    });
  }
}

// ============================================================================
// CONTENT QUALITY VALIDATION
// ============================================================================

function validateContentQuality(
  post: BlogPost,
  results: ValidationResult[]
): void {
  // Word count
  if (post.wordCount < VALIDATION_THRESHOLDS.wordCount.thinContent) {
    results.push({
      field: 'wordCount',
      severity: 'warning',
      message: `Post is thin (${post.wordCount} words)`,
      suggestion:
        'Consider adding more depth or merging with related content',
    });
  }

  // Placeholder check
  const content = JSON.stringify(post);
  const placeholderMatches = content.match(/\[PLACEHOLDER[^\]]*\]/g);
  if (placeholderMatches && placeholderMatches.length > 0) {
    results.push({
      field: 'content',
      severity: 'error',
      message: `Post contains ${placeholderMatches.length} unfilled placeholder(s)`,
      suggestion:
        'Replace all [PLACEHOLDER] markers with real content before publishing',
    });
  }

  // Check for generic/filler content patterns
  const genericPatterns = [
    'in this article',
    'in this post',
    'we will discuss',
    "let's dive in",
    "let's explore",
    'without further ado',
  ];

  const lowerHero = post.heroAnswer.toLowerCase();
  for (const pattern of genericPatterns) {
    if (lowerHero.includes(pattern)) {
      results.push({
        field: 'heroAnswer',
        severity: 'info',
        message: `Hero answer contains filler phrase: "${pattern}"`,
        suggestion:
          'Remove filler phrases and start with the actual answer',
      });
      break;
    }
  }

  // Check summary doesn't start with "This article"
  if (
    post.summary.toLowerCase().startsWith('this article') ||
    post.summary.toLowerCase().startsWith('this post')
  ) {
    results.push({
      field: 'summary',
      severity: 'info',
      message: 'Summary starts with "This article/post..."',
      suggestion:
        'Start with the key information, not a description of the article',
    });
  }
}

// ============================================================================
// JSON-LD VALIDATION
// ============================================================================

function validateJsonLd(post: BlogPost, results: ValidationResult[]): void {
  if (!post.ldJsonArticle) {
    results.push({
      field: 'ldJsonArticle',
      severity: 'error',
      message: 'Missing Article JSON-LD structured data',
    });
    return;
  }

  // Validate Article JSON-LD
  if (!post.ldJsonArticle.headline) {
    results.push({
      field: 'ldJsonArticle.headline',
      severity: 'error',
      message: 'Article JSON-LD missing headline',
    });
  }

  if (!post.ldJsonArticle.author?.name) {
    results.push({
      field: 'ldJsonArticle.author',
      severity: 'error',
      message: 'Article JSON-LD missing author',
    });
  }

  if (post.status === 'published' && !post.ldJsonArticle.datePublished) {
    results.push({
      field: 'ldJsonArticle.datePublished',
      severity: 'warning',
      message: 'Published post missing datePublished in JSON-LD',
    });
  }

  // Validate FAQPage JSON-LD if present
  if (post.ldJsonFaqPage) {
    if (
      !post.ldJsonFaqPage.mainEntity ||
      post.ldJsonFaqPage.mainEntity.length < 2
    ) {
      results.push({
        field: 'ldJsonFaqPage',
        severity: 'warning',
        message: 'FAQPage JSON-LD should have at least 2 questions',
      });
    }
  }
}

// ============================================================================
// SCORE CALCULATION
// ============================================================================

function calculateScores(
  post: BlogPost,
  results: ValidationResult[]
): PostValidationReport['score'] {
  const errors = results.filter((r) => r.severity === 'error');
  const warnings = results.filter((r) => r.severity === 'warning');

  // SEO Score
  let seoScore = 100;
  const seoFields = [
    'metaTitle',
    'metaDescription',
    'primaryKeyword',
    'internalLinks',
    'canonicalUrl',
    'focusQuestions',
  ];
  for (const result of results) {
    if (seoFields.some((f) => result.field.startsWith(f))) {
      seoScore -= result.severity === 'error' ? 15 : 5;
    }
  }
  seoScore = Math.max(0, seoScore);

  // E-E-A-T Score
  let eeatScore = 100;
  const eeatFields = ['author', 'experienceEvidence', 'reviewedBy'];
  for (const result of results) {
    if (eeatFields.some((f) => result.field.startsWith(f))) {
      eeatScore -= result.severity === 'error' ? 20 : 10;
    }
  }
  eeatScore = Math.max(0, eeatScore);

  // Structure Score
  let structureScore = 100;
  const structureFields = ['title', 'heroAnswer', 'sections', 'faq'];
  for (const result of results) {
    if (structureFields.some((f) => result.field.startsWith(f))) {
      structureScore -= result.severity === 'error' ? 15 : 5;
    }
  }
  structureScore = Math.max(0, structureScore);

  // Overall Score
  const overall = Math.round(
    seoScore * 0.3 + eeatScore * 0.4 + structureScore * 0.3
  );

  return {
    seoScore: Math.round(seoScore),
    eeatScore: Math.round(eeatScore),
    structureScore: Math.round(structureScore),
    overall,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function containsAnswerSignals(text: string): boolean {
  const signals = [
    /^(the|a|an) /i,
    /you (should|can|need|must)/i,
    /is (a|the|an)/i,
    /are (typically|usually|generally)/i,
    /^\d+/, // Starts with number
    /^yes/i,
    /^no/i,
  ];
  return signals.some((s) => s.test(text.trim()));
}

function isQuestionOrActionOriented(heading: string): boolean {
  return (
    heading.endsWith('?') ||
    /^(how|what|why|when|where|which|who)/i.test(heading) ||
    /^(understanding|choosing|selecting|comparing|finding)/i.test(heading)
  );
}

function isSensitiveTopic(post: BlogPost): boolean {
  const fullText =
    `${post.title} ${post.primaryKeyword} ${post.heroAnswer}`.toLowerCase();
  return YMYL_KEYWORDS.some((kw) => fullText.includes(kw));
}

/**
 * Quick validation check for publishing readiness
 */
export function isPublishReady(post: BlogPost): {
  ready: boolean;
  blockers: string[];
} {
  const report = validatePost(post);
  const blockers: string[] = [];

  // Check for blocking errors
  for (const error of report.errors) {
    if (error.field === 'content' && error.message.includes('placeholder')) {
      blockers.push('Post contains unfilled placeholders');
    }
    if (error.field === 'author') {
      blockers.push('Post missing author information');
    }
    if (error.field === 'ldJsonArticle') {
      blockers.push('Post missing required structured data');
    }
    if (error.field === 'experienceEvidence') {
      blockers.push('Post missing experience evidence section');
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}
