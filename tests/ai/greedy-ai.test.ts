// ============================================================================
// HEX DOMINION - Greedy AI Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from '../framework.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { type GameStateView, type UnitView } from '../../src/ai/game-state.js';
import { type AIAction } from '../../src/ai/actions.js';
import { DEFAULT_TERRAIN_COSTS, HexUtil, type Tile, type TerrainCosts } from '../../src/core.js';
import { type Building } from '../../src/building.js';
import { type UnitTemplate } from '../../src/unit-templates.js';
import { Unit } from '../../src/unit.js';
import { Combat } from '../../src/combat.js';

const runner = new TestRunner();

// Helper to create a UnitView
function createUnitView(
  id: string,
  team: string,
  q: number,
  r: number,
  options: Partial<UnitView> = {}
): UnitView {
  return {
    id,
    team,
    q,
    r,
    speed: options.speed ?? 4,
    attack: options.attack ?? 5,
    range: options.range ?? 1,
    health: options.health ?? 10,
    terrainCosts: options.terrainCosts ?? DEFAULT_TERRAIN_COSTS,
    canCapture: options.canCapture ?? true,
    canBuild: options.canBuild ?? false,
    armored: options.armored ?? false,
    armorPiercing: options.armorPiercing ?? false,
    hasActed: options.hasActed ?? false,
  };
}

// Helper to create a mock GameStateView
function createMockState(config: {
  units?: UnitView[];
  buildings?: Building[];
  resources?: { funds: number; science: number };
  templates?: UnitTemplate[];
  reachablePositions?: Map<string, { q: number; r: number; cost: number }>;
} = {}): GameStateView {
  const units = config.units ?? [];
  const buildings = config.buildings ?? [];
  const resources = config.resources ?? { funds: 1000, science: 0 };
  const templates = config.templates ?? [];
  const reachablePositions = config.reachablePositions ?? new Map();

  return {
    currentTeam: 'enemy',
    turnNumber: 1,
    getTile: (q: number, r: number): Tile | undefined => ({ q, r, type: 'grass' }),
    getAllTiles: () => [],
    getBuilding: (q: number, r: number) => buildings.find(b => b.q === q && b.r === r),
    getAllBuildings: () => buildings,
    getBuildingsByOwner: (owner: string) => buildings.filter(b => b.owner === owner),
    getBuildingsByType: (type: string) => buildings.filter(b => b.type === type),
    getUnit: (id: string) => units.find(u => u.id === id),
    getUnitAt: (q: number, r: number) => units.find(u => u.q === q && u.r === r),
    getAllUnits: () => units,
    getTeamUnits: (team: string) => units.filter(u => u.team === team),
    getActiveUnits: (team: string) => units.filter(u => u.team === team && !u.hasActed),
    getResources: () => resources,
    getTeamTemplates: () => templates,
    getUnlockedTechs: () => new Set(),
    getAvailableTechs: () => [],
    getUnlockedChassis: () => [{ id: 'foot', name: 'Foot', maxWeight: 2 }],
    getUnlockedWeapons: () => [{ id: 'machineGun', name: 'Machine Gun', weight: 1 }],
    getUnlockedSystems: () => [{ id: 'capture', name: 'Capture', weight: 0 }],
    getReachablePositions: () => reachablePositions,
    findPath: () => null,
    // Use REAL Combat.calculateExpectedDamage (accounts for armor!)
    calculateExpectedDamage: (attacker: UnitView, defender: UnitView) => {
      const attackerUnit = new Unit(attacker.id, attacker.team, attacker.q, attacker.r, {
        attack: attacker.attack,
        armored: attacker.armored,
        armorPiercing: attacker.armorPiercing,
      } as any);
      attackerUnit.health = attacker.health;

      const defenderUnit = new Unit(defender.id, defender.team, defender.q, defender.r, {
        armored: defender.armored,
      } as any);
      defenderUnit.health = defender.health;

      return Combat.calculateExpectedDamage(attackerUnit, defenderUnit);
    },
    // Use REAL HexUtil.distance
    isInRange: (attacker: UnitView, target: UnitView) => {
      const dist = HexUtil.distance(attacker.q, attacker.r, target.q, target.r);
      return dist <= attacker.range;
    },
    getTargetsInRange: (attacker: UnitView) => {
      return units.filter(u => {
        if (u.team === attacker.team) return false;
        const dist = HexUtil.distance(attacker.q, attacker.r, u.q, u.r);
        return dist <= attacker.range;
      });
    },
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
        terrainCosts: {} as any, armored: false, armorPiercing: false,
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
      const unit = createUnitView('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building: Building = { q: 5, r: 5, type: 'city', owner: 'player' };

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
      const unit = createUnitView('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building: Building = { q: 5, r: 5, type: 'factory', owner: null };

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
      const unit = createUnitView('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building: Building = { q: 5, r: 5, type: 'city', owner: 'enemy' };

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
      const attacker = createUnitView('soldier1', 'enemy', 5, 5, { range: 1 });
      const target = createUnitView('player_unit', 'player', 5, 6);

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
      const attacker = createUnitView('soldier1', 'enemy', 5, 5, { range: 1, attack: 5 });
      // Two enemies adjacent - one armored, one not
      const armoredTarget = createUnitView('tank', 'player', 5, 6, { armored: true });
      const softTarget = createUnitView('soldier', 'player', 6, 5, { armored: false });

      // Create state where calculateExpectedDamage returns different values based on armor
      const state = createMockState({
        units: [attacker, armoredTarget, softTarget],
      });

      // Override calculateExpectedDamage to simulate armor reduction
      (state as any).calculateExpectedDamage = (att: UnitView, def: UnitView) => {
        const baseDmg = Math.floor(att.attack * (att.health / 10));
        if (def.armored && !att.armorPiercing) {
          return Math.floor(baseDmg / 5);
        }
        return baseDmg;
      };

      const actions = ai.planTurn(state, 'enemy');

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'Should attack');
      // Should attack the soft target for more damage
      if (attackAction?.type === 'attack') {
        assertEqual(attackAction.targetQ, 6);
        assertEqual(attackAction.targetR, 5);
      }
    });
  });

  runner.describe('production', () => {
    runner.it('should build units at unoccupied factories', () => {
      const ai = new GreedyAI();
      const factory: Building = { q: 0, r: 0, type: 'factory', owner: 'enemy' };
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
      const factory: Building = { q: 0, r: 0, type: 'factory', owner: 'enemy' };
      const occupyingUnit = createUnitView('existing', 'enemy', 0, 0);
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
      const factory: Building = { q: 0, r: 0, type: 'factory', owner: 'enemy' };
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
      const unit = createUnitView('soldier1', 'enemy', 0, 0);
      const enemy = createUnitView('player_unit', 'player', 10, 10);

      // Reachable positions are closer to the enemy
      const reachable = new Map<string, { q: number; r: number; cost: number }>();
      reachable.set('0,0', { q: 0, r: 0, cost: 0 });
      reachable.set('1,0', { q: 1, r: 0, cost: 1 });
      reachable.set('1,1', { q: 1, r: 1, cost: 2 });

      const state = createMockState({
        units: [unit, enemy],
        reachablePositions: reachable,
      });

      const actions = ai.planTurn(state, 'enemy');

      const moveAction = actions.find(a => a.type === 'move');
      assert(moveAction !== undefined, 'Should have move action');
      // Should move to position closest to enemy (1,1)
      if (moveAction?.type === 'move') {
        assertEqual(moveAction.targetQ, 1);
        assertEqual(moveAction.targetR, 1);
      }
    });

    runner.it('should wait if no movement improves position', () => {
      const ai = new GreedyAI();
      const unit = createUnitView('soldier1', 'enemy', 5, 5);

      // No enemies, no buildings to capture, nowhere to go
      const state = createMockState({
        units: [unit],
        reachablePositions: new Map([['5,5', { q: 5, r: 5, cost: 0 }]]),
      });

      const actions = ai.planTurn(state, 'enemy');

      const waitAction = actions.find(a => a.type === 'wait');
      assert(waitAction !== undefined, 'Should have wait action');
    });
  });
});

export default runner;
