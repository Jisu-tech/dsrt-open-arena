import type { ToolCallResult } from '../types';
import { getToolDefinition, ToolContext } from './index';

export interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  rawText: string;
}

/**
 * Parses LLM output for tool execution directives.
 * Supports multiple patterns: [TOOL: name] {json} [/TOOL] and <tool_call name="...">...</tool_call>
 */
export function parseToolDirectives(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  // Pattern 1: [TOOL: name] {"arg": "value"} [/TOOL]
  const bracketRegex = /\[TOOL:\s*([a-zA-Z0-9_-]+)\]([\s\S]*?)\[\/TOOL\]/g;
  let match: RegExpExecArray | null;
  while ((match = bracketRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const argsString = match[2].trim();
    let args: Record<string, unknown> = {};

    try {
      if (argsString) {
        args = JSON.parse(argsString);
      }
      calls.push({
        id: `call_${Math.random().toString(36).substring(2, 9)}`,
        name,
        args,
        rawText: match[0],
      });
    } catch (err) {
      console.warn(`[Tool Executor] Failed to parse JSON for tool ${name}:`, err);
    }
  }

  // Pattern 2: XML format <tool_call name="tool_name">{"arg": "value"}</tool_call>
  const xmlRegex = /<tool_call\s+name="([^"]+)">([\s\S]*?)<\/tool_call>/g;
  while ((match = xmlRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const argsString = match[2].trim();
    let args: Record<string, unknown> = {};

    try {
      if (argsString) {
        args = JSON.parse(argsString);
      }
      calls.push({
        id: `call_${Math.random().toString(36).substring(2, 9)}`,
        name,
        args,
        rawText: match[0],
      });
    } catch (err) {
      console.warn(`[Tool Executor] Failed to parse JSON for XML tool ${name}:`, err);
    }
  }

  return calls;
}

/**
 * Executes a single tool call and returns a full ToolCallResult.
 */
export async function executeToolCall(
  call: ParsedToolCall,
  context?: ToolContext
): Promise<ToolCallResult> {
  const start = Date.now();
  const tool = getToolDefinition(call.name);

  if (!tool) {
    return {
      id: call.id,
      name: call.name,
      output: '',
      success: false,
      error: `Tool execution failed: Tool "${call.name}" is not registered or unavailable.`,
      duration_ms: Date.now() - start,
    };
  }

  try {
    const result = await tool.execute(call.args, context);
    return {
      id: call.id,
      name: call.name,
      output: result.output,
      success: result.success,
      error: result.success ? undefined : (result.output || 'Tool execution failed'),
      duration_ms: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: call.id,
      name: call.name,
      output: '',
      success: false,
      error: `Tool execution threw a fatal error: ${message}`,
      duration_ms: Date.now() - start,
    };
  }
}