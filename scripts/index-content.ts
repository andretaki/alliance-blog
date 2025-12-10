#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * Index Content CLI
 *
 * Build and manage the content index for deduplication.
 *
 * Usage:
 *   npx tsx scripts/index-content.ts              # Build/refresh index
 *   npx tsx scripts/index-content.ts --stats      # Show statistics
 *   npx tsx scripts/index-content.ts --check "Topic Title"
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  fetchExistingPosts,
  buildContentIndex,
  saveContentIndex,
  loadContentIndex,
  getContentStats,
  isDuplicateTopic,
  findRelatedPosts,
  type ContentIndex,
} from '../src/lib/discovery/existing-content';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
  rebuild: boolean;
  stats: boolean;
  check?: string;
  list: boolean;
  export?: string;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    rebuild: false,
    stats: false,
    list: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--rebuild':
      case '-r':
        options.rebuild = true;
        break;
      case '--stats':
      case '-s':
        options.stats = true;
        break;
      case '--check':
      case '-c':
        options.check = nextArg;
        i++;
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--export':
      case '-e':
        options.export = nextArg;
        i++;
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

  // Default to rebuild if no action specified
  if (!options.stats && !options.check && !options.list && !options.export) {
    options.rebuild = true;
  }

  return options;
}

function showHelp(): void {
  console.log(`
Alliance Chemical Content Index Manager
========================================

Build and manage the content index for topic deduplication.

USAGE:
  npx tsx scripts/index-content.ts [options]

ACTIONS:
  (default)          Build/refresh content index from database
  --stats, -s        Show content statistics
  --check, -c        Check if a topic is a duplicate
  --list, -l         List all indexed posts
  --export, -e       Export index to specified path

OPTIONS:
  --rebuild, -r      Force rebuild index (default action)
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

EXAMPLES:
  # Build content index from database
  npx tsx scripts/index-content.ts

  # Show statistics about indexed content
  npx tsx scripts/index-content.ts --stats

  # Check if a topic is duplicate
  npx tsx scripts/index-content.ts --check "How to Dilute Sulfuric Acid"

  # List all indexed posts
  npx tsx scripts/index-content.ts --list

  # Export index to custom location
  npx tsx scripts/index-content.ts --export ./backup/content-index.json

CACHE:
  Index is cached at ./data/content-index.json
  Cache expires after 24 hours
  Use --rebuild to force refresh
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

  console.log('\n📚 Alliance Chemical Content Index\n');
  console.log('━'.repeat(50));

  let index: ContentIndex;

  // BUILD/REBUILD INDEX
  if (options.rebuild || options.stats || options.check || options.list) {
    // Check for cached index first (unless rebuilding)
    if (!options.rebuild) {
      const cached = loadContentIndex();
      if (cached) {
        console.log(`\n📄 Using cached index (${cached.posts.length} posts)`);
        console.log(`   Last updated: ${cached.lastUpdated.toLocaleString()}`);
        index = cached;
      } else {
        console.log('\n🔄 No cache found, building from database...');
        options.rebuild = true;
      }
    }

    if (options.rebuild) {
      console.log('\n🔄 Building content index from database...');

      try {
        const posts = await fetchExistingPosts();
        console.log(`   Found ${posts.length} posts`);

        index = buildContentIndex(posts);
        saveContentIndex(index);

        console.log(`   ✓ Index built and cached`);
        console.log(`   Keywords: ${index.keywords.size}`);
        console.log(`   Chemicals: ${index.chemicals.size}`);
      } catch (error) {
        console.error(`\n❌ Error building index: ${error}`);
        console.log('\nMake sure DATABASE_URL is set in your environment.');
        process.exit(1);
      }
    }
  }

  // STATS MODE
  if (options.stats) {
    console.log('\n📊 Content Statistics\n');
    const stats = getContentStats(index!);

    console.log(`   Total Posts: ${stats.totalPosts}`);
    console.log(`   Published: ${stats.publishedPosts}`);
    console.log(`   Drafts: ${stats.draftPosts}`);
    console.log(`   Keywords Covered: ${stats.totalKeywords}`);
    console.log(`   Chemicals Covered: ${stats.totalChemicals}`);

    if (stats.chemicalCoverage.length > 0) {
      console.log(`\n   Chemicals in Index:`);
      const chemicals = stats.chemicalCoverage.slice(0, 20);
      console.log(`   ${chemicals.join(', ')}${stats.chemicalCoverage.length > 20 ? '...' : ''}`);
    }

    if (stats.recentPosts.length > 0) {
      console.log(`\n   Recent Posts:`);
      for (const post of stats.recentPosts) {
        const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft';
        console.log(`   [${date}] ${post.title}`);
      }
    }
  }

  // CHECK MODE
  if (options.check) {
    console.log(`\n🔍 Checking: "${options.check}"\n`);

    const check = isDuplicateTopic(options.check, index!, {
      strictness: 'moderate',
    });

    if (check.isDuplicate) {
      console.log(`   ❌ DUPLICATE`);
      console.log(`   Confidence: ${check.confidence}`);
      console.log(`   Reason: ${check.reason}`);
      if (check.matchedPost) {
        console.log(`\n   Matched Post:`);
        console.log(`   - Title: ${check.matchedPost.title}`);
        console.log(`   - Slug: ${check.matchedPost.slug}`);
        console.log(`   - Keyword: ${check.matchedPost.primaryKeyword}`);
      }
    } else if (check.confidence === 'possible') {
      console.log(`   ⚠️  POSSIBLE DUPLICATE`);
      console.log(`   Similarity: ${Math.round((check.similarity || 0) * 100)}%`);
      console.log(`   Reason: ${check.reason}`);
      if (check.matchedPost) {
        console.log(`\n   Similar to:`);
        console.log(`   - ${check.matchedPost.title}`);
      }
    } else {
      console.log(`   ✅ UNIQUE`);
      console.log(`   No matching content found`);
    }

    // Show related posts
    const related = findRelatedPosts(options.check, index!, 5);
    if (related.length > 0) {
      console.log(`\n   Related Posts (for internal linking):`);
      for (const post of related) {
        console.log(`   - ${post.title}`);
      }
    }
  }

  // LIST MODE
  if (options.list) {
    console.log(`\n📋 Indexed Posts (${index!.posts.length})\n`);

    // Group by status
    const published = index!.posts.filter((p) => p.status === 'published');
    const drafts = index!.posts.filter((p) => p.status === 'draft');
    const other = index!.posts.filter((p) => !['published', 'draft'].includes(p.status));

    if (published.length > 0) {
      console.log(`   Published (${published.length}):`);
      for (const post of published.slice(0, options.verbose ? undefined : 20)) {
        console.log(`   • ${post.title}`);
        if (options.verbose) {
          console.log(`     Keyword: ${post.primaryKeyword} | Slug: ${post.slug}`);
        }
      }
      if (!options.verbose && published.length > 20) {
        console.log(`   ... and ${published.length - 20} more`);
      }
    }

    if (drafts.length > 0) {
      console.log(`\n   Drafts (${drafts.length}):`);
      for (const post of drafts.slice(0, options.verbose ? undefined : 10)) {
        console.log(`   • ${post.title}`);
      }
      if (!options.verbose && drafts.length > 10) {
        console.log(`   ... and ${drafts.length - 10} more`);
      }
    }

    if (other.length > 0) {
      console.log(`\n   Other (${other.length}):`);
      for (const post of other) {
        console.log(`   • ${post.title} [${post.status}]`);
      }
    }
  }

  // EXPORT MODE
  if (options.export) {
    console.log(`\n📁 Exporting index to: ${options.export}`);

    const dir = path.dirname(options.export);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    saveContentIndex(index!, options.export);
    console.log(`   ✓ Export complete`);
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
