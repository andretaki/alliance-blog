#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * Discover Topics CLI
 *
 * CLI script for discovering content gaps and generating topic ideas.
 *
 * Usage:
 *   npx tsx scripts/discover-topics.ts --collection acids --count 10
 *   npx tsx scripts/discover-topics.ts --all --min-score 60
 *   npx tsx scripts/discover-topics.ts --gaps --refresh
 *   npx tsx scripts/discover-topics.ts --check "How to Dilute Sulfuric Acid"
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateTopicIdeas,
  generateTopicIdeasWithDedup,
  suggestAngles,
  scoreEEAT,
  findContentGaps,
  findContentGapsWithDedup,
  checkTopicDuplicate,
  getCollectionHandles,
  getCollectionInfo,
  getContentIndex,
  type TopicSuggestion,
  type ContentAngle,
  type FilteredTopicsResult,
} from '../src/lib/discovery/topic-finder';
import {
  getContentStats,
} from '../src/lib/discovery/existing-content';
import {
  prioritizeTopics,
  filterByThreshold,
  groupByPriority,
  getScoringStats,
  formatScoredTopic,
  type ScoredTopic,
} from '../src/lib/discovery/topic-scorer';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
  collection?: string;
  all: boolean;
  gaps: boolean;
  count: number;
  minScore: number;
  angle?: ContentAngle;
  industry?: string;
  existingPosts?: string;
  output: 'console' | 'json' | 'file';
  verbose: boolean;
  help: boolean;
  // Deduplication options
  refresh: boolean;
  includeDuplicates: boolean;
  strictness: 'strict' | 'moderate' | 'loose';
  check?: string;
  stats: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    all: false,
    gaps: false,
    count: 5,
    minScore: 0,
    output: 'console',
    verbose: false,
    help: false,
    refresh: false,
    includeDuplicates: false,
    strictness: 'moderate',
    stats: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--collection':
      case '-c':
        options.collection = nextArg;
        i++;
        break;
      case '--all':
      case '-a':
        options.all = true;
        break;
      case '--gaps':
      case '-g':
        options.gaps = true;
        break;
      case '--count':
      case '-n':
        options.count = parseInt(nextArg, 10);
        i++;
        break;
      case '--min-score':
      case '-m':
        options.minScore = parseInt(nextArg, 10);
        i++;
        break;
      case '--angle':
        options.angle = nextArg as ContentAngle;
        i++;
        break;
      case '--industry':
        options.industry = nextArg;
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
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--refresh':
      case '-r':
        options.refresh = true;
        break;
      case '--include-duplicates':
        options.includeDuplicates = true;
        break;
      case '--strictness':
        options.strictness = nextArg as CLIOptions['strictness'];
        i++;
        break;
      case '--check':
        options.check = nextArg;
        i++;
        break;
      case '--stats':
        options.stats = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  const collections = getCollectionHandles().slice(0, 10).join(', ');

  console.log(`
Alliance Chemical Topic Discovery
==================================

Discover content gaps and generate high-E-E-A-T topic ideas.
Automatically filters out topics that match existing blog posts.

USAGE:
  npx tsx scripts/discover-topics.ts --collection HANDLE [options]
  npx tsx scripts/discover-topics.ts --all [options]
  npx tsx scripts/discover-topics.ts --gaps [options]
  npx tsx scripts/discover-topics.ts --check "Topic Title"
  npx tsx scripts/discover-topics.ts --stats

MODES:
  --collection, -c   Generate topics for a specific collection
  --all, -a          Generate topics for all product collections
  --gaps, -g         Find content gaps using database posts
  --check            Check if a specific topic is duplicate
  --stats            Show existing content statistics

OPTIONS:
  --count, -n        Number of topics to generate per collection (default: 5)
  --min-score, -m    Minimum score threshold for topics (0-100, default: 0)
  --angle            Focus on specific angle: howto, comparison, safety, technical, faq, application
  --industry         Focus on specific industry (e.g., "water treatment")
  --existing-posts   Path to JSON file with existing post titles (deprecated - uses DB)
  --output, -o       Output format: console (default), json, file
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

DEDUPLICATION:
  --refresh, -r         Rebuild content index from database (default: use cache)
  --include-duplicates  Show all topics including duplicates (for debugging)
  --strictness          Duplicate detection: strict, moderate (default), loose

COLLECTIONS:
  ${collections}... (use --all to see full list)

EXAMPLES:
  # Generate 10 unique topic ideas for acids collection
  npx tsx scripts/discover-topics.ts --collection acids --count 10

  # Refresh index and find high-priority topics
  npx tsx scripts/discover-topics.ts --all --min-score 60 --refresh

  # Check if a topic already exists
  npx tsx scripts/discover-topics.ts --check "How to Dilute Sulfuric Acid Safely"

  # View existing content statistics
  npx tsx scripts/discover-topics.ts --stats

  # Include duplicates in output (for debugging)
  npx tsx scripts/discover-topics.ts --collection solvents --include-duplicates

  # Find content gaps using database
  npx tsx scripts/discover-topics.ts --gaps --count 5
`);
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function discoverForCollection(
  handle: string,
  count: number,
  options: {
    angle?: ContentAngle;
    industry?: string;
    existingPosts?: string[];
    verbose?: boolean;
    refresh?: boolean;
    includeDuplicates?: boolean;
    strictness?: 'strict' | 'moderate' | 'loose';
  }
): Promise<{ topics: TopicSuggestion[]; filtered: FilteredTopicsResult['filtered'] }> {
  const collection = getCollectionInfo(handle);
  if (!collection) {
    console.error(`Collection not found: ${handle}`);
    return { topics: [], filtered: [] };
  }

  console.log(`\n📚 Generating topics for: ${collection.name}`);
  console.log(`   URL: ${collection.url}`);
  if (options.verbose) {
    console.log(`   Chemicals: ${collection.chemicals.join(', ')}`);
    console.log(`   Industries: ${collection.industries.join(', ')}`);
  }

  // Use deduplication-aware generation
  const result = await generateTopicIdeasWithDedup(handle, count, {
    existingPosts: options.existingPosts,
    focusAngle: options.angle,
    focusIndustry: options.industry,
    refreshIndex: options.refresh,
    excludeDuplicates: !options.includeDuplicates,
    strictness: options.strictness,
    includeRelatedPosts: true,
  });

  if (result.stats.duplicates > 0) {
    console.log(`   ⚠️  Filtered ${result.stats.duplicates} duplicate(s)`);
  }

  return { topics: result.topics, filtered: result.filtered };
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('\n🔍 Alliance Chemical Topic Discovery\n');
  console.log('━'.repeat(60));

  // STATS MODE
  if (options.stats) {
    console.log('\n📊 Existing Content Statistics\n');
    const index = await getContentIndex(options.refresh);
    const stats = getContentStats(index);

    console.log(`   Total Posts: ${stats.totalPosts}`);
    console.log(`   Published: ${stats.publishedPosts}`);
    console.log(`   Drafts: ${stats.draftPosts}`);
    console.log(`   Keywords Covered: ${stats.totalKeywords}`);
    console.log(`   Chemicals Covered: ${stats.totalChemicals}`);
    console.log(`\n   Chemicals: ${stats.chemicalCoverage.slice(0, 15).join(', ')}${stats.chemicalCoverage.length > 15 ? '...' : ''}`);

    if (stats.recentPosts.length > 0) {
      console.log(`\n   Recent Posts:`);
      for (const post of stats.recentPosts) {
        console.log(`   - ${post.title}`);
      }
    }

    console.log('\n✅ Done!\n');
    return;
  }

  // CHECK MODE
  if (options.check) {
    console.log(`\n🔍 Checking topic: "${options.check}"\n`);
    const result = await checkTopicDuplicate(options.check, {
      refreshIndex: options.refresh,
      strictness: options.strictness,
    });

    if (result.isDuplicate) {
      console.log(`   ❌ DUPLICATE (${result.confidence} confidence)`);
      console.log(`   Reason: ${result.reason}`);
      if (result.matchedPost) {
        console.log(`   Matches: "${result.matchedPost.title}"`);
        console.log(`   Slug: ${result.matchedPost.slug}`);
      }
    } else if (result.confidence === 'possible') {
      console.log(`   ⚠️  POSSIBLE DUPLICATE`);
      console.log(`   Reason: ${result.reason}`);
      if (result.matchedPost) {
        console.log(`   Similar to: "${result.matchedPost.title}"`);
      }
    } else {
      console.log(`   ✅ UNIQUE - No matching content found`);
    }

    if (result.relatedPosts.length > 0) {
      console.log(`\n   Related posts for internal linking:`);
      for (const post of result.relatedPosts) {
        console.log(`   - ${post.title}`);
      }
    }

    console.log('\n✅ Done!\n');
    return;
  }

  if (!options.collection && !options.all && !options.gaps) {
    console.error('Error: Specify --collection, --all, --gaps, --check, or --stats');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  // Load existing posts if provided (fallback, deprecated)
  let existingPosts: string[] = [];
  if (options.existingPosts) {
    try {
      const postsFile = fs.readFileSync(options.existingPosts, 'utf-8');
      const parsed = JSON.parse(postsFile);
      existingPosts = Array.isArray(parsed)
        ? parsed.map((p: unknown) => (typeof p === 'string' ? p : (p as { title: string }).title || ''))
        : [];
      console.log(`📄 Loaded ${existingPosts.length} existing posts from file`);
    } catch (error) {
      console.warn(`⚠️  Could not load existing posts: ${error}`);
    }
  }

  // Show content index status
  if (!options.existingPosts) {
    console.log('\n📊 Loading content index from database...');
    const index = await getContentIndex(options.refresh);
    const stats = getContentStats(index);
    console.log(`   ${stats.totalPosts} existing posts indexed`);
    console.log(`   ${stats.totalKeywords} keywords covered`);
    if (options.refresh) {
      console.log(`   ✓ Index refreshed`);
    }
  }

  let allTopics: TopicSuggestion[] = [];
  let allFiltered: FilteredTopicsResult['filtered'] = [];

  // GAPS MODE
  if (options.gaps) {
    console.log('\n🔬 Finding content gaps...');

    const gaps = await findContentGapsWithDedup({
      maxGaps: options.count,
      topicsPerGap: 3,
      refreshIndex: options.refresh,
      excludeDuplicates: !options.includeDuplicates,
      strictness: options.strictness,
    });

    console.log(`\n📊 Found ${gaps.length} content gaps:\n`);

    for (const gap of gaps) {
      console.log(`\n🗂️  ${gap.collection}`);
      console.log(`   ${gap.collectionUrl}`);
      console.log(`   Reason: ${gap.reason}`);
      console.log(`   Suggested Topics:`);

      for (const topic of gap.suggestedTopics) {
        console.log(`   • ${topic.topic}`);
        if (options.verbose) {
          console.log(`     Keyword: ${topic.primaryKeyword} | Angle: ${topic.angle}`);
        }
        allTopics.push(topic);
      }
    }
  }

  // SINGLE COLLECTION MODE
  else if (options.collection) {
    const result = await discoverForCollection(options.collection, options.count, {
      angle: options.angle,
      industry: options.industry,
      existingPosts,
      verbose: options.verbose,
      refresh: options.refresh,
      includeDuplicates: options.includeDuplicates,
      strictness: options.strictness,
    });
    allTopics = result.topics;
    allFiltered = result.filtered;
  }

  // ALL COLLECTIONS MODE
  else if (options.all) {
    const collections = getCollectionHandles();
    console.log(`\n📚 Generating topics for ${collections.length} collections...`);

    // Limit to avoid overwhelming the API
    const targetCollections = collections.slice(0, 10);

    for (const handle of targetCollections) {
      try {
        const result = await discoverForCollection(handle, Math.min(options.count, 3), {
          angle: options.angle,
          industry: options.industry,
          existingPosts,
          verbose: options.verbose,
          refresh: options.refresh,
          includeDuplicates: options.includeDuplicates,
          strictness: options.strictness,
        });
        allTopics.push(...result.topics);
        allFiltered.push(...result.filtered);
      } catch (error) {
        console.error(`   Error for ${handle}: ${error}`);
      }
    }

    if (collections.length > 10) {
      console.log(`\n⚠️  Limited to first 10 collections. Use --collection for specific ones.`);
    }
  }

  // Score and prioritize
  console.log('\n📊 Scoring and prioritizing topics...');
  const scoredTopics = prioritizeTopics(allTopics);

  // Filter by minimum score
  const filteredTopics =
    options.minScore > 0
      ? filterByThreshold(scoredTopics, options.minScore)
      : scoredTopics;

  // Display results
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTS: ${filteredTopics.length} unique topics (min score: ${options.minScore})`);
  if (allFiltered.length > 0) {
    console.log(`FILTERED: ${allFiltered.length} duplicate(s) removed`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  const stats = getScoringStats(filteredTopics);
  console.log(`📈 Stats:`);
  console.log(`   Total: ${stats.total} | Avg Score: ${stats.averageScore}`);
  console.log(`   🟢 High: ${stats.highPriority} | 🟡 Medium: ${stats.mediumPriority} | 🟠 Low: ${stats.lowPriority} | 🔴 Skip: ${stats.skipped}`);
  console.log('');

  // Group by priority
  const groups = groupByPriority(filteredTopics);

  if (options.output === 'console') {
    // High priority
    if (groups.high_priority.length > 0) {
      console.log('\n🟢 HIGH PRIORITY:');
      for (const topic of groups.high_priority) {
        console.log(formatScoredTopic(topic));
        console.log('');
      }
    }

    // Medium priority
    if (groups.medium_priority.length > 0) {
      console.log('\n🟡 MEDIUM PRIORITY:');
      for (const topic of groups.medium_priority) {
        console.log(formatScoredTopic(topic));
        console.log('');
      }
    }

    // Low priority (only in verbose)
    if (options.verbose && groups.low_priority.length > 0) {
      console.log('\n🟠 LOW PRIORITY:');
      for (const topic of groups.low_priority) {
        console.log(formatScoredTopic(topic));
        console.log('');
      }
    }

    // Show filtered duplicates (in verbose mode)
    if (options.verbose && allFiltered.length > 0) {
      console.log('\n❌ FILTERED (duplicates):');
      for (const { topic, reason, matchedPost } of allFiltered) {
        console.log(`   "${topic.topic}"`);
        console.log(`      Reason: ${reason}`);
        if (matchedPost) {
          console.log(`      Matches: "${matchedPost.title}"`);
        }
        console.log('');
      }
    }
  }

  // JSON output
  if (options.output === 'json') {
    const output = {
      generatedAt: new Date().toISOString(),
      stats,
      topics: filteredTopics,
      filtered: allFiltered.map(f => ({
        topic: f.topic.topic,
        reason: f.reason,
        matchedTitle: f.matchedPost?.title,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
  }

  // File output
  if (options.output === 'file') {
    const outputDir = path.join(process.cwd(), 'topics');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = options.collection
      ? `${timestamp}-${options.collection}-topics.json`
      : `${timestamp}-all-topics.json`;

    const filePath = path.join(outputDir, filename);
    const output = {
      generatedAt: new Date().toISOString(),
      stats,
      topics: filteredTopics,
      duplicatesFiltered: allFiltered.length,
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`\n📁 Saved to: ${filePath}`);
  }

  console.log('\n✅ Discovery complete!\n');
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
