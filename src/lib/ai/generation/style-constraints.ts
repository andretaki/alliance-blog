/**
 * Style Constraints
 *
 * Compact, data-driven style specification for AI content generation.
 * Replaces verbose prose guides with structured constraints that are
 * easier to validate and enforce.
 */

import type { StyleProfileData, OpeningHookType, ComponentType } from '../analysis/dom-style-analyzer';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Compact style constraints that the generator must obey
 * All fields are concrete values, not descriptions
 */
export interface StyleConstraints {
  /** Preferred opening hook types in order of preference */
  preferredHookTypes: OpeningHookType[];

  /** Components that MUST appear in the post */
  requiredComponents: ComponentType[];

  /** Components that SHOULD appear if relevant */
  recommendedComponents: ComponentType[];

  /** Transition phrases to use between sections */
  transitionPhrases: string[];

  /** Brand credentials to reference for trust */
  brandCredentials: string[];

  /** Technical terms to use appropriately */
  technicalTerms: string[];

  /** Safety phrases for hazardous content */
  safetyPhrases: string[];

  /** Numeric targets for content structure */
  targets: {
    /** Minimum words per section body */
    minSectionWords: number;
    /** Maximum words per section body */
    maxSectionWords: number;
    /** Hero answer sentence count */
    heroAnswerSentences: { min: number; max: number };
    /** FAQ count */
    faqCount: { min: number; max: number };
    /** Total word count */
    totalWords: { min: number; max: number };
    /** Section count */
    sectionCount: { min: number; max: number };
    /** Average sentence length target */
    avgSentenceLength: { min: number; max: number };
  };

  /** Voice/pronoun guidance */
  voice: {
    /** Primary pronoun to use: 'we' for company, 'you' for reader */
    primaryPronoun: 'we' | 'you';
    /** Include first-person experience markers */
    includeExperienceMarkers: boolean;
    /** Sentence starters to prefer */
    preferredStarters: string[];
  };
}

// ============================================================================
// DEFAULT CONSTRAINTS (Alliance Chemical baseline)
// ============================================================================

export const DEFAULT_STYLE_CONSTRAINTS: StyleConstraints = {
  preferredHookTypes: ['story', 'problem', 'question', 'statistic'],

  requiredComponents: [
    'callout_warning',
    'bullet_list',
    'cta_section',
  ],

  recommendedComponents: [
    'callout_info',
    'comparison_table',
    'process_steps',
    'numbered_list',
    'faq_section',
  ],

  transitionPhrases: [
    "Here's what happens:",
    "Here's why:",
    "The bottom line:",
    "In practice,",
    "This means that",
    "The result:",
    "What you need to know:",
    "The fix:",
    "Prevention protocol:",
    "Best practice:",
  ],

  brandCredentials: [
    '20+ years supplying industrial facilities',
    'Central Texas Chemical Supplier',
    'Domestic supply chain',
    'Fast shipping nationwide',
    'Complete documentation and SDS provided',
  ],

  technicalTerms: [
    'concentration',
    'pH',
    'dilution',
    'ppm',
    'viscosity',
    'specific gravity',
  ],

  safetyPhrases: [
    'wear proper PPE',
    'ensure adequate ventilation',
    'follow SDS guidelines',
    'never mix with',
    'store in',
    'dispose according to',
  ],

  targets: {
    minSectionWords: 150,
    maxSectionWords: 500,
    heroAnswerSentences: { min: 2, max: 4 },
    faqCount: { min: 3, max: 6 },
    totalWords: { min: 1500, max: 3500 },
    sectionCount: { min: 4, max: 8 },
    avgSentenceLength: { min: 12, max: 25 },
  },

  voice: {
    primaryPronoun: 'we',
    includeExperienceMarkers: true,
    preferredStarters: [
      'We recommend',
      'Based on our experience',
      'In our facility',
      'Here at Alliance Chemical',
      'When working with',
    ],
  },
};

// ============================================================================
// CONSTRAINT GENERATION FROM STYLE PROFILE
// ============================================================================

/**
 * Generate StyleConstraints from a DOM-analyzed StyleProfileData
 * This creates data-driven constraints based on actual content analysis
 */
export function generateConstraintsFromProfile(
  profile: StyleProfileData
): StyleConstraints {
  return {
    preferredHookTypes: profile.hooks.preferredTypes.slice(0, 4) as OpeningHookType[],

    requiredComponents: profile.components.required.slice(0, 5),

    recommendedComponents: profile.components.common.slice(0, 5),

    transitionPhrases: profile.voice.topTransitions.slice(0, 10),

    brandCredentials: profile.brand.credentials.length > 0
      ? profile.brand.credentials.slice(0, 5)
      : DEFAULT_STYLE_CONSTRAINTS.brandCredentials,

    technicalTerms: profile.brand.technicalTerms.slice(0, 10),

    safetyPhrases: profile.brand.safetyPhrases.slice(0, 8),

    targets: {
      minSectionWords: Math.round(profile.structure.avgWordsPerSection * 0.6),
      maxSectionWords: Math.round(profile.structure.avgWordsPerSection * 1.4),
      heroAnswerSentences: { min: 2, max: 4 },
      faqCount: {
        min: Math.max(3, Math.round(profile.structure.avgFaqsPerPost - 1)),
        max: Math.round(profile.structure.avgFaqsPerPost + 2),
      },
      totalWords: {
        min: Math.round((profile.totalWords / profile.sampleSize) * 0.7),
        max: Math.round((profile.totalWords / profile.sampleSize) * 1.3),
      },
      sectionCount: {
        min: Math.max(3, Math.round(profile.structure.avgSectionsPerPost - 2)),
        max: Math.round(profile.structure.avgSectionsPerPost + 2),
      },
      avgSentenceLength: {
        min: Math.round(profile.structure.avgSentenceLength * 0.7),
        max: Math.round(profile.structure.avgSentenceLength * 1.3),
      },
    },

    voice: {
      primaryPronoun: profile.voice.dominantPronoun === 'you' ? 'you' : 'we',
      includeExperienceMarkers: true,
      preferredStarters: profile.voice.topSentenceStarters.slice(0, 8),
    },
  };
}

// ============================================================================
// CONSTRAINT SERIALIZATION
// ============================================================================

/**
 * Serialize constraints to a compact format for AI prompts
 * This replaces verbose style guides with structured JSON
 */
export function constraintsToPrompt(constraints: StyleConstraints): string {
  return `## STYLE CONSTRAINTS (MUST FOLLOW)

### Opening
Use one of these hook types: ${constraints.preferredHookTypes.join(', ')}

### Required Components
Include ALL of these:
${constraints.requiredComponents.map(c => `- ${c.replace(/_/g, ' ')}`).join('\n')}

### Recommended Components
Include when relevant:
${constraints.recommendedComponents.map(c => `- ${c.replace(/_/g, ' ')}`).join('\n')}

### Transitions
Use these phrases: ${constraints.transitionPhrases.slice(0, 6).join(' | ')}

### Trust Signals
Reference: ${constraints.brandCredentials.slice(0, 3).join(' • ')}

### Targets
- Section words: ${constraints.targets.minSectionWords}-${constraints.targets.maxSectionWords}
- Hero answer: ${constraints.targets.heroAnswerSentences.min}-${constraints.targets.heroAnswerSentences.max} sentences
- FAQs: ${constraints.targets.faqCount.min}-${constraints.targets.faqCount.max}
- Total words: ${constraints.targets.totalWords.min}-${constraints.targets.totalWords.max}
- Sections: ${constraints.targets.sectionCount.min}-${constraints.targets.sectionCount.max}

### Voice
- Primary pronoun: "${constraints.voice.primaryPronoun}"
- Include experience markers: ${constraints.voice.includeExperienceMarkers}
- Sentence starters: ${constraints.voice.preferredStarters.slice(0, 4).join(' | ')}

### Technical Terms
Use appropriately: ${constraints.technicalTerms.slice(0, 6).join(', ')}

### Safety (for hazardous topics)
Include: ${constraints.safetyPhrases.slice(0, 4).join(' | ')}`;
}

/**
 * Get constraints as JSON for structured prompts
 */
export function constraintsToJson(constraints: StyleConstraints): string {
  return JSON.stringify(constraints, null, 2);
}
