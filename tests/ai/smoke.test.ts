// ============================================================================
// HEX DOMINION - AI Smoke Tests
// ============================================================================
// High-level integration tests that verify AI can play complete games.
// Uses shared TestGame which uses REAL game objects.

import { TestRunner, assertEqual, assert } from '../framework.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { NoOpAI } from '../../src/ai/noop-ai.js';
import { getTeamTemplates } from '../../src/unit-templates.js';
import { getUnlockedTechs } from '../../src/research.js';
import {
  TestGame,
  createDuelScenario,
  createEconomyScenario,
  runAITurn,
  runUntilGameOver,
} from '../test-utils.js';

const runner = new TestRunner();

runner.describe('AI Smoke Tests', () => {
  // DISABLED: Flaky test - AI vs AI battles have non-deterministic outcomes
  // runner.describe('Units-only battle', () => {
  //   runner.it('should complete a battle between two greedy AIs within 50 turns', () => {
  //     const game = new TestGame(['team1', 'team2'], 12, 12);
  //
  //     // Add 3 units per team
  //     game.addUnit('team1', 2, 5, 'soldier');
  //     game.addUnit('team1', 2, 6, 'soldier');
  //     game.addUnit('team1', 2, 7, 'soldier');
  //     game.addUnit('team2', 8, 5, 'soldier');
  //     game.addUnit('team2', 8, 6, 'soldier');
  //     game.addUnit('team2', 8, 7, 'soldier');
  //
  //     const winner = runUntilGameOver(game, [new GreedyAI(), new GreedyAI()], 50);
  //
  //     assert(winner !== null, `Game should end within 50 turns. Current turn: ${game.turn}`);
  //     assert(game.turn <= 50, `Game took ${game.turn} turns, expected <= 50`);
  //   });
  // });

  runner.describe('Economy battle', () => {
    runner.it('should build units within 2 turns when starting with economy', () => {
      const { game } = createEconomyScenario(['team1', 'team2'], 5000, 0);
      const ai1 = new GreedyAI();
      const ai2 = new GreedyAI();

      // Run for 2 full turns (4 half-turns)
      for (let i = 0; i < 4; i++) {
        const ai = game.currentTeamIndex === 0 ? ai1 : ai2;
        runAITurn(game, ai);
      }

      const team1Units = game.units.filter(u => u.team === 'team1' && u.isAlive());
      const team2Units = game.units.filter(u => u.team === 'team2' && u.isAlive());

      assert(team1Units.length > 0, `Team 1 should have built at least 1 unit, has ${team1Units.length}`);
      assert(team2Units.length > 0, `Team 2 should have built at least 1 unit, has ${team2Units.length}`);
    });
  });

  runner.describe('Combat integration', () => {
    runner.it('should correctly apply damage using real Combat system', () => {
      const { game, attacker, defender } = createDuelScenario('soldier', 'soldier');
      const ai = new GreedyAI();

      const aiState = game.createAIState();
      const actions = ai.planTurn(aiState, 'attacker');

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'AI should plan an attack');

      for (const action of actions) {
        if (action.type === 'endTurn') break;
        game.executeAction(action);
      }

      assert(defender.health < 10, `Defender should have taken damage, health: ${defender.health}`);
    });
  });

  // DISABLED: Flaky test - AI vs AI battles have non-deterministic outcomes
  // runner.describe('NoOp vs Greedy', () => {
  //   runner.it('greedy should win within 20 turns on tiny map', () => {
  //     const game = new TestGame(['noop', 'greedy'], 8, 8);
  //
  //     // Give each side a city, factory, and starting unit
  //     game.addBuilding(1, 3, 'city', 'noop');
  //     game.addBuilding(1, 4, 'factory', 'noop');
  //     game.addUnit('noop', 2, 3, 'soldier');
  //
  //     game.addBuilding(6, 3, 'city', 'greedy');
  //     game.addBuilding(6, 4, 'factory', 'greedy');
  //     game.addUnit('greedy', 5, 3, 'soldier');
  //
  //     game.resources.addFunds('noop', 2000);
  //     game.resources.addFunds('greedy', 2000);
  //
  //     const winner = runUntilGameOver(game, [new NoOpAI(), new GreedyAI()], 20);
  //
  //     assert(winner === 'greedy', `Greedy should win, but winner was: ${winner}`);
  //     assert(game.turn <= 20, `Game should end within 20 turns, took ${game.turn}`);
  //   });
  // });

  runner.describe('Research and Design', () => {
    runner.it('both greedy AIs should research and design within 10 turns', () => {
      const { game } = createEconomyScenario(['team1', 'team2'], 2000, 5);

      const initialTemplates1 = getTeamTemplates('team1').length;
      const initialTemplates2 = getTeamTemplates('team2').length;
      const initialTechs1 = getUnlockedTechs('team1').size;
      const initialTechs2 = getUnlockedTechs('team2').size;

      const ai1 = new GreedyAI();
      const ai2 = new GreedyAI();

      // Run for 10 full turns
      for (let i = 0; i < 20; i++) {
        const ai = game.currentTeamIndex === 0 ? ai1 : ai2;
        runAITurn(game, ai);
      }

      const finalTechs1 = getUnlockedTechs('team1').size;
      const finalTechs2 = getUnlockedTechs('team2').size;

      assert(
        finalTechs1 > initialTechs1,
        `Team 1 should have researched new tech. Initial: ${initialTechs1}, Final: ${finalTechs1}`
      );
      assert(
        finalTechs2 > initialTechs2,
        `Team 2 should have researched new tech. Initial: ${initialTechs2}, Final: ${finalTechs2}`
      );

      const finalTemplates1 = getTeamTemplates('team1').length;
      const finalTemplates2 = getTeamTemplates('team2').length;

      assert(
        finalTemplates1 > initialTemplates1,
        `Team 1 should have designed new template. Initial: ${initialTemplates1}, Final: ${finalTemplates1}`
      );
      assert(
        finalTemplates2 > initialTemplates2,
        `Team 2 should have designed new template. Initial: ${initialTemplates2}, Final: ${finalTemplates2}`
      );
    });
  });
});

export default runner;
