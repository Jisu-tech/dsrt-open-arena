export interface SanitizeResult {
  cleanPrompt: string;
  flagged: boolean;
  flags: string[];
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+(?:a|an)\s+(?:evil|malicious|unrestricted)/i,
  /system\s*:\s*you\s+are/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<<SYS>>/i,
  /\bDAN\b.*\bmode\b/i,
  /do\s+anything\s+now/i,
  /jailbreak/i,
];

export function sanitizeUserInput(rawInput: string): SanitizeResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { cleanPrompt: '', flagged: false, flags: [] };
  }

  let cleanPrompt = rawInput.trim();
  const flags: string[] = [];

  // Check for injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleanPrompt)) {
      flags.push(`injection_pattern:${pattern.source.slice(0, 30)}`);
    }
  }

  // Strip control characters (keep newlines and tabs)
  cleanPrompt = cleanPrompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length (100K chars)
  if (cleanPrompt.length > 100_000) {
    cleanPrompt = cleanPrompt.slice(0, 100_000);
    flags.push('truncated:100000');
  }

  return {
    cleanPrompt,
    flagged: flags.length > 0,
    flags,
  };
}
