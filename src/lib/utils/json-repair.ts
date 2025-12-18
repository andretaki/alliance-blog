/**
 * JSON Repair Utility
 * Robust JSON parsing for AI-generated content
 */

import { jsonrepair } from 'jsonrepair';

/**
 * Extract JSON from AI response text
 * Handles markdown code blocks, extra text, etc.
 */
export function extractJson(text: string): string {
  let jsonStr = text.trim();

  // Remove markdown code block wrapper if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  // Try to find JSON object in the text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Try to find JSON array
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Return as-is if no match
  return jsonStr;
}

/**
 * Parse AI response with repair fallback
 */
export function parseAIResponse<T>(text: string): T {
  // 1. Extract JSON from response
  const jsonStr = extractJson(text);

  // 2. Try direct parse first
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // 3. Attempt repair
    try {
      const repaired = jsonrepair(jsonStr);
      return JSON.parse(repaired) as T;
    } catch (repairError) {
      // 4. Log for debugging
      console.error('JSON repair failed. Original text:', jsonStr.slice(0, 500));
      throw new Error(
        `Failed to parse JSON response: ${repairError instanceof Error ? repairError.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Safe JSON parse with default value
 */
export function safeParseJson<T>(text: string, defaultValue: T): T {
  try {
    return parseAIResponse<T>(text);
  } catch {
    return defaultValue;
  }
}

/**
 * Validate and parse JSON with type guard
 */
export function parseAndValidate<T>(
  text: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const data = parseAIResponse<unknown>(text);
    if (validator(data)) {
      return data;
    }
    console.error('Validation failed for parsed JSON');
    return null;
  } catch {
    return null;
  }
}
