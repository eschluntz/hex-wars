// ============================================================================
// HEX DOMINION - NoOp AI Controller
// ============================================================================
// Testing baseline - just ends turn without doing anything.

import { type AIController, type AIContext } from './controller.js';

export class NoOpAI implements AIController {
  readonly id = 'noop';
  readonly name = 'No-Op AI';

  async planTurn(ctx: AIContext): Promise<void> {
    await ctx.doAction({ type: 'endTurn' });
  }
}
