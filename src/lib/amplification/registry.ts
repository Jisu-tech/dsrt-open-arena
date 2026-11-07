import type { AmplificationEngine } from './types';

import { e01IntentEngine } from './engines/e01-intent';
import { e02PlanningEngine } from './engines/e02-planning';
import { e03ContextEngine } from './engines/e03-context';
import { e04RetrievalEngine } from './engines/e04-retrieval';
import { e05StrategyEngine } from './engines/e05-strategy';
import { e06InstructionEngine } from './engines/e06-instruction';
import { e07OrchestrationEngine } from './engines/e07-orchestration';
import { e08ToolsEngine } from './engines/e08-tools';
import { e09RefinementEngine } from './engines/e09-refinement';
import { e10VerificationEngine } from './engines/e10-verification';
import { e11QualityEngine } from './engines/e11-quality';
import { e12CostEngine } from './engines/e12-cost';

export const WAVE1_ENGINES: AmplificationEngine[] = [
  e01IntentEngine,
  e02PlanningEngine,
  e03ContextEngine,
  e04RetrievalEngine,
];

export const WAVE2_ENGINES: AmplificationEngine[] = [
  e05StrategyEngine,
  e06InstructionEngine,
  e07OrchestrationEngine,
  e08ToolsEngine,
];

export const WAVE3_ENGINES: AmplificationEngine[] = [
  e09RefinementEngine,
  e10VerificationEngine,
  e11QualityEngine,
  e12CostEngine,
];

export const ALL_ENGINES: AmplificationEngine[] = [
  ...WAVE1_ENGINES,
  ...WAVE2_ENGINES,
  ...WAVE3_ENGINES,
];

export const ENGINE_REGISTRY: Record<string, AmplificationEngine> = Object.fromEntries(
  ALL_ENGINES.map((e) => [e.id, e])
);

export function getEngine(id: string): AmplificationEngine | undefined {
  return ENGINE_REGISTRY[id];
}