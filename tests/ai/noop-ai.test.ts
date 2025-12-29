// ============================================================================
// HEX DOMINION - NoOp AI Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from '../framework.js';
import { NoOpAI } from '../../src/ai/noop-ai.js';
import { type AIGameState } from '../../src/ai/game-state.js';
import { ResourceManager } from '../../src/resources.js';
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
  getBuilding() {
    return undefined;
  }
  getAllBuildings() {
    return [];
  }
}

// Create a minimal mock AIGameState
function createMockState(): AIGameState {
  const resourceManager = new ResourceManager(['enemy']);
  const testMap = new TestMap();

  return {
    currentTeam: 'enemy',
    turnNumber: 1,
    units: [],
    map: testMap as any,
    buildings: [],
    resources: resourceManager,
    pathfinder: new Pathfinder(testMap as any),
    getTeamTemplates: () => [],
    getResearchedChassis: () => [],
    getResearchedWeapons: () => [],
    getResearchedSystems: () => [],
    getAvailableTechs: () => [],
  };
}

runner.describe('NoOpAI', () => {
  runner.describe('planTurn', () => {
    runner.it('should only return endTurn action', () => {
      const ai = new NoOpAI();
      const state = createMockState();
      const actions = ai.planTurn(state, 'enemy');

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
