/**
 * Content Validator
 *
 * Post-generation quality gate that checks content requirements.
 * Returns structured validation results with auto-repair suggestions.
 */

import * as cheerio from 'cheerio';
import type { BlogPost, Section, FAQ, ExperienceEvidence } from '@/lib/schema/canonical';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  severity: ValidationSeverity;
  message: string;
  suggestedFix?: string;
  currentValue?: string | number;
  expectedValue?: string | number;
}

export interface ContentMetrics {
  wordCount: number;
  sectionCount: number;
  avgWordsPerSection: number;
  minSectionWords: number;
  maxSectionWords: number;
  faqCount: number;
  internalLinkCount: number;
  ctaCount: number;
  hasHeroAnswer: boolean;
  heroAnswerSentences: number;
  hasExperienceEvidence: boolean;
  placeholderCount: number;
  calloutCount: number;
  safetyCalloutCount: number;
}

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  metrics: ContentMetrics;
  repairSuggestions: RepairSuggestion[];
}

export interface RepairSuggestion {
  field: string;
  action: 'extend' | 'add' | 'fix' | 'remove';
  prompt: string;
}

export interface ValidationConfig {
  /** Minimum words per section */
  minSectionWords?: number;
  /** Minimum total word count */
  minTotalWords?: number;
  /** Minimum number of FAQs */
  minFaqs?: number;
  /** Require safety callouts for hazardous topics */
  requireSafetyCallouts?: boolean;
  /** Topic keywords that indicate hazardous content */
  hazardousKeywords?: string[];
  /** Require CTA at end of content */
  requireEndCta?: boolean;
  /** Require internal links */
  minInternalLinks?: number;
  /** Hero answer sentence count range */
  heroAnswerSentences?: { min: number; max: number };
}

const DEFAULT_CONFIG: Required<ValidationConfig> = {
  minSectionWords: 120,
  minTotalWords: 1000,
  minFaqs: 2,
  requireSafetyCallouts: true,
  hazardousKeywords: [
    'acid', 'chemical', 'toxic', 'hazardous', 'corrosive', 'flammable',
    'caustic', 'dangerous', 'safety', 'ppe', 'protective', 'burn',
    'irritant', 'poison', 'reactive', 'oxidizer',
  ],
  requireEndCta: true,
  minInternalLinks: 2,
  heroAnswerSentences: { min: 2, max: 4 },
};

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate a generated blog post against quality requirements
 */
export function validateContent(
  post: Partial<BlogPost>,
  config: ValidationConfig = {}
): ValidationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const issues: ValidationIssue[] = [];
  const repairSuggestions: RepairSuggestion[] = [];

  // Calculate metrics
  const metrics = calculateMetrics(post);

  // Run all validations
  validateWordCount(post, cfg, metrics, issues, repairSuggestions);
  validateSections(post, cfg, metrics, issues, repairSuggestions);
  validateHeroAnswer(post, cfg, metrics, issues, repairSuggestions);
  validateFaqs(post, cfg, metrics, issues, repairSuggestions);
  validateInternalLinks(post, cfg, metrics, issues, repairSuggestions);
  validateCta(post, cfg, metrics, issues, repairSuggestions);
  validateSafetyContent(post, cfg, metrics, issues, repairSuggestions);
  validateExperienceEvidence(post, cfg, metrics, issues, repairSuggestions);
  validatePlaceholders(post, cfg, metrics, issues, repairSuggestions);

  // Calculate score
  const score = calculateScore(issues, metrics, cfg);
  const valid = score >= 70 && !issues.some(i => i.severity === 'error');

  return {
    valid,
    score,
    issues,
    metrics,
    repairSuggestions,
  };
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

function calculateMetrics(post: Partial<BlogPost>): ContentMetrics {
  const sections = (post.sections || []) as Section[];
  const faqs = (post.faq || []) as FAQ[];

  // Word counts
  const sectionWordCounts = sections.map(s => countWords(stripHtml(s.body)));
  const totalSectionWords = sectionWordCounts.reduce((sum, w) => sum + w, 0);
  const heroAnswerWords = post.heroAnswer ? countWords(post.heroAnswer) : 0;

  // Internal links
  const internalLinks = post.internalLinks || [];

  // CTA detection
  const ctaCount = countCtas(sections);

  // Safety callouts
  const { calloutCount, safetyCalloutCount } = countCallouts(sections);

  // Hero answer sentences
  const heroSentences = post.heroAnswer
    ? post.heroAnswer.split(/[.!?]+/).filter(s => s.trim().length > 10).length
    : 0;

  // Experience evidence
  const evidence = post.experienceEvidence as ExperienceEvidence | undefined;
  const hasEvidence = !!(evidence?.summary && evidence.summary.length > 20);
  const placeholderCount = evidence?.placeholders?.length || 0;

  return {
    wordCount: post.wordCount || totalSectionWords + heroAnswerWords,
    sectionCount: sections.length,
    avgWordsPerSection: sections.length > 0 ? totalSectionWords / sections.length : 0,
    minSectionWords: sectionWordCounts.length > 0 ? Math.min(...sectionWordCounts) : 0,
    maxSectionWords: sectionWordCounts.length > 0 ? Math.max(...sectionWordCounts) : 0,
    faqCount: faqs.length,
    internalLinkCount: internalLinks.length,
    ctaCount,
    hasHeroAnswer: !!post.heroAnswer && post.heroAnswer.length > 50,
    heroAnswerSentences: heroSentences,
    hasExperienceEvidence: hasEvidence,
    placeholderCount,
    calloutCount,
    safetyCalloutCount,
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateWordCount(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (metrics.wordCount < cfg.minTotalWords) {
    issues.push({
      field: 'wordCount',
      severity: 'error',
      message: `Total word count (${metrics.wordCount}) is below minimum (${cfg.minTotalWords})`,
      currentValue: metrics.wordCount,
      expectedValue: cfg.minTotalWords,
    });

    repairs.push({
      field: 'sections',
      action: 'extend',
      prompt: `Expand the content to reach at least ${cfg.minTotalWords} words. Current count: ${metrics.wordCount}. Add more detail, examples, or additional subsections.`,
    });
  }
}

function validateSections(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  const sections = (post.sections || []) as Section[];

  if (sections.length === 0) {
    issues.push({
      field: 'sections',
      severity: 'error',
      message: 'No sections found in content',
    });
    return;
  }

  // Check each section's word count
  sections.forEach((section, index) => {
    const wordCount = countWords(stripHtml(section.body));

    if (wordCount < cfg.minSectionWords) {
      issues.push({
        field: `sections[${index}]`,
        severity: 'warning',
        message: `Section "${section.headingText}" has only ${wordCount} words (minimum: ${cfg.minSectionWords})`,
        currentValue: wordCount,
        expectedValue: cfg.minSectionWords,
      });

      repairs.push({
        field: `sections[${index}]`,
        action: 'extend',
        prompt: `Expand the section "${section.headingText}" to at least ${cfg.minSectionWords} words. Current: ${wordCount} words. Add more detail, practical examples, or step-by-step guidance.`,
      });
    }
  });
}

function validateHeroAnswer(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (!metrics.hasHeroAnswer) {
    issues.push({
      field: 'heroAnswer',
      severity: 'error',
      message: 'Missing or too short hero answer (featured snippet)',
    });

    repairs.push({
      field: 'heroAnswer',
      action: 'add',
      prompt: `Write a 2-4 sentence hero answer that directly answers the main question. This will be used for featured snippets. Be concise and authoritative.`,
    });
    return;
  }

  const { min, max } = cfg.heroAnswerSentences;
  if (metrics.heroAnswerSentences < min || metrics.heroAnswerSentences > max) {
    issues.push({
      field: 'heroAnswer',
      severity: 'warning',
      message: `Hero answer has ${metrics.heroAnswerSentences} sentences (expected ${min}-${max})`,
      currentValue: metrics.heroAnswerSentences,
      expectedValue: `${min}-${max}`,
    });

    if (metrics.heroAnswerSentences < min) {
      repairs.push({
        field: 'heroAnswer',
        action: 'extend',
        prompt: `Expand the hero answer to ${min}-${max} sentences. Current: ${metrics.heroAnswerSentences} sentences.`,
      });
    } else {
      repairs.push({
        field: 'heroAnswer',
        action: 'fix',
        prompt: `Condense the hero answer to ${min}-${max} sentences. Current: ${metrics.heroAnswerSentences} sentences. Keep the most essential information.`,
      });
    }
  }
}

function validateFaqs(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (metrics.faqCount < cfg.minFaqs) {
    issues.push({
      field: 'faqs',
      severity: 'warning',
      message: `Only ${metrics.faqCount} FAQs (recommended: at least ${cfg.minFaqs})`,
      currentValue: metrics.faqCount,
      expectedValue: cfg.minFaqs,
    });

    repairs.push({
      field: 'faqs',
      action: 'add',
      prompt: `Add ${cfg.minFaqs - metrics.faqCount} more FAQ items. Focus on common questions users ask about this topic. Each answer should be 2-4 sentences.`,
    });
  }

  // Validate FAQ answer quality
  const faqs = (post.faq || []) as FAQ[];
  faqs.forEach((faq, index) => {
    const answerWords = countWords(faq.answer);
    if (answerWords < 20) {
      issues.push({
        field: `faqs[${index}]`,
        severity: 'info',
        message: `FAQ answer "${faq.question.substring(0, 30)}..." is very short (${answerWords} words)`,
      });
    }
  });
}

function validateInternalLinks(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (metrics.internalLinkCount < cfg.minInternalLinks) {
    issues.push({
      field: 'internalLinks',
      severity: 'warning',
      message: `Only ${metrics.internalLinkCount} internal links (recommended: at least ${cfg.minInternalLinks})`,
      currentValue: metrics.internalLinkCount,
      expectedValue: cfg.minInternalLinks,
    });

    repairs.push({
      field: 'internalLinks',
      action: 'add',
      prompt: `Add ${cfg.minInternalLinks - metrics.internalLinkCount} more internal links to related products or articles. Place them naturally within the content.`,
    });
  }
}

function validateCta(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (cfg.requireEndCta && metrics.ctaCount === 0) {
    issues.push({
      field: 'sections',
      severity: 'warning',
      message: 'No CTA (call-to-action) found in content',
    });

    repairs.push({
      field: 'sections',
      action: 'add',
      prompt: `Add a call-to-action section at the end of the content. Include a compelling reason to take action and a clear next step (e.g., "Shop Now", "Contact Us", "Learn More").`,
    });
  }
}

function validateSafetyContent(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (!cfg.requireSafetyCallouts) return;

  // Check if topic involves hazardous content
  const title = (post.title || '').toLowerCase();
  const keyword = post.primaryKeyword?.toLowerCase() || '';
  const content = ((post.sections as Section[]) || [])
    .map(s => s.body)
    .join(' ')
    .toLowerCase();

  const isHazardousTopic = cfg.hazardousKeywords.some(kw =>
    title.includes(kw) || keyword.includes(kw) || content.includes(kw)
  );

  if (isHazardousTopic && metrics.safetyCalloutCount === 0) {
    issues.push({
      field: 'sections',
      severity: 'error',
      message: 'Content involves hazardous materials but has no safety callouts',
    });

    repairs.push({
      field: 'sections',
      action: 'add',
      prompt: `Add safety warning callouts to the content. Include PPE requirements, handling precautions, and storage guidelines. Use warning or danger callout styles for visibility.`,
    });
  }
}

function validateExperienceEvidence(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (!metrics.hasExperienceEvidence) {
    issues.push({
      field: 'experienceEvidence',
      severity: 'warning',
      message: 'Missing experience evidence for E-E-A-T compliance',
    });

    repairs.push({
      field: 'experienceEvidence',
      action: 'add',
      prompt: `Add experience evidence showing first-hand expertise. Include specific details about hands-on experience with the topic, real-world applications, or customer success stories.`,
    });
  }
}

function validatePlaceholders(
  post: Partial<BlogPost>,
  cfg: Required<ValidationConfig>,
  metrics: ContentMetrics,
  issues: ValidationIssue[],
  repairs: RepairSuggestion[]
): void {
  if (metrics.placeholderCount === 0 && metrics.hasExperienceEvidence) {
    issues.push({
      field: 'experienceEvidence.placeholders',
      severity: 'info',
      message: 'No placeholders for human review in experience evidence',
      suggestedFix: 'Consider adding placeholders for specific details that need human verification',
    });
  }

  // Check for unfilled placeholders in content
  const sections = (post.sections || []) as Section[];
  const contentWithPlaceholders = sections.filter(s =>
    /\[.*?\]|\{.*?\}|TODO|PLACEHOLDER|TBD/i.test(s.body)
  );

  if (contentWithPlaceholders.length > 0) {
    issues.push({
      field: 'sections',
      severity: 'warning',
      message: `${contentWithPlaceholders.length} section(s) contain unfilled placeholders`,
      suggestedFix: 'Review and fill in all placeholder content before publishing',
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  return $.text();
}

function countCtas(sections: Section[]): number {
  let count = 0;

  for (const section of sections) {
    const html = section.body.toLowerCase();
    // Check for CTA patterns
    if (
      html.includes('shop now') ||
      html.includes('buy now') ||
      html.includes('contact us') ||
      html.includes('get started') ||
      html.includes('learn more') ||
      html.includes('request a quote') ||
      html.includes('class="cta') ||
      html.includes('class="button') ||
      html.includes('call-to-action')
    ) {
      count++;
    }
  }

  return count;
}

function countCallouts(sections: Section[]): { calloutCount: number; safetyCalloutCount: number } {
  let calloutCount = 0;
  let safetyCalloutCount = 0;

  for (const section of sections) {
    const html = section.body.toLowerCase();

    // Count all callouts
    const calloutMatches = html.match(/class="[^"]*callout[^"]*"/g) || [];
    calloutCount += calloutMatches.length;

    // Count safety-specific callouts
    if (
      html.includes('callout-warning') ||
      html.includes('callout-danger') ||
      html.includes('warning-callout') ||
      html.includes('danger-callout') ||
      html.includes('safety') ||
      (html.includes('callout') && (html.includes('⚠') || html.includes('warning') || html.includes('caution')))
    ) {
      safetyCalloutCount++;
    }
  }

  return { calloutCount, safetyCalloutCount };
}

function calculateScore(
  issues: ValidationIssue[],
  metrics: ContentMetrics,
  cfg: Required<ValidationConfig>
): number {
  let score = 100;

  // Deduct for issues
  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 15;
        break;
      case 'warning':
        score -= 5;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  // Bonus for exceeding minimums
  if (metrics.wordCount >= cfg.minTotalWords * 1.2) score += 5;
  if (metrics.faqCount >= cfg.minFaqs + 2) score += 3;
  if (metrics.internalLinkCount >= cfg.minInternalLinks + 2) score += 3;
  if (metrics.hasExperienceEvidence) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// QUICK VALIDATION CHECK
// ============================================================================

/**
 * Quick check that returns just pass/fail and critical issues
 */
export function quickValidate(post: Partial<BlogPost>): {
  valid: boolean;
  criticalIssues: string[];
} {
  const result = validateContent(post);
  const criticalIssues = result.issues
    .filter(i => i.severity === 'error')
    .map(i => i.message);

  return {
    valid: criticalIssues.length === 0,
    criticalIssues,
  };
}

/**
 * Generate a repair prompt for a specific issue
 */
export function getRepairPrompt(
  post: Partial<BlogPost>,
  issue: ValidationIssue
): string | null {
  const result = validateContent(post);
  const repair = result.repairSuggestions.find(r => r.field === issue.field);
  return repair?.prompt || null;
}
