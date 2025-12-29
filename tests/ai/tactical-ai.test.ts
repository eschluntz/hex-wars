// ============================================================================
// HEX DOMINION - Tactical AI Tests
// ============================================================================
// Unit tests for TacticalAI decision-making and head-to-head battles

import { TestRunner, assertEqual, assert } from '../framework.js';
import { TacticalAI } from '../../src/ai/tactical-ai.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { getTeamTemplates } from '../../src/unit-templates.js';
import {
  TestGame,
  createDuelScenario,
  createEconomyScenario,
  runAITurn,
  runUntilGameOver,
} from '../test-utils.js';

const runner = new TestRunner();

runner.describe('Tactical AI Unit Tests', () => {
  runner.describe('Basic Decision Making', () => {
    runner.it('should prioritize capturing buildings over attacking', () => {
      const game = new TestGame(['tactical'], 10, 10);

      // Add a capturable building and an enemy unit
      game.addBuilding(5, 5, 'city', 'enemy');
      const unit = game.addUnit('tactical', 4, 5, 'soldier');
      game.addUnit('enemy', 6, 6, 'soldier');

      const ai = new TacticalAI();
      const aiState = game.createAIState();
      const actions = ai.planTurn(aiState, 'tactical');

      // Should move to building and capture (not attack)
      const moveAction = actions.find(a => a.type === 'move');
      const captureAction = actions.find(a => a.type === 'capture');

      assert(moveAction !== undefined, 'Should plan a move action');
      assert(captureAction !== undefined, 'Should plan a capture action');
      if (moveAction && moveAction.type === 'move') {
        assertEqual(moveAction.targetQ, 5);
        assertEqual(moveAction.targetR, 5);
      }
    });

    runner.it('should focus fire on damaged units', () => {
      const game = new TestGame(['tactical'], 10, 10);

      const attacker = game.addUnit('tactical', 5, 5, 'soldier');
      const weakEnemy = game.addUnit('enemy', 6, 5, 'soldier');
      const fullEnemy = game.addUnit('enemy', 7, 5, 'soldier');

      // Damage one enemy
      weakEnemy.health = 3;

      const ai = new TacticalAI();
      const aiState = game.createAIState();
      const actions = ai.planTurn(aiState, 'tactical');

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'Should plan an attack');
      if (attackAction && attackAction.type === 'attack') {
        // Should attack the weak enemy (focus fire)
        assertEqual(attackAction.targetQ, weakEnemy.q);
        assertEqual(attackAction.targetR, weakEnemy.r);
      }
    });

    runner.it('should build stronger units when affordable', () => {
      const { game } = createEconomyScenario(['tactical', 'enemy'], 10000, 0);

      const ai = new TacticalAI();
      const aiState = game.createAIState();
      const actions = ai.planTurn(aiState, 'tactical');

      const buildActions = actions.filter(a => a.type === 'build');
      assert(buildActions.length > 0, 'Should build at least one unit');

      // With 10000 funds, should build expensive units (tank = 4000)
      const buildAction = buildActions[0];
      if (buildAction && buildAction.type === 'build') {
        const templates = getTeamTemplates('tactical');
        const template = templates.find(t => t.id === buildAction.templateId);
        assert(template !== undefined, 'Built template should exist');
        if (template) {
          // Should not build the cheapest unit (soldier = 1000)
          assert(template.cost > 1000, `Should build stronger unit, got cost ${template.cost}`);
        }
      }
    });
  });

  runner.describe('Combat Integration', () => {
    runner.it('should execute attacks correctly', () => {
      const { game, attacker, defender } = createDuelScenario('soldier', 'soldier');
      const ai = new TacticalAI();

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

  runner.describe('Performance Tests', () => {
    runner.it('should complete turn in <1s with 50 units', () => {
      const game = new TestGame(['tactical', 'enemy'], 20, 20);

      // Add 50 units total (25 per side)
      for (let i = 0; i < 25; i++) {
        game.addUnit('tactical', 2 + (i % 5), 2 + Math.floor(i / 5), 'soldier');
        game.addUnit('enemy', 15 + (i % 5), 2 + Math.floor(i / 5), 'soldier');
      }

      const ai = new TacticalAI();
      const aiState = game.createAIState();

      const startTime = performance.now();
      const actions = ai.planTurn(aiState, 'tactical');
      const endTime = performance.now();

      const duration = endTime - startTime;
      assert(duration < 1000, `Turn planning took ${duration.toFixed(2)}ms, should be < 1000ms`);
      assert(actions.length > 0, 'Should produce actions');
    });
  });
});

runner.describe('Tactical AI vs Greedy AI', () => {
  runner.it('tactical should beat greedy on small map (8x8) with equal start', () => {
    const game = new TestGame(['tactical', 'greedy'], 8, 8);

    // Equal starting positions
    game.addBuilding(1, 3, 'city', 'tactical');
    game.addBuilding(1, 4, 'factory', 'tactical');
    game.addUnit('tactical', 2, 3, 'soldier');

    game.addBuilding(6, 3, 'city', 'greedy');
    game.addBuilding(6, 4, 'factory', 'greedy');
    game.addUnit('greedy', 5, 3, 'soldier');

    game.resources.addFunds('tactical', 5000);
    game.resources.addFunds('greedy', 5000);

    const winner = runUntilGameOver(game, [new TacticalAI(), new GreedyAI()], 50);

    assert(winner !== null, 'Game should complete within 50 turns');
    assertEqual(winner, 'tactical', `Tactical AI should win, but ${winner} won`);
  });

  runner.it('tactical should beat greedy on medium map (12x12)', () => {
    const { game } = createEconomyScenario(['tactical', 'greedy'], 5000, 0);

    // Add neutral buildings in the middle
    game.addBuilding(6, 5, 'city', null);
    game.addBuilding(6, 6, 'factory', null);

    const winner = runUntilGameOver(game, [new TacticalAI(), new GreedyAI()], 60);

    assert(winner !== null, 'Game should complete within 60 turns');
    assertEqual(winner, 'tactical', `Tactical AI should win, but ${winner} won`);
  });

  runner.it('tactical should win majority of matches (5 games)', () => {
    let tacticalWins = 0;
    const numGames = 5;

    for (let i = 0; i < numGames; i++) {
      const { game } = createEconomyScenario(['tactical', 'greedy'], 5000, 0);

      // Add some variety with neutral buildings
      if (i % 2 === 0) {
        game.addBuilding(6, 3, 'city', null);
      }

      const winner = runUntilGameOver(game, [new TacticalAI(), new GreedyAI()], 50);

      if (winner === 'tactical') {
        tacticalWins++;
      }
    }

    // Tactical AI should win at least 60% of games (3 out of 5)
    assert(
      tacticalWins >= 3,
      `Tactical AI should win at least 3/5 games, won ${tacticalWins}/${numGames}`
    );
  });
});

export default runner;
