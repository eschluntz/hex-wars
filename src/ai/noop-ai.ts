// ============================================================================
// HEX DOMINION - NoOp AI Controller
// ============================================================================
// Testing baseline - just ends turn without doing anything.

import { type AIController } from './controller.js';
import { type AIAction } from './actions.js';
import { type GameStateView } from './game-state.js';

export class NoOpAI implements AIController {
  readonly id = 'noop';
  readonly name = 'No-Op AI';

  planTurn(_state: GameStateView, _team: string): AIAction[] {
    return [{ type: 'endTurn' }];
  }
}
