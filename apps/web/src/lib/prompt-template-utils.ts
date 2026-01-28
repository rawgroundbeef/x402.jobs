/**
 * Utilities for parsing and validating prompt template syntax.
 *
 * Prompt templates use {paramName}{/paramName} syntax to mark parameter placeholders.
 * These utilities extract, validate, and compare tags against defined parameters.
 */

/**
 * Extract parameter tag names from a system prompt.
 * Tags use the {paramName}{/paramName} syntax.
 *
 * @param systemPrompt - The system prompt text to parse
 * @returns Array of unique parameter names found in the prompt
 */
export function extractParameterTags(systemPrompt: string): string[] {
  if (!systemPrompt) return [];

  // Match {name}{/name} pattern - capture the name
  const tagRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}\{\/\1\}/g;
  const matches = new Set<string>();
  let match;

  while ((match = tagRegex.exec(systemPrompt)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
}

/**
 * Find tags in the system prompt that don't have a matching parameter definition.
 *
 * @param systemPrompt - The system prompt text
 * @param definedParams - Array of defined parameter names
 * @returns Array of tag names that are undefined
 */
export function findUndefinedTags(
  systemPrompt: string,
  definedParams: string[],
): string[] {
  const usedTags = extractParameterTags(systemPrompt);
  const definedSet = new Set(definedParams);
  return usedTags.filter((tag) => !definedSet.has(tag));
}

/**
 * Find defined parameters that aren't used in the system prompt.
 *
 * @param systemPrompt - The system prompt text
 * @param definedParams - Array of defined parameter names
 * @returns Array of parameter names that are unused
 */
export function findUnusedParameters(
  systemPrompt: string,
  definedParams: string[],
): string[] {
  const usedTags = new Set(extractParameterTags(systemPrompt));
  return definedParams.filter((param) => !usedTags.has(param));
}
