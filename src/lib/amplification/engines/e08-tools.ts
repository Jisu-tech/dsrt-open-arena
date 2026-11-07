import type { AmplificationEngine, EngineContext, EngineResult, ToolSpec } from '../types';
import { getAllToolSpecs, ToolDefinition } from '../tools';

/**
 * E08: Tool Selection Engine
 * Evaluates the query to determine if external tools are required and injects tool schemas into the prompt.
 */
class E08ToolsEngine implements AmplificationEngine<ToolSpec[]> {
  id = 'E08';
  name = 'Tool Selection';
  description = 'Selects and injects necessary tool schemas into context based on user intent.';
  wave: 1 | 2 | 3 | 4 = 3;

  async execute(context: EngineContext): Promise<EngineResult<ToolSpec[]>> {
    const wallStart = Date.now();
    const allTools = getAllToolSpecs();

    if (allTools.length === 0) {
      return {
        success: true,
        data: [] as ToolSpec[],
        tokens_prompt: 0,
        tokens_completion: 0,
        latency_ms: Date.now() - wallStart,
      };
    }

    const query = context.userMessage ? context.userMessage.toLowerCase() : '';

    const selectedTools = allTools.filter((t: ToolDefinition) => {
      if (t.category === 'utility' || t.category === 'system') return true;
      if (t.name === 'web_search' || t.name === 'web_fetch') {
        return (
          query.includes('search') ||
          query.includes('latest') ||
          query.includes('news') ||
          query.includes('http')
        );
      }
      if (t.name === 'document_search') {
        return (
          query.includes('document') ||
          query.includes('file') ||
          query.includes('knowledge base')
        );
      }
      return true;
    });

    const toolSpecs: ToolSpec[] = selectedTools.map((t: ToolDefinition) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    return {
      success: true,
      data: toolSpecs,
      tokens_prompt: 0,
      tokens_completion: 0,
      latency_ms: Date.now() - wallStart,
    };
  }
}

export const e08ToolsEngine = new E08ToolsEngine();
export const e08Tools = e08ToolsEngine;
export default e08ToolsEngine;