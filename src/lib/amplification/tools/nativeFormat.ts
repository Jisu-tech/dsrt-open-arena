import type { ToolSpec } from '../types';

/**
 * OpenAI Native Tools Format (`tools: [{ type: 'function', function: { name, description, parameters } }]`)
 */
export function toOpenAITools(specs: ToolSpec[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolSpec['parameters'];
  };
}> {
  return specs.map((spec) => ({
    type: 'function' as const,
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
    },
  }));
}

/**
 * Anthropic Native Tools Format (`tools: [{ name, description, input_schema }]`)
 */
export function toAnthropicTools(specs: ToolSpec[]): Array<{
  name: string;
  description: string;
  input_schema: ToolSpec['parameters'];
}> {
  return specs.map((spec) => ({
    name: spec.name,
    description: spec.description,
    input_schema: spec.parameters,
  }));
}

/**
 * Google Gemini Native Tools Format (`tools: [{ functionDeclarations: [{ name, description, parameters }] }]`)
 */
export function toGeminiTools(specs: ToolSpec[]): Array<{
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: ToolSpec['parameters'];
  }>;
}> {
  return [
    {
      functionDeclarations: specs.map((spec) => ({
        name: spec.name,
        description: spec.description,
        parameters: spec.parameters,
      })),
    },
  ];
}