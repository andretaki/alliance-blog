/**
 * Product Matcher
 *
 * Matches topics and content to relevant Alliance Chemical products and collections.
 * Uses keyword matching, chemical name recognition, and industry context.
 */

import type { ProductLink } from './content-types';

// ============================================================================
// COLLECTION DATA
// ============================================================================

/**
 * Alliance Chemical product collections with keywords and categories
 */
export interface CollectionData {
  handle: string;
  name: string;
  url: string;
  keywords: string[];
  chemicals: string[];
  industries: string[];
  applications: string[];
}

/**
 * Complete collection catalog from sitemap
 */
export const COLLECTIONS: CollectionData[] = [
  // === ACIDS ===
  {
    handle: 'acids',
    name: 'Acids',
    url: 'https://alliancechemical.com/collections/acids',
    keywords: ['acid', 'acidic', 'ph lower', 'corrosive'],
    chemicals: ['hydrochloric', 'sulfuric', 'nitric', 'phosphoric', 'acetic', 'citric', 'oxalic', 'boric'],
    industries: ['water treatment', 'metal finishing', 'cleaning', 'agriculture', 'food processing'],
    applications: ['ph adjustment', 'etching', 'cleaning', 'descaling', 'passivation'],
  },
  {
    handle: 'hydrochloric',
    name: 'Hydrochloric Acid',
    url: 'https://alliancechemical.com/collections/hydrochloric',
    keywords: ['hcl', 'muriatic', 'hydrochloric'],
    chemicals: ['hydrochloric acid', 'muriatic acid', 'hcl'],
    industries: ['pool', 'metal', 'cleaning', 'water treatment'],
    applications: ['ph adjustment', 'concrete etching', 'descaling', 'metal cleaning'],
  },
  {
    handle: 'sulfuric',
    name: 'Sulfuric Acid',
    url: 'https://alliancechemical.com/collections/sulfuric',
    keywords: ['sulfuric', 'battery acid', 'h2so4'],
    chemicals: ['sulfuric acid', 'battery acid', 'h2so4'],
    industries: ['automotive', 'metal finishing', 'wastewater', 'semiconductor'],
    applications: ['battery', 'anodizing', 'ph adjustment', 'dehydration', 'drain cleaning'],
  },
  {
    handle: 'nitric-acid',
    name: 'Nitric Acid',
    url: 'https://alliancechemical.com/collections/nitric-acid',
    keywords: ['nitric', 'hno3'],
    chemicals: ['nitric acid', 'hno3'],
    industries: ['semiconductor', 'metal finishing', 'precious metals', 'aerospace'],
    applications: ['passivation', 'etching', 'gold recovery', 'stainless steel'],
  },
  {
    handle: 'phosphoric-acid',
    name: 'Phosphoric Acid',
    url: 'https://alliancechemical.com/collections/phosphoric-acid',
    keywords: ['phosphoric', 'h3po4'],
    chemicals: ['phosphoric acid', 'h3po4'],
    industries: ['food', 'metal', 'agriculture', 'cleaning'],
    applications: ['rust removal', 'metal prep', 'food additive', 'fertilizer'],
  },
  {
    handle: 'organic-acids',
    name: 'Organic Acids',
    url: 'https://alliancechemical.com/collections/organic-acids',
    keywords: ['organic acid', 'acetic', 'citric', 'vinegar'],
    chemicals: ['acetic acid', 'citric acid', 'vinegar', 'lactic acid'],
    industries: ['food', 'cleaning', 'agriculture', 'winemaking'],
    applications: ['descaling', 'cleaning', 'ph adjustment', 'food preservation'],
  },
  {
    handle: 'mineral-acids',
    name: 'Mineral Acids',
    url: 'https://alliancechemical.com/collections/mineral-acids',
    keywords: ['mineral acid', 'inorganic acid'],
    chemicals: ['hydrochloric', 'sulfuric', 'nitric', 'phosphoric'],
    industries: ['industrial', 'metal finishing', 'water treatment'],
    applications: ['etching', 'cleaning', 'processing'],
  },

  // === BASES & CAUSTICS ===
  {
    handle: 'bases-and-caustics',
    name: 'Bases & Caustics',
    url: 'https://alliancechemical.com/collections/bases-and-caustics',
    keywords: ['base', 'caustic', 'alkaline', 'ph raise'],
    chemicals: ['sodium hydroxide', 'potassium hydroxide', 'ammonia'],
    industries: ['soap making', 'cleaning', 'water treatment', 'biodiesel'],
    applications: ['saponification', 'ph adjustment', 'degreasing', 'drain cleaning'],
  },
  {
    handle: 'hydroxides',
    name: 'Hydroxides',
    url: 'https://alliancechemical.com/collections/hydroxides',
    keywords: ['hydroxide', 'lye', 'caustic'],
    chemicals: ['sodium hydroxide', 'potassium hydroxide', 'calcium hydroxide', 'ammonium hydroxide'],
    industries: ['soap', 'food', 'cleaning', 'biodiesel'],
    applications: ['soap making', 'food processing', 'cleaning', 'ph adjustment'],
  },
  {
    handle: 'ammonia-products',
    name: 'Ammonia Products',
    url: 'https://alliancechemical.com/collections/ammonia-products',
    keywords: ['ammonia', 'ammonium'],
    chemicals: ['ammonia', 'ammonium hydroxide', 'aqua ammonia'],
    industries: ['cleaning', 'semiconductor', 'agriculture', 'refrigeration'],
    applications: ['cleaning', 'wafer cleaning', 'fertilizer', 'refrigerant'],
  },
  {
    handle: 'carbonates-and-related-compounds',
    name: 'Carbonates',
    url: 'https://alliancechemical.com/collections/carbonates-and-related-compounds',
    keywords: ['carbonate', 'soda ash', 'bicarbonate'],
    chemicals: ['sodium carbonate', 'soda ash', 'sodium bicarbonate', 'potassium carbonate'],
    industries: ['glass', 'cleaning', 'water treatment', 'food'],
    applications: ['water softening', 'ph adjustment', 'cleaning', 'glass making'],
  },

  // === SOLVENTS ===
  {
    handle: 'solvents',
    name: 'Solvents',
    url: 'https://alliancechemical.com/collections/solvents',
    keywords: ['solvent', 'thinner', 'degreaser', 'dissolve'],
    chemicals: ['acetone', 'mek', 'toluene', 'xylene', 'mineral spirits'],
    industries: ['coatings', 'manufacturing', 'cleaning', 'extraction'],
    applications: ['paint thinning', 'degreasing', 'extraction', 'cleaning'],
  },
  {
    handle: 'alcohols',
    name: 'Alcohols',
    url: 'https://alliancechemical.com/collections/alcohols',
    keywords: ['alcohol', 'isopropyl', 'ethanol', 'methanol', 'ipa'],
    chemicals: ['isopropyl alcohol', 'ethanol', 'methanol', 'denatured alcohol', 'ipa', 'sda'],
    industries: ['healthcare', 'electronics', 'extraction', 'cleaning', 'fuel'],
    applications: ['disinfection', 'cleaning', 'extraction', 'fuel', 'sanitizing'],
  },
  {
    handle: 'ketones',
    name: 'Ketones',
    url: 'https://alliancechemical.com/collections/ketones',
    keywords: ['ketone', 'acetone', 'mek', 'cyclohexanone'],
    chemicals: ['acetone', 'mek', 'methyl ethyl ketone', 'cyclohexanone', 'mibk'],
    industries: ['coatings', 'adhesives', 'manufacturing', '3d printing'],
    applications: ['paint stripping', 'adhesive solvent', 'cleaning', 'vapor smoothing'],
  },
  {
    handle: 'esters',
    name: 'Esters',
    url: 'https://alliancechemical.com/collections/esters',
    keywords: ['ester', 'acetate', 'ethyl acetate', 'butyl acetate'],
    chemicals: ['ethyl acetate', 'butyl acetate', 'n-butyl acetate'],
    industries: ['coatings', 'leather', 'adhesives', 'food'],
    applications: ['solvent', 'flavoring', 'coating', 'extraction'],
  },
  {
    handle: 'hydrocarbons',
    name: 'Hydrocarbons',
    url: 'https://alliancechemical.com/collections/hydrocarbons',
    keywords: ['hydrocarbon', 'toluene', 'xylene', 'hexane', 'heptane'],
    chemicals: ['toluene', 'xylene', 'hexane', 'heptane', 'naphtha'],
    industries: ['coatings', 'extraction', 'adhesives', 'fuel'],
    applications: ['solvent', 'extraction', 'paint thinning', 'degreasing'],
  },
  {
    handle: 'chlorinated-solvents',
    name: 'Chlorinated Solvents',
    url: 'https://alliancechemical.com/collections/chlorinated-solvents',
    keywords: ['chlorinated', 'tce', 'trichloroethylene', 'methylene chloride'],
    chemicals: ['trichloroethylene', 'tce', 'methylene chloride', 'perchloroethylene'],
    industries: ['aerospace', 'automotive', 'metal finishing', 'degreasing'],
    applications: ['vapor degreasing', 'cleaning', 'metal cleaning'],
  },
  {
    handle: 'citrus-solvents',
    name: 'Citrus Solvents',
    url: 'https://alliancechemical.com/collections/citrus-solvents',
    keywords: ['citrus', 'limonene', 'd-limonene', 'orange'],
    chemicals: ['d-limonene', 'orange oil', 'citrus terpene'],
    industries: ['cleaning', 'pest control', 'degreasing', 'food'],
    applications: ['degreasing', 'pest control', 'adhesive removal', 'cleaning'],
  },
  {
    handle: 'glycols-and-glycol-ethers',
    name: 'Glycols & Glycol Ethers',
    url: 'https://alliancechemical.com/collections/glycols-and-glycol-ethers',
    keywords: ['glycol', 'glycol ether', 'antifreeze', 'coolant'],
    chemicals: ['ethylene glycol', 'propylene glycol', 'glycol ether', 'butyl cellosolve'],
    industries: ['hvac', 'automotive', 'coatings', 'food'],
    applications: ['antifreeze', 'coolant', 'solvent', 'deicing'],
  },
  {
    handle: 'ethylene-glycol',
    name: 'Ethylene Glycol',
    url: 'https://alliancechemical.com/collections/ethylene-glycol',
    keywords: ['ethylene glycol', 'eg', 'antifreeze'],
    chemicals: ['ethylene glycol', 'meg', 'inhibited ethylene glycol'],
    industries: ['hvac', 'automotive', 'data center', 'aerospace'],
    applications: ['antifreeze', 'coolant', 'deicing', 'heat transfer'],
  },

  // === OXIDIZERS ===
  {
    handle: 'oxidizers-and-bleaching-agents',
    name: 'Oxidizers & Bleaching Agents',
    url: 'https://alliancechemical.com/collections/oxidizers-and-bleaching-agents',
    keywords: ['oxidizer', 'bleach', 'peroxide', 'hypochlorite'],
    chemicals: ['hydrogen peroxide', 'sodium hypochlorite', 'calcium hypochlorite'],
    industries: ['water treatment', 'cleaning', 'healthcare', 'pool'],
    applications: ['disinfection', 'bleaching', 'sanitizing', 'oxidation'],
  },
  {
    handle: 'hydrogen-peroxide-3',
    name: 'Hydrogen Peroxide',
    url: 'https://alliancechemical.com/collections/hydrogen-peroxide-3',
    keywords: ['hydrogen peroxide', 'h2o2', 'peroxide'],
    chemicals: ['hydrogen peroxide', 'h2o2'],
    industries: ['healthcare', 'semiconductor', 'water treatment', 'textile'],
    applications: ['disinfection', 'wafer cleaning', 'bleaching', 'oxidation'],
  },
  {
    handle: 'sodium-hypochlorite',
    name: 'Sodium Hypochlorite',
    url: 'https://alliancechemical.com/collections/sodium-hypochlorite',
    keywords: ['sodium hypochlorite', 'bleach', 'chlorine'],
    chemicals: ['sodium hypochlorite', 'liquid bleach', 'chlorine'],
    industries: ['water treatment', 'pool', 'cleaning', 'food'],
    applications: ['disinfection', 'sanitizing', 'water treatment', 'mold removal'],
  },

  // === SALTS & INORGANICS ===
  {
    handle: 'salts-and-inorganic-compounds',
    name: 'Salts & Inorganic Compounds',
    url: 'https://alliancechemical.com/collections/salts-and-inorganic-compounds',
    keywords: ['salt', 'inorganic', 'chloride', 'sulfate'],
    chemicals: ['sodium chloride', 'calcium chloride', 'aluminum sulfate'],
    industries: ['water treatment', 'food', 'road maintenance', 'industrial'],
    applications: ['deicing', 'water treatment', 'coagulation', 'food processing'],
  },
  {
    handle: 'chlorides',
    name: 'Chlorides',
    url: 'https://alliancechemical.com/collections/chlorides',
    keywords: ['chloride', 'ferric chloride', 'calcium chloride'],
    chemicals: ['ferric chloride', 'calcium chloride', 'sodium chloride', 'zinc chloride'],
    industries: ['water treatment', 'pcb', 'road maintenance', 'food'],
    applications: ['etching', 'coagulation', 'deicing', 'dust control'],
  },
  {
    handle: 'sulfates',
    name: 'Sulfates',
    url: 'https://alliancechemical.com/collections/sulfates',
    keywords: ['sulfate', 'aluminum sulfate', 'alum', 'copper sulfate'],
    chemicals: ['aluminum sulfate', 'alum', 'copper sulfate', 'ferrous sulfate', 'magnesium sulfate'],
    industries: ['water treatment', 'agriculture', 'pool', 'gardening'],
    applications: ['coagulation', 'algae control', 'soil amendment', 'flocculation'],
  },
  {
    handle: 'phosphates',
    name: 'Phosphates',
    url: 'https://alliancechemical.com/collections/phosphates',
    keywords: ['phosphate', 'tsp', 'trisodium phosphate'],
    chemicals: ['trisodium phosphate', 'tsp', 'sodium phosphate'],
    industries: ['cleaning', 'food', 'water treatment', 'metal prep'],
    applications: ['cleaning', 'degreasing', 'paint prep', 'water treatment'],
  },

  // === SPECIALTY ===
  {
    handle: 'water-products',
    name: 'Water Products',
    url: 'https://alliancechemical.com/collections/water-products',
    keywords: ['water', 'deionized', 'distilled', 'di water'],
    chemicals: ['deionized water', 'distilled water', 'di water', 'ultrapure water'],
    industries: ['lab', 'electronics', 'automotive', 'healthcare'],
    applications: ['lab use', 'battery', 'cooling', 'dilution'],
  },
  {
    handle: 'coolants-and-antifreeze',
    name: 'Coolants & Antifreeze',
    url: 'https://alliancechemical.com/collections/coolants-and-antifreeze',
    keywords: ['coolant', 'antifreeze', 'heat transfer'],
    chemicals: ['ethylene glycol', 'propylene glycol', 'inhibited coolant'],
    industries: ['hvac', 'automotive', 'data center', 'industrial'],
    applications: ['cooling', 'freeze protection', 'heat transfer'],
  },
  {
    handle: 'fuels-and-fuel-additives',
    name: 'Fuels & Fuel Additives',
    url: 'https://alliancechemical.com/collections/fuels-and-fuel-additives',
    keywords: ['fuel', 'kerosene', 'methanol', 'fuel additive'],
    chemicals: ['kerosene', 'methanol', 'fuel grade methanol'],
    industries: ['heating', 'racing', 'fuel cell', 'agriculture'],
    applications: ['heating', 'fuel', 'freeze branding', 'generator'],
  },
  {
    handle: 'industrial-minerals',
    name: 'Industrial Minerals',
    url: 'https://alliancechemical.com/collections/industrial-minerals',
    keywords: ['mineral', 'talc', 'vermiculite', 'silica'],
    chemicals: ['talc', 'vermiculite', 'diatomaceous earth', 'silica'],
    industries: ['aerospace', 'adhesives', 'gardening', 'cosmetics'],
    applications: ['filler', 'insulation', 'soil amendment', 'lubrication'],
  },
  {
    handle: 'cleaning-solutions',
    name: 'Cleaning Solutions',
    url: 'https://alliancechemical.com/collections/cleaning-solutions',
    keywords: ['cleaner', 'cleaning', 'wash', 'detergent'],
    chemicals: [],
    industries: ['industrial', 'automotive', 'food', 'healthcare'],
    applications: ['cleaning', 'degreasing', 'sanitizing'],
  },
  {
    handle: 'desiccants-and-drying-agents',
    name: 'Desiccants & Drying Agents',
    url: 'https://alliancechemical.com/collections/desiccants-and-drying-agents',
    keywords: ['desiccant', 'drying', 'moisture absorber'],
    chemicals: ['silica gel', 'calcium chloride', 'molecular sieve'],
    industries: ['packaging', 'lab', 'storage', 'pharmaceutical'],
    applications: ['moisture control', 'drying', 'preservation'],
  },

  // === INDUSTRY VERTICALS ===
  {
    handle: 'aviation-aerospace',
    name: 'Aviation & Aerospace',
    url: 'https://alliancechemical.com/collections/aviation-aerospace',
    keywords: ['aviation', 'aerospace', 'aircraft'],
    chemicals: [],
    industries: ['aviation', 'aerospace', 'defense'],
    applications: ['cleaning', 'deicing', 'coating', 'maintenance'],
  },
  {
    handle: 'extraction',
    name: 'Extraction',
    url: 'https://alliancechemical.com/collections/extraction',
    keywords: ['extraction', 'extract', 'botanical'],
    chemicals: ['ethanol', 'hexane', 'isopropyl alcohol'],
    industries: ['botanical', 'cannabis', 'essential oils', 'food'],
    applications: ['extraction', 'winterization', 'purification'],
  },
  {
    handle: 'water-treatment',
    name: 'Water Treatment',
    url: 'https://alliancechemical.com/collections/water-treatment',
    keywords: ['water treatment', 'municipal', 'industrial water'],
    chemicals: [],
    industries: ['municipal', 'industrial', 'wastewater'],
    applications: ['treatment', 'purification', 'disinfection'],
  },
  {
    handle: 'food-beverage',
    name: 'Food & Beverage',
    url: 'https://alliancechemical.com/collections/food-beverage',
    keywords: ['food', 'beverage', 'food grade', 'fcc'],
    chemicals: [],
    industries: ['food', 'beverage', 'brewing', 'dairy'],
    applications: ['cleaning', 'processing', 'preservation'],
  },
  {
    handle: 'healthcare',
    name: 'Healthcare',
    url: 'https://alliancechemical.com/collections/healthcare',
    keywords: ['healthcare', 'medical', 'pharmaceutical', 'usp'],
    chemicals: [],
    industries: ['healthcare', 'pharmaceutical', 'medical'],
    applications: ['disinfection', 'cleaning', 'processing'],
  },
  {
    handle: 'petroleum',
    name: 'Petroleum',
    url: 'https://alliancechemical.com/collections/petroleum',
    keywords: ['petroleum', 'oil', 'gas', 'oilfield'],
    chemicals: [],
    industries: ['oil', 'gas', 'refinery', 'pipeline'],
    applications: ['degreasing', 'cleaning', 'treating'],
  },
  {
    handle: 'botanical',
    name: 'Botanical',
    url: 'https://alliancechemical.com/collections/botanical',
    keywords: ['botanical', 'plant', 'herb', 'essential oil'],
    chemicals: [],
    industries: ['botanical', 'essential oils', 'herbal'],
    applications: ['extraction', 'distillation', 'processing'],
  },
  {
    handle: 'hemp',
    name: 'Hemp & Cannabis',
    url: 'https://alliancechemical.com/collections/hemp',
    keywords: ['hemp', 'cannabis', 'cbd', 'thc'],
    chemicals: [],
    industries: ['hemp', 'cannabis', 'cbd'],
    applications: ['extraction', 'processing', 'cultivation'],
  },
  {
    handle: 'winery',
    name: 'Winery',
    url: 'https://alliancechemical.com/collections/winery',
    keywords: ['winery', 'wine', 'brewing', 'distillery'],
    chemicals: [],
    industries: ['winery', 'brewery', 'distillery'],
    applications: ['cleaning', 'sanitizing', 'processing'],
  },
  {
    handle: 'wastewater',
    name: 'Wastewater',
    url: 'https://alliancechemical.com/collections/wastewater',
    keywords: ['wastewater', 'sewage', 'effluent'],
    chemicals: [],
    industries: ['wastewater', 'municipal', 'industrial'],
    applications: ['treatment', 'disinfection', 'ph adjustment'],
  },
];

// ============================================================================
// CHEMICAL NAME VARIATIONS
// ============================================================================

/**
 * Common chemical name variations and synonyms
 */
export const CHEMICAL_SYNONYMS: Record<string, string[]> = {
  'hydrochloric acid': ['hcl', 'muriatic acid', 'spirits of salt'],
  'sulfuric acid': ['h2so4', 'battery acid', 'vitriol', 'oil of vitriol'],
  'nitric acid': ['hno3', 'aqua fortis'],
  'phosphoric acid': ['h3po4', 'orthophosphoric acid'],
  'acetic acid': ['ethanoic acid', 'vinegar', 'glacial acetic'],
  'citric acid': ['sour salt', 'e330'],
  'sodium hydroxide': ['naoh', 'lye', 'caustic soda', 'caustic'],
  'potassium hydroxide': ['koh', 'caustic potash', 'potash lye'],
  'ammonium hydroxide': ['ammonia', 'aqua ammonia', 'nh4oh'],
  'isopropyl alcohol': ['ipa', 'isopropanol', 'rubbing alcohol', '2-propanol'],
  'ethanol': ['ethyl alcohol', 'grain alcohol', 'drinking alcohol'],
  'methanol': ['methyl alcohol', 'wood alcohol', 'meoh'],
  'denatured alcohol': ['sda', 'methylated spirits'],
  'acetone': ['propanone', 'dimethyl ketone'],
  'methyl ethyl ketone': ['mek', '2-butanone', 'butanone'],
  'toluene': ['methylbenzene', 'toluol'],
  'xylene': ['xylol', 'dimethylbenzene'],
  'hexane': ['n-hexane'],
  'ethylene glycol': ['eg', 'meg', 'monoethylene glycol', 'antifreeze'],
  'propylene glycol': ['pg', 'mpg', 'monopropylene glycol'],
  'd-limonene': ['limonene', 'orange oil', 'citrus terpene'],
  'hydrogen peroxide': ['h2o2', 'peroxide'],
  'sodium hypochlorite': ['bleach', 'liquid chlorine', 'hypo'],
  'ferric chloride': ['iron(iii) chloride', 'fecl3'],
  'calcium chloride': ['cacl2'],
  'aluminum sulfate': ['alum', 'aluminium sulfate'],
  'trichloroethylene': ['tce', 'trike', 'trichlor'],
  'sodium carbonate': ['soda ash', 'washing soda', 'na2co3'],
  'sodium bicarbonate': ['baking soda', 'nahco3', 'bicarb'],
  'deionized water': ['di water', 'demineralized water', 'dionized'],
  'distilled water': ['purified water'],
};

// ============================================================================
// MATCHING FUNCTIONS
// ============================================================================

/**
 * Match result with relevance score
 */
export interface MatchResult {
  collection: CollectionData;
  score: number;
  matchReasons: string[];
}

/**
 * Find relevant products/collections for a topic
 */
export function matchTopicToProducts(
  topic: string,
  options?: {
    industryHint?: string;
    applicationHint?: string;
    maxResults?: number;
  }
): ProductLink[] {
  const results = scoreCollections(topic, options);
  const maxResults = options?.maxResults || 5;

  return results
    .slice(0, maxResults)
    .map((result) => ({
      name: result.collection.name,
      url: result.collection.url,
      collection: result.collection.handle,
    }));
}

/**
 * Score all collections against a topic
 */
export function scoreCollections(
  topic: string,
  options?: {
    industryHint?: string;
    applicationHint?: string;
  }
): MatchResult[] {
  const normalizedTopic = topic.toLowerCase();
  const results: MatchResult[] = [];

  for (const collection of COLLECTIONS) {
    const { score, reasons } = calculateCollectionScore(
      normalizedTopic,
      collection,
      options
    );

    if (score > 0) {
      results.push({
        collection,
        score,
        matchReasons: reasons,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Calculate relevance score for a single collection
 */
function calculateCollectionScore(
  topic: string,
  collection: CollectionData,
  options?: {
    industryHint?: string;
    applicationHint?: string;
  }
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Check chemical names (highest weight)
  for (const chemical of collection.chemicals) {
    if (topic.includes(chemical.toLowerCase())) {
      score += 10;
      reasons.push(`Direct chemical match: ${chemical}`);
    }

    // Check synonyms
    const synonyms = CHEMICAL_SYNONYMS[chemical.toLowerCase()] || [];
    for (const synonym of synonyms) {
      if (topic.includes(synonym.toLowerCase())) {
        score += 8;
        reasons.push(`Chemical synonym match: ${synonym} (${chemical})`);
      }
    }
  }

  // Check keywords
  for (const keyword of collection.keywords) {
    if (topic.includes(keyword.toLowerCase())) {
      score += 5;
      reasons.push(`Keyword match: ${keyword}`);
    }
  }

  // Check applications
  for (const app of collection.applications) {
    if (topic.includes(app.toLowerCase())) {
      score += 4;
      reasons.push(`Application match: ${app}`);
    }
  }

  // Check industries
  for (const industry of collection.industries) {
    if (topic.includes(industry.toLowerCase())) {
      score += 3;
      reasons.push(`Industry match: ${industry}`);
    }
  }

  // Bonus for industry hint match
  if (options?.industryHint) {
    const hintLower = options.industryHint.toLowerCase();
    if (collection.industries.some((i) => i.toLowerCase().includes(hintLower))) {
      score += 5;
      reasons.push(`Industry hint match: ${options.industryHint}`);
    }
  }

  // Bonus for application hint match
  if (options?.applicationHint) {
    const hintLower = options.applicationHint.toLowerCase();
    if (collection.applications.some((a) => a.toLowerCase().includes(hintLower))) {
      score += 5;
      reasons.push(`Application hint match: ${options.applicationHint}`);
    }
  }

  return { score, reasons };
}

/**
 * Extract chemical names from text
 */
export function extractChemicalNames(text: string): string[] {
  const normalizedText = text.toLowerCase();
  const found: Set<string> = new Set();

  // Check all collections for chemical matches
  for (const collection of COLLECTIONS) {
    for (const chemical of collection.chemicals) {
      if (normalizedText.includes(chemical.toLowerCase())) {
        found.add(chemical);
      }
    }
  }

  // Check synonyms
  for (const [canonical, synonyms] of Object.entries(CHEMICAL_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (normalizedText.includes(synonym.toLowerCase())) {
        found.add(canonical);
      }
    }
  }

  return Array.from(found);
}

/**
 * Get collection by handle
 */
export function getCollectionByHandle(handle: string): CollectionData | undefined {
  return COLLECTIONS.find((c) => c.handle === handle);
}

/**
 * Get all industry verticals
 */
export function getIndustryVerticals(): CollectionData[] {
  return COLLECTIONS.filter((c) =>
    ['aviation-aerospace', 'extraction', 'water-treatment', 'food-beverage',
      'healthcare', 'petroleum', 'botanical', 'hemp', 'winery', 'wastewater'].includes(c.handle)
  );
}

/**
 * Get primary product collections (not industry verticals)
 */
export function getProductCollections(): CollectionData[] {
  const industryHandles = new Set([
    'aviation-aerospace', 'extraction', 'water-treatment', 'food-beverage',
    'healthcare', 'petroleum', 'botanical', 'hemp', 'winery', 'wastewater',
    'industrial-automotive', 'research-development', 'education',
    'environmental', 'government',
  ]);

  return COLLECTIONS.filter((c) => !industryHandles.has(c.handle));
}

/**
 * Format product link for natural inline use
 */
export function formatProductMention(
  productLink: ProductLink,
  context?: string
): string {
  if (context) {
    return `${context} <a href="${productLink.url}">${productLink.name}</a>`;
  }
  return `<a href="${productLink.url}">${productLink.name}</a>`;
}

/**
 * Generate product CTA based on matched products
 */
export function generateProductCTA(
  products: ProductLink[],
  ctaStyle: 'inline' | 'block' | 'section' = 'section'
): string {
  if (products.length === 0) return '';

  if (ctaStyle === 'inline' && products.length === 1) {
    return `Browse our <a href="${products[0].url}">${products[0].name}</a> for your application.`;
  }

  if (ctaStyle === 'block') {
    const links = products
      .map((p) => `<li><a href="${p.url}">${p.name}</a></li>`)
      .join('\n');
    return `
<div class="product-cta">
  <h4>Related Products</h4>
  <ul>
    ${links}
  </ul>
</div>`;
  }

  // Section style (default)
  const mainProduct = products[0];
  const additionalProducts = products.slice(1);

  let html = `
<div class="cta-section">
  <h2>Need ${mainProduct.name} for Your Application?</h2>
  <p>Alliance Chemical supplies high-quality chemicals with complete documentation and fast shipping.</p>
  <a href="${mainProduct.url}" class="cta-button">View ${mainProduct.name} Products</a>`;

  if (additionalProducts.length > 0) {
    const links = additionalProducts
      .map((p) => `<a href="${p.url}">${p.name}</a>`)
      .join(' | ');
    html += `
  <p class="related-links">Also see: ${links}</p>`;
  }

  html += `
</div>`;

  return html;
}
