/**
 * Production Input Sanitizer & Prompt Injection Shield
 */

export interface SanitizationResult {
  cleanPrompt: string;
  hasSystemInjection: boolean;
  tokenEstimate: number;
  warnings: string[];
}

export function sanitizeUserInput(input: string, maxCharacters = 32000): SanitizationResult {
  const warnings: string[] = [];
  if (!input) {
    return { cleanPrompt: '', hasSystemInjection: false, tokenEstimate: 0, warnings: [] };
  }

  let truncated = input;
  if (input.length > maxCharacters) {
    truncated = input.slice(0, maxCharacters);
    warnings.push(`Input truncated from ${input.length} to ${maxCharacters} characters.`);
  }

  const injectionPatterns = [
    /ignore\s+all\s+previous\s+instructions/gi,
    /disregard\s+prior\s+system\s+prompts/gi,
    /you\s+are\s+now\s+in\s+DAN\s+mode/gi,
    /jailbreak/gi,
  ];

  let hasSystemInjection = false;
  for (const pattern of injectionPatterns) {
    if (pattern.test(truncated)) {
      hasSystemInjection = true;
      warnings.push('Potential prompt injection pattern detected and neutralized.');
      break;
    }
  }

  const cleanPrompt = truncated
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

  const tokenEstimate = Math.ceil(cleanPrompt.length / 4);

  return {
    cleanPrompt,
    hasSystemInjection,
    tokenEstimate,
    warnings,
  };
}