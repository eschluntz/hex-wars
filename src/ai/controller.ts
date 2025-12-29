// ============================================================================
// HEX DOMINION - AI Controller Interface
// ============================================================================

import { type AIAction } from './actions.js';
import { type GameStateView } from './game-state.js';

export interface AIController {
  readonly id: string;
  readonly name: string;

  /**
   * Plan all actions for the current turn.
   * Returns a list of actions to execute in order, ending with 'endTurn'.
   */
  planTurn(state: GameStateView, team: string): AIAction[];

  /**
   * Optional callback when a tech is unlocked (for reactive AI behavior).
   */
  onTechUnlocked?(state: GameStateView, team: string, techId: string): AIAction[];
}
