#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * Generate Article CLI
 *
 * CLI script for generating Shopify-native blog articles.
 *
 * Usage:
 *   npx tsx scripts/generate-article.ts --topic "How to Dilute Sulfuric Acid" --type howto
 *   npx tsx scripts/generate-article.ts --topic "Isopropyl Alcohol vs Ethanol" --type comparison --publish false
 *   npx tsx scripts/generate-article.ts --topic "Hydrogen Peroxide Safety" --type safety --output json
 *   npx tsx scripts/generate-article.ts --outline ./outlines/sulfuric-dilution.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateArticle, generateArticleSectionBySection } from '../src/lib/shopify/article-generator';
import { validateArticle, autoFixArticle, getValidationSummary } from '../src/lib/shopify/article-validator';
import { matchTopicToProducts } from '../src/lib/shopify/product-matcher';
import { formatForCopyPaste, formatAsJson, publishGeneratedArticle, testConnection } from '../src/lib/shopify/api-client';
import { outlineToContentBrief, isOutlineFile, type OutlineFile } from '../src/lib/outline';
import type { ContentBrief, ShopifyContentType, GenerationOptions } from '../src/lib/shopify/content-types';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
  topic: string;
  type: ShopifyContentType;
  keyword?: string;
  outline?: string; // Path to outline JSON file
  output: 'copy' | 'json' | 'html' | 'file';
  publish: boolean;
  draft: boolean;
  blogId?: string;
  sectionBySection: boolean;
  autofix: boolean;
  validate: boolean;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    topic: '',
    type: 'educational',
    output: 'copy',
    publish: false,
    draft: false,
    sectionBySection: false,
    autofix: true,
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
      case '--outline':
        options.outline = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg as CLIOptions['output'];
        i++;
        break;
      case '--publish':
        options.publish = nextArg !== 'false';
        i++;
        break;
      case '--draft':
        options.draft = true;
        break;
      case '--blog-id':
        options.blogId = nextArg;
        i++;
        break;
      case '--section-by-section':
        options.sectionBySection = true;
        break;
      case '--no-autofix':
        options.autofix = false;
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
Alliance Chemical Article Generator
====================================

Generate Shopify-native blog articles with proper formatting for schema markup.

USAGE:
  npx tsx scripts/generate-article.ts --topic "Topic" --type TYPE [options]
  npx tsx scripts/generate-article.ts --outline ./outlines/topic.json [options]

REQUIRED (one of):
  --topic, -t      The topic/title for the article
  --outline        Path to outline JSON file (from generate-outline.ts)

OPTIONS:
  --type           Content type: howto, faq, comparison, technical, safety, educational
                   (auto-detected from outline if using --outline)
  --keyword, -k    Primary keyword (defaults to topic)
  --output, -o     Output format: copy (default), json, html, file
  --publish        Publish to Shopify via API (requires SHOPIFY credentials)
  --draft          Create as unpublished draft in Shopify
  --blog-id        Shopify blog ID to publish to
  --section-by-section  Generate article section by section (more control)
  --no-autofix     Skip automatic issue fixing
  --no-validate    Skip validation
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

EXAMPLES:
  # Generate a how-to article and copy to clipboard
  npx tsx scripts/generate-article.ts --topic "How to Dilute Sulfuric Acid Safely" --type howto

  # Generate FAQ article with specific keyword
  npx tsx scripts/generate-article.ts --topic "Isopropyl Alcohol" --type faq --keyword "isopropyl alcohol uses"

  # Generate from an outline file (recommended workflow)
  npx tsx scripts/generate-article.ts --outline ./outlines/sulfuric-dilution.json

  # Generate and save to file
  npx tsx scripts/generate-article.ts --topic "MEK vs Acetone" --type comparison --output file

  # Generate and publish as draft
  npx tsx scripts/generate-article.ts --topic "Hydrogen Peroxide Safety" --type safety --draft

CONTENT TYPES:
  howto       Step-by-step guides (generates HowTo schema)
  faq         Question/answer format (generates FAQPage schema)
  comparison  A vs B comparisons with tables
  technical   Detailed specifications and data
  safety      Safety-focused with warnings
  educational General informational articles

PIPELINE:
  The recommended workflow is:
    1. discover-topics.ts → Find topic ideas with E-E-A-T scoring
    2. generate-outline.ts → Create detailed outline
    3. generate-article.ts --outline → Generate article from outline
`);
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.topic && !options.outline) {
    console.error('Error: --topic or --outline is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  console.log('\n🔬 Alliance Chemical Article Generator\n');
  console.log('━'.repeat(60));

  let brief: ContentBrief;

  // Load from outline file if provided
  if (options.outline) {
    console.log('\n📄 Loading outline from:', options.outline);

    try {
      const outlineContent = fs.readFileSync(options.outline, 'utf-8');
      const outlineData = JSON.parse(outlineContent);

      if (!isOutlineFile(outlineData)) {
        console.error('   ❌ Invalid outline file format');
        process.exit(1);
      }

      brief = outlineToContentBrief(outlineData.outline);

      console.log(`   Topic: ${brief.topic}`);
      console.log(`   Type: ${brief.contentType}`);
      console.log(`   Target Words: ${brief.targetWordCount}`);
      console.log(`   Sections: ${brief.outline?.length || 0}`);
      console.log(`   FAQs: ${brief.faqSuggestions?.length || 0}`);

      // Override with CLI options if provided
      if (options.type && options.type !== 'educational') {
        brief.contentType = options.type;
      }
      if (options.keyword) {
        brief.primaryKeyword = options.keyword;
      }
    } catch (error) {
      console.error(`   ❌ Error loading outline: ${error}`);
      process.exit(1);
    }
  } else {
    // Build content brief from CLI options
    brief = {
      topic: options.topic,
      primaryKeyword: options.keyword || options.topic.toLowerCase(),
      secondaryKeywords: [],
      contentType: options.type,
      targetWordCount: getTargetWordCount(options.type),
      safetyLevel: options.type === 'safety' ? 'high' : 'standard',
    };
  }

  // Match products (only if not already in brief from outline)
  if (!brief.relatedProducts || brief.relatedProducts.length === 0) {
    console.log('\n📦 Matching relevant products...');
    const products = matchTopicToProducts(brief.topic, { maxResults: 5 });
    brief.relatedProducts = products;

    if (options.verbose) {
      console.log('   Matched products:');
      products.forEach((p) => console.log(`   - ${p.name}: ${p.url}`));
    }
  } else if (options.verbose) {
    console.log('\n📦 Products from outline:');
    brief.relatedProducts.forEach((p) => console.log(`   - ${p.name}: ${p.url}`));
  }

  // Generate article
  console.log('\n✍️  Generating article...');
  console.log(`   Type: ${brief.contentType}`);
  console.log(`   Topic: ${brief.topic}`);

  const startTime = Date.now();

  let article;
  try {
    if (options.sectionBySection) {
      article = await generateArticleSectionBySection(brief);
    } else {
      article = await generateArticle(brief);
    }
  } catch (error) {
    console.error('\n❌ Generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✓ Generated in ${generationTime}s`);

  // Auto-fix if enabled
  if (options.autofix) {
    console.log('\n🔧 Auto-fixing issues...');
    const { article: fixedArticle, fixes } = autoFixArticle(article);
    article = fixedArticle;
    if (fixes.length > 0) {
      fixes.forEach((fix) => console.log(`   ✓ ${fix}`));
    } else {
      console.log('   No fixes needed');
    }
  }

  // Validate if enabled
  if (options.validate) {
    console.log('\n🔍 Validating article...');
    const validation = validateArticle(article);
    const summary = getValidationSummary(article);

    if (validation.valid) {
      console.log('   ✓ Article is valid');
    } else {
      console.log(`   ⚠️ ${summary.errorCount} errors, ${summary.warningCount} warnings`);
    }

    if (options.verbose || !validation.valid) {
      summary.topIssues.forEach((issue) => console.log(`   ${issue}`));
    }

    if (!validation.valid && options.publish) {
      console.error('\n❌ Cannot publish: article has validation errors');
      console.log('   Fix errors or use --no-validate to skip validation');
      process.exit(1);
    }
  }

  // Show article stats
  console.log('\n📊 Article Stats:');
  console.log(`   Title: ${article.title}`);
  console.log(`   Slug: ${article.slug}`);
  console.log(`   Words: ${article.wordCount}`);
  console.log(`   Reading Time: ~${Math.ceil(article.wordCount / 200)} min`);
  console.log(`   Headings: ${article.headings.length}`);
  console.log(`   FAQs: ${article.parsedFaqs.length}`);
  console.log(`   Steps: ${article.parsedSteps.length}`);
  console.log(`   Tags: ${article.tags.join(', ')}`);

  // Handle output
  console.log('\n📤 Output:');

  switch (options.output) {
    case 'copy':
      const copyOutput = formatForCopyPaste(article);
      console.log(copyOutput);
      break;

    case 'json':
      const jsonOutput = formatAsJson(article);
      console.log(jsonOutput);
      break;

    case 'html':
      console.log(article.body);
      break;

    case 'file':
      const outputDir = path.join(process.cwd(), 'generated-articles');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${timestamp}-${article.slug}`;

      // Save HTML (raw content for Shopify)
      const htmlPath = path.join(outputDir, `${filename}.html`);
      fs.writeFileSync(htmlPath, article.body);
      console.log(`   HTML saved: ${htmlPath}`);

      // Save preview HTML (styled for local viewing)
      const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} - Preview</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #fafafa; }
    article { background: white; padding: 40px 50px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 2.2rem; line-height: 1.3; margin-bottom: 1.5rem; color: #111; }
    h2 { font-size: 1.5rem; margin-top: 2.5rem; margin-bottom: 1rem; color: #222; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h3 { font-size: 1.25rem; margin-top: 2rem; margin-bottom: 0.75rem; color: #333; }
    h4 { font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #444; }
    p { margin-bottom: 1.25rem; }
    ul, ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { font-weight: 600; }
    .callout { padding: 1rem 1.25rem; border-radius: 6px; margin: 1.5rem 0; border-left: 4px solid; }
    .callout h4 { margin-top: 0; margin-bottom: 0.5rem; font-size: 1rem; }
    .callout p:last-child { margin-bottom: 0; }
    .callout.info { background: #e7f3ff; border-color: #0066cc; }
    .callout.warning { background: #fff8e6; border-color: #f0a000; }
    .callout.danger { background: #fee; border-color: #d00; }
    .callout.success { background: #e6f7e6; border-color: #28a745; }
    table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.95rem; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #fafafa; }
    .article-meta { font-size: 0.9rem; color: #666; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e5e5; display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .faq-section { margin-top: 2rem; }
    .faq-item { margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e5e5e5; }
    .faq-question { font-weight: 600; font-size: 1.1rem; color: #222; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <article>
    <div class="article-meta">
      <span><strong>Words:</strong> ${article.wordCount}</span>
      <span><strong>Reading:</strong> ~${Math.ceil(article.wordCount / 200)} min</span>
      <span><strong>Type:</strong> ${article.contentType}</span>
      <span><strong>Model:</strong> Claude Sonnet 4.5</span>
    </div>
    <h1>${article.title}</h1>
    ${article.body}
  </article>
</body>
</html>`;
      const previewPath = path.join(outputDir, `${filename}.preview.html`);
      fs.writeFileSync(previewPath, previewHtml);
      console.log(`   Preview saved: ${previewPath}`);

      // Save JSON
      const jsonPath = path.join(outputDir, `${filename}.json`);
      fs.writeFileSync(jsonPath, formatAsJson(article));
      console.log(`   JSON saved: ${jsonPath}`);

      // Save copy-paste format
      const copyPath = path.join(outputDir, `${filename}.txt`);
      fs.writeFileSync(copyPath, formatForCopyPaste(article));
      console.log(`   Copy-paste saved: ${copyPath}`);
      break;
  }

  // Publish if requested
  if (options.publish || options.draft) {
    console.log('\n🚀 Publishing to Shopify...');

    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      console.error(`   ❌ Cannot connect to Shopify: ${connectionTest.message}`);
      process.exit(1);
    }

    const blogId = options.blogId || process.env.SHOPIFY_BLOG_ID;
    if (!blogId) {
      console.error('   ❌ No blog ID specified. Use --blog-id or set SHOPIFY_BLOG_ID');
      process.exit(1);
    }

    const result = await publishGeneratedArticle(article, {
      blogId,
      publishImmediately: options.publish && !options.draft,
    });

    if (result.success) {
      console.log(`   ✓ ${options.draft ? 'Draft created' : 'Published'}: ${result.articleId}`);
      if (result.articleUrl) {
        console.log(`   URL: ${result.articleUrl}`);
      }
    } else {
      console.error(`   ❌ Failed: ${result.error}`);
      process.exit(1);
    }
  }

  console.log('\n✅ Done!\n');
}

function getTargetWordCount(type: ShopifyContentType): number {
  switch (type) {
    case 'howto':
      return 1500;
    case 'faq':
      return 1200;
    case 'comparison':
      return 1800;
    case 'technical':
      return 2000;
    case 'safety':
      return 1500;
    default:
      return 1500;
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
