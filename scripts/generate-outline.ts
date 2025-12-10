#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * Generate Outline CLI
 *
 * CLI script for generating detailed content outlines.
 *
 * Usage:
 *   npx tsx scripts/generate-outline.ts --topic "How to Dilute Sulfuric Acid" --type howto
 *   npx tsx scripts/generate-outline.ts --topic "MEK vs Acetone" --type comparison --output file
 *   npx tsx scripts/generate-outline.ts --from-topic ./topics/topic.json
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateOutline,
  suggestFAQs,
  validateOutline,
  formatOutline,
  type ContentOutline,
  type OutlineFile,
  type OutlineGenerationOptions,
} from '../src/lib/outline';
import {
  angleToContentType,
  type TopicSuggestion,
  type ContentAngle,
  type SearchIntent,
} from '../src/lib/discovery';
import type { ShopifyContentType } from '../src/lib/shopify/content-types';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
  topic?: string;
  type: ShopifyContentType;
  keyword?: string;
  angle?: ContentAngle;
  intent?: SearchIntent;
  wordCount: number;
  faqCount: number;
  industry?: string;
  fromTopic?: string;
  existingPosts?: string;
  output: 'console' | 'json' | 'file';
  outputPath?: string;
  validate: boolean;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    type: 'educational',
    wordCount: 1500,
    faqCount: 5,
    output: 'console',
    validate: true,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--topic':
      case '-t':
        options.topic = nextArg;
        i++;
        break;
      case '--type':
        options.type = nextArg as ShopifyContentType;
        i++;
        break;
      case '--keyword':
      case '-k':
        options.keyword = nextArg;
        i++;
        break;
      case '--angle':
        options.angle = nextArg as ContentAngle;
        i++;
        break;
      case '--intent':
        options.intent = nextArg as SearchIntent;
        i++;
        break;
      case '--word-count':
      case '-w':
        options.wordCount = parseInt(nextArg, 10);
        i++;
        break;
      case '--faq-count':
      case '-f':
        options.faqCount = parseInt(nextArg, 10);
        i++;
        break;
      case '--industry':
        options.industry = nextArg;
        i++;
        break;
      case '--from-topic':
        options.fromTopic = nextArg;
        i++;
        break;
      case '--existing-posts':
      case '-e':
        options.existingPosts = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg as CLIOptions['output'];
        i++;
        break;
      case '--output-path':
        options.outputPath = nextArg;
        i++;
        break;
      case '--no-validate':
        options.validate = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Alliance Chemical Outline Generator
=====================================

Generate detailed content outlines for article planning.

USAGE:
  npx tsx scripts/generate-outline.ts --topic "Topic" --type TYPE [options]
  npx tsx scripts/generate-outline.ts --from-topic ./topics/topic.json [options]

REQUIRED (one of):
  --topic, -t        The topic/title for the article
  --from-topic       Path to a JSON file with topic suggestion

OPTIONS:
  --type             Content type: howto, faq, comparison, technical, safety, educational
  --keyword, -k      Primary keyword (defaults to topic)
  --angle            Content angle: howto, comparison, safety, technical, faq, application
  --intent           Search intent: informational, commercial, transactional
  --word-count, -w   Target word count (default: 1500)
  --faq-count, -f    Number of FAQs to include (default: 5)
  --industry         Focus industry (e.g., "water treatment")
  --existing-posts   Path to JSON file with existing posts for internal linking
  --output, -o       Output format: console (default), json, file
  --output-path      Custom output file path (with --output file)
  --no-validate      Skip outline validation
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

EXAMPLES:
  # Generate outline for a how-to article
  npx tsx scripts/generate-outline.ts --topic "How to Dilute Sulfuric Acid Safely" --type howto

  # Generate comparison outline with custom word count
  npx tsx scripts/generate-outline.ts --topic "MEK vs Acetone" --type comparison --word-count 2000

  # Generate from topic discovery output
  npx tsx scripts/generate-outline.ts --from-topic ./topics/selected-topic.json

  # Save outline to file
  npx tsx scripts/generate-outline.ts --topic "Hydrogen Peroxide Safety" --type safety --output file

  # Generate with industry focus
  npx tsx scripts/generate-outline.ts --topic "IPA Uses" --type faq --industry "electronics"

OUTPUT:
  When using --output file, outlines are saved to ./outlines/ directory as JSON files.
  These can be passed to generate-article.ts with --outline flag.
`);
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

function buildTopicSuggestion(options: CLIOptions): TopicSuggestion {
  const topic = options.topic!;
  const angle = options.angle || contentTypeToAngle(options.type);

  return {
    topic,
    primaryKeyword: options.keyword || topic.toLowerCase(),
    angle,
    searchIntent: options.intent || inferSearchIntent(angle),
    eeatScore: {
      experience: 7,
      expertise: 8,
      authority: 7,
      trust: 8,
    },
    uniqueAngle: 'Alliance Chemical perspective with 20+ years of industry experience',
    relevantProducts: [],
  };
}

function contentTypeToAngle(contentType: ShopifyContentType): ContentAngle {
  const mapping: Record<ShopifyContentType, ContentAngle> = {
    howto: 'howto',
    faq: 'faq',
    comparison: 'comparison',
    technical: 'technical',
    safety: 'safety',
    educational: 'application',
    review: 'comparison',
    news: 'application',
  };
  return mapping[contentType] || 'application';
}

function inferSearchIntent(angle: ContentAngle): SearchIntent {
  const mapping: Record<ContentAngle, SearchIntent> = {
    howto: 'informational',
    comparison: 'commercial',
    safety: 'informational',
    technical: 'informational',
    faq: 'informational',
    application: 'commercial',
  };
  return mapping[angle] || 'informational';
}

function loadTopicFromFile(filePath: string): TopicSuggestion {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);

  // Handle different formats
  if (parsed.topic && parsed.primaryKeyword) {
    return parsed as TopicSuggestion;
  }

  // Handle topics from discover-topics output
  if (parsed.topics && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
    return parsed.topics[0] as TopicSuggestion;
  }

  // Handle single topic with different structure
  if (parsed.suggestion) {
    return parsed.suggestion as TopicSuggestion;
  }

  throw new Error('Invalid topic file format');
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.topic && !options.fromTopic) {
    console.error('Error: --topic or --from-topic is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  console.log('\n📝 Alliance Chemical Outline Generator\n');
  console.log('━'.repeat(60));

  // Build topic suggestion
  let topicSuggestion: TopicSuggestion;

  if (options.fromTopic) {
    console.log(`\n📄 Loading topic from: ${options.fromTopic}`);
    try {
      topicSuggestion = loadTopicFromFile(options.fromTopic);
      console.log(`   Topic: ${topicSuggestion.topic}`);
    } catch (error) {
      console.error(`   ❌ Error loading topic: ${error}`);
      process.exit(1);
    }
  } else {
    topicSuggestion = buildTopicSuggestion(options);
  }

  // Load existing posts for internal linking
  let existingPosts: Array<{ slug: string; title: string; url: string }> = [];
  if (options.existingPosts) {
    try {
      const postsFile = fs.readFileSync(options.existingPosts, 'utf-8');
      existingPosts = JSON.parse(postsFile);
      console.log(`📄 Loaded ${existingPosts.length} existing posts for internal linking`);
    } catch (error) {
      console.warn(`⚠️  Could not load existing posts: ${error}`);
    }
  }

  // Build generation options
  const genOptions: OutlineGenerationOptions = {
    targetWordCount: options.wordCount,
    faqCount: options.faqCount,
    industryFocus: options.industry,
    existingPosts,
    includeSafety:
      options.type === 'safety' ||
      topicSuggestion.angle === 'safety' ||
      topicSuggestion.topic.toLowerCase().includes('safe'),
  };

  // Generate outline
  console.log('\n✍️  Generating outline...');
  console.log(`   Topic: ${topicSuggestion.topic}`);
  console.log(`   Type: ${options.type}`);
  console.log(`   Target Words: ${options.wordCount}`);

  const startTime = Date.now();

  let outline: ContentOutline;
  try {
    outline = await generateOutline(topicSuggestion, genOptions);
  } catch (error) {
    console.error('\n❌ Generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✓ Generated in ${generationTime}s`);

  // Validate outline
  if (options.validate) {
    console.log('\n🔍 Validating outline...');
    const validation = validateOutline(outline);

    if (validation.valid) {
      console.log('   ✓ Outline is valid');
    } else {
      console.log(`   ⚠️  ${validation.issues.length} issues found:`);
      validation.issues.forEach((issue) => console.log(`      • ${issue}`));
    }

    if (validation.warnings.length > 0 && options.verbose) {
      console.log(`   Warnings:`);
      validation.warnings.forEach((w) => console.log(`      • ${w}`));
    }

    console.log(`   Stats:`);
    console.log(`      Sections: ${validation.stats.totalSections}`);
    console.log(`      FAQs: ${validation.stats.totalFaqs}`);
    console.log(`      Est. Words: ${validation.stats.estimatedWordCount}`);
    console.log(`      E-E-A-T Elements: ${validation.stats.hasEeatElements ? 'Yes' : 'No'}`);
    console.log(`      Internal Links: ${validation.stats.hasInternalLinks ? 'Yes' : 'No'}`);
  }

  // Build output file
  const outlineFile: OutlineFile = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    outline,
    sourceTopic: {
      suggestion: {
        topic: topicSuggestion.topic,
        primaryKeyword: topicSuggestion.primaryKeyword,
        angle: topicSuggestion.angle,
        searchIntent: topicSuggestion.searchIntent,
        uniqueAngle: topicSuggestion.uniqueAngle,
      },
    },
  };

  // Output
  console.log('\n📤 Output:');

  switch (options.output) {
    case 'console':
      console.log('\n' + formatOutline(outline));
      break;

    case 'json':
      console.log(JSON.stringify(outlineFile, null, 2));
      break;

    case 'file': {
      const outputDir = path.join(process.cwd(), 'outlines');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate filename from topic
      const slug = topicSuggestion.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

      const filename = options.outputPath || path.join(outputDir, `${slug}.json`);

      fs.writeFileSync(filename, JSON.stringify(outlineFile, null, 2));
      console.log(`   Outline saved: ${filename}`);
      console.log(`\n   Use with article generator:`);
      console.log(`   npx tsx scripts/generate-article.ts --outline ${filename}`);
      break;
    }
  }

  console.log('\n✅ Done!\n');
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
