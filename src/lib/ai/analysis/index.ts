/**
 * Style Analysis Module
 *
 * Provides writing style analysis for AI content generation.
 * Two analyzers are available:
 *
 * 1. DOM-based analyzer (recommended) - Uses cheerio for proper HTML parsing
 *    - More accurate component detection
 *    - Proper status filtering
 *    - Scoped to article content only
 *
 * 2. Legacy regex-based analyzer - Original implementation
 *    - Faster but less accurate
 *    - May include header/footer content
 */

// DOM-based analyzer (recommended)
export {
  analyzeStyleWithDOM,
  type StyleProfileData,
  type AnalyzeStyleOptions,
  type OpeningHookType,
  type ComponentType,
} from './dom-style-analyzer';

// Legacy analyzer (for backwards compatibility)
export {
  analyzeWritingStyle,
  analyzeDeepStyle,
  generateStyleGuidePrompt,
  generateDeepStyleGuidePrompt,
  generateCondensedStylePrompt,
  type StyleProfile,
  type DeepStyleProfile,
  type OpeningHookPattern,
  type ComponentPattern,
  type VoiceCharacteristic,
  type TrustSignal,
} from './style-analyzer';

// Re-export types with aliases for clarity
export type {
  OpeningHookType as HookType,
  ComponentType as UIComponentType,
} from './dom-style-analyzer';
