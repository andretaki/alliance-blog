/**
 * Style-Aware Prompt Generator
 *
 * Generates AI prompts that incorporate the deep style analysis
 * to ensure generated content matches Alliance Chemical's authentic voice.
 */

import {
  analyzeStyleWithDOM,
  type StyleProfileData,
} from '../analysis/dom-style-analyzer';
import {
  generateDeepStyleGuidePrompt,
  generateCondensedStylePrompt,
  analyzeDeepStyle,
  type DeepStyleProfile,
} from '../analysis/style-analyzer';
import type { BlogPost, Brief } from '@/lib/schema/canonical';

// Cache the style profile to avoid re-analysis
let cachedStyleProfile: DeepStyleProfile | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get the current style profile (cached)
 */
export async function getStyleProfile(): Promise<DeepStyleProfile> {
  const now = Date.now();

  if (cachedStyleProfile && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedStyleProfile;
  }

  cachedStyleProfile = await analyzeDeepStyle({ limit: 20 });
  cacheTimestamp = now;

  return cachedStyleProfile;
}

/**
 * Clear the cached style profile (useful after importing new posts)
 */
export function clearStyleCache(): void {
  cachedStyleProfile = null;
  cacheTimestamp = 0;
}

/**
 * Generate a style-aware system prompt for draft generation
 */
export async function generateStyleAwareSystemPrompt(
  options: {
    verbose?: boolean; // Use full style guide vs condensed
  } = {}
): Promise<string> {
  const { verbose = false } = options;

  const profile = await getStyleProfile();

  const styleGuide = verbose
    ? generateDeepStyleGuidePrompt(profile)
    : generateCondensedStylePrompt(profile);

  return `
You are writing a blog post for Alliance Chemical, a chemical supplier with over 20 years of experience.
Your output must be a single valid JSON object matching the canonical blog schema exactly.

${styleGuide}

## CRITICAL REQUIREMENTS:

### 1. VOICE & TONE:
- Write as an experienced chemical industry expert
- Use "we" for company perspective, "you" for reader engagement
- Include personal expertise ("In my experience...", "After working with...")
- Be practical and solution-focused
- Always emphasize safety where relevant

### 2. OPENING:
- Start with a compelling hook (story, problem, or scenario)
- Get to the value proposition quickly
- Reference real-world experience early

### 3. STRUCTURE:
- heroAnswer: Direct, practical answer in 2-4 sentences
- sections: Each with substantive content and appropriate subheadings
- Include callouts for warnings, tips, and important information
- Use tables for comparisons and specifications
- Include process steps for procedures

### 4. E-E-A-T REQUIREMENTS:
- experienceEvidence: Add [PLACEHOLDER_...] markers for editors to insert real examples
- Reference the author's credentials naturally
- Include appropriate safety warnings and disclaimers
- Link to authoritative sources (SDS, regulations, standards)

### 5. COMPONENTS TO INCLUDE:
${profile.components.required.map((c) => `- ${c.replace(/_/g, ' ')}`).join('\n')}

### 6. TRUST SIGNALS:
- Reference years of experience
- Include certification/grade information where relevant
- Mention real-world applications and case studies

### 7. CTA:
- Include calls-to-action linking to relevant products
- Use natural placement (mid-content and end)
- Highlight value: fast shipping, documentation, technical support

OUTPUT: A single valid JSON object. No markdown wrapping. No explanatory text.
`.trim();
}

/**
 * Generate a user prompt with style context for a specific topic
 */
export async function generateStyledUserPrompt(
  brief: Brief,
  options: {
    primaryKeyword: string;
    searchIntent: string;
    authorInfo: {
      name: string;
      role: string;
      credentials: string;
    };
    exemplarPosts: BlogPost[];
    targetOpeningHook?: string;
    productLinks?: Array<{ url: string; name: string }>;
  }
): Promise<string> {
  const profile = await getStyleProfile();

  // Select the opening hook type based on content type
  const hookType =
    options.targetOpeningHook ||
    profile.openingHooks.preferredTypes[0] ||
    'story';

  // Find a hook example for this type
  const hookExample = profile.openingHooks.patterns.find(
    (p) => p.type === hookType
  );

  return `
## CONTENT BRIEF

**Title:** ${brief.suggestedTitle}
**Slug:** ${brief.suggestedSlug}
**Primary Keyword:** ${options.primaryKeyword}
**Search Intent:** ${options.searchIntent}

### Hero Answer Draft
${brief.heroAnswerDraft}

## ARTICLE OUTLINE

${brief.outline
  .map(
    (o) => `
### ${o.headingLevel.toUpperCase()}: ${o.headingText}
**Key points:**
${o.keyPoints.map((p) => `- ${p}`).join('\n')}
**Target:** ~${o.estimatedWordCount} words
`
  )
  .join('\n')}

## OPENING HOOK GUIDANCE

Use a **${hookType.replace(/_/g, ' ')}** opening.
${
  hookExample
    ? `
**Example of this style (from "${hookExample.sourcePostTitle}"):**
> ${hookExample.example.substring(0, 250)}...
`
    : ''
}

## KEY QUESTIONS TO ADDRESS

${brief.keyQuestions.map((q) => `- ${q}`).join('\n')}

## INTERNAL LINKS TO INCLUDE

${brief.suggestedInternalLinks
  .map(
    (l) => `
- **URL:** ${l.targetUrl}
- **Anchor text:** "${l.suggestedAnchorText}"
- **Placement:** ${l.placement}
- **Context:** ${l.reason}
`
  )
  .join('\n')}

${
  options.productLinks && options.productLinks.length > 0
    ? `
## PRODUCT LINKS TO FEATURE

${options.productLinks.map((p) => `- [${p.name}](${p.url})`).join('\n')}
`
    : ''
}

## EXTERNAL REFERENCES

${brief.externalReferences
  .map(
    (r) => `
- **Type:** ${r.type}
- **Description:** ${r.description}
- **Purpose:** ${r.reason}
`
  )
  .join('\n')}

## FAQ SUGGESTIONS

${brief.faqSuggestions
  .map(
    (f) => `
**Q:** ${f.question}
**Key points for answer:**
${f.keyPointsForAnswer.map((p) => `- ${p}`).join('\n')}
`
  )
  .join('\n')}

## EXPERIENCE EVIDENCE PROMPTS

Include these as [PLACEHOLDER_...] markers:
${brief.experiencePrompts.map((p) => `- ${p}`).join('\n')}

## AUTHOR INFORMATION

- **Name:** ${options.authorInfo.name}
- **Role:** ${options.authorInfo.role}
- **Credentials:** ${options.authorInfo.credentials}

---

## EXEMPLAR POSTS FOR STYLE REFERENCE

${options.exemplarPosts
  .slice(0, 2)
  .map(
    (p, i) => `
=== EXEMPLAR ${i + 1}: ${p.title} ===

**Opening (first 300 chars):**
${p.heroAnswer.substring(0, 300)}...

**Section Structure:**
${p.sections.map((s) => `- ${s.headingLevel}: ${s.headingText}`).join('\n')}

**Word Count:** ${p.wordCount}
`
  )
  .join('\n')}

---

## VOICE REMINDERS

${profile.voice.characteristics
  .filter((c) => c.frequency === 'always')
  .map((c) => `- **${c.trait}:** ${c.description}`)
  .join('\n')}

## TRANSITION PHRASES TO USE

${profile.voice.transitionPhrases.slice(0, 8).join(' | ')}

---

Generate the complete blog post as a single JSON object matching the canonical schema.
Follow the Alliance Chemical voice and style guidelines precisely.
`.trim();
}

/**
 * Generate a style-aware prompt for revising existing content
 */
export async function generateRevisionPrompt(
  existingPost: BlogPost,
  revisionGoals: string[]
): Promise<string> {
  const profile = await getStyleProfile();

  return `
## CONTENT REVISION REQUEST

You are revising an existing Alliance Chemical blog post. Make surgical improvements while preserving the established voice.

### CURRENT POST

**Title:** ${existingPost.title}
**Current Word Count:** ${existingPost.wordCount}

**Hero Answer:**
${existingPost.heroAnswer}

**Sections:**
${existingPost.sections.map((s) => `- ${s.headingLevel}: ${s.headingText}`).join('\n')}

### REVISION GOALS

${revisionGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

### STYLE GUIDELINES TO MAINTAIN

**Voice Characteristics:**
${profile.voice.characteristics.map((c) => `- ${c.trait}: ${c.description}`).join('\n')}

**Components that should be present:**
${profile.components.required.map((c) => `- ${c.replace(/_/g, ' ')}`).join('\n')}

**Trust signals to include:**
${profile.trustSignals.brandCredentials.slice(0, 3).map((c) => `- ${c}`).join('\n')}

### OUTPUT FORMAT

Return a JSON object with:
- \`updatedFields\`: Object containing only the changed fields
- \`changeLog\`: Array of strings describing each change made
- \`qualityImprovements\`: Array of specific improvements to E-E-A-T signals

Do NOT regenerate the entire post. Only update what's needed to achieve the revision goals.
`.trim();
}

/**
 * Generate component HTML templates based on style analysis
 */
export async function getComponentTemplates(): Promise<
  Record<string, string>
> {
  return {
    callout_success: `
<div class="callout success">
  <h4>✓ [TITLE]</h4>
  <p>[CONTENT]</p>
</div>
    `.trim(),

    callout_warning: `
<div class="callout warning">
  <h4>⚠ [TITLE]</h4>
  <p>[CONTENT]</p>
</div>
    `.trim(),

    callout_danger: `
<div class="callout danger">
  <h4>⚠ [TITLE]</h4>
  <p>[CONTENT]</p>
</div>
    `.trim(),

    callout_info: `
<div class="ac-callout">
  <h4>💡 [TITLE]</h4>
  <p>[CONTENT]</p>
</div>
    `.trim(),

    process_steps: `
<ol class="process-steps">
  <li>
    <h4>[STEP_1_TITLE]</h4>
    <p>[STEP_1_CONTENT]</p>
  </li>
  <li>
    <h4>[STEP_2_TITLE]</h4>
    <p>[STEP_2_CONTENT]</p>
  </li>
  <!-- Additional steps as needed -->
</ol>
    `.trim(),

    comparison_table: `
<table>
  <thead>
    <tr>
      <th>[COLUMN_1]</th>
      <th>[COLUMN_2]</th>
      <th>[COLUMN_3]</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>[ROW_1_COL_1]</td>
      <td>[ROW_1_COL_2]</td>
      <td>[ROW_1_COL_3]</td>
    </tr>
    <!-- Additional rows as needed -->
  </tbody>
</table>
    `.trim(),

    credentials_box: `
<div class="credentials-box">
  <div class="credentials-header">
    <div class="credentials-icon">AC</div>
    <div>
      <h3 style="margin: 0;">About Alliance Chemical</h3>
      <p style="margin: 0; color: var(--muted);">[SUBTITLE]</p>
    </div>
  </div>
  <p>[DESCRIPTION]</p>
</div>
    `.trim(),

    cta_section: `
<div class="cta-section">
  <h2>[CTA_HEADLINE]</h2>
  <p style="font-size: 1.1rem; opacity: 0.95; margin-bottom: 1rem;">[CTA_DESCRIPTION]</p>
  <a class="cta-button" href="[PRODUCT_URL]">[CTA_BUTTON_TEXT]</a>
  <p style="margin-top: 1.5rem; font-size: 0.9rem; opacity: 0.9;">[CTA_SUPPORTING_TEXT]</p>
</div>
    `.trim(),

    image_with_caption: `
<div class="image-container">
  <img src="[IMAGE_URL]" alt="[ALT_TEXT]">
  <p class="image-caption">[CAPTION]</p>
</div>
    `.trim(),

    hero_badges: `
<div class="trust-badges">
  <div class="badge">[BADGE_1]</div>
  <div class="badge">[BADGE_2]</div>
  <div class="badge">[BADGE_3]</div>
  <div class="badge">[BADGE_4]</div>
</div>
    `.trim(),

    case_study: `
<div class="case-study">
  <h4>[CASE_STUDY_TITLE]</h4>
  <p><strong>Scenario:</strong> [SCENARIO]</p>
  <p><strong>Solution:</strong> [SOLUTION]</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-number">[STAT_1_NUMBER]</div>
      <div class="stat-label">[STAT_1_LABEL]</div>
    </div>
    <div class="stat">
      <div class="stat-number">[STAT_2_NUMBER]</div>
      <div class="stat-label">[STAT_2_LABEL]</div>
    </div>
  </div>
  <p><strong>The Lesson:</strong> [LESSON]</p>
</div>
    `.trim(),
  };
}

/**
 * Get suggested opening hook for a topic
 */
export async function suggestOpeningHook(
  topic: string,
  productFocus?: string
): Promise<{
  hookType: string;
  suggestion: string;
  example?: string;
}> {
  const profile = await getStyleProfile();

  // Determine best hook type based on topic
  const topicLower = topic.toLowerCase();
  let hookType = profile.openingHooks.preferredTypes[0] || 'story';

  if (
    topicLower.includes('guide') ||
    topicLower.includes('how to')
  ) {
    hookType = 'problem';
  } else if (
    topicLower.includes('vs') ||
    topicLower.includes('comparison')
  ) {
    hookType = 'question';
  } else if (
    topicLower.includes('safety') ||
    topicLower.includes('danger')
  ) {
    hookType = 'bold_claim';
  }

  const example = profile.openingHooks.patterns.find(
    (p) => p.type === hookType
  );

  const suggestions: Record<string, string> = {
    story:
      'Start with a real customer story or phone call that illustrates the problem this content solves.',
    problem:
      "Open with a specific, costly problem your readers face. Use concrete numbers or consequences.",
    question:
      "Lead with a provocative question that challenges common assumptions in the reader's mind.",
    statistic:
      'Open with a surprising industry statistic or data point that establishes urgency.',
    bold_claim:
      'Start with a strong, confident statement that positions Alliance Chemical as the authority.',
    scenario:
      'Paint a vivid picture of a situation your reader might find themselves in.',
    direct_address:
      "Speak directly to the reader's pain point or goal from the first sentence.",
    definition:
      "Begin by clearly defining the topic, especially if it's technical or commonly misunderstood.",
    quote:
      'Start with a quote from an industry expert or satisfied customer.',
  };

  return {
    hookType,
    suggestion: suggestions[hookType] || suggestions.story,
    example: example?.example,
  };
}
