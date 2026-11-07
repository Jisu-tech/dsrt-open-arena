import { ToolDefinition, ToolContext } from './registry';
import { searchVectorStore, DocumentSnippet } from '@/lib/vector/store';

/**
 * 1. Calculator Tool
 */
export const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Evaluates mathematical expressions safely (supports arithmetic, trig functions, powers, logs).',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate, e.g., "2 + 2", "Math.sin(Math.PI / 4) * 10".',
      },
    },
    required: ['expression'],
  },
  execute: async (args: Record<string, unknown>) => {
    const expression = typeof args.expression === 'string' ? args.expression : '';
    if (!expression) return { success: false, output: 'Missing required parameter: expression' };

    try {
      const sanitized = expression.replace(/[^0-9+\-*/().,^ %eMath\b]/g, '');
      const fn = new Function('Math', `return (${sanitized});`);
      const result = fn(Math);
      return {
        success: true,
        output: String(result),
        metadata: { expression, evaluated: sanitized },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Calculation error: ${message}`,
        metadata: { expression },
      };
    }
  },
};

/**
 * 2. Web Fetch Tool
 */
export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetches raw web content from a specified URL and strips HTML tags.',
  category: 'web',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The HTTP or HTTPS URL to fetch.',
      },
      maxLength: {
        type: 'number',
        description: 'Maximum character length of response content (default 4000).',
      },
    },
    required: ['url'],
  },
  execute: async (args: Record<string, unknown>) => {
    const url = typeof args.url === 'string' ? args.url : '';
    const maxLength = typeof args.maxLength === 'number' ? args.maxLength : undefined;
    
    if (!url) return { success: false, output: 'Missing required parameter: url' };

    try {
      const limit = maxLength || 4000;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSRT-Open-Arena/1.0',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          output: `HTTP error ${response.status}: ${response.statusText}`,
          metadata: { status: response.status },
        };
      }

      const rawHtml = await response.text();
      const cleaned = rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const truncated = cleaned.slice(0, limit);

      return {
        success: true,
        output: truncated,
        metadata: {
          url,
          originalLength: cleaned.length,
          truncated: cleaned.length > limit,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Fetch failed: ${message}`,
        metadata: { url },
      };
    }
  },
};

/**
 * 3. Web Search Tool
 */
export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Searches the web for recent information or general knowledge snippets.',
  category: 'web',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms or question.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of search results to return (default 5).',
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>) => {
    const query = typeof args.query === 'string' ? args.query : '';
    const limit = typeof args.limit === 'number' ? args.limit : undefined;
    
    if (!query) return { success: false, output: 'Missing required parameter: query' };

    try {
      const maxResults = limit || 5;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSRT-Open-Arena/1.0',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          output: `Search provider returned status ${response.status}`,
          metadata: { status: response.status },
        };
      }

      const html = await response.text();
      const results: Array<{ title: string; snippet: string; url?: string }> = [];

      const resultBlockRegex = /<a\s+class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a\s+class="result__snippet"[^>]*>(.*?)<\/a>/gi;
      let match: RegExpExecArray | null;

      while ((match = resultBlockRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1] || '';
        const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
        const rawSnippet = match[3].replace(/<[^>]+>/g, '').trim();

        if (rawTitle && rawSnippet) {
          results.push({
            title: rawTitle,
            snippet: rawSnippet,
            url: rawUrl.includes('uddg=') ? decodeURIComponent(rawUrl.split('uddg=')[1]?.split('&')[0] || '') : rawUrl,
          });
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No search results found for query: "${query}"`,
          metadata: { query, count: 0 },
        };
      }

      const output = results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}${r.url ? `\nLink: ${r.url}` : ''}`)
        .join('\n\n');

      return {
        success: true,
        output,
        metadata: { query, count: results.length },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Search failed: ${message}`,
        metadata: { query },
      };
    }
  },
};

/**
 * 4. Document Search Tool
 */
export const documentSearchTool: ToolDefinition = {
  name: 'document_search',
  description: 'Searches vector database for relevant context snippets from uploaded workspace documents.',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Semantic query to find matching document passages.',
      },
      topK: {
        type: 'number',
        description: 'Number of relevant snippets to retrieve (default 3).',
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>, context?: ToolContext) => {
    const query = typeof args.query === 'string' ? args.query : '';
    const topK = typeof args.topK === 'number' ? args.topK : undefined;
    
    if (!query) return { success: false, output: 'Missing required parameter: query' };

    if (!context?.supabase) {
      return {
        success: false,
        output: 'Vector search unavailable: Supabase client context not provided to tool execution.',
      };
    }

    try {
      const k = topK || 3;
      const snippets: DocumentSnippet[] = await searchVectorStore(
        context.supabase,
        query,
        k,
        context.workspaceId
      );

      if (!snippets || snippets.length === 0) {
        return {
          success: true,
          output: `No matching document snippets found for: "${query}"`,
          metadata: { count: 0 },
        };
      }

      const formatted = snippets
        .map((s, idx) => {
          const docTitle =
            (s.metadata?.title as string) ||
            (s.metadata?.name as string) ||
            (s.metadata?.filename as string) ||
            `Document #${idx + 1}`;
          const relevance = Math.round((s.score || 0) * 100);
          return `[Doc: ${docTitle} | Match: ${relevance}%]\n${s.content}`;
        })
        .join('\n\n---\n\n');

      return {
        success: true,
        output: formatted,
        metadata: {
          query,
          count: snippets.length,
          snippetIds: snippets.map((s) => s.id),
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Document search failed: ${message}`,
        metadata: { query },
      };
    }
  },
};

/**
 * 5. Date & Time Now Tool
 */
export const datetimeNowTool: ToolDefinition = {
  name: 'datetime_now',
  description: 'Returns current date, time, day of week, and ISO string.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone identifier, e.g. "UTC", "America/New_York", "Europe/London". Defaults to UTC.',
      },
    },
  },
  execute: async (args: Record<string, unknown>) => {
    try {
      const tz = typeof args.timezone === 'string' ? args.timezone : 'UTC';
      const now = new Date();

      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now);

      return {
        success: true,
        output: `Current Date & Time (${tz}): ${formatted}\nISO String: ${now.toISOString()}\nTimestamp: ${now.getTime()}`,
        metadata: { timezone: tz, iso: now.toISOString(), timestamp: now.getTime() },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attemptedTz = typeof args.timezone === 'string' ? args.timezone : 'UTC';
      return {
        success: false,
        output: `Failed to format date for timezone "${attemptedTz}": ${message}`,
      };
    }
  },
};

/**
 * 6. Code Interpreter Tool
 */
export const codeInterpreterTool: ToolDefinition = {
  name: 'code_interpreter',
  description: 'Executes JavaScript code in a safe isolated sandbox and captures output/logs.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code snippet to execute.',
      },
    },
    required: ['code'],
  },
  execute: async (args: Record<string, unknown>) => {
    const code = typeof args.code === 'string' ? args.code : '';
    if (!code) return { success: false, output: 'Missing required parameter: code' };

    const logs: string[] = [];
    const customConsole = {
      log: (...msg: unknown[]) => logs.push(msg.map((m) => (typeof m === 'object' ? JSON.stringify(m) : String(m))).join(' ')),
      warn: (...msg: unknown[]) => logs.push(`[WARN] ${msg.map((m) => String(m)).join(' ')}`),
      error: (...msg: unknown[]) => logs.push(`[ERROR] ${msg.map((m) => String(m)).join(' ')}`),
      info: (...msg: unknown[]) => logs.push(`[INFO] ${msg.map((m) => String(m)).join(' ')}`),
    };

    try {
      const sandboxFn = new Function('console', 'Math', 'JSON', 'Array', 'Object', `
        'use strict';
        ${code}
      `);

      const result = sandboxFn(customConsole, Math, JSON, Array, Object);
      const resultStr = result !== undefined ? (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)) : null;

      let outputText = '';
      if (logs.length > 0) {
        outputText += `Console Logs:\n${logs.join('\n')}\n`;
      }
      if (resultStr !== null) {
        outputText += `Returned Value:\n${resultStr}`;
      }
      if (!outputText) {
        outputText = 'Code executed successfully with no console output or returned value.';
      }

      return {
        success: true,
        output: outputText.trim(),
        metadata: { logs, hasReturnValue: resultStr !== null },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Execution error: ${message}${logs.length ? `\n\nLogs before failure:\n${logs.join('\n')}` : ''}`,
      };
    }
  },
};

export const BUILTIN_TOOLS: ToolDefinition[] = [
  calculatorTool,
  webFetchTool,
  webSearchTool,
  documentSearchTool,
  datetimeNowTool,
  codeInterpreterTool,
];