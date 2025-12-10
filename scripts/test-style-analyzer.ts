#!/usr/bin/env npx tsx
/**
 * Test Script for Deep Style Analyzer
 *
 * Tests the style analyzer output generation with sample data,
 * without requiring a database connection.
 *
 * Run with: npx tsx scripts/test-style-analyzer.ts
 */

// Define types locally to avoid importing from modules that need DB
type OpeningHookType =
  | 'story'
  | 'question'
  | 'statistic'
  | 'problem'
  | 'bold_claim'
  | 'scenario'
  | 'definition'
  | 'quote'
  | 'direct_address';

type ComponentType =
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

interface VoiceCharacteristic {
  trait: string;
  description: string;
  examples: string[];
  frequency: 'always' | 'often' | 'sometimes' | 'rarely';
}

interface TrustSignal {
  type: string;
  examples: string[];
  frequency: number;
}

interface OpeningHookPattern {
  type: OpeningHookType;
  example: string;
  sourcePostId: string;
  sourcePostTitle: string;
}

interface ComponentPattern {
  type: ComponentType;
  frequency: number;
  avgPerPost: number;
  examples: Array<{ html: string; context: string; sourcePostId: string }>;
  placementNotes: string[];
}

interface DeepStyleProfile {
  tone: {
    formality: 'casual' | 'professional' | 'technical' | 'mixed';
    voice: 'first_person' | 'second_person' | 'third_person' | 'mixed';
    personality: string[];
  };
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
  content: {
    includesProductLinks: boolean;
    includesExternalReferences: boolean;
    includesSafetyInfo: boolean;
    includesChemicalFormulas: boolean;
    includesPricing: boolean;
    targetAudience: string[];
  };
  metrics: {
    avgWordCount: number;
    avgSentenceLength: number;
    avgParagraphLength: number;
    readabilityLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };
  patterns: {
    commonOpenings: string[];
    commonTransitions: string[];
    commonCTAs: string[];
    brandTerms: string[];
  };
  exemplarIds: string[];
  openingHooks: {
    patterns: OpeningHookPattern[];
    preferredTypes: OpeningHookType[];
    avoidTypes: OpeningHookType[];
  };
  components: {
    patterns: ComponentPattern[];
    typicalFlow: ComponentType[];
    required: ComponentType[];
    optional: ComponentType[];
  };
  voice: {
    characteristics: VoiceCharacteristic[];
    pronounUsage: { we: number; you: number; they: number; i: number };
    sentenceStarters: string[];
    transitionPhrases: string[];
    emphasisPatterns: string[];
  };
  trustSignals: {
    patterns: TrustSignal[];
    brandCredentials: string[];
    expertReferences: string[];
    certificationMentions: string[];
  };
  technicalContent: {
    chemicalFormulas: string[];
    measurementUnits: string[];
    technicalTerms: string[];
    safetyPhrases: string[];
    processDescriptions: string[];
  };
  ctaPatterns: {
    primary: string[];
    secondary: string[];
    placement: ('hero' | 'mid_content' | 'end' | 'sidebar')[];
    urgencyPhrases: string[];
    valuePhrases: string[];
  };
  seoPatterns: {
    titleFormats: string[];
    metaDescriptionFormats: string[];
    headerHierarchy: string;
    keywordPlacement: string[];
  };
}

// Inline the prompt generation functions to avoid DB imports
function generateDeepStyleGuidePrompt(profile: DeepStyleProfile): string {
  const parts: string[] = [];

  parts.push('# Alliance Chemical Writing Style Guide');
  parts.push('\nThis guide captures the authentic voice and patterns of Alliance Chemical blog content.\n');

  parts.push('## Voice & Personality\n');
  for (const char of profile.voice.characteristics) {
    parts.push(`### ${char.trait}`);
    parts.push(`${char.description}`);
    parts.push(`**Frequency:** ${char.frequency}`);
    parts.push(`**Examples:**`);
    char.examples.forEach(ex => parts.push(`- "${ex}"`));
    parts.push('');
  }

  parts.push('## Pronoun Usage\n');
  parts.push('Alliance Chemical uses a conversational mix of pronouns:');
  parts.push(`- **"We/Our/Us"**: ${profile.voice.pronounUsage.we} uses (establishes company authority)`);
  parts.push(`- **"You/Your"**: ${profile.voice.pronounUsage.you} uses (direct address to reader)`);
  parts.push(`- **"I"**: ${profile.voice.pronounUsage.i} uses (personal expertise, especially from Andre)`);
  parts.push('');

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
  parts.push('');

  parts.push('## Trust Signals\n');
  profile.trustSignals.brandCredentials.forEach(cred => {
    parts.push(`- ${cred}`);
  });
  parts.push('');

  parts.push('## Transition Phrases\n');
  profile.voice.transitionPhrases.forEach(phrase => parts.push(`- "${phrase}"`));
  parts.push('');

  parts.push('## Writing Metrics\n');
  parts.push(`- **Target word count:** ~${profile.metrics.avgWordCount} words`);
  parts.push(`- **Sections per post:** ~${profile.structure.avgSectionsPerPost}`);
  parts.push(`- **Readability level:** ${profile.metrics.readabilityLevel}`);

  return parts.join('\n');
}

function generateCondensedStylePrompt(profile: DeepStyleProfile): string {
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
${profile.trustSignals.brandCredentials.slice(0, 3).map(c => `- ${c}`).join('\n')}

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

function getComponentTemplates(): Record<string, string> {
  return {
    callout_success: '<div class="callout success"><h4>✓ [TITLE]</h4><p>[CONTENT]</p></div>',
    callout_warning: '<div class="callout warning"><h4>⚠ [TITLE]</h4><p>[CONTENT]</p></div>',
    callout_danger: '<div class="callout danger"><h4>⚠ [TITLE]</h4><p>[CONTENT]</p></div>',
    callout_info: '<div class="ac-callout"><h4>💡 [TITLE]</h4><p>[CONTENT]</p></div>',
    process_steps: '<ol class="process-steps"><li><h4>[STEP_TITLE]</h4><p>[STEP_CONTENT]</p></li></ol>',
    comparison_table: '<table><thead><tr><th>[COL1]</th><th>[COL2]</th></tr></thead><tbody>...</tbody></table>',
    credentials_box: '<div class="credentials-box">...[CREDENTIALS]...</div>',
    cta_section: '<div class="cta-section"><h2>[CTA_HEADLINE]</h2><a class="cta-button" href="[URL]">[BUTTON_TEXT]</a></div>',
    image_with_caption: '<div class="image-container"><img src="[URL]" alt="[ALT]"><p class="image-caption">[CAPTION]</p></div>',
    hero_badges: '<div class="trust-badges"><div class="badge">[BADGE_1]</div>...</div>',
    case_study: '<div class="case-study"><h4>[TITLE]</h4><div class="stats">...</div></div>',
  };
}

// Sample style profile based on the HTML examples analyzed
function getSampleStyleProfile(): DeepStyleProfile {
  return {
    // Basic profile
    tone: {
      formality: 'professional',
      voice: 'mixed',
      personality: ['authoritative', 'educational', 'helpful', 'safety-conscious'],
    },
    structure: {
      avgSectionsPerPost: 7,
      avgWordsPerSection: 250,
      usesBulletPoints: true,
      usesNumberedLists: true,
      usesTables: true,
      usesInfoBoxes: true,
      usesCTAs: true,
      avgFAQsPerPost: 0,
    },
    content: {
      includesProductLinks: true,
      includesExternalReferences: true,
      includesSafetyInfo: true,
      includesChemicalFormulas: true,
      includesPricing: false,
      targetAudience: ['industrial professionals', 'engineers', 'researchers', 'hobbyists'],
    },
    metrics: {
      avgWordCount: 2500,
      avgSentenceLength: 18,
      avgParagraphLength: 45,
      readabilityLevel: 'intermediate',
    },
    patterns: {
      commonOpenings: [
        'A few weeks ago, the phone rang...',
        'It was a Monday morning when...',
        'After 20+ years supplying...',
      ],
      commonTransitions: [
        "Here's what happens:",
        "Here's why:",
        "The bottom line:",
        "In practice,",
      ],
      commonCTAs: [
        'View Product & Get Quote',
        'Shop Now',
        'Contact Our Experts',
      ],
      brandTerms: [
        'Alliance Chemical',
        'technical grade',
        'ACS grade',
        'industrial strength',
      ],
    },
    exemplarIds: ['sample-1', 'sample-2', 'sample-3'],

    // Deep profile
    openingHooks: {
      patterns: [
        {
          type: 'story' as OpeningHookType,
          example: 'A few weeks ago, the phone rang. On the other end was John Keith, W5BWC, calling from his electronics workshop in Texas. John\'s been an Extra Class ham radio operator for decades...',
          sourcePostId: 'ferric-chloride-guide',
          sourcePostTitle: 'Ferric Chloride for PCB Etching: The Complete Guide',
        },
        {
          type: 'problem' as OpeningHookType,
          example: 'It was a Monday morning in January when the facilities manager called. Their weekend had turned into a crisis—a water-cooled chiller system had frozen during an unexpected cold snap...',
          sourcePostId: 'ethylene-glycol-guide',
          sourcePostTitle: 'Ethylene Glycol for Heat Transfer Systems',
        },
        {
          type: 'statistic' as OpeningHookType,
          example: 'The $200K coolant failure. The silent corrosion killing uptime. The contamination nobody saw coming. After 15+ years solving these problems, here\'s what really happens in production environments.',
          sourcePostId: 'data-center-cooling',
          sourcePostTitle: 'Data Center Cooling Chemistry Part 2',
        },
      ],
      preferredTypes: ['story', 'problem', 'statistic'] as OpeningHookType[],
      avoidTypes: ['definition', 'quote'] as OpeningHookType[],
    },

    components: {
      patterns: [
        {
          type: 'callout_danger' as ComponentType,
          frequency: 10,
          avgPerPost: 2,
          examples: [],
          placementNotes: ['Use for critical safety information', 'Can be used for attention-grabbing opening facts'],
        },
        {
          type: 'callout_warning' as ComponentType,
          frequency: 12,
          avgPerPost: 2.5,
          examples: [],
          placementNotes: ['Use for important cautions', 'Place before risky procedures'],
        },
        {
          type: 'callout_success' as ComponentType,
          frequency: 8,
          avgPerPost: 1.5,
          examples: [],
          placementNotes: ['Use for key benefits', 'Place after solutions'],
        },
        {
          type: 'comparison_table' as ComponentType,
          frequency: 5,
          avgPerPost: 1,
          examples: [],
          placementNotes: ['Use for product comparisons', 'Include in dedicated comparison sections'],
        },
        {
          type: 'process_steps' as ComponentType,
          frequency: 4,
          avgPerPost: 1,
          examples: [],
          placementNotes: ['Use for step-by-step procedures', 'Place in How-To sections'],
        },
        {
          type: 'credentials_box' as ComponentType,
          frequency: 3,
          avgPerPost: 1,
          examples: [],
          placementNotes: ['Establish authority', 'Place near end before CTA'],
        },
        {
          type: 'cta_section' as ComponentType,
          frequency: 3,
          avgPerPost: 1,
          examples: [],
          placementNotes: ['Place at end of article', 'Include product link'],
        },
      ],
      typicalFlow: [
        'hero_badges',
        'callout_danger',
        'image_with_caption',
        'callout_warning',
        'bullet_list',
        'comparison_table',
        'process_steps',
        'callout_success',
        'credentials_box',
        'cta_section',
      ] as ComponentType[],
      required: ['callout_warning', 'bullet_list', 'cta_section'] as ComponentType[],
      optional: ['comparison_table', 'process_steps', 'credentials_box'] as ComponentType[],
    },

    voice: {
      characteristics: [
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
      ],
      pronounUsage: { we: 45, you: 78, they: 12, i: 23 },
      sentenceStarters: [
        'This is why',
        'Here\'s what',
        'The result',
        'In practice',
        'For example',
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
        "Impact:",
        "After 20+ years",
        "Based on our experience",
      ],
      emphasisPatterns: ['Bold text for key points', 'Italics for emphasis'],
    },

    trustSignals: {
      patterns: [
        { type: 'expertise_years', examples: ['20+ years experience', 'over two decades'], frequency: 5 },
        { type: 'certifications', examples: ['ACS grade', 'USP grade', 'technical grade'], frequency: 8 },
        { type: 'safety_emphasis', examples: ['safety', 'warning', 'caution'], frequency: 15 },
      ],
      brandCredentials: [
        '20+ years supplying industrial facilities',
        'Central Texas Chemical Supplier',
        'Domestic supply chain',
        'Fast shipping nationwide',
        'Complete documentation and SDS provided',
      ],
      expertReferences: ['engineers', 'industry experts'],
      certificationMentions: ['ACS grade', 'USP grade'],
    },

    technicalContent: {
      chemicalFormulas: ['FeCl₃', 'CuCl₂', 'EG', 'pH'],
      measurementUnits: ['°F', '°C', 'ppm', 'mg/L', '%', 'cP', 'kW', 'MW'],
      technicalTerms: ['pH', 'concentration', 'viscosity', 'corrosion', 'inhibitor', 'dielectric'],
      safetyPhrases: ['PPE', 'safety glasses', 'gloves', 'ventilation', 'SDS'],
      processDescriptions: [
        'Prepare the solution by mixing...',
        'Apply using appropriate PPE...',
        'Store in a cool, dry location...',
      ],
    },

    ctaPatterns: {
      primary: ['View Product & Get Quote', 'Shop Now', 'Contact Our Experts'],
      secondary: ['Learn more about', 'Read our guide to', 'View our selection of'],
      placement: ['mid_content', 'end'],
      urgencyPhrases: ['Same-day shipping on in-stock items', 'Fast shipping nationwide'],
      valuePhrases: ['Complete documentation included', 'Technical support available'],
    },

    seoPatterns: {
      titleFormats: ['Main Topic: Subtitle', 'Guide Format', 'How-To Format'],
      metaDescriptionFormats: ['Includes expertise claim', 'Educational framing'],
      headerHierarchy: 'H1 (Title) > H2 (Main Sections) > H3 (Subsections) > H4 (Callout Headers)',
      keywordPlacement: [
        'Primary keyword in title',
        'Primary keyword in first paragraph',
        'Variations in H2 headers',
      ],
    },
  };
}

async function main() {
  console.log('🔍 Testing Deep Style Analyzer with Sample Data...\n');
  console.log('=' .repeat(60));

  try {
    // Use sample profile (simulating what would come from DB analysis)
    const profile = getSampleStyleProfile();

    console.log('\n📊 STYLE PROFILE SUMMARY\n');
    console.log('=' .repeat(60));

    // Basic metrics
    console.log('\n📏 WRITING METRICS');
    console.log(`  Average word count: ${profile.metrics.avgWordCount}`);
    console.log(`  Average sentence length: ${profile.metrics.avgSentenceLength} words`);
    console.log(`  Sections per post: ${profile.structure.avgSectionsPerPost}`);
    console.log(`  Readability level: ${profile.metrics.readabilityLevel}`);

    // Voice
    console.log('\n🗣️ VOICE CHARACTERISTICS');
    for (const char of profile.voice.characteristics) {
      console.log(`  • ${char.trait} (${char.frequency})`);
      console.log(`    ${char.description}`);
    }

    // Pronoun usage
    console.log('\n👥 PRONOUN USAGE');
    console.log(`  "We/Our/Us": ${profile.voice.pronounUsage.we} occurrences`);
    console.log(`  "You/Your": ${profile.voice.pronounUsage.you} occurrences`);
    console.log(`  "I": ${profile.voice.pronounUsage.i} occurrences`);

    // Opening hooks
    console.log('\n🎣 OPENING HOOK PATTERNS');
    console.log(`  Preferred types: ${profile.openingHooks.preferredTypes.join(', ')}`);
    if (profile.openingHooks.patterns.length > 0) {
      console.log('\n  Examples:');
      for (const pattern of profile.openingHooks.patterns.slice(0, 3)) {
        console.log(`\n  [${pattern.type}] from "${pattern.sourcePostTitle}":`);
        console.log(`    "${pattern.example.substring(0, 150)}..."`);
      }
    }

    // Components
    console.log('\n🧩 REQUIRED COMPONENTS');
    for (const comp of profile.components.required) {
      console.log(`  ✓ ${comp.replace(/_/g, ' ')}`);
    }

    console.log('\n  OPTIONAL COMPONENTS');
    for (const comp of profile.components.optional) {
      console.log(`  ○ ${comp.replace(/_/g, ' ')}`);
    }

    // Trust signals
    console.log('\n🛡️ TRUST SIGNALS');
    for (const cred of profile.trustSignals.brandCredentials) {
      console.log(`  • ${cred}`);
    }

    // Transitions
    console.log('\n🔄 TRANSITION PHRASES');
    console.log(`  ${profile.voice.transitionPhrases.slice(0, 8).join(' | ')}`);

    // CTA patterns
    console.log('\n📢 CTA PATTERNS');
    console.log('  Primary CTAs:');
    for (const cta of profile.ctaPatterns.primary.slice(0, 3)) {
      console.log(`    • "${cta}"`);
    }

    // Technical content
    console.log('\n🔬 TECHNICAL CONTENT');
    console.log(`  Terms: ${profile.technicalContent.technicalTerms.slice(0, 10).join(', ')}`);
    console.log(`  Safety: ${profile.technicalContent.safetyPhrases.join(', ')}`);

    // Generate prompts
    console.log('\n\n' + '=' .repeat(60));
    console.log('📝 GENERATED CONDENSED STYLE PROMPT');
    console.log('=' .repeat(60));
    const condensed = generateCondensedStylePrompt(profile);
    console.log(condensed);

    // Test opening hook suggestion (mock the function since it needs DB)
    console.log('\n\n' + '=' .repeat(60));
    console.log('🎯 OPENING HOOK SUGGESTIONS');
    console.log('=' .repeat(60));

    const hookSuggestions: Record<string, { type: string; suggestion: string }> = {
      'How to Use Ferric Chloride for PCB Etching': {
        type: 'problem',
        suggestion: 'Open with a specific, costly problem your readers face.',
      },
      'Ethylene Glycol vs Propylene Glycol Comparison': {
        type: 'question',
        suggestion: 'Lead with a provocative question that challenges common assumptions.',
      },
      'Sulfuric Acid Safety Guidelines': {
        type: 'bold_claim',
        suggestion: 'Start with a strong, confident statement about safety.',
      },
    };

    for (const [topic, hook] of Object.entries(hookSuggestions)) {
      console.log(`\n  Topic: "${topic}"`);
      console.log(`  Recommended hook: ${hook.type}`);
      console.log(`  Suggestion: ${hook.suggestion}`);
    }

    // Show component templates
    console.log('\n\n' + '=' .repeat(60));
    console.log('🎨 AVAILABLE COMPONENT TEMPLATES');
    console.log('=' .repeat(60));

    const templates = await getComponentTemplates();
    for (const [name, _] of Object.entries(templates)) {
      console.log(`  • ${name}`);
    }

    console.log('\n\n✅ Style analysis test complete!');
    console.log('\n📝 To generate the full style guide prompt, use:');
    console.log('   generateDeepStyleGuidePrompt(profile)');
    console.log('\n📝 For a condensed prompt (for system messages), use:');
    console.log('   generateCondensedStylePrompt(profile)');

  } catch (error) {
    console.error('❌ Error running style analysis:', error);
    process.exit(1);
  }
}

main();
