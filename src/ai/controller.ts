// ============================================================================
// HEX DOMINION - AI Controller Interface
// ============================================================================

import { type AIAction } from './actions.js';
import { type Unit } from '../unit.js';
import { type Building } from '../building.js';
import { type UnitTemplate } from '../unit-templates.js';
import { type Pathfinder } from '../pathfinder.js';

/**
 * Context passed to AI during its turn.
 * Provides query methods for current state and doAction to execute actions.
 */
export interface AIContext {
  readonly team: string;

  // Queries - always return current state
  getUnits(): readonly Unit[];
  getBuildings(): readonly Building[];
  getFunds(): number;
  getTemplates(): UnitTemplate[];
  getPathfinder(): Pathfinder;

  // Execute an action (plays animation, updates state, returns when complete)
  doAction(action: AIAction): Promise<void>;
}

export interface AIController {
  readonly id: string;
  readonly name: string;

  /**
   * Execute the AI's turn.
   * Call ctx.doAction() for each action - it executes immediately with animation.
   * State is always current after each doAction returns.
   */
  planTurn(ctx: AIContext): Promise<void>;
}
