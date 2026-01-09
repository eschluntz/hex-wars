// ============================================================================
// HEX DOMINION - NoOp AI Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from '../framework.js';
import { NoOpAI } from '../../src/ai/noop-ai.js';
import { type AIContext } from '../../src/ai/controller.js';
import { type AIAction } from '../../src/ai/actions.js';
import { Pathfinder } from '../../src/pathfinder.js';

const runner = new TestRunner();

// Minimal test map
class TestMap {
  getTile(q: number, r: number) {
    return { q, r, type: 'grass' };
  }
  getAllTiles() {
    return [];
  }
}

// Create a mock AIContext that records actions
function createMockContext(): { ctx: AIContext; actions: AIAction[] } {
  const actions: AIAction[] = [];
  const testMap = new TestMap();

  const ctx: AIContext = {
    team: 'enemy',
    getUnits: () => [],
    getBuildings: () => [],
    getFunds: () => 0,
    getTemplates: () => [],
    getPathfinder: () => new Pathfinder(testMap as any),
    doAction: async (action: AIAction) => {
      actions.push(action);
    },
  };

  return { ctx, actions };
}

runner.describe('NoOpAI', () => {
  runner.describe('planTurn', () => {
    runner.it('should only return endTurn action', async () => {
      const ai = new NoOpAI();
      const { ctx, actions } = createMockContext();
      await ai.planTurn(ctx);

      assertEqual(actions.length, 1);
      assertEqual(actions[0]!.type, 'endTurn');
    });

    runner.it('should have correct id and name', () => {
      const ai = new NoOpAI();
      assertEqual(ai.id, 'noop');
      assertEqual(ai.name, 'No-Op AI');
    });
  });
});

export default runner;
