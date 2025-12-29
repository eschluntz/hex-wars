// ============================================================================
// HEX DOMINION - AI Registry
// ============================================================================
// Central registry for AI controller types, allowing easy instantiation by name.

import { type AIController } from './controller.js';
import { NoOpAI } from './noop-ai.js';
import { GreedyAI } from './greedy-ai.js';
import { TacticalAI } from './tactical-ai.js';

type AIFactory = () => AIController;

const AI_REGISTRY: Record<string, AIFactory> = {
  noop: () => new NoOpAI(),
  greedy: () => new GreedyAI(),
  tactical: () => new TacticalAI(),
};

export function createAI(type: string): AIController {
  const factory = AI_REGISTRY[type];
  if (!factory) {
    throw new Error(`Unknown AI type: ${type}. Available: ${Object.keys(AI_REGISTRY).join(', ')}`);
  }
  return factory();
}

export function getAvailableAITypes(): string[] {
  return Object.keys(AI_REGISTRY);
}
