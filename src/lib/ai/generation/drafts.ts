/**
 * Draft Generation
 *
 * Generate full blog post drafts using AI.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDefaultProvider } from '../providers';
import { DRAFT_GENERATION_SYSTEM_PROMPT } from '../prompts/system';
import { BlogPostSchema } from '@/lib/schema/canonical.zod';
import type {
  BlogPost,
  Brief,
  Section,
  FAQ,
  ArticleJsonLd,
  FaqPageJsonLd,
} from '@/lib/schema/canonical';
import { AI_CONFIG } from '@/lib/config/constants';
import { getOrganizationInfo } from '@/lib/config/env';
import {
  generateStyleAwareSystemPrompt,
  generateStyledUserPrompt,
} from './style-aware-prompts';

/**
 * Input for draft generation
 */
export interface DraftGenerationInput {
  brief: Brief;
  authorInfo: {
    id: string;
    name: string;
    role: string;
    credentials: string;
    profileUrl?: string | null;
  };
  exemplarPosts: BlogPost[];
  primaryKeyword: string;
  searchIntent: string;
  clusterTopicId?: string | null;
  /** Use the deep style analyzer for style-aware generation */
  useStyleAnalysis?: boolean;
  /** Specific opening hook type to use (story, question, problem, etc.) */
  targetOpeningHook?: string;
  /** Product links to feature in the content */
  productLinks?: Array<{ url: string; name: string }>;
}

/**
 * Generate a full blog post draft from a brief
 */
export async function generateDraft(
  input: DraftGenerationInput
): Promise<BlogPost> {
  let systemPrompt: string;
  let userPrompt: string;

  if (input.useStyleAnalysis) {
    // Use style-aware generation with deep analysis
    systemPrompt = await generateStyleAwareSystemPrompt({ verbose: false });
    userPrompt = await generateStyledUserPrompt(input.brief, {
      primaryKeyword: input.primaryKeyword,
      searchIntent: input.searchIntent,
      authorInfo: {
        name: input.authorInfo.name,
        role: input.authorInfo.role,
        credentials: input.authorInfo.credentials,
      },
      exemplarPosts: input.exemplarPosts,
      targetOpeningHook: input.targetOpeningHook,
      productLinks: input.productLinks,
    });
  } else {
    // Use the original prompt generation
    systemPrompt = DRAFT_GENERATION_SYSTEM_PROMPT;
    userPrompt = buildDraftPrompt(input);
  }

  // Generate the draft using structured output
  const draft = await getDefaultProvider().generateStructured(userPrompt, BlogPostSchema, {
    systemPrompt,
    temperature: AI_CONFIG.temperature.structured,
    maxTokens: AI_CONFIG.maxTokens.draft,
  });

  // Ensure IDs are set
  draft.id = uuidv4();
  draft.authorId = input.authorInfo.id;
  draft.author = {
    id: input.authorInfo.id,
    name: input.authorInfo.name,
    role: input.authorInfo.role,
    credentials: input.authorInfo.credentials,
    profileUrl: input.authorInfo.profileUrl || null,
    avatarUrl: null,
  };

  // Ensure section and FAQ IDs
  draft.sections = draft.sections.map((s) => ({
    ...s,
    id: s.id || uuidv4(),
  }));
  draft.faq = draft.faq.map((f) => ({
    ...f,
    id: f.id || uuidv4(),
  }));

  // Set metadata
  draft.status = 'draft';
  draft.version = 1;
  draft.aiAssisted = true;
  draft.aiModel = AI_CONFIG.models[AI_CONFIG.defaultProvider];
  draft.createdAt = new Date().toISOString();
  draft.updatedAt = new Date().toISOString();
  draft.clusterTopicId = input.clusterTopicId || null;

  // Update JSON-LD with correct org info
  const org = getOrganizationInfo();
  draft.ldJsonArticle = updateArticleJsonLd(draft.ldJsonArticle, draft, org);

  // Generate FAQPage JSON-LD if needed
  if (draft.faq.length >= 2) {
    draft.ldJsonFaqPage = generateFaqPageJsonLd(draft.faq);
  }

  // Calculate word count
  draft.wordCount = calculateWordCount(draft);
  draft.readingTimeMinutes = Math.ceil(draft.wordCount / 200);

  return draft;
}

/**
 * Build the prompt for draft generation
 */
function buildDraftPrompt(input: DraftGenerationInput): string {
  const { brief, authorInfo, exemplarPosts, primaryKeyword, searchIntent } = input;

  return `
## BRIEF

Title: ${brief.suggestedTitle}
Slug: ${brief.suggestedSlug}
Primary Keyword: ${primaryKeyword}
Search Intent: ${searchIntent}

Hero Answer Draft:
${brief.heroAnswerDraft}

## OUTLINE

${brief.outline
  .map(
    (o) => `
### ${o.headingLevel.toUpperCase()}: ${o.headingText}
Key points to cover:
${o.keyPoints.map((p) => `- ${p}`).join('\n')}
Target word count: ~${o.estimatedWordCount} words
`
  )
  .join('\n')}

## KEY QUESTIONS TO ANSWER

${brief.keyQuestions.map((q) => `- ${q}`).join('\n')}

## SUGGESTED INTERNAL LINKS

Include these links naturally in the content:
${brief.suggestedInternalLinks
  .map(
    (l) =>
      `- Link to: ${l.targetUrl}
   Anchor text: "${l.suggestedAnchorText}"
   Place in: ${l.placement}
   Reason: ${l.reason}`
  )
  .join('\n\n')}

## EXTERNAL REFERENCES TO MENTION

${brief.externalReferences
  .map(
    (r) =>
      `- Type: ${r.type}
   What: ${r.description}
   Why: ${r.reason}`
  )
  .join('\n\n')}

## FAQ SUGGESTIONS

${brief.faqSuggestions
  .map(
    (f) =>
      `Q: ${f.question}
Points to cover in answer:
${f.keyPointsForAnswer.map((p) => `  - ${p}`).join('\n')}`
  )
  .join('\n\n')}

## EXPERIENCE EVIDENCE

Include these prompts as [PLACEHOLDER_...] markers for editors to fill in:
${brief.experiencePrompts.map((p) => `- ${p}`).join('\n')}

## AUTHOR INFORMATION

Name: ${authorInfo.name}
Role: ${authorInfo.role}
Credentials: ${authorInfo.credentials}

---

## EXEMPLAR POSTS

Use these as style and structure references:

${exemplarPosts
  .map(
    (p, i) => `
=== EXEMPLAR ${i + 1}: ${p.title} ===

Hero Answer:
${p.heroAnswer}

Sections:
${p.sections.map((s) => `- ${s.headingLevel}: ${s.headingText}`).join('\n')}

Primary Keyword: ${p.primaryKeyword}
Word Count: ${p.wordCount}
Search Intent: ${p.searchIntent}
`
  )
  .join('\n')}

---

Generate the complete blog post as a single JSON object matching the canonical schema.
Include ALL required fields. Use [PLACEHOLDER_...] markers where editors need to add
specific real-world examples, data, or credentials.

IMPORTANT:
- The heroAnswer must directly answer the main question in 2-4 sentences
- Each section must have substantial body content (100+ words)
- Meta title should be 50-60 characters
- Meta description should be 130-160 characters
- Include at least 2 FAQs if suggested in the brief
- Experience evidence section must include clear placeholders for real examples
`;
}

/**
 * Update Article JSON-LD with correct data
 */
function updateArticleJsonLd(
  existing: ArticleJsonLd,
  post: BlogPost,
  org: { name: string; logoUrl: string; websiteUrl: string }
): ArticleJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.slice(0, 110),
    description: post.summary,
    image: null,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.profileUrl,
      jobTitle: post.author.role,
      description: post.author.credentials,
    },
    publisher: {
      '@type': 'Organization',
      name: org.name,
      logo: {
        '@type': 'ImageObject',
        url: org.logoUrl,
      },
    },
    datePublished: null,
    dateModified: null,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.canonicalUrl,
    },
    keywords: [post.primaryKeyword, ...post.secondaryKeywords.slice(0, 5)].join(
      ', '
    ),
  };
}

/**
 * Generate FAQPage JSON-LD
 */
function generateFaqPageJsonLd(faqs: FAQ[]): FaqPageJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Calculate total word count
 */
function calculateWordCount(post: BlogPost): number {
  let count = 0;

  // Hero answer
  count += post.heroAnswer.split(/\s+/).filter(Boolean).length;

  // Sections
  for (const section of post.sections) {
    count += section.wordCount || section.body.split(/\s+/).filter(Boolean).length;
  }

  // FAQs
  for (const faq of post.faq) {
    count += faq.question.split(/\s+/).filter(Boolean).length;
    count += faq.answer.split(/\s+/).filter(Boolean).length;
  }

  return count;
}
