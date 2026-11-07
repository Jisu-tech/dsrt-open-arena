import { globalToolRegistry, ToolDefinition, ToolContext, ToolExecutionResult } from './registry';
import { BUILTIN_TOOLS } from './builtin';

// Automatically register all production built-in tools
BUILTIN_TOOLS.forEach((tool) => {
  if (!globalToolRegistry.has(tool.name)) {
    globalToolRegistry.register(tool);
  }
});

// Export bridged functions to fix import errors across the application
export const getAllToolSpecs = (): ToolDefinition[] => globalToolRegistry.getAll();
export const getToolDefinition = (name: string): ToolDefinition | undefined => globalToolRegistry.get(name);
export const hasTool = (name: string): boolean => globalToolRegistry.has(name);

// Re-export core types and the registry itself
export { globalToolRegistry };
export type { ToolDefinition, ToolContext, ToolExecutionResult };