// ============================================================================
// HEX DOMINION - NoOp AI Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from '../framework.js';
import { NoOpAI } from '../../src/ai/noop-ai.js';
import { type GameStateView } from '../../src/ai/game-state.js';

const runner = new TestRunner();

// Create a minimal mock GameStateView
function createMockState(): GameStateView {
  return {
    currentTeam: 'enemy',
    turnNumber: 1,
    getTile: () => undefined,
    getAllTiles: () => [],
    getBuilding: () => undefined,
    getAllBuildings: () => [],
    getBuildingsByOwner: () => [],
    getBuildingsByType: () => [],
    getUnit: () => undefined,
    getUnitAt: () => undefined,
    getAllUnits: () => [],
    getTeamUnits: () => [],
    getActiveUnits: () => [],
    getResources: () => ({ funds: 0, science: 0 }),
    getTeamTemplates: () => [],
    getUnlockedTechs: () => new Set(),
    getAvailableTechs: () => [],
    getUnlockedChassis: () => [] as Array<{ id: string; name: string; maxWeight: number }>,
    getUnlockedWeapons: () => [] as Array<{ id: string; name: string; weight: number }>,
    getUnlockedSystems: () => [] as Array<{ id: string; name: string; weight: number; requiresChassis?: string[] }>,
    getReachablePositions: () => new Map(),
    findPath: () => null,
    calculateExpectedDamage: () => 0,
    isInRange: () => false,
    getTargetsInRange: () => [],
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
