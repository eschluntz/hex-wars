// ============================================================================
// HEX DOMINION - Greedy AI Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from '../framework.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { type AIGameState } from '../../src/ai/game-state.js';
import { DEFAULT_TERRAIN_COSTS, HexUtil } from '../../src/core.js';
import { type Building, createBuilding, CAPTURE_RESISTANCE } from '../../src/building.js';
import { type UnitTemplate } from '../../src/unit-templates.js';
import { Unit } from '../../src/unit.js';
import { Combat } from '../../src/combat.js';
import { Pathfinder } from '../../src/pathfinder.js';
import { ResourceManager } from '../../src/resources.js';

const runner = new TestRunner();

// Helper to create a Unit
function createUnit(
  id: string,
  team: string,
  q: number,
  r: number,
  options: {
    speed?: number;
    attack?: number;
    range?: number;
    health?: number;
    canCapture?: boolean;
    canBuild?: boolean;
    armored?: boolean;
    armorPiercing?: boolean;
    hasActed?: boolean;
  } = {}
): Unit {
  const unit = new Unit(id, team, q, r, {
    speed: options.speed ?? 4,
    attack: options.attack ?? 5,
    range: options.range ?? 1,
    terrainCosts: DEFAULT_TERRAIN_COSTS,
    canCapture: options.canCapture ?? true,
    canBuild: options.canBuild ?? false,
    armored: options.armored ?? false,
    armorPiercing: options.armorPiercing ?? false,
    color: '#ffffff',
  });
  if (options.health !== undefined) {
    unit.health = options.health;
  }
  if (options.hasActed !== undefined) {
    unit.hasActed = options.hasActed;
  }
  return unit;
}

// Minimal test map for pathfinding
class TestMap {
  getTile(q: number, r: number) {
    return { q, r, type: 'grass' };
  }
  getAllTiles() {
    const tiles = [];
    for (let r = 0; r < 20; r++) {
      for (let q = 0; q < 20; q++) {
        tiles.push({ q, r, type: 'grass' });
      }
    }
    return tiles;
  }
}

// Helper to create a mock AIGameState
function createMockState(config: {
  units?: Unit[];
  buildings?: Building[];
  resources?: { funds: number; science: number };
  templates?: UnitTemplate[];
  pathfinder?: Pathfinder;
} = {}): AIGameState {
  const units = config.units ?? [];
  const buildings = config.buildings ?? [];
  const resources = config.resources ?? { funds: 1000, science: 0 };
  const templates = config.templates ?? [];
  const pathfinder = config.pathfinder ?? new Pathfinder(new TestMap() as any);

  const resourceManager = new ResourceManager(['enemy', 'player']);
  resourceManager.addFunds('enemy', resources.funds);
  resourceManager.addScience('enemy', resources.science);

  return {
    currentTeam: 'enemy',
    turnNumber: 1,
    units,
    map: {
      getBuilding: (q: number, r: number) => buildings.find(b => b.q === q && b.r === r),
      getAllBuildings: () => buildings,
      getTile: (q: number, r: number) => ({ q, r, type: 'grass' }),
      getAllTiles: () => [],
    } as any,
    buildings,
    resources: resourceManager,
    pathfinder,
    getTeamTemplates: () => templates,
    getResearchedChassis: () => [{ id: 'foot', name: 'Foot', maxWeight: 2, speed: 3, terrainCosts: DEFAULT_TERRAIN_COSTS, baseCost: 500 }],
    getResearchedWeapons: () => [{ id: 'machineGun', name: 'Machine Gun', weight: 1, attack: 4, range: 1, armorPiercing: false, cost: 500 }],
    getResearchedSystems: () => [{ id: 'capture', name: 'Capture', weight: 0, cost: 0 }],
    getAvailableTechs: () => [],
  };
}

runner.describe('GreedyAI', () => {
  runner.describe('planTurn basics', () => {
    runner.it('should have correct id and name', () => {
      const ai = new GreedyAI();
      assertEqual(ai.id, 'greedy');
      assertEqual(ai.name, 'Greedy AI');
    });

    runner.it('should always end with endTurn action', () => {
      const ai = new GreedyAI();
      const state = createMockState();
      const actions = ai.planTurn(state, 'enemy');

      assert(actions.length >= 1, 'Should have at least one action');
      assertEqual(actions[actions.length - 1]!.type, 'endTurn');
    });

    runner.it('should return only endTurn when no units, buildings, or new components', () => {
      const ai = new GreedyAI();
      // Create state with existing templates for all unlocked chassis (no new designs needed)
      const existingTemplates = [{
        id: 'soldier', name: 'Soldier', chassisId: 'foot', weaponId: 'machineGun',
        systemIds: ['capture'], cost: 1000, speed: 3, attack: 4, range: 1,
        terrainCosts: DEFAULT_TERRAIN_COSTS, armored: false, armorPiercing: false,
        canCapture: true, canBuild: false,
      }];
      const state = createMockState({ units: [], buildings: [], templates: existingTemplates });
      const actions = ai.planTurn(state, 'enemy');

      assertEqual(actions.length, 1);
      assertEqual(actions[0]!.type, 'endTurn');
    });
  });

  runner.describe('capture priority', () => {
    runner.it('should capture building when unit is on it', () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building = createBuilding(5, 5, 'city', 'player');

      const state = createMockState({
        units: [unit],
        buildings: [building],
      });

      const actions = ai.planTurn(state, 'enemy');

      // Should have capture action
      const captureAction = actions.find(a => a.type === 'capture');
      assert(captureAction !== undefined, 'Should have capture action');
      assertEqual((captureAction as { type: 'capture'; unitId: string }).unitId, 'soldier1');
    });

    runner.it('should capture neutral building', () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building = createBuilding(5, 5, 'factory', null);

      const state = createMockState({
        units: [unit],
        buildings: [building],
      });

      const actions = ai.planTurn(state, 'enemy');

      const captureAction = actions.find(a => a.type === 'capture');
      assert(captureAction !== undefined, 'Should capture neutral building');
    });

    runner.it('should not capture own building', () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building = createBuilding(5, 5, 'city', 'enemy');

      const state = createMockState({
        units: [unit],
        buildings: [building],
      });

      const actions = ai.planTurn(state, 'enemy');

      const captureAction = actions.find(a => a.type === 'capture');
      assertEqual(captureAction, undefined);
    });
  });

  runner.describe('attack priority', () => {
    runner.it('should attack enemy in range', () => {
      const ai = new GreedyAI();
      const attacker = createUnit('soldier1', 'enemy', 5, 5, { range: 1 });
      const target = createUnit('player_unit', 'player', 5, 6);

      const state = createMockState({
        units: [attacker, target],
      });

      const actions = ai.planTurn(state, 'enemy');

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'Should have attack action');
      if (attackAction?.type === 'attack') {
        assertEqual(attackAction.targetQ, 5);
        assertEqual(attackAction.targetR, 6);
      }
    });

    runner.it('should prefer higher damage targets', () => {
      const ai = new GreedyAI();
      const attacker = createUnit('soldier1', 'enemy', 5, 5, { range: 1, attack: 5 });
      // Two enemies adjacent - one armored, one not
      const armoredTarget = createUnit('tank', 'player', 5, 6, { armored: true });
      const softTarget = createUnit('soldier', 'player', 6, 5, { armored: false });

      const state = createMockState({
        units: [attacker, armoredTarget, softTarget],
      });

      const actions = ai.planTurn(state, 'enemy');

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'Should attack');
      // Should attack the soft target for more damage (armor halves damage)
      if (attackAction?.type === 'attack') {
        assertEqual(attackAction.targetQ, 6);
        assertEqual(attackAction.targetR, 5);
      }
    });
  });

  runner.describe('production', () => {
    runner.it('should build units at unoccupied factories', () => {
      const ai = new GreedyAI();
      const factory = createBuilding(0, 0, 'factory', 'enemy');
      const template: UnitTemplate = {
        id: 'soldier',
        name: 'Soldier',
        chassisId: 'foot',
        weaponId: 'machineGun',
        systemIds: ['capture'],
        cost: 500,
        speed: 4,
        attack: 4,
        range: 1,
        terrainCosts: DEFAULT_TERRAIN_COSTS,
        armored: false,
        armorPiercing: false,
        canCapture: true,
        canBuild: false,
      };

      const state = createMockState({
        buildings: [factory],
        templates: [template],
        resources: { funds: 1000, science: 0 },
      });

      const actions = ai.planTurn(state, 'enemy');

      const buildAction = actions.find(a => a.type === 'build');
      assert(buildAction !== undefined, 'Should build a unit');
      if (buildAction?.type === 'build') {
        assertEqual(buildAction.factoryQ, 0);
        assertEqual(buildAction.factoryR, 0);
        assertEqual(buildAction.templateId, 'soldier');
      }
    });

    runner.it('should not build when factory is occupied', () => {
      const ai = new GreedyAI();
      const factory = createBuilding(0, 0, 'factory', 'enemy');
      const occupyingUnit = createUnit('existing', 'enemy', 0, 0);
      const template: UnitTemplate = {
        id: 'soldier',
        name: 'Soldier',
        chassisId: 'foot',
        weaponId: 'machineGun',
        systemIds: ['capture'],
        cost: 500,
        speed: 4,
        attack: 4,
        range: 1,
        terrainCosts: DEFAULT_TERRAIN_COSTS,
        armored: false,
        armorPiercing: false,
        canCapture: true,
        canBuild: false,
      };

      const state = createMockState({
        units: [occupyingUnit],
        buildings: [factory],
        templates: [template],
        resources: { funds: 1000, science: 0 },
      });

      const actions = ai.planTurn(state, 'enemy');

      const buildAction = actions.find(a => a.type === 'build');
      assertEqual(buildAction, undefined);
    });

    runner.it('should not build when cannot afford', () => {
      const ai = new GreedyAI();
      const factory = createBuilding(0, 0, 'factory', 'enemy');
      const template: UnitTemplate = {
        id: 'soldier',
        name: 'Soldier',
        chassisId: 'foot',
        weaponId: 'machineGun',
        systemIds: ['capture'],
        cost: 500,
        speed: 4,
        attack: 4,
        range: 1,
        terrainCosts: DEFAULT_TERRAIN_COSTS,
        armored: false,
        armorPiercing: false,
        canCapture: true,
        canBuild: false,
      };

      const state = createMockState({
        buildings: [factory],
        templates: [template],
        resources: { funds: 100, science: 0 }, // Not enough funds
      });

      const actions = ai.planTurn(state, 'enemy');

      const buildAction = actions.find(a => a.type === 'build');
      assertEqual(buildAction, undefined);
    });
  });

  runner.describe('movement', () => {
    runner.it('should move toward enemy when nothing else to do', () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 0, 0);
      const enemy = createUnit('player_unit', 'player', 10, 10);

      // Create a pathfinder that returns specific reachable positions
      const testMap = new TestMap();
      const pathfinder = new Pathfinder(testMap as any);

      const state = createMockState({
        units: [unit, enemy],
        pathfinder,
      });

      const actions = ai.planTurn(state, 'enemy');

      const moveAction = actions.find(a => a.type === 'move');
      assert(moveAction !== undefined, 'Should have move action');
      // Should move toward the enemy (not stay at 0,0)
      if (moveAction?.type === 'move') {
        const movedCloser = moveAction.targetQ > 0 || moveAction.targetR > 0;
        assert(movedCloser, 'Should move closer to enemy');
      }
    });

    runner.it('should wait if no movement improves position', () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5);

      // No enemies, no buildings to capture - just one unit alone
      const state = createMockState({
        units: [unit],
      });

      const actions = ai.planTurn(state, 'enemy');

      const waitAction = actions.find(a => a.type === 'wait');
      assert(waitAction !== undefined, 'Should have wait action');
    });
  });
});

export default runner;
