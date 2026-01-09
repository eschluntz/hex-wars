// ============================================================================
// HEX DOMINION - AI Smoke Tests
// ============================================================================
// High-level integration tests that verify AI can play complete games.
// Uses shared TestGame which uses REAL game objects.

import { TestRunner, assertEqual, assert } from '../framework.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import {
  createDuelScenario,
  createEconomyScenario,
  runAITurn,
} from '../test-utils.js';

const runner = new TestRunner();

runner.describe('AI Smoke Tests', () => {
  runner.describe('Economy battle', () => {
    runner.it('should build units within 2 turns when starting with economy', async () => {
      const { game } = createEconomyScenario(['team1', 'team2'], 5000);
      const ai1 = new GreedyAI();
      const ai2 = new GreedyAI();

      // Run for 2 full turns (4 half-turns)
      for (let i = 0; i < 4; i++) {
        const ai = game.currentTeamIndex === 0 ? ai1 : ai2;
        await runAITurn(game, ai);
      }

      const team1Units = game.units.filter(u => u.team === 'team1' && u.isAlive());
      const team2Units = game.units.filter(u => u.team === 'team2' && u.isAlive());

      assert(team1Units.length > 0, `Team 1 should have built at least 1 unit, has ${team1Units.length}`);
      assert(team2Units.length > 0, `Team 2 should have built at least 1 unit, has ${team2Units.length}`);
    });
  });

  runner.describe('Combat integration', () => {
    runner.it('should correctly apply damage using real Combat system', async () => {
      const { game, attacker, defender } = createDuelScenario('infantry', 'infantry');
      const ai = new GreedyAI();

      const { ctx, actions } = game.createAIContext();
      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'AI should plan an attack');
      assert(defender.health < 10, `Defender should have taken damage, health: ${defender.health}`);
    });
  });
});

export default runner;
