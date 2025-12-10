/**
 * Deep Style Analyzer
 *
 * Extracts comprehensive writing style patterns from blog posts including:
 * - Opening hook patterns (story, question, statistic, etc.)
 * - Voice and tone characteristics
 * - Component usage patterns (callouts, tables, lists)
 * - Trust and credibility signals
 * - Brand terminology and phrases
 *
 * Used to enable AI to generate content that matches the brand's authentic voice.
 */

import { db } from '@/lib/db/client';
import { blogPosts } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Opening hook type classification
 */
export type OpeningHookType =
  | 'story' // Personal story or anecdote
  | 'question' // Rhetorical or direct question
  | 'statistic' // Data-driven opening
  | 'problem' // Problem statement
  | 'bold_claim' // Strong assertion
  | 'scenario' // Hypothetical situation
  | 'definition' // Defining the topic
  | 'quote' // Quote from expert
  | 'direct_address'; // Speaking directly to reader

/**
 * Component type classification
 */
export type ComponentType =
  | 'callout_success'
  | 'callout_warning'
  | 'callout_danger'
  | 'callout_info'
  | 'process_steps'
  | 'comparison_table'
  | 'data_table'
  | 'credentials_box'
  | 'hero_badges'
  | 'cta_section'
  | 'image_with_caption'
  | 'chemical_formula'
  | 'bullet_list'
  | 'numbered_list'
  | 'faq_section';

/**
 * Extracted opening hook pattern
 */
export interface OpeningHookPattern {
  type: OpeningHookType;
  example: string;
  sourcePostId: string;
  sourcePostTitle: string;
}

/**
 * Component usage pattern with context
 */
export interface ComponentPattern {
  type: ComponentType;
  frequency: number; // How often it appears across posts
  avgPerPost: number;
  examples: Array<{
    html: string;
    context: string; // What section/purpose it serves
    sourcePostId: string;
  }>;
  placementNotes: string[]; // Where in the post it typically appears
}

/**
 * Voice characteristic with examples
 */
export interface VoiceCharacteristic {
  trait: string;
  description: string;
  examples: string[];
  frequency: 'always' | 'often' | 'sometimes' | 'rarely';
}

/**
 * Trust/credibility signal pattern
 */
export interface TrustSignal {
  type: 'expertise_years' | 'certifications' | 'customer_testimonial' | 'expert_reference' | 'industry_statistics' | 'safety_emphasis' | 'quality_claims';
  examples: string[];
  frequency: number;
}

/**
 * Enhanced extracted style profile from analyzed posts
 */
export interface StyleProfile {
  // Tone characteristics
  tone: {
    formality: 'casual' | 'professional' | 'technical' | 'mixed';
    voice: 'first_person' | 'second_person' | 'third_person' | 'mixed';
    personality: string[]; // e.g., ['authoritative', 'helpful', 'educational']
  };

  // Structure patterns
  structure: {
    avgSectionsPerPost: number;
    avgWordsPerSection: number;
    usesBulletPoints: boolean;
    usesNumberedLists: boolean;
    usesTables: boolean;
    usesInfoBoxes: boolean;
    usesCTAs: boolean;
    avgFAQsPerPost: number;
  };

  // Content patterns
  content: {
    includesProductLinks: boolean;
    includesExternalReferences: boolean;
    includesSafetyInfo: boolean;
    includesChemicalFormulas: boolean;
    includesPricing: boolean;
    targetAudience: string[];
  };

  // Writing metrics
  metrics: {
    avgWordCount: number;
    avgSentenceLength: number;
    avgParagraphLength: number;
    readabilityLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };

  // Common phrases and patterns
  patterns: {
    commonOpenings: string[];
    commonTransitions: string[];
    commonCTAs: string[];
    brandTerms: string[];
  };

  // Sample exemplars (post IDs to use as references)
  exemplarIds: string[];
}

/**
 * Deep style profile with rich pattern extraction
 */
export interface DeepStyleProfile extends StyleProfile {
  // Opening hook analysis
  openingHooks: {
    patterns: OpeningHookPattern[];
    preferredTypes: OpeningHookType[];
    avoidTypes: OpeningHookType[];
  };

  // Component usage patterns
  components: {
    patterns: ComponentPattern[];
    typicalFlow: ComponentType[]; // Common ordering of components
    required: ComponentType[]; // Components that appear in 80%+ of posts
    optional: ComponentType[]; // Components that appear in 30-80% of posts
  };

  // Deep voice analysis
  voice: {
    characteristics: VoiceCharacteristic[];
    pronounUsage: {
      we: number; // Frequency count
      you: number;
      they: number;
      i: number;
    };
    sentenceStarters: string[]; // Common ways to start sentences
    transitionPhrases: string[];
    emphasisPatterns: string[]; // How emphasis is added (bold, italics, etc.)
  };

  // Trust and credibility
  trustSignals: {
    patterns: TrustSignal[];
    brandCredentials: string[];
    expertReferences: string[];
    certificationMentions: string[];
  };

  // Technical content patterns
  technicalContent: {
    chemicalFormulas: string[];
    measurementUnits: string[];
    technicalTerms: string[];
    safetyPhrases: string[];
    processDescriptions: string[];
  };

  // CTA patterns
  ctaPatterns: {
    primary: string[]; // Main CTAs
    secondary: string[]; // Supporting CTAs
    placement: ('hero' | 'mid_content' | 'end' | 'sidebar')[];
    urgencyPhrases: string[];
    valuePhrases: string[];
  };

  // SEO patterns
  seoPatterns: {
    titleFormats: string[];
    metaDescriptionFormats: string[];
    headerHierarchy: string; // H1 > H2 > H3 pattern
    keywordPlacement: string[];
  };
}

/**
 * Analyze posts to extract basic style profile
 */
export async function analyzeWritingStyle(
  options: {
    limit?: number;
    status?: 'draft' | 'published' | 'all';
  } = {}
): Promise<StyleProfile> {
  const { limit = 20, status = 'all' } = options;

  // Fetch posts with full content
  let query = db.query.blogPosts.findMany({
    orderBy: [desc(blogPosts.wordCount)], // Prioritize longer, more detailed posts
    limit,
  });

  const posts = await query;

  if (posts.length === 0) {
    throw new Error('No posts found to analyze');
  }

  // Analyze tone
  const tone = analyzeTone(posts);

  // Analyze structure
  const structure = analyzeStructure(posts);

  // Analyze content patterns
  const content = analyzeContentPatterns(posts);

  // Calculate metrics
  const metrics = calculateMetrics(posts);

  // Extract common patterns
  const patterns = extractPatterns(posts);

  // Select best exemplars (diverse, well-structured posts)
  const exemplarIds = selectExemplars(posts, 5);

  return {
    tone,
    structure,
    content,
    metrics,
    patterns,
    exemplarIds,
  };
}

// ============================================================================
// DEEP STYLE ANALYSIS
// ============================================================================

/**
 * Analyze posts to extract a comprehensive deep style profile
 * This captures the nuanced patterns that make Alliance Chemical content distinctive
 */
export async function analyzeDeepStyle(
  options: {
    limit?: number;
    status?: 'draft' | 'published' | 'all';
  } = {}
): Promise<DeepStyleProfile> {
  const { limit = 20, status = 'all' } = options;

  // Fetch posts with full content
  const posts = await db.query.blogPosts.findMany({
    orderBy: [desc(blogPosts.wordCount)],
    limit,
  });

  if (posts.length === 0) {
    throw new Error('No posts found to analyze');
  }

  // Get basic profile first
  const basicProfile = await analyzeWritingStyle(options);

  // Extract deep patterns
  const openingHooks = analyzeOpeningHooks(posts);
  const components = analyzeComponents(posts);
  const voice = analyzeDeepVoice(posts);
  const trustSignals = analyzeTrustSignals(posts);
  const technicalContent = analyzeTechnicalContent(posts);
  const ctaPatterns = analyzeCTAPatterns(posts);
  const seoPatterns = analyzeSEOPatterns(posts);

  return {
    ...basicProfile,
    openingHooks,
    components,
    voice,
    trustSignals,
    technicalContent,
    ctaPatterns,
    seoPatterns,
  };
}

/**
 * Analyze opening hook patterns across posts
 */
function analyzeOpeningHooks(posts: any[]): DeepStyleProfile['openingHooks'] {
  const patterns: OpeningHookPattern[] = [];
  const typeFrequency: Record<OpeningHookType, number> = {
    story: 0,
    question: 0,
    statistic: 0,
    problem: 0,
    bold_claim: 0,
    scenario: 0,
    definition: 0,
    quote: 0,
    direct_address: 0,
  };

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';

    // Find first content section (skip hero/header)
    const firstSection = extractFirstContentSection(rawHtml);
    if (!firstSection) continue;

    const text = stripHtml(firstSection).trim();
    const hookType = classifyOpeningHook(text);

    typeFrequency[hookType]++;

    // Store example if we don't have many of this type yet
    const existingOfType = patterns.filter(p => p.type === hookType).length;
    if (existingOfType < 3) {
      patterns.push({
        type: hookType,
        example: text.substring(0, 400) + (text.length > 400 ? '...' : ''),
        sourcePostId: post.id,
        sourcePostTitle: post.title,
      });
    }
  }

  // Determine preferred and avoid types
  const sortedTypes = Object.entries(typeFrequency)
    .sort((a, b) => b[1] - a[1]);

  const preferredTypes = sortedTypes
    .filter(([_, count]) => count >= posts.length * 0.2)
    .map(([type]) => type as OpeningHookType);

  const avoidTypes = sortedTypes
    .filter(([_, count]) => count === 0)
    .map(([type]) => type as OpeningHookType);

  return {
    patterns,
    preferredTypes: preferredTypes.length > 0 ? preferredTypes : ['story', 'problem'],
    avoidTypes,
  };
}

/**
 * Extract the first content section from HTML (after hero/header)
 */
function extractFirstContentSection(html: string): string | null {
  // Look for first content-section div or first h2
  const contentSectionMatch = html.match(/<div[^>]*class="[^"]*content-section[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentSectionMatch) {
    return contentSectionMatch[1];
  }

  // Look for first section with h2
  const sectionMatch = html.match(/<section[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/section|$)/i);
  if (sectionMatch) {
    return sectionMatch[2];
  }

  // Fallback to first few paragraphs
  const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  if (paragraphs && paragraphs.length > 0) {
    return paragraphs.slice(0, 3).join('\n');
  }

  return null;
}

/**
 * Classify the type of opening hook used
 */
function classifyOpeningHook(text: string): OpeningHookType {
  const lowerText = text.toLowerCase();

  // Story indicators: past tense narrative, specific details, named individuals
  if (/\b(called|rang|phone|morning|afternoon|day|week|year)\b/.test(lowerText) &&
      /\b(he|she|they|john|mike|sarah|we)\b/.test(lowerText)) {
    return 'story';
  }

  // Question indicators
  if (/^(have you|do you|what if|why do|how do|are you|should you|can you|what|why|how|is it)/i.test(text.trim())) {
    return 'question';
  }

  // Statistic indicators: numbers, percentages, measurements
  if (/\b(\d{2,}%|\d+\s*(million|billion|thousand)|20\+\s*years|over\s*\d+)\b/i.test(text)) {
    return 'statistic';
  }

  // Problem statement indicators
  if (/\b(problem|issue|challenge|mistake|failure|crisis|damage|cost|wrong)\b/i.test(lowerText) &&
      /\b(common|frequent|typical|major|critical|expensive)\b/i.test(lowerText)) {
    return 'problem';
  }

  // Bold claim indicators
  if (/\b(the (only|best|most|ultimate)|never|always|every|essential|critical|must)\b/i.test(lowerText)) {
    return 'bold_claim';
  }

  // Scenario/hypothetical
  if (/\b(imagine|picture|consider|suppose|what if|let's say)\b/i.test(lowerText)) {
    return 'scenario';
  }

  // Definition
  if (/\b(is a|refers to|defined as|meaning|known as)\b/i.test(lowerText)) {
    return 'definition';
  }

  // Quote
  if (/^[""]/.test(text.trim()) || /\b(said|explains|notes|according to)\b/i.test(lowerText)) {
    return 'quote';
  }

  // Direct address (speaking to "you")
  if (/^(if you|when you|as a|for those|whether you)/i.test(text.trim())) {
    return 'direct_address';
  }

  // Default to story for narrative-style openings common in Alliance Chemical
  return 'story';
}

/**
 * Analyze component usage patterns
 */
function analyzeComponents(posts: any[]): DeepStyleProfile['components'] {
  const componentCounts: Record<ComponentType, { count: number; examples: Array<{ html: string; context: string; sourcePostId: string }> }> = {
    callout_success: { count: 0, examples: [] },
    callout_warning: { count: 0, examples: [] },
    callout_danger: { count: 0, examples: [] },
    callout_info: { count: 0, examples: [] },
    process_steps: { count: 0, examples: [] },
    comparison_table: { count: 0, examples: [] },
    data_table: { count: 0, examples: [] },
    credentials_box: { count: 0, examples: [] },
    hero_badges: { count: 0, examples: [] },
    cta_section: { count: 0, examples: [] },
    image_with_caption: { count: 0, examples: [] },
    chemical_formula: { count: 0, examples: [] },
    bullet_list: { count: 0, examples: [] },
    numbered_list: { count: 0, examples: [] },
    faq_section: { count: 0, examples: [] },
  };

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';

    // Callouts
    detectComponent(rawHtml, /class="[^"]*callout[^"]*success[^"]*"[\s\S]*?<\/div>/gi, 'callout_success', componentCounts, post.id);
    detectComponent(rawHtml, /class="[^"]*callout[^"]*warning[^"]*"[\s\S]*?<\/div>/gi, 'callout_warning', componentCounts, post.id);
    detectComponent(rawHtml, /class="[^"]*callout[^"]*danger[^"]*"[\s\S]*?<\/div>/gi, 'callout_danger', componentCounts, post.id);
    detectComponent(rawHtml, /class="[^"]*callout(?![^"]*(?:success|warning|danger))[^"]*"[\s\S]*?<\/div>/gi, 'callout_info', componentCounts, post.id);
    detectComponent(rawHtml, /class="[^"]*ac-callout[^"]*"[\s\S]*?<\/div>/gi, 'callout_info', componentCounts, post.id);

    // Process steps
    detectComponent(rawHtml, /class="[^"]*process-steps?[^"]*"[\s\S]*?(?=<\/(?:ol|div)>)/gi, 'process_steps', componentCounts, post.id);

    // Tables
    if (/<table[\s\S]*?(?:comparison|vs\.|versus)/i.test(rawHtml)) {
      detectComponent(rawHtml, /<table[\s\S]*?<\/table>/gi, 'comparison_table', componentCounts, post.id);
    } else {
      detectComponent(rawHtml, /<table[\s\S]*?<\/table>/gi, 'data_table', componentCounts, post.id);
    }

    // Credentials box
    detectComponent(rawHtml, /class="[^"]*credentials-box[^"]*"[\s\S]*?<\/div>/gi, 'credentials_box', componentCounts, post.id);
    detectComponent(rawHtml, /class="[^"]*author-box[^"]*"[\s\S]*?<\/div>/gi, 'credentials_box', componentCounts, post.id);

    // Hero badges
    detectComponent(rawHtml, /class="[^"]*trust-badges[^"]*"[\s\S]*?<\/div>/gi, 'hero_badges', componentCounts, post.id);

    // CTA sections
    detectComponent(rawHtml, /class="[^"]*cta-section[^"]*"[\s\S]*?<\/div>/gi, 'cta_section', componentCounts, post.id);

    // Images with captions
    detectComponent(rawHtml, /class="[^"]*image-container[^"]*"[\s\S]*?<\/div>/gi, 'image_with_caption', componentCounts, post.id);

    // Chemical formulas (monospace or subscript)
    if (/[A-Z][a-z]?[₂₃₄₅₆₇₈₉]|font-family:\s*monospace|<sub>/i.test(rawHtml)) {
      componentCounts.chemical_formula.count++;
    }

    // Lists
    if (/<ul/i.test(rawHtml)) componentCounts.bullet_list.count++;
    if (/<ol/i.test(rawHtml)) componentCounts.numbered_list.count++;
  }

  // Build patterns array
  const patterns: ComponentPattern[] = [];
  const required: ComponentType[] = [];
  const optional: ComponentType[] = [];

  for (const [type, data] of Object.entries(componentCounts)) {
    const frequency = data.count / posts.length;

    if (data.count > 0) {
      patterns.push({
        type: type as ComponentType,
        frequency: data.count,
        avgPerPost: Math.round((data.count / posts.length) * 10) / 10,
        examples: data.examples.slice(0, 2),
        placementNotes: getPlacementNotes(type as ComponentType),
      });
    }

    if (frequency >= 0.8) required.push(type as ComponentType);
    else if (frequency >= 0.3) optional.push(type as ComponentType);
  }

  // Typical flow based on Alliance Chemical patterns
  const typicalFlow: ComponentType[] = [
    'hero_badges',
    'callout_danger', // Often used for attention-grabbing opening
    'image_with_caption',
    'callout_warning',
    'bullet_list',
    'comparison_table',
    'process_steps',
    'callout_success',
    'data_table',
    'credentials_box',
    'cta_section',
  ];

  return {
    patterns,
    typicalFlow,
    required,
    optional,
  };
}

/**
 * Helper to detect and store component examples
 */
function detectComponent(
  html: string,
  pattern: RegExp,
  type: ComponentType,
  counts: Record<ComponentType, { count: number; examples: Array<{ html: string; context: string; sourcePostId: string }> }>,
  postId: string
): void {
  const matches = html.match(pattern);
  if (matches) {
    counts[type].count += matches.length;
    if (counts[type].examples.length < 2 && matches[0]) {
      counts[type].examples.push({
        html: matches[0].substring(0, 500),
        context: 'Extracted from post content',
        sourcePostId: postId,
      });
    }
  }
}

/**
 * Get placement notes for each component type
 */
function getPlacementNotes(type: ComponentType): string[] {
  const notes: Record<ComponentType, string[]> = {
    callout_success: ['Use to highlight key benefits or positive outcomes', 'Often placed after explaining a solution'],
    callout_warning: ['Use for important cautions or considerations', 'Place before potentially risky procedures'],
    callout_danger: ['Use for critical safety information', 'Can also be used for attention-grabbing opening facts'],
    callout_info: ['Use for helpful tips and additional context', 'Good for "Pro Tips" from Andre'],
    process_steps: ['Use for step-by-step procedures', 'Place in dedicated "How To" sections'],
    comparison_table: ['Use when comparing products, grades, or alternatives', 'Place in dedicated comparison sections'],
    data_table: ['Use for specifications, properties, or measurements', 'Place near relevant technical discussion'],
    credentials_box: ['Use to establish authority and trust', 'Typically placed near the end before CTA'],
    hero_badges: ['Use in hero section for trust signals', 'Include 3-4 key differentiators'],
    cta_section: ['Place at end of article', 'Include product link and value proposition'],
    image_with_caption: ['Use to break up text and illustrate concepts', 'Place after introducing a concept'],
    chemical_formula: ['Include inline when discussing reactions or compounds', 'Use proper subscript formatting'],
    bullet_list: ['Use for features, benefits, or non-sequential items', 'Keep to 3-7 items typically'],
    numbered_list: ['Use for sequential steps or ranked items', 'Use process-steps styling for major procedures'],
    faq_section: ['Place near end of article', 'Include 3-6 common questions'],
  };
  return notes[type] || [];
}

/**
 * Analyze deep voice characteristics
 */
function analyzeDeepVoice(posts: any[]): DeepStyleProfile['voice'] {
  const pronounCounts = { we: 0, you: 0, they: 0, i: 0 };
  const sentenceStarters = new Map<string, number>();
  const transitionPhrases: string[] = [];
  const emphasisPatterns: string[] = [];

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';
    const text = stripHtml(rawHtml);

    // Count pronouns
    pronounCounts.we += (text.match(/\b(we|our|us)\b/gi) || []).length;
    pronounCounts.you += (text.match(/\b(you|your|you're)\b/gi) || []).length;
    pronounCounts.they += (text.match(/\b(they|their|them)\b/gi) || []).length;
    pronounCounts.i += (text.match(/\b(I|I've|I'm)\b/g) || []).length;

    // Extract sentence starters
    const sentences = text.split(/[.!?]\s+/).filter(s => s.length > 10);
    for (const sentence of sentences) {
      const starter = sentence.trim().split(/\s+/).slice(0, 3).join(' ');
      sentenceStarters.set(starter, (sentenceStarters.get(starter) || 0) + 1);
    }

    // Look for emphasis patterns in HTML
    if (/<strong>/i.test(rawHtml)) emphasisPatterns.push('Bold text for key points');
    if (/<em>/i.test(rawHtml)) emphasisPatterns.push('Italics for emphasis');
    if (/style="[^"]*background[^"]*"/i.test(rawHtml)) emphasisPatterns.push('Background highlighting');
  }

  // Get most common sentence starters
  const commonStarters = Array.from(sentenceStarters.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([starter]) => starter);

  // Alliance Chemical transition phrases based on examples
  const allianceTransitions = [
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
    "Impact:",
    "After 20+ years",
    "Based on our experience",
  ];

  // Characteristics based on analysis
  const characteristics: VoiceCharacteristic[] = [
    {
      trait: 'Expert Authority',
      description: 'Positions as industry expert with decades of experience',
      examples: ['After 20+ years supplying...', 'Based on our experience...', 'We\'ve seen this mistake...'],
      frequency: 'always',
    },
    {
      trait: 'Practical Problem-Solver',
      description: 'Focuses on real problems and actionable solutions',
      examples: ['Here\'s how to fix it:', 'The solution:', 'What you should do:'],
      frequency: 'always',
    },
    {
      trait: 'Educational but Accessible',
      description: 'Explains technical concepts clearly without being condescending',
      examples: ['What this means for you:', 'In plain English:', 'Let\'s break this down:'],
      frequency: 'often',
    },
    {
      trait: 'Safety-Conscious',
      description: 'Consistently emphasizes safety and proper handling',
      examples: ['Critical safety warning:', 'Never use...', 'Always wear appropriate PPE'],
      frequency: 'always',
    },
    {
      trait: 'Story-Driven',
      description: 'Uses real customer stories and case studies',
      examples: ['A few weeks ago, the phone rang...', 'It was a Monday morning when...'],
      frequency: 'often',
    },
  ];

  return {
    characteristics,
    pronounUsage: pronounCounts,
    sentenceStarters: commonStarters,
    transitionPhrases: allianceTransitions,
    emphasisPatterns: [...new Set(emphasisPatterns)],
  };
}

/**
 * Analyze trust and credibility signals
 */
function analyzeTrustSignals(posts: any[]): DeepStyleProfile['trustSignals'] {
  const patterns: TrustSignal[] = [];
  const brandCredentials: string[] = [];
  const expertReferences: string[] = [];
  const certifications: string[] = [];

  // Common trust patterns in Alliance Chemical content
  const trustPatterns = {
    expertise_years: /(\d+\+?\s*years?\s*(of\s+)?experience|since\s+\d{4}|over\s+\d+\s*years)/gi,
    certifications: /(ACS\s+grade|USP\s+grade|technical\s+grade|food\s+grade|reagent\s+grade)/gi,
    expert_reference: /(according\s+to|experts?\s+(?:say|recommend|note)|engineer|scientist)/gi,
    industry_statistics: /(\d+%\s+of|\d+\s+million|industry\s+(?:standard|leading))/gi,
    safety_emphasis: /(safety|warning|caution|critical|important|must|never)/gi,
    quality_claims: /(high[\s-]?purity|premium|professional[\s-]?grade|quality)/gi,
  };

  for (const post of posts) {
    const text = stripHtml(post.rawHtml || '');

    for (const [type, pattern] of Object.entries(trustPatterns)) {
      const matches = text.match(pattern);
      if (matches) {
        const existingPattern = patterns.find(p => p.type === type);
        if (existingPattern) {
          existingPattern.frequency += matches.length;
          matches.slice(0, 2).forEach(m => {
            if (!existingPattern.examples.includes(m)) {
              existingPattern.examples.push(m);
            }
          });
        } else {
          patterns.push({
            type: type as TrustSignal['type'],
            examples: matches.slice(0, 3),
            frequency: matches.length,
          });
        }
      }
    }
  }

  // Alliance Chemical specific credentials
  brandCredentials.push(
    '20+ years supplying industrial facilities',
    'Central Texas Chemical Supplier',
    'Domestic supply chain',
    'Fast shipping nationwide',
    'Complete documentation and SDS provided',
  );

  return {
    patterns,
    brandCredentials,
    expertReferences,
    certificationMentions: certifications,
  };
}

/**
 * Analyze technical content patterns
 */
function analyzeTechnicalContent(posts: any[]): DeepStyleProfile['technicalContent'] {
  const chemicalFormulas = new Set<string>();
  const measurementUnits = new Set<string>();
  const technicalTerms = new Set<string>();
  const safetyPhrases = new Set<string>();
  const processDescriptions = new Set<string>();

  // Patterns to look for
  const formulaPattern = /\b([A-Z][a-z]?[₂₃₄₅₆]?[A-Z]?[a-z]?[₂₃₄₅₆]?|[A-Z]{2,4}[₂₃₄₅₆]?)\b/g;
  const unitPattern = /\b(\d+\.?\d*\s*(?:°[CF]|ppm|mg|kg|L|ml|mL|gal|%|μS\/cm|cP|kW|MW|BTU|psi))\b/gi;
  const technicalTermPattern = /\b(ph|concentration|viscosity|specific\s+heat|thermal\s+conductivity|dielectric|corrosion|oxidation|precipitation|dilution|inhibitor)\b/gi;
  const safetyPattern = /\b(ppe|safety\s+glasses|gloves|ventilation|spill|hazard|warning|caution|emergency|msds|sds)\b/gi;

  for (const post of posts) {
    const text = stripHtml(post.rawHtml || '');

    // Extract formulas
    const formulas = text.match(formulaPattern);
    if (formulas) {
      formulas.filter(f => f.length > 1 && f.length < 15).forEach(f => chemicalFormulas.add(f));
    }

    // Extract measurement units
    const units = text.match(unitPattern);
    if (units) {
      units.slice(0, 10).forEach(u => measurementUnits.add(u));
    }

    // Extract technical terms
    const terms = text.match(technicalTermPattern);
    if (terms) {
      terms.forEach(t => technicalTerms.add(t.toLowerCase()));
    }

    // Extract safety phrases
    const safety = text.match(safetyPattern);
    if (safety) {
      safety.forEach(s => safetyPhrases.add(s.toLowerCase()));
    }
  }

  // Common process description patterns in Alliance Chemical content
  const commonProcessDescriptions = [
    'Prepare the solution by mixing...',
    'Apply using appropriate PPE...',
    'Store in a cool, dry location...',
    'Dispose of according to local regulations...',
    'Test pH before proceeding...',
    'Allow to cure/dry for...',
  ];

  return {
    chemicalFormulas: Array.from(chemicalFormulas).slice(0, 20),
    measurementUnits: Array.from(measurementUnits).slice(0, 15),
    technicalTerms: Array.from(technicalTerms).slice(0, 25),
    safetyPhrases: Array.from(safetyPhrases).slice(0, 15),
    processDescriptions: commonProcessDescriptions,
  };
}

/**
 * Analyze CTA patterns
 */
function analyzeCTAPatterns(posts: any[]): DeepStyleProfile['ctaPatterns'] {
  const primaryCTAs: string[] = [];
  const secondaryCTAs: string[] = [];
  const placements: ('hero' | 'mid_content' | 'end' | 'sidebar')[] = [];

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';

    // Check for CTA sections at end
    if (/class="[^"]*cta-section[^"]*"[\s\S]*?<\/div>\s*<footer/i.test(rawHtml)) {
      placements.push('end');
    }

    // Check for mid-content product links
    if (/<a[^>]*href="[^"]*alliancechemical\.com\/products/i.test(rawHtml)) {
      placements.push('mid_content');
    }

    // Extract CTA button text
    const ctaButtons = rawHtml.match(/<a[^>]*class="[^"]*cta-button[^"]*"[^>]*>([^<]+)</gi);
    if (ctaButtons) {
      ctaButtons.forEach((cta: string) => {
        const text = cta.replace(/<[^>]+>/g, '').trim();
        if (text && !primaryCTAs.includes(text)) {
          primaryCTAs.push(text);
        }
      });
    }
  }

  // Alliance Chemical CTA patterns based on examples
  const alliancePrimaryCTAs = [
    'View Product & Get Quote',
    'Shop Now',
    'Get a Quote',
    'View Products & Get Quote',
    'Contact Our Experts',
  ];

  const allianceSecondaryCTAs = [
    'Learn more about',
    'Read our guide to',
    'View our selection of',
    'Browse our full line of',
  ];

  const urgencyPhrases = [
    'Same-day shipping on in-stock items',
    'Fast shipping nationwide',
    'Available now',
    'In stock',
  ];

  const valuePhrases = [
    'Complete documentation included',
    'Technical support available',
    'Bulk pricing available',
    'Full SDS provided',
  ];

  return {
    primary: primaryCTAs.length > 0 ? primaryCTAs : alliancePrimaryCTAs,
    secondary: allianceSecondaryCTAs,
    placement: [...new Set(placements)],
    urgencyPhrases,
    valuePhrases,
  };
}

/**
 * Analyze SEO patterns
 */
function analyzeSEOPatterns(posts: any[]): DeepStyleProfile['seoPatterns'] {
  const titleFormats: string[] = [];
  const metaFormats: string[] = [];

  for (const post of posts) {
    // Analyze title format
    const title = post.title || '';
    if (title.includes(':')) titleFormats.push('Main Topic: Subtitle');
    if (title.includes('Guide')) titleFormats.push('Guide Format');
    if (title.includes('How')) titleFormats.push('How-To Format');
    if (/\d/.test(title)) titleFormats.push('Number in Title');

    // Analyze meta descriptions
    const excerpt = post.excerpt || '';
    if (excerpt.length > 0) {
      if (/20\+ years|experience|expert/i.test(excerpt)) {
        metaFormats.push('Includes expertise claim');
      }
      if (/learn|discover|guide/i.test(excerpt)) {
        metaFormats.push('Educational framing');
      }
    }
  }

  return {
    titleFormats: [...new Set(titleFormats)],
    metaDescriptionFormats: [...new Set(metaFormats)],
    headerHierarchy: 'H1 (Title) > H2 (Main Sections) > H3 (Subsections) > H4 (Callout Headers)',
    keywordPlacement: [
      'Primary keyword in title',
      'Primary keyword in first paragraph',
      'Variations in H2 headers',
      'Related terms in H3 headers',
      'Natural inclusion in body text',
    ],
  };
}

/**
 * Analyze tone characteristics
 */
function analyzeTone(posts: any[]): StyleProfile['tone'] {
  let firstPersonCount = 0;
  let secondPersonCount = 0;
  let thirdPersonCount = 0;
  let technicalTermCount = 0;
  let casualPhraseCount = 0;

  const personalities = new Set<string>();

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';
    const text = stripHtml(rawHtml).toLowerCase();

    // Check voice
    if (/\b(we|our|us)\b/i.test(text)) firstPersonCount++;
    if (/\b(you|your)\b/i.test(text)) secondPersonCount++;
    if (/\b(the company|alliance chemical|it is)\b/i.test(text)) thirdPersonCount++;

    // Check for technical language
    if (/\b(ph|concentration|formula|compound|chemical|reaction|solution)\b/i.test(text)) {
      technicalTermCount++;
    }

    // Check for casual language
    if (/\b(let's|here's|you'll|we'll|gonna|wanna)\b/i.test(text)) {
      casualPhraseCount++;
    }

    // Detect personality traits
    if (/\bsafety|caution|warning|important\b/i.test(text)) personalities.add('safety-conscious');
    if (/\bexpert|professional|industry\b/i.test(text)) personalities.add('authoritative');
    if (/\bhow to|guide|step|learn\b/i.test(text)) personalities.add('educational');
    if (/\bhelp|support|assist\b/i.test(text)) personalities.add('helpful');
  }

  // Determine formality
  const formalityRatio = technicalTermCount / Math.max(casualPhraseCount, 1);
  let formality: StyleProfile['tone']['formality'] = 'professional';
  if (formalityRatio > 2) formality = 'technical';
  else if (formalityRatio < 0.5) formality = 'casual';
  else if (technicalTermCount > 0 && casualPhraseCount > 0) formality = 'mixed';

  // Determine voice
  const voiceCounts = { first: firstPersonCount, second: secondPersonCount, third: thirdPersonCount };
  const maxVoice = Object.entries(voiceCounts).sort((a, b) => b[1] - a[1])[0];
  let voice: StyleProfile['tone']['voice'] = 'mixed';
  if (maxVoice[1] > posts.length * 0.6) {
    voice = maxVoice[0] === 'first' ? 'first_person' : maxVoice[0] === 'second' ? 'second_person' : 'third_person';
  }

  return {
    formality,
    voice,
    personality: Array.from(personalities),
  };
}

/**
 * Analyze structural patterns
 */
function analyzeStructure(posts: any[]): StyleProfile['structure'] {
  let totalSections = 0;
  let totalWordsInSections = 0;
  let bulletPointPosts = 0;
  let numberedListPosts = 0;
  let tablePosts = 0;
  let infoBoxPosts = 0;
  let ctaPosts = 0;
  let totalFAQs = 0;

  for (const post of posts) {
    const sections = post.sections || [];
    totalSections += sections.length;

    for (const section of sections) {
      totalWordsInSections += section.wordCount || 0;
    }

    const rawHtml = post.rawHtml || '';

    if (/<ul|<li/i.test(rawHtml)) bulletPointPosts++;
    if (/<ol/i.test(rawHtml)) numberedListPosts++;
    if (/<table/i.test(rawHtml)) tablePosts++;
    if (/info-box|callout|note|tip/i.test(rawHtml)) infoBoxPosts++;
    if (/cta|call-to-action|shop now|contact|get started/i.test(rawHtml)) ctaPosts++;

    totalFAQs += (post.faq || []).length;
  }

  const avgSections = totalSections / posts.length;
  const avgWordsPerSection = totalSections > 0 ? totalWordsInSections / totalSections : 0;

  return {
    avgSectionsPerPost: Math.round(avgSections * 10) / 10,
    avgWordsPerSection: Math.round(avgWordsPerSection),
    usesBulletPoints: bulletPointPosts > posts.length * 0.5,
    usesNumberedLists: numberedListPosts > posts.length * 0.3,
    usesTables: tablePosts > posts.length * 0.3,
    usesInfoBoxes: infoBoxPosts > posts.length * 0.3,
    usesCTAs: ctaPosts > posts.length * 0.5,
    avgFAQsPerPost: Math.round((totalFAQs / posts.length) * 10) / 10,
  };
}

/**
 * Analyze content patterns
 */
function analyzeContentPatterns(posts: any[]): StyleProfile['content'] {
  let productLinkPosts = 0;
  let externalRefPosts = 0;
  let safetyInfoPosts = 0;
  let chemicalFormulaPosts = 0;
  let pricingPosts = 0;
  const audiences = new Set<string>();

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';
    const text = stripHtml(rawHtml);

    if (/alliancechemical\.com\/product/i.test(rawHtml)) productLinkPosts++;
    if (/<a[^>]+href=["']https?:\/\/(?!alliance)/i.test(rawHtml)) externalRefPosts++;
    if (/safety|hazard|warning|caution|ppe|protective/i.test(text)) safetyInfoPosts++;
    if (/[A-Z][a-z]?₂?[A-Z][a-z]?|[A-Z][a-z]+\s+\d+/i.test(text)) chemicalFormulaPosts++;
    if (/\$\d+|\bprice\b|\bcost\b/i.test(text)) pricingPosts++;

    // Detect target audiences
    if (/industrial|manufacturer|plant|facility/i.test(text)) audiences.add('industrial professionals');
    if (/laboratory|research|scientist/i.test(text)) audiences.add('researchers');
    if (/pool|home|diy|household/i.test(text)) audiences.add('consumers');
    if (/contractor|construction|building/i.test(text)) audiences.add('contractors');
  }

  return {
    includesProductLinks: productLinkPosts > posts.length * 0.5,
    includesExternalReferences: externalRefPosts > posts.length * 0.3,
    includesSafetyInfo: safetyInfoPosts > posts.length * 0.5,
    includesChemicalFormulas: chemicalFormulaPosts > posts.length * 0.3,
    includesPricing: pricingPosts > posts.length * 0.2,
    targetAudience: Array.from(audiences),
  };
}

/**
 * Calculate writing metrics
 */
function calculateMetrics(posts: any[]): StyleProfile['metrics'] {
  let totalWords = 0;
  let totalSentences = 0;
  let totalParagraphs = 0;

  for (const post of posts) {
    totalWords += post.wordCount || 0;

    const rawHtml = post.rawHtml || '';
    const text = stripHtml(rawHtml);

    // Count sentences (rough)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    totalSentences += sentences.length;

    // Count paragraphs
    const paragraphs = rawHtml.split(/<\/p>/i).length - 1;
    totalParagraphs += Math.max(paragraphs, 1);
  }

  const avgWordCount = Math.round(totalWords / posts.length);
  const avgSentenceLength = totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0;
  const avgParagraphLength = totalParagraphs > 0 ? Math.round(totalWords / totalParagraphs) : 0;

  // Estimate readability level
  let readabilityLevel: StyleProfile['metrics']['readabilityLevel'] = 'intermediate';
  if (avgSentenceLength > 25) readabilityLevel = 'expert';
  else if (avgSentenceLength > 20) readabilityLevel = 'advanced';
  else if (avgSentenceLength < 12) readabilityLevel = 'beginner';

  return {
    avgWordCount,
    avgSentenceLength,
    avgParagraphLength,
    readabilityLevel,
  };
}

/**
 * Extract common patterns and phrases
 */
function extractPatterns(posts: any[]): StyleProfile['patterns'] {
  const openings: string[] = [];
  const transitions: string[] = [];
  const ctas: string[] = [];
  const brandTerms = new Set<string>();

  // Common chemical/brand terms to look for
  const knownTerms = [
    'Alliance Chemical',
    'technical grade',
    'ACS grade',
    'USP grade',
    'food grade',
    'industrial strength',
    'high purity',
    'bulk',
    'wholesale',
  ];

  for (const post of posts) {
    const rawHtml = post.rawHtml || '';
    const text = stripHtml(rawHtml);

    // Extract first paragraph as opening
    const firstParagraph = text.split(/\n\n/)[0]?.trim();
    if (firstParagraph && firstParagraph.length > 50 && firstParagraph.length < 500) {
      openings.push(firstParagraph.substring(0, 200) + '...');
    }

    // Look for brand terms
    for (const term of knownTerms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        brandTerms.add(term);
      }
    }
  }

  // Common transitions in chemical/industrial writing
  const commonTransitions = [
    'Additionally,',
    'Furthermore,',
    'In contrast,',
    'However,',
    'This means that',
    'As a result,',
    'For example,',
    'In practice,',
  ];

  // Common CTAs
  const commonCTAs = [
    'Shop our selection of',
    'Contact our experts',
    'Browse our full line of',
    'Get a quote today',
    'Order now',
  ];

  return {
    commonOpenings: openings.slice(0, 5),
    commonTransitions,
    commonCTAs,
    brandTerms: Array.from(brandTerms),
  };
}

/**
 * Select the best exemplar posts
 */
function selectExemplars(posts: any[], count: number): string[] {
  // Score posts based on quality indicators
  const scoredPosts = posts.map(post => {
    let score = 0;

    // Prefer longer, more detailed posts
    score += Math.min(post.wordCount / 500, 5);

    // Prefer posts with good structure
    const sections = post.sections || [];
    score += Math.min(sections.length / 2, 3);

    // Prefer posts with FAQs
    const faqs = post.faq || [];
    score += faqs.length > 0 ? 1 : 0;

    // Prefer posts with links
    const rawHtml = post.rawHtml || '';
    if (/alliancechemical\.com/i.test(rawHtml)) score += 1;

    return { id: post.id, score, title: post.title };
  });

  // Sort by score and return top IDs
  return scoredPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(p => p.id);
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a style guide prompt from the basic profile
 */
export function generateStyleGuidePrompt(profile: StyleProfile): string {
  const parts: string[] = [];

  parts.push('## Writing Style Guide\n');

  // Tone
  parts.push(`### Tone & Voice`);
  parts.push(`- Formality: ${profile.tone.formality}`);
  parts.push(`- Voice: ${profile.tone.voice.replace('_', ' ')}`);
  parts.push(`- Personality: ${profile.tone.personality.join(', ')}`);

  // Structure
  parts.push(`\n### Structure`);
  parts.push(`- Target ${profile.structure.avgSectionsPerPost} sections per post`);
  parts.push(`- Aim for ~${profile.structure.avgWordsPerSection} words per section`);
  if (profile.structure.usesBulletPoints) parts.push(`- Use bullet points for lists`);
  if (profile.structure.usesNumberedLists) parts.push(`- Use numbered lists for sequential steps`);
  if (profile.structure.usesTables) parts.push(`- Include comparison tables where relevant`);
  if (profile.structure.usesInfoBoxes) parts.push(`- Use info boxes for important callouts`);
  if (profile.structure.usesCTAs) parts.push(`- Include calls-to-action`);

  // Content
  parts.push(`\n### Content Elements`);
  if (profile.content.includesProductLinks) parts.push(`- Link to relevant Alliance Chemical products`);
  if (profile.content.includesSafetyInfo) parts.push(`- Always include safety information and warnings`);
  if (profile.content.includesChemicalFormulas) parts.push(`- Include chemical formulas where appropriate`);
  parts.push(`- Target audience: ${profile.content.targetAudience.join(', ')}`);

  // Metrics
  parts.push(`\n### Writing Metrics`);
  parts.push(`- Target word count: ~${profile.metrics.avgWordCount} words`);
  parts.push(`- Sentence length: ~${profile.metrics.avgSentenceLength} words average`);
  parts.push(`- Readability: ${profile.metrics.readabilityLevel} level`);

  // Brand terms
  if (profile.patterns.brandTerms.length > 0) {
    parts.push(`\n### Brand Terminology`);
    parts.push(`Use these terms consistently: ${profile.patterns.brandTerms.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Generate a comprehensive style guide prompt from the deep profile
 * This creates detailed instructions for AI content generation
 */
export function generateDeepStyleGuidePrompt(profile: DeepStyleProfile): string {
  const parts: string[] = [];

  parts.push('# Alliance Chemical Writing Style Guide');
  parts.push('\nThis guide captures the authentic voice and patterns of Alliance Chemical blog content.\n');

  // Voice Characteristics
  parts.push('## Voice & Personality\n');
  for (const char of profile.voice.characteristics) {
    parts.push(`### ${char.trait}`);
    parts.push(`${char.description}`);
    parts.push(`**Frequency:** ${char.frequency}`);
    parts.push(`**Examples:**`);
    char.examples.forEach(ex => parts.push(`- "${ex}"`));
    parts.push('');
  }

  // Pronoun Usage
  parts.push('## Pronoun Usage\n');
  parts.push('Alliance Chemical uses a conversational mix of pronouns:');
  parts.push(`- **"We/Our/Us"**: ${profile.voice.pronounUsage.we} uses (establishes company authority)`);
  parts.push(`- **"You/Your"**: ${profile.voice.pronounUsage.you} uses (direct address to reader)`);
  parts.push(`- **"I"**: ${profile.voice.pronounUsage.i} uses (personal expertise, especially from Andre)`);
  parts.push('');

  // Opening Hook Patterns
  parts.push('## Opening Hooks\n');
  parts.push('Alliance Chemical articles typically open with engaging hooks. Preferred types:');
  profile.openingHooks.preferredTypes.forEach(type => {
    parts.push(`- **${type.replace('_', ' ')}**`);
  });
  parts.push('\n**Examples from actual posts:**');
  profile.openingHooks.patterns.slice(0, 3).forEach(pattern => {
    parts.push(`\n*${pattern.type}* (from "${pattern.sourcePostTitle}"):`);
    parts.push(`> ${pattern.example.substring(0, 300)}...`);
  });
  if (profile.openingHooks.avoidTypes.length > 0) {
    parts.push(`\n**Avoid these opening types:** ${profile.openingHooks.avoidTypes.join(', ')}`);
  }
  parts.push('');

  // Component Usage
  parts.push('## HTML Components\n');
  parts.push('Alliance Chemical uses specific styled components. Include these appropriately:\n');

  parts.push('### Required Components (appear in 80%+ of posts)');
  profile.components.required.forEach(comp => {
    const pattern = profile.components.patterns.find(p => p.type === comp);
    if (pattern) {
      parts.push(`- **${comp.replace(/_/g, ' ')}** (avg ${pattern.avgPerPost} per post)`);
      pattern.placementNotes.forEach(note => parts.push(`  - ${note}`));
    }
  });

  parts.push('\n### Optional Components (30-80% of posts)');
  profile.components.optional.forEach(comp => {
    const pattern = profile.components.patterns.find(p => p.type === comp);
    if (pattern) {
      parts.push(`- **${comp.replace(/_/g, ' ')}** (avg ${pattern.avgPerPost} per post)`);
    }
  });

  parts.push('\n### Typical Component Flow');
  parts.push('Components typically appear in this order:');
  parts.push(profile.components.typicalFlow.map((c, i) => `${i + 1}. ${c.replace(/_/g, ' ')}`).join('\n'));
  parts.push('');

  // Trust Signals
  parts.push('## Trust & Credibility Signals\n');
  parts.push('Alliance Chemical establishes authority through:');
  profile.trustSignals.brandCredentials.forEach(cred => {
    parts.push(`- ${cred}`);
  });
  parts.push('\n**Trust patterns to include:**');
  profile.trustSignals.patterns.slice(0, 5).forEach(pattern => {
    parts.push(`- **${pattern.type.replace(/_/g, ' ')}**: ${pattern.examples.slice(0, 2).join(', ')}`);
  });
  parts.push('');

  // Technical Content
  parts.push('## Technical Content Guidelines\n');
  parts.push('Alliance Chemical content is technically accurate but accessible.\n');

  if (profile.technicalContent.chemicalFormulas.length > 0) {
    parts.push('**Chemical formulas used:** ' + profile.technicalContent.chemicalFormulas.slice(0, 10).join(', '));
  }
  if (profile.technicalContent.measurementUnits.length > 0) {
    parts.push('**Common measurements:** ' + profile.technicalContent.measurementUnits.slice(0, 8).join(', '));
  }
  if (profile.technicalContent.technicalTerms.length > 0) {
    parts.push('**Technical terms:** ' + profile.technicalContent.technicalTerms.slice(0, 10).join(', '));
  }
  if (profile.technicalContent.safetyPhrases.length > 0) {
    parts.push('\n**Safety language:** ' + profile.technicalContent.safetyPhrases.join(', '));
  }
  parts.push('');

  // CTA Patterns
  parts.push('## Call-to-Action Patterns\n');
  parts.push('**Primary CTAs:**');
  profile.ctaPatterns.primary.forEach(cta => parts.push(`- "${cta}"`));
  parts.push('\n**Secondary/Inline CTAs:**');
  profile.ctaPatterns.secondary.forEach(cta => parts.push(`- "${cta}"`));
  parts.push('\n**CTA Placement:** ' + profile.ctaPatterns.placement.join(', '));
  parts.push('\n**Urgency phrases:** ' + profile.ctaPatterns.urgencyPhrases.join(' | '));
  parts.push('**Value phrases:** ' + profile.ctaPatterns.valuePhrases.join(' | '));
  parts.push('');

  // Transition Phrases
  parts.push('## Transition Phrases\n');
  parts.push('Use these Alliance Chemical signature transitions:');
  profile.voice.transitionPhrases.forEach(phrase => parts.push(`- "${phrase}"`));
  parts.push('');

  // Writing Metrics
  parts.push('## Writing Metrics\n');
  parts.push(`- **Target word count:** ~${profile.metrics.avgWordCount} words`);
  parts.push(`- **Average sentence length:** ~${profile.metrics.avgSentenceLength} words`);
  parts.push(`- **Sections per post:** ~${profile.structure.avgSectionsPerPost}`);
  parts.push(`- **Readability level:** ${profile.metrics.readabilityLevel}`);
  parts.push('');

  // SEO Patterns
  parts.push('## SEO Guidelines\n');
  parts.push('**Title formats used:** ' + profile.seoPatterns.titleFormats.join(', '));
  parts.push('**Header hierarchy:** ' + profile.seoPatterns.headerHierarchy);
  parts.push('\n**Keyword placement:**');
  profile.seoPatterns.keywordPlacement.forEach(placement => parts.push(`- ${placement}`));

  return parts.join('\n');
}

/**
 * Generate a condensed style prompt for AI system messages
 * This is a shorter version suitable for inclusion in API calls
 */
export function generateCondensedStylePrompt(profile: DeepStyleProfile): string {
  return `
# Alliance Chemical Writing Style

## Voice
- Expert authority with 20+ years experience
- Practical problem-solver focused on real solutions
- Educational but accessible - explains technical concepts clearly
- Safety-conscious - always emphasizes proper handling
- Story-driven - uses real customer stories and case studies

## Pronouns
Use "we/our" for company perspective, "you/your" for reader engagement, "I" for Andre's personal expertise.

## Opening Hooks
Prefer: ${profile.openingHooks.preferredTypes.slice(0, 3).join(', ')}
Start with a compelling story, problem, or real-world scenario.

## Required Elements
${profile.components.required.map(c => `- ${c.replace(/_/g, ' ')}`).join('\n')}

## Trust Signals
${profile.trustSignals.brandCredentials.slice(0, 3).join('\n- ')}

## Transitions
Use: ${profile.voice.transitionPhrases.slice(0, 6).join(' | ')}

## Technical Content
Include chemical formulas, measurements, and safety warnings where appropriate.
Terms: ${profile.technicalContent.technicalTerms.slice(0, 8).join(', ')}

## CTA
Primary: ${profile.ctaPatterns.primary[0]}
Always link to relevant Alliance Chemical products.

## Metrics
~${profile.metrics.avgWordCount} words, ${profile.structure.avgSectionsPerPost} sections, ${profile.metrics.readabilityLevel} readability
`.trim();
}
