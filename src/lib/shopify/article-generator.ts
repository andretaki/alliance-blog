/**
 * Article Generator
 *
 * Main generation engine for Shopify-native blog articles.
 * Generates HTML content that will parse correctly in the main-article.liquid template.
 */

import { getDefaultProvider } from '@/lib/ai/providers';
import { AI_CONFIG } from '@/lib/config/constants';
import type {
  ContentBrief,
  GeneratedArticle,
  ShopifyFAQ,
  ShopifyHowToStep,
  ShopifyContentType,
  ProductLink,
  GenerationOptions,
} from './content-types';
import {
  formatFAQContent,
  formatHowToSteps,
  formatCallout,
  formatSafetyWarning,
  formatCTASection,
  formatComparisonTable,
  extractHeadings,
  calculateWordCount,
  generateSlug,
  truncateText,
  parseFAQsFromHtml,
  parseStepsFromHtml,
  applyInlineStyles,
} from './format-rules';
import {
  matchTopicToProducts,
  extractChemicalNames,
  generateProductCTA,
} from './product-matcher';
import { getTagsForContentType } from './content-types';

// ============================================================================
// GENERATION SYSTEM PROMPTS
// ============================================================================

const ALLIANCE_CHEMICAL_VOICE = `
You are writing as Alliance Chemical, an industrial chemical supplier with 20+ years of experience.

VOICE CHARACTERISTICS:
- Expert authority: Reference real experience ("In our 20+ years supplying industrial facilities...")
- Practical problem-solver: Focus on actionable, real-world guidance
- Safety-conscious: Always emphasize proper handling and PPE
- Use "we/our" when speaking as the company
- Use "you/your" when addressing the reader directly
- Be specific with concentrations, measurements, and timeframes
- Include trust signals: certifications, industry knowledge, customer success

AVOID:
- Generic filler content
- Overly academic or theoretical language
- Vague claims without specifics
- Content that could be written by anyone (make it uniquely Alliance Chemical)
`;

const SHOPIFY_FORMAT_RULES = `
FORMAT REQUIREMENTS FOR SHOPIFY TEMPLATE:

1. HEADING HIERARCHY:
   - Use H2 for main sections
   - Use H3 for subsections under H2s
   - Never skip levels (no H3 before H2)

2. FAQ FORMAT (use Q:/A: format):
   <p><strong>Q: [Question here]?</strong></p>
   <p>A: [Answer here]</p>

3. HOW-TO STEPS (use "Step N:" in H3):
   <h3>Step 1: [Title]</h3>
   <p>[Instructions]</p>

4. CALLOUTS:
   <div class="callout warning"><h4>⚠️ Warning</h4><p>[text]</p></div>
   <div class="callout danger"><h3>🚨 Critical Safety Warning</h3><p>[text]</p></div>
   <div class="callout info"><h4>💡 Pro Tip</h4><p>[text]</p></div>
   <div class="callout success"><h4>✓ Best Practice</h4><p>[text]</p></div>

5. TABLES: Use standard HTML tables, they're wrapped automatically

6. PRODUCT LINKS: Use full URLs like https://alliancechemical.com/collections/[collection]

7. CTA SECTIONS:
   <div class="cta-section">
   <h2>[Title]</h2>
   <p>[Description]</p>
   <a href="[url]" class="cta-button">[Button Text]</a>
   </div>
`;

// ============================================================================
// MAIN GENERATOR FUNCTIONS
// ============================================================================

/**
 * Generate a complete article from a content brief
 */
export async function generateArticle(
  brief: ContentBrief,
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  // Match relevant products
  const productLinks = brief.relatedProducts || matchTopicToProducts(brief.topic, {
    industryHint: brief.industryFocus?.[0],
    applicationHint: brief.searchIntent,
    maxResults: 5,
  });

  // Generate based on content type
  let article: GeneratedArticle;

  switch (brief.contentType) {
    case 'faq':
      article = await generateFAQArticle(brief, productLinks, options);
      break;
    case 'howto':
      article = await generateHowToArticle(brief, productLinks, options);
      break;
    case 'comparison':
      article = await generateComparisonArticle(brief, productLinks, options);
      break;
    case 'technical':
      article = await generateTechnicalArticle(brief, productLinks, options);
      break;
    case 'safety':
      article = await generateSafetyArticle(brief, productLinks, options);
      break;
    default:
      article = await generateEducationalArticle(brief, productLinks, options);
  }

  return article;
}

/**
 * Generate FAQ-focused article
 */
export async function generateFAQArticle(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const systemPrompt = `${ALLIANCE_CHEMICAL_VOICE}

${SHOPIFY_FORMAT_RULES}

You are generating an FAQ-focused article. The Shopify template will parse this to generate FAQPage schema.

CRITICAL: Use this exact format for FAQs:
<p><strong>Q: [Question]?</strong></p>
<p>A: [Detailed answer with practical information]</p>

Include at least 5-8 FAQs covering:
- Basic "what is" questions
- "How to use" questions
- Safety considerations
- Common problems/troubleshooting
- Comparison questions (vs alternatives)
- Buying considerations`;

  const userPrompt = buildGenerationPrompt(brief, productLinks, 'faq');

  const html = await generateContent(systemPrompt, userPrompt, options);

  return assembleArticle(brief, html, productLinks, 'faq');
}

/**
 * Generate How-To article with step-by-step instructions
 */
export async function generateHowToArticle(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const systemPrompt = `${ALLIANCE_CHEMICAL_VOICE}

${SHOPIFY_FORMAT_RULES}

You are generating a How-To guide. The Shopify template will parse steps to generate HowTo schema.

CRITICAL: Use this exact format for steps:
<h3>Step 1: [Step Title]</h3>
<p>[Detailed instructions for this step]</p>

Structure:
1. Opening with safety considerations and what you'll need
2. Materials/equipment list
3. Step-by-step process (5-10 steps typically)
4. Pro tips callouts between steps where relevant
5. Troubleshooting common issues
6. FAQ section at the end`;

  const userPrompt = buildGenerationPrompt(brief, productLinks, 'howto');

  const html = await generateContent(systemPrompt, userPrompt, options);

  return assembleArticle(brief, html, productLinks, 'howto');
}

/**
 * Generate comparison article
 */
export async function generateComparisonArticle(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const systemPrompt = `${ALLIANCE_CHEMICAL_VOICE}

${SHOPIFY_FORMAT_RULES}

You are generating a comparison article. Help readers choose between options.

Structure:
1. Quick answer: "Use X for [situation], use Y for [situation]"
2. Overview of each option
3. Comparison table with key properties
4. Detailed analysis of when to use each
5. Cost considerations
6. Safety comparison
7. Our recommendation with reasoning
8. FAQ section

Use HTML tables for the comparison:
<table>
<thead><tr><th>Feature</th><th>Option A</th><th>Option B</th></tr></thead>
<tbody><tr><td>...</td><td>...</td><td>...</td></tr></tbody>
</table>`;

  const userPrompt = buildGenerationPrompt(brief, productLinks, 'comparison');

  const html = await generateContent(systemPrompt, userPrompt, options);

  return assembleArticle(brief, html, productLinks, 'comparison');
}

/**
 * Generate technical/specification article
 */
export async function generateTechnicalArticle(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const systemPrompt = `${ALLIANCE_CHEMICAL_VOICE}

${SHOPIFY_FORMAT_RULES}

You are generating a technical article for professionals. Include detailed specifications and data.

Structure:
1. Quick summary for busy readers
2. Chemical properties and specifications
3. Concentration variations and their uses
4. Industry-specific applications with details
5. Storage and handling requirements
6. Compatibility information
7. Regulatory considerations (EPA, OSHA, etc.)
8. Technical FAQ section

Include tables for specifications:
<table>
<thead><tr><th>Property</th><th>Value</th><th>Notes</th></tr></thead>
<tbody>...</tbody>
</table>

Use proper chemical nomenclature and include CAS numbers where relevant.`;

  const userPrompt = buildGenerationPrompt(brief, productLinks, 'technical');

  const html = await generateContent(systemPrompt, userPrompt, options);

  return assembleArticle(brief, html, productLinks, 'technical');
}

/**
 * Generate safety-focused article
 */
export async function generateSafetyArticle(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const systemPrompt = `${ALLIANCE_CHEMICAL_VOICE}

${SHOPIFY_FORMAT_RULES}

You are generating a safety-focused article. This is critical content - be thorough and accurate.

ALWAYS include:
1. Prominent safety warnings at the top
2. Required PPE with specific recommendations
3. Safe handling procedures
4. Storage requirements
5. Emergency procedures (spills, exposure)
6. First aid information
7. Disposal requirements
8. Regulatory compliance notes

Use danger callouts for critical information:
<div class="safety-warning danger">
<h3>🚨 Critical Safety Warning</h3>
<p>[Critical safety information]</p>
</div>

Use warning callouts for important information:
<div class="callout warning">
<h4>⚠️ Warning</h4>
<p>[Important safety note]</p>
</div>`;

  const userPrompt = buildGenerationPrompt(brief, productLinks, 'safety');

  const html = await generateContent(systemPrompt, userPrompt, options);

  return assembleArticle(brief, html, productLinks, 'safety');
}

/**
 * Generate educational/informational article
 */
export async function generateEducationalArticle(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const systemPrompt = `${ALLIANCE_CHEMICAL_VOICE}

${SHOPIFY_FORMAT_RULES}

You are generating an educational article that establishes Alliance Chemical as an authority.

Structure:
1. Engaging opening hook (story, problem, or striking fact)
2. Hero answer (2-3 sentences directly answering the main question)
3. Comprehensive coverage of the topic
4. Practical applications with real examples
5. Safety considerations (if relevant)
6. Product recommendations where natural
7. FAQ section addressing related questions
8. CTA section

Make it comprehensive enough to be THE definitive resource on this topic.`;

  const userPrompt = buildGenerationPrompt(brief, productLinks, 'educational');

  const html = await generateContent(systemPrompt, userPrompt, options);

  return assembleArticle(brief, html, productLinks, 'educational');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build the generation prompt from brief
 */
function buildGenerationPrompt(
  brief: ContentBrief,
  productLinks: ProductLink[],
  contentType: string
): string {
  const chemicalsInTopic = extractChemicalNames(brief.topic);

  let prompt = `
TOPIC: ${brief.topic}
PRIMARY KEYWORD: ${brief.primaryKeyword}
SECONDARY KEYWORDS: ${brief.secondaryKeywords.join(', ')}
CONTENT TYPE: ${contentType}
TARGET WORD COUNT: ${brief.targetWordCount || 1500} words minimum

${brief.targetAudience ? `TARGET AUDIENCE: ${brief.targetAudience}` : ''}
${brief.industryFocus?.length ? `INDUSTRY FOCUS: ${brief.industryFocus.join(', ')}` : ''}
${brief.searchIntent ? `SEARCH INTENT: ${brief.searchIntent}` : ''}

RELEVANT CHEMICALS: ${chemicalsInTopic.join(', ') || 'General topic'}

ALLIANCE CHEMICAL PRODUCTS TO LINK (use naturally):
${productLinks.map((p) => `- ${p.name}: ${p.url}`).join('\n')}
`;

  if (brief.outline) {
    prompt += `\n\nOUTLINE TO FOLLOW:\n`;
    brief.outline.forEach((section, i) => {
      prompt += `\n${section.headingLevel.toUpperCase()}: ${section.headingText}\n`;
      prompt += `Key points: ${section.keyPoints.join(', ')}\n`;
      if (section.estimatedWordCount) {
        prompt += `Target: ~${section.estimatedWordCount} words\n`;
      }
    });
  }

  if (brief.faqSuggestions?.length) {
    prompt += `\n\nFAQ QUESTIONS TO ANSWER:\n`;
    brief.faqSuggestions.forEach((faq) => {
      prompt += `- ${faq.question}\n`;
    });
  }

  if (brief.howToSteps?.length) {
    prompt += `\n\nSTEPS TO INCLUDE:\n`;
    brief.howToSteps.forEach((step, i) => {
      prompt += `${i + 1}. ${step.title}\n`;
    });
  }

  if (brief.comparisonItems?.length) {
    prompt += `\n\nITEMS TO COMPARE:\n`;
    brief.comparisonItems.forEach((item) => {
      prompt += `- ${item.name} (compare on: ${item.compareOn.join(', ')})\n`;
    });
  }

  if (brief.safetyLevel && brief.safetyLevel !== 'none') {
    prompt += `\n\nSAFETY LEVEL: ${brief.safetyLevel}`;
    if (brief.safetyLevel === 'critical') {
      prompt += ` - Include prominent safety warnings throughout`;
    } else if (brief.safetyLevel === 'high') {
      prompt += ` - Include safety section and warnings`;
    } else {
      prompt += ` - Include basic safety considerations`;
    }
  }

  prompt += `\n\nGenerate the complete HTML article body. Do NOT include <html>, <head>, or <body> tags - just the article content starting with the opening paragraph.`;

  return prompt;
}

/**
 * Generate content using AI
 */
async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  options: GenerationOptions
): Promise<string> {
  const temperature = options.temperature ?? AI_CONFIG.temperature.structured;

  // Using the OpenAI provider from existing infrastructure
  const response = await getDefaultProvider().generateText(userPrompt, {
    systemPrompt,
    temperature,
    maxTokens: AI_CONFIG.maxTokens.draft,
  });

  return response.trim();
}

/**
 * Assemble the final article from generated HTML
 */
function assembleArticle(
  brief: ContentBrief,
  html: string,
  productLinks: ProductLink[],
  contentType: ShopifyContentType
): GeneratedArticle {
  // Apply inline styles to convert class-based callouts/CTAs to inline styles
  // This ensures articles render correctly in Shopify without needing custom CSS
  const styledHtml = applyInlineStyles(html);

  // Parse out FAQs and steps for validation
  const parsedFaqs = parseFAQsFromHtml(styledHtml);
  const parsedSteps = parseStepsFromHtml(styledHtml);

  // Extract headings
  const headings = extractHeadings(styledHtml);

  // Calculate word count
  const wordCount = calculateWordCount(styledHtml);

  // Generate slug
  const slug = brief.primaryKeyword
    ? generateSlug(brief.primaryKeyword)
    : generateSlug(brief.topic);

  // Generate excerpt (155 chars max, keyword-rich)
  const excerpt = generateExcerpt(brief, wordCount);

  // Generate tags
  const tags = generateTags(brief, contentType);

  // Generate title
  const title = generateTitle(brief, contentType);

  // Generate schema preview
  const schemaPreview = generateSchemaPreview(contentType, {
    title,
    faqs: parsedFaqs,
    steps: parsedSteps,
    wordCount,
  });

  return {
    title,
    slug,
    body: styledHtml,
    excerpt,
    tags,
    parsedFaqs,
    parsedSteps,
    contentType,
    wordCount,
    headings,
    productLinks,
    schemaPreview,
    generatedAt: new Date().toISOString(),
    aiModel: AI_CONFIG.models[AI_CONFIG.defaultProvider],
    briefUsed: brief,
  };
}

/**
 * Generate SEO-optimized excerpt
 */
function generateExcerpt(brief: ContentBrief, wordCount: number): string {
  const keyword = brief.primaryKeyword;
  const topic = brief.topic;

  // Try to include the keyword near the beginning
  let excerpt = '';

  if (brief.contentType === 'howto') {
    excerpt = `Learn ${topic.toLowerCase()}. Expert guide with step-by-step instructions, safety tips, and pro techniques from Alliance Chemical.`;
  } else if (brief.contentType === 'faq') {
    excerpt = `Get answers about ${keyword}. Common questions, expert advice, and practical tips from our 20+ years of industry experience.`;
  } else if (brief.contentType === 'comparison') {
    excerpt = `${topic}. Expert comparison guide with pros, cons, and recommendations to help you choose the right option.`;
  } else if (brief.contentType === 'safety') {
    excerpt = `Essential ${keyword} safety guide. PPE requirements, handling procedures, and emergency protocols from industry experts.`;
  } else if (brief.contentType === 'technical') {
    excerpt = `Technical guide to ${keyword}. Specifications, concentrations, applications, and expert insights for professionals.`;
  } else {
    excerpt = `Complete guide to ${keyword}. Expert insights, practical applications, and industry knowledge from Alliance Chemical.`;
  }

  // Ensure it's 155 chars or less
  return truncateText(excerpt, 155);
}

/**
 * Generate appropriate tags for content type
 */
function generateTags(brief: ContentBrief, contentType: ShopifyContentType): string[] {
  const tags: Set<string> = new Set();

  // Add content type tags
  const contentTypeTags = getTagsForContentType(contentType);
  contentTypeTags.forEach((tag) => tags.add(tag));

  // Add primary keyword as tag
  tags.add(brief.primaryKeyword.toLowerCase());

  // Add chemical names found in topic
  const chemicals = extractChemicalNames(brief.topic);
  chemicals.forEach((chem) => tags.add(chem.toLowerCase()));

  // Add industry tags if specified
  brief.industryFocus?.forEach((industry) => tags.add(industry.toLowerCase()));

  // Add safety tag if safety-focused
  if (brief.safetyLevel === 'high' || brief.safetyLevel === 'critical') {
    tags.add('safety');
  }

  // Add secondary keyword tags (first 3)
  brief.secondaryKeywords.slice(0, 3).forEach((kw) => tags.add(kw.toLowerCase()));

  return Array.from(tags);
}

/**
 * Generate article title
 */
function generateTitle(brief: ContentBrief, contentType: ShopifyContentType): string {
  // If outline has a title, use it
  if (brief.outline?.[0]?.headingText && brief.outline[0].headingText.length > 20) {
    return brief.outline[0].headingText;
  }

  // Generate based on content type and topic
  const topic = brief.topic;
  const keyword = brief.primaryKeyword;

  switch (contentType) {
    case 'howto':
      if (topic.toLowerCase().startsWith('how to')) {
        return topic;
      }
      return `How to ${topic}: A Complete Guide`;

    case 'faq':
      return `${keyword}: Frequently Asked Questions & Expert Answers`;

    case 'comparison':
      return topic.includes('vs') ? topic : `${topic}: Complete Comparison Guide`;

    case 'safety':
      return `${keyword} Safety Guide: Handling, Storage & Emergency Procedures`;

    case 'technical':
      return `${keyword}: Technical Specifications & Professional Guide`;

    default:
      return `${topic}: The Complete Guide`;
  }
}

/**
 * Generate schema preview for validation
 */
function generateSchemaPreview(
  contentType: ShopifyContentType,
  data: {
    title: string;
    faqs: ShopifyFAQ[];
    steps: ShopifyHowToStep[];
    wordCount: number;
  }
): { type: string; data: Record<string, unknown> } {
  const baseSchema = {
    type: 'Article',
    data: {
      headline: data.title,
      wordCount: data.wordCount,
    },
  };

  switch (contentType) {
    case 'faq':
      return {
        type: 'FAQPage',
        data: {
          ...baseSchema.data,
          mainEntity: data.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        },
      };

    case 'howto':
      return {
        type: 'HowTo',
        data: {
          ...baseSchema.data,
          step: data.steps.map((step) => ({
            '@type': 'HowToStep',
            position: step.stepNumber,
            name: step.title,
            text: step.instructions,
          })),
        },
      };

    default:
      return baseSchema;
  }
}

// ============================================================================
// SECTION-BY-SECTION GENERATION
// ============================================================================

/**
 * Generate article section by section for more control
 */
export async function generateArticleSectionBySection(
  brief: ContentBrief,
  options: GenerationOptions = {}
): Promise<GeneratedArticle> {
  const productLinks = brief.relatedProducts || matchTopicToProducts(brief.topic, {
    maxResults: 5,
  });

  const sections: string[] = [];

  // 1. Generate opening hook
  const opening = await generateOpeningHook(brief, options);
  sections.push(opening);

  // 2. Generate hero answer
  const heroAnswer = await generateHeroAnswer(brief);
  sections.push(heroAnswer);

  // 3. Generate main content sections
  if (brief.outline) {
    for (const outlineSection of brief.outline) {
      const section = await generateSection(brief, outlineSection, productLinks, options);
      sections.push(section);
    }
  } else {
    // Generate default structure based on content type
    const mainContent = await generateMainContent(brief, productLinks, options);
    sections.push(mainContent);
  }

  // 4. Generate FAQ section if applicable
  if (brief.faqSuggestions?.length || brief.contentType === 'faq') {
    const faqSection = await generateFAQSection(brief, options);
    sections.push(faqSection);
  }

  // 5. Generate CTA section
  const cta = generateProductCTA(productLinks, 'section');
  sections.push(cta);

  // Assemble final HTML
  const html = sections.join('\n\n');

  return assembleArticle(brief, html, productLinks, brief.contentType);
}

/**
 * Generate opening hook
 */
async function generateOpeningHook(
  brief: ContentBrief,
  options: GenerationOptions
): Promise<string> {
  const hookType = options.openingHookType || 'problem';

  const prompt = `Generate a compelling opening hook for an article about "${brief.topic}".

Hook type: ${hookType}
${hookType === 'story' ? 'Start with a real customer story or industry situation' : ''}
${hookType === 'problem' ? 'Start with the pain point that drives people to search this' : ''}
${hookType === 'statistic' ? 'Start with a compelling data point or statistic' : ''}
${hookType === 'question' ? 'Start with a provocative question that challenges assumptions' : ''}

Write 2-3 sentences that hook the reader and establish Alliance Chemical's expertise.
Output just the HTML paragraphs, no headings.`;

  return await generateContent(ALLIANCE_CHEMICAL_VOICE, prompt, options);
}

/**
 * Generate hero answer (featured snippet target)
 */
async function generateHeroAnswer(brief: ContentBrief): Promise<string> {
  const prompt = `Generate a hero answer for: "${brief.topic}"

This should:
- Directly answer the main question in 2-3 sentences
- Be suitable for a Google featured snippet
- Include the primary keyword "${brief.primaryKeyword}" naturally
- Be factual and authoritative

Output a single <p> tag with the answer, wrapped in <strong> tags.`;

  return await generateContent(ALLIANCE_CHEMICAL_VOICE, prompt, {});
}

/**
 * Generate a single section from outline
 */
async function generateSection(
  brief: ContentBrief,
  outlineSection: NonNullable<ContentBrief['outline']>[number],
  productLinks: ProductLink[],
  options: GenerationOptions
): Promise<string> {
  const relevantProduct = productLinks.find((p) =>
    outlineSection.keyPoints.some((kp) =>
      kp.toLowerCase().includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(outlineSection.headingText.toLowerCase().split(' ')[0])
    )
  );

  const prompt = `Generate the section "${outlineSection.headingText}" for an article about "${brief.topic}".

Key points to cover:
${outlineSection.keyPoints.map((kp) => `- ${kp}`).join('\n')}

${outlineSection.estimatedWordCount ? `Target word count: ~${outlineSection.estimatedWordCount} words` : ''}
${outlineSection.includeTable ? 'Include a comparison or data table' : ''}
${outlineSection.includeCallout ? `Include a ${outlineSection.includeCallout} callout` : ''}
${relevantProduct ? `Link to ${relevantProduct.name} (${relevantProduct.url}) where natural` : ''}

Start with <${outlineSection.headingLevel}>${outlineSection.headingText}</${outlineSection.headingLevel}>`;

  return await generateContent(ALLIANCE_CHEMICAL_VOICE + SHOPIFY_FORMAT_RULES, prompt, options);
}

/**
 * Generate main content when no outline provided
 */
async function generateMainContent(
  brief: ContentBrief,
  productLinks: ProductLink[],
  options: GenerationOptions
): Promise<string> {
  const prompt = buildGenerationPrompt(brief, productLinks, brief.contentType);
  return await generateContent(
    ALLIANCE_CHEMICAL_VOICE + SHOPIFY_FORMAT_RULES,
    prompt,
    options
  );
}

/**
 * Generate FAQ section
 */
async function generateFAQSection(
  brief: ContentBrief,
  options: GenerationOptions
): Promise<string> {
  const questions = brief.faqSuggestions?.map((f) => f.question) || [];

  const prompt = `Generate an FAQ section for "${brief.topic}".

${questions.length > 0 ? `Include these questions:\n${questions.map((q) => `- ${q}`).join('\n')}` : 'Generate 5-6 relevant FAQs'}

CRITICAL FORMAT - Use this exact structure:
<h2>Frequently Asked Questions</h2>

<p><strong>Q: [Question]?</strong></p>
<p>A: [Detailed answer]</p>

<p><strong>Q: [Question]?</strong></p>
<p>A: [Detailed answer]</p>

(Continue for all FAQs)`;

  return await generateContent(ALLIANCE_CHEMICAL_VOICE, prompt, options);
}
