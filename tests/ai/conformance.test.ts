// ============================================================================
// HEX DOMINION - AI Conformance Tests
// ============================================================================
// Generic smoke tests that ALL AIs should pass (except NoOpAI).
// Ensures new AIs meet basic functionality requirements.

import { TestRunner, assert } from '../framework.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { TacticalAI } from '../../src/ai/tactical-ai.js';
import { getTeamTemplates } from '../../src/unit-templates.js';
import { getUnlockedTechs } from '../../src/research.js';
import { type AIController } from '../../src/ai/controller.js';
import {
  createEconomyScenario,
  runAITurn,
  runUntilGameOver,
} from '../test-utils.js';

const runner = new TestRunner();

// All production AIs that should pass conformance tests
const PRODUCTION_AIS: Array<{ name: string; ai: AIController }> = [
  { name: 'GreedyAI', ai: new GreedyAI() },
  { name: 'TacticalAI', ai: new TacticalAI() },
];

runner.describe('AI Conformance Tests', () => {
  for (const { name, ai } of PRODUCTION_AIS) {
    runner.describe(`${name} conformance`, () => {
      runner.it('should have valid id and name', () => {
        assert(ai.id.length > 0, `${name} should have non-empty id`);
        assert(ai.name.length > 0, `${name} should have non-empty name`);
        assert(typeof ai.planTurn === 'function', `${name} should implement planTurn`);
      });

      runner.it('should build units within 2 turns when starting with economy', () => {
        const { game } = createEconomyScenario(['team1', 'team2'], 5000, 0);
        const opponent = new GreedyAI();

        // Run for 2 full turns (4 half-turns)
        for (let i = 0; i < 4; i++) {
          const currentAI = game.currentTeamIndex === 0 ? ai : opponent;
          runAITurn(game, currentAI);
        }

        const team1Units = game.units.filter(u => u.team === 'team1' && u.isAlive());
        assert(team1Units.length > 0, `${name} should have built at least 1 unit, has ${team1Units.length}`);
      });

      runner.it('should research new tech within 10 turns with science income', () => {
        const { game } = createEconomyScenario(['team1', 'team2'], 2000, 5);
        const opponent = new GreedyAI();

        const initialTechs = getUnlockedTechs('team1').size;

        // Run for 10 full turns
        for (let i = 0; i < 20; i++) {
          const currentAI = game.currentTeamIndex === 0 ? ai : opponent;
          runAITurn(game, currentAI);
        }

        const finalTechs = getUnlockedTechs('team1').size;
        assert(
          finalTechs > initialTechs,
          `${name} should have researched new tech. Initial: ${initialTechs}, Final: ${finalTechs}`
        );
      });

      runner.it('should design new unit templates when unlocking components', () => {
        const { game } = createEconomyScenario(['team1', 'team2'], 2000, 5);
        const opponent = new GreedyAI();

        const initialTemplates = getTeamTemplates('team1').length;

        // Run for 10 full turns
        for (let i = 0; i < 20; i++) {
          const currentAI = game.currentTeamIndex === 0 ? ai : opponent;
          runAITurn(game, currentAI);
        }

        const finalTemplates = getTeamTemplates('team1').length;
        assert(
          finalTemplates > initialTemplates,
          `${name} should have designed new templates. Initial: ${initialTemplates}, Final: ${finalTemplates}`
        );
      });

      runner.it('should complete a battle within 60 turns', () => {
        const { game } = createEconomyScenario(['team1', 'team2'], 5000, 0);
        const opponent = new GreedyAI();

        const winner = runUntilGameOver(game, [ai, opponent], 60);
        assert(winner !== null, `${name} battle should complete within 60 turns, reached turn ${game.turn}`);
      });

      runner.it('should always end turn with endTurn action', () => {
        const { game } = createEconomyScenario(['team1', 'team2'], 5000, 0);
        const aiState = game.createAIState();
        const actions = ai.planTurn(aiState, 'team1');

        assert(actions.length > 0, `${name} should return at least one action`);
        const lastAction = actions[actions.length - 1];
        assert(
          lastAction?.type === 'endTurn',
          `${name} should end with endTurn action, got ${lastAction?.type}`
        );
      });

      runner.it('should handle empty game state without crashing', () => {
        const { game } = createEconomyScenario(['team1', 'team2'], 0, 0);
        // Remove all buildings
        game.map.getAllBuildings().forEach(b => b.owner = null);

        const aiState = game.createAIState();
        const actions = ai.planTurn(aiState, 'team1');

        assert(actions.length > 0, `${name} should return actions even with no resources`);
        assert(
          actions[actions.length - 1]?.type === 'endTurn',
          `${name} should still end turn even with no resources`
        );
      });
    });
  }
});

export default runner;
