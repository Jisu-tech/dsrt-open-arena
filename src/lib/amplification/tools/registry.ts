import { SupabaseClient } from '@supabase/supabase-js';

export type ToolCategory = 'utility' | 'search' | 'retrieval' | 'code' | 'system' | 'web' | 'data';

export interface ToolContext {
  supabase?: SupabaseClient;
  workspaceId?: string;
  conversationId?: string;
  userId?: string;
  providerKeys?: Record<string, string>;
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category?: ToolCategory;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  // Fixed: Replaced `args: any` with strict `Record<string, unknown>`
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<ToolExecutionResult>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export const globalToolRegistry = new ToolRegistry();