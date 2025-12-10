import 'dotenv/config';
import { analyzeWritingStyle, generateStyleGuidePrompt } from '../src/lib/ai/analysis/style-analyzer';

async function run() {
  console.log('Analyzing your blog writing style...\n');

  const profile = await analyzeWritingStyle({ limit: 50 });

  console.log('=== STYLE PROFILE ===\n');

  console.log('📝 TONE:');
  console.log(`  Formality: ${profile.tone.formality}`);
  console.log(`  Voice: ${profile.tone.voice}`);
  console.log(`  Personality: ${profile.tone.personality.join(', ')}`);

  console.log('\n📐 STRUCTURE:');
  console.log(`  Avg sections/post: ${profile.structure.avgSectionsPerPost}`);
  console.log(`  Avg words/section: ${profile.structure.avgWordsPerSection}`);
  console.log(`  Uses bullet points: ${profile.structure.usesBulletPoints}`);
  console.log(`  Uses numbered lists: ${profile.structure.usesNumberedLists}`);
  console.log(`  Uses tables: ${profile.structure.usesTables}`);
  console.log(`  Uses info boxes: ${profile.structure.usesInfoBoxes}`);
  console.log(`  Uses CTAs: ${profile.structure.usesCTAs}`);
  console.log(`  Avg FAQs/post: ${profile.structure.avgFAQsPerPost}`);

  console.log('\n📊 CONTENT PATTERNS:');
  console.log(`  Product links: ${profile.content.includesProductLinks}`);
  console.log(`  External refs: ${profile.content.includesExternalReferences}`);
  console.log(`  Safety info: ${profile.content.includesSafetyInfo}`);
  console.log(`  Chemical formulas: ${profile.content.includesChemicalFormulas}`);
  console.log(`  Target audience: ${profile.content.targetAudience.join(', ')}`);

  console.log('\n📈 METRICS:');
  console.log(`  Avg word count: ${profile.metrics.avgWordCount}`);
  console.log(`  Avg sentence length: ${profile.metrics.avgSentenceLength} words`);
  console.log(`  Avg paragraph length: ${profile.metrics.avgParagraphLength} words`);
  console.log(`  Readability: ${profile.metrics.readabilityLevel}`);

  console.log('\n🏷️ BRAND TERMS:');
  console.log(`  ${profile.patterns.brandTerms.join(', ')}`);

  console.log('\n⭐ TOP EXEMPLAR POST IDs:');
  profile.exemplarIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));

  console.log('\n\n=== GENERATED STYLE GUIDE ===\n');
  console.log(generateStyleGuidePrompt(profile));

  process.exit(0);
}

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
