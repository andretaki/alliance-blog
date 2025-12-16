#!/usr/bin/env npx ts-node
/**
 * Generate Blog Images Script
 *
 * Generates header images for blog articles using Google's Gemini image models.
 *
 * Usage:
 *   npx ts-node scripts/generate-image.ts --title "Article Title" --summary "Brief summary"
 *   npx ts-node scripts/generate-image.ts --prompt "Custom image prompt"
 *   npx ts-node scripts/generate-image.ts --outline outlines/my-article.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables (.env.local first, then .env as fallback)
if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  config({ path: '.env' });
}

import {
  generateBlogHeaderImage,
  generateAndSaveImage,
  generateProductImage,
  AspectRatio,
  ImageModel,
} from '../src/lib/ai/generation/images';

interface OutlineData {
  metadata: {
    title: string;
    slug: string;
    metaDescription?: string;
  };
  brief?: {
    targetKeyword?: string;
    summary?: string;
  };
}

interface CliOptions {
  title?: string;
  summary?: string;
  prompt?: string;
  outline?: string;
  output?: string;
  style?: 'photorealistic' | 'illustration' | 'infographic' | 'minimalist';
  aspectRatio?: AspectRatio;
  model?: ImageModel;
  product?: string;
  useCase?: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--title':
      case '-t':
        options.title = nextArg;
        i++;
        break;
      case '--summary':
      case '-s':
        options.summary = nextArg;
        i++;
        break;
      case '--prompt':
      case '-p':
        options.prompt = nextArg;
        i++;
        break;
      case '--outline':
      case '-o':
        options.outline = nextArg;
        i++;
        break;
      case '--output':
        options.output = nextArg;
        i++;
        break;
      case '--style':
        options.style = nextArg as CliOptions['style'];
        i++;
        break;
      case '--aspect-ratio':
      case '-ar':
        options.aspectRatio = nextArg as AspectRatio;
        i++;
        break;
      case '--model':
      case '-m':
        options.model = nextArg as ImageModel;
        i++;
        break;
      case '--product':
        options.product = nextArg;
        i++;
        break;
      case '--use-case':
        options.useCase = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Generate Blog Images Script

Usage:
  npx ts-node scripts/generate-image.ts [options]

Options:
  --title, -t        Article title (for blog header generation)
  --summary, -s      Article summary/description
  --prompt, -p       Custom image prompt (overrides title/summary)
  --outline, -o      Path to article outline JSON file
  --output           Output file path (default: generated-images/<slug>.png)
  --style            Image style: photorealistic, illustration, infographic, minimalist
  --aspect-ratio, -ar  Aspect ratio: 1:1, 16:9, 4:3, etc. (default: 16:9)
  --model, -m        Model: gemini-2.5-flash-image (fast) or gemini-3-pro-image-preview (quality)
  --product          Product name (for product image generation)
  --use-case         Product use case description
  --help, -h         Show this help message

Examples:
  # Generate from title and summary
  npx ts-node scripts/generate-image.ts --title "How to Safely Dilute Muriatic Acid" --summary "A guide to proper acid dilution techniques"

  # Generate from outline file
  npx ts-node scripts/generate-image.ts --outline outlines/muriatic-acid-guide.json

  # Custom prompt with specific style
  npx ts-node scripts/generate-image.ts --prompt "Industrial chemical laboratory with safety equipment" --style photorealistic

  # Generate product image
  npx ts-node scripts/generate-image.ts --product "Muriatic Acid 31%" --use-case "Pool pH adjustment" --summary "Industrial grade hydrochloric acid"

  # High quality with Pro model
  npx ts-node scripts/generate-image.ts --title "Chemical Safety Guide" --model gemini-3-pro-image-preview
`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

async function main(): Promise<void> {
  const options = parseArgs();

  // Check for required environment variable
  if (!process.env.GOOGLE_API_KEY) {
    console.error('Error: GOOGLE_API_KEY environment variable is not set.');
    console.error('Please add it to your .env.local file.');
    process.exit(1);
  }

  let title: string | undefined;
  let summary: string | undefined;
  let slug: string | undefined;

  // Load from outline file if provided
  if (options.outline) {
    if (!fs.existsSync(options.outline)) {
      console.error(`Error: Outline file not found: ${options.outline}`);
      process.exit(1);
    }

    const outlineData: OutlineData = JSON.parse(fs.readFileSync(options.outline, 'utf-8'));
    title = outlineData.metadata.title;
    summary = outlineData.brief?.summary || outlineData.metadata.metaDescription;
    slug = outlineData.metadata.slug;
  }

  // Override with CLI options
  if (options.title) title = options.title;
  if (options.summary) summary = options.summary;

  // Determine output path
  const outputDir = 'generated-images';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  slug = slug || (title ? slugify(title) : 'generated-image');
  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = options.output || path.join(outputDir, `${timestamp}-${slug}.png`);

  console.log('\n🎨 Generating image...\n');

  try {
    if (options.prompt) {
      // Custom prompt
      console.log(`Prompt: ${options.prompt.substring(0, 100)}...`);
      const result = await generateAndSaveImage(options.prompt, outputPath, {
        model: options.model,
        aspectRatio: options.aspectRatio || '16:9',
        imageOnly: true,
      });
      console.log(`\n✅ Image saved to: ${result.filePath}`);
      if (result.text) {
        console.log(`\nModel notes: ${result.text}`);
      }
    } else if (options.product) {
      // Product image
      console.log(`Product: ${options.product}`);
      const image = await generateProductImage(
        options.product,
        options.summary || options.product,
        options.useCase || 'Industrial use',
        {
          model: options.model,
          aspectRatio: options.aspectRatio || '4:3',
        }
      );

      // Save the image
      const imageBuffer = Buffer.from(image.data, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`\n✅ Product image saved to: ${outputPath}`);
    } else if (title && summary) {
      // Blog header image
      console.log(`Title: ${title}`);
      console.log(`Summary: ${summary.substring(0, 100)}...`);
      console.log(`Style: ${options.style || 'photorealistic'}`);

      const image = await generateBlogHeaderImage(title, summary, {
        style: options.style,
        aspectRatio: options.aspectRatio || '16:9',
        model: options.model,
      });

      // Save the image
      const imageBuffer = Buffer.from(image.data, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`\n✅ Blog header image saved to: ${outputPath}`);
    } else {
      console.error('Error: Please provide either:');
      console.error('  - --title and --summary for blog header');
      console.error('  - --prompt for custom image');
      console.error('  - --outline for outline-based generation');
      console.error('  - --product for product image');
      console.error('\nRun with --help for more information.');
      process.exit(1);
    }

    console.log(`\nModel used: ${options.model || 'gemini-2.5-flash-image'}`);
    console.log(`Aspect ratio: ${options.aspectRatio || '16:9'}`);
  } catch (error) {
    console.error('\n❌ Error generating image:', error);
    process.exit(1);
  }
}

main();
