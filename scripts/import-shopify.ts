import 'dotenv/config';
import { importFromShopify } from '../src/lib/import/pipeline';
import { clearStyleCache } from '../src/lib/ai/generation/style-aware-prompts';

const AUTHOR_ID = '2549bf2d-38b3-42a4-87d7-39aa4225ae97';

async function runImport() {
  const store = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const analyzeStyle = process.argv.includes('--analyze-style');

  if (!store || !accessToken) {
    console.error('Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN');
    process.exit(1);
  }

  console.log(`Importing blogs from ${store}...`);

  const result = await importFromShopify(store, accessToken, {
    defaultAuthorId: AUTHOR_ID,
    limit: 100, // Import up to 100 posts
  });

  console.log('\n=== Import Results ===');
  console.log(`Success: ${result.success}`);
  console.log(`Posts Created: ${result.postsCreated}`);
  console.log(`Posts Updated: ${result.postsUpdated}`);
  console.log(`Posts Failed: ${result.postsFailed}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log(`- ${e.url}: ${e.error}`));
  }

  // Clear the style cache after import so new posts are included in next analysis
  console.log('\nClearing style analysis cache...');
  clearStyleCache();

  // Optionally run style analysis after import
  if (analyzeStyle && result.postsCreated > 0) {
    console.log('\n=== Running Style Analysis ===');
    try {
      const { analyzeDeepStyle, generateCondensedStylePrompt } = await import('../src/lib/ai/analysis/style-analyzer');
      const profile = await analyzeDeepStyle({ limit: 20 });

      console.log('\nStyle Profile Summary:');
      console.log(`- Opening hook types preferred: ${profile.openingHooks.preferredTypes.join(', ')}`);
      console.log(`- Voice characteristics: ${profile.voice.characteristics.map(c => c.trait).join(', ')}`);
      console.log(`- Required components: ${profile.components.required.join(', ')}`);
      console.log(`- Average word count: ${profile.metrics.avgWordCount}`);

      console.log('\nCondensed style prompt generated successfully.');
      console.log('Use getStyleProfile() to access the cached profile in your application.');
    } catch (error) {
      console.error('Style analysis failed:', error);
    }
  }

  process.exit(0);
}

runImport().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});
