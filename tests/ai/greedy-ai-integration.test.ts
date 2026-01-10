// ============================================================================
// HEX DOMINION - Greedy AI Integration Tests
// ============================================================================
// Integration tests that exercise the real AI logic without mocking.

import { TestRunner, assert } from '../framework.js';
import { TestGame, runAITurn } from '../test-utils.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { HexUtil } from '../../src/core.js';

const runner = new TestRunner();

runner.describe('GreedyAI Integration', () => {
  runner.it('should move infantry closer to unclaimed city', async () => {
    // Setup: AI team with one infantry, one neutral city
    const game = new TestGame(['ai', 'player'], 12, 12);
    const infantry = game.addUnit('ai', 2, 2, 'infantry');
    game.addBuilding(8, 8, 'city', null); // null = unclaimed

    // Record initial distance
    const initialDistance = HexUtil.distance(infantry.q, infantry.r, 8, 8);

    // Run AI turn
    const ai = new GreedyAI();
    await runAITurn(game, ai);

    // Assert infantry moved closer
    const finalDistance = HexUtil.distance(infantry.q, infantry.r, 8, 8);
    assert(
      finalDistance < initialDistance,
      `Infantry should be closer to city. Initial: ${initialDistance}, Final: ${finalDistance}`
    );
  });

  runner.it('should route two infantry to different cities', async () => {
    // Setup: two infantry in center, cities on opposite sides
    // Right city at distance 6, left city at distance 8
    const game = new TestGame(['ai', 'player'], 20, 12);
    const infantry1 = game.addUnit('ai', 10, 5, 'infantry');
    const infantry2 = game.addUnit('ai', 10, 6, 'infantry');
    game.addBuilding(16, 5, 'city', null); // right city, distance 6
    game.addBuilding(2, 5, 'city', null); // left city, distance 8

    // Run AI turn
    const ai = new GreedyAI();
    await runAITurn(game, ai);

    // Infantry should split: one moves right (q > 10), one moves left (q < 10)
    const positions = [infantry1.q, infantry2.q];
    const movedRight = positions.some(q => q > 10);
    const movedLeft = positions.some(q => q < 10);

    assert(
      movedRight && movedLeft,
      `Infantry should split toward different cities. Positions: (${infantry1.q},${infantry1.r}) and (${infantry2.q},${infantry2.r})`
    );
  });
});

export default runner;
