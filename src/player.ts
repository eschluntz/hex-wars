// ============================================================================
// HEX DOMINION - Player Module
// ============================================================================

import { type AIController } from './ai/controller.js';

export type PlayerType = 'human' | 'ai';

export interface Player {
  id: string;           // e.g., 'player', 'enemy'
  name: string;
  type: PlayerType;
  aiController?: AIController;
}

export interface PlayerConfig {
  id: string;
  name: string;
  type: PlayerType;
  aiType?: string;      // e.g., 'greedy', 'noop' - used to look up AI from registry
}
