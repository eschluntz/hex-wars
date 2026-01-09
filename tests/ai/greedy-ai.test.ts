// ============================================================================
// HEX DOMINION - Greedy AI Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from '../framework.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { type AIContext } from '../../src/ai/controller.js';
import { type AIAction } from '../../src/ai/actions.js';
import { DEFAULT_TERRAIN_COSTS } from '../../src/core.js';
import { type Building, createBuilding } from '../../src/building.js';
import { type UnitTemplate } from '../../src/unit-templates.js';
import { Unit } from '../../src/unit.js';
import { Pathfinder } from '../../src/pathfinder.js';
import { ResourceManager } from '../../src/resources.js';

const runner = new TestRunner();

// Helper to create a basic UnitTemplate
function createTemplate(id: string, cost: number, overrides: Partial<UnitTemplate> = {}): UnitTemplate {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    cost,
    speed: 4,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: DEFAULT_TERRAIN_COSTS,
    flying: false,
    canCapture: true,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    ...overrides,
  };
}

// Helper to create a Unit
function createUnit(
  id: string,
  team: string,
  q: number,
  r: number,
  options: {
    speed?: number;
    range?: number;
    minRange?: number;
    canMoveAndAttack?: boolean;
    health?: number;
    canCapture?: boolean;
    canBuild?: boolean;
    hasActed?: boolean;
    templateId?: string;
  } = {}
): Unit {
  const unit = Unit.withStats(id, team, q, r, {
    speed: options.speed ?? 4,
    range: options.range ?? 1,
    minRange: options.minRange ?? 0,
    canMoveAndAttack: options.canMoveAndAttack ?? true,
    canCapture: options.canCapture ?? true,
    canBuild: options.canBuild ?? false,
    templateId: options.templateId ?? 'infantry',
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

// Helper to create a mock AIContext that records actions
function createMockContext(config: {
  team?: string;
  units?: Unit[];
  buildings?: Building[];
  funds?: number;
  templates?: UnitTemplate[];
  pathfinder?: Pathfinder;
} = {}): { ctx: AIContext; actions: AIAction[] } {
  const team = config.team ?? 'enemy';
  let units = config.units ?? [];
  const buildings = config.buildings ?? [];
  let funds = config.funds ?? 1000;
  const templates = config.templates ?? [];
  const pathfinder = config.pathfinder ?? new Pathfinder(new TestMap() as any);

  const actions: AIAction[] = [];

  const ctx: AIContext = {
    team,
    getUnits: () => units,
    getBuildings: () => buildings,
    getFunds: () => funds,
    getTemplates: () => templates,
    getPathfinder: () => pathfinder,
    doAction: async (action: AIAction) => {
      actions.push(action);
      // Simulate action effects for realistic testing
      if (action.type === 'move') {
        const unit = units.find(u => u.id === action.unitId);
        if (unit) {
          unit.q = action.targetQ;
          unit.r = action.targetR;
        }
      } else if (action.type === 'wait' || action.type === 'capture' || action.type === 'attack') {
        const unit = units.find(u => u.id === action.unitId);
        if (unit) {
          unit.hasActed = true;
        }
      } else if (action.type === 'build') {
        const template = templates.find(t => t.id === action.templateId);
        if (template) {
          funds -= template.cost;
          const newUnit = Unit.withStats(
            `${action.templateId}_new`,
            team,
            action.factoryQ,
            action.factoryR,
            { templateId: action.templateId }
          );
          newUnit.hasActed = true;
          units = [...units, newUnit];
        }
      }
    },
  };

  return { ctx, actions };
}

runner.describe('GreedyAI', () => {
  runner.describe('planTurn basics', () => {
    runner.it('should have correct id and name', () => {
      const ai = new GreedyAI();
      assertEqual(ai.id, 'greedy');
      assertEqual(ai.name, 'Greedy AI');
    });

    runner.it('should always end with endTurn action', async () => {
      const ai = new GreedyAI();
      const { ctx, actions } = createMockContext();
      await ai.planTurn(ctx);

      assert(actions.length >= 1, 'Should have at least one action');
      assertEqual(actions[actions.length - 1]!.type, 'endTurn');
    });

    runner.it('should return only endTurn when no units, buildings, or new components', async () => {
      const ai = new GreedyAI();
      const existingTemplates = [createTemplate('infantry', 1000)];
      const { ctx, actions } = createMockContext({ units: [], buildings: [], templates: existingTemplates });
      await ai.planTurn(ctx);

      assertEqual(actions.length, 1);
      assertEqual(actions[0]!.type, 'endTurn');
    });
  });

  runner.describe('capture priority', () => {
    runner.it('should capture building when unit is on it', async () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building = createBuilding(5, 5, 'city', 'player');

      const { ctx, actions } = createMockContext({
        units: [unit],
        buildings: [building],
      });

      await ai.planTurn(ctx);

      const captureAction = actions.find(a => a.type === 'capture');
      assert(captureAction !== undefined, 'Should have capture action');
      assertEqual((captureAction as { type: 'capture'; unitId: string }).unitId, 'soldier1');
    });

    runner.it('should capture neutral building', async () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building = createBuilding(5, 5, 'factory', null);

      const { ctx, actions } = createMockContext({
        units: [unit],
        buildings: [building],
      });

      await ai.planTurn(ctx);

      const captureAction = actions.find(a => a.type === 'capture');
      assert(captureAction !== undefined, 'Should capture neutral building');
    });

    runner.it('should not capture own building', async () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true });
      const building = createBuilding(5, 5, 'city', 'enemy');

      const { ctx, actions } = createMockContext({
        units: [unit],
        buildings: [building],
      });

      await ai.planTurn(ctx);

      const captureAction = actions.find(a => a.type === 'capture');
      assertEqual(captureAction, undefined);
    });

    runner.it('should prioritize capturing capital over city', async () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: true, speed: 4 });
      const city = createBuilding(6, 5, 'city', 'player');
      const capital = createBuilding(7, 5, 'capital', 'player');

      const { ctx, actions } = createMockContext({
        units: [unit],
        buildings: [city, capital],
      });

      await ai.planTurn(ctx);

      const moveAction = actions.find(a => a.type === 'move');
      assert(moveAction !== undefined, 'Should have move action');
      if (moveAction?.type === 'move') {
        assertEqual(moveAction.targetQ, 7);
        assertEqual(moveAction.targetR, 5);
      }
    });
  });

  runner.describe('attack priority', () => {
    runner.it('should attack enemy in range', async () => {
      const ai = new GreedyAI();
      const attacker = createUnit('soldier1', 'enemy', 5, 5, { range: 1, canCapture: false });
      const target = createUnit('player_unit', 'player', 5, 6, { canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [attacker, target],
      });

      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'Should have attack action');
      if (attackAction?.type === 'attack') {
        assertEqual(attackAction.targetQ, 5);
        assertEqual(attackAction.targetR, 6);
      }
    });

    runner.it('should prefer higher damage targets', async () => {
      const ai = new GreedyAI();
      const attacker = createUnit('soldier1', 'enemy', 5, 5, { range: 1, templateId: 'infantry', canCapture: false });
      const tankTarget = createUnit('tank', 'player', 5, 6, { templateId: 'tank', canCapture: false });
      const softTarget = createUnit('soldier', 'player', 6, 5, { templateId: 'infantry', canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [attacker, tankTarget, softTarget],
      });

      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack');
      assert(attackAction !== undefined, 'Should attack');
      if (attackAction?.type === 'attack') {
        assertEqual(attackAction.targetQ, 6);
        assertEqual(attackAction.targetR, 5);
      }
    });
  });

  runner.describe('production', () => {
    runner.it('should build units at unoccupied factories', async () => {
      const ai = new GreedyAI();
      const factory = createBuilding(0, 0, 'factory', 'enemy');

      const { ctx, actions } = createMockContext({
        buildings: [factory],
        templates: [createTemplate('infantry', 500)],
        funds: 1000,
      });

      await ai.planTurn(ctx);

      const buildAction = actions.find(a => a.type === 'build');
      assert(buildAction !== undefined, 'Should build a unit');
      if (buildAction?.type === 'build') {
        assertEqual(buildAction.factoryQ, 0);
        assertEqual(buildAction.factoryR, 0);
        assertEqual(buildAction.templateId, 'infantry');
      }
    });

    runner.it('should not build when factory is occupied', async () => {
      const ai = new GreedyAI();
      const factory = createBuilding(0, 0, 'factory', 'enemy');
      const occupyingUnit = createUnit('existing', 'enemy', 0, 0, { hasActed: true });

      const { ctx, actions } = createMockContext({
        units: [occupyingUnit],
        buildings: [factory],
        templates: [createTemplate('infantry', 500)],
        funds: 1000,
      });

      await ai.planTurn(ctx);

      const buildAction = actions.find(a => a.type === 'build');
      assertEqual(buildAction, undefined);
    });

    runner.it('should not build when cannot afford', async () => {
      const ai = new GreedyAI();
      const factory = createBuilding(0, 0, 'factory', 'enemy');

      const { ctx, actions } = createMockContext({
        buildings: [factory],
        templates: [createTemplate('infantry', 500)],
        funds: 100,
      });

      await ai.planTurn(ctx);

      const buildAction = actions.find(a => a.type === 'build');
      assertEqual(buildAction, undefined);
    });
  });

  runner.describe('movement', () => {
    runner.it('should move toward enemy when nothing else to do', async () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 0, 0, { canCapture: false });
      const enemy = createUnit('player_unit', 'player', 10, 10, { canCapture: false });

      const testMap = new TestMap();
      const pathfinder = new Pathfinder(testMap as any);

      const { ctx, actions } = createMockContext({
        units: [unit, enemy],
        pathfinder,
      });

      await ai.planTurn(ctx);

      const moveAction = actions.find(a => a.type === 'move');
      assert(moveAction !== undefined, 'Should have move action');
      if (moveAction?.type === 'move') {
        const movedCloser = moveAction.targetQ > 0 || moveAction.targetR > 0;
        assert(movedCloser, 'Should move closer to enemy');
      }
    });

    runner.it('should wait if no movement improves position', async () => {
      const ai = new GreedyAI();
      const unit = createUnit('soldier1', 'enemy', 5, 5, { canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [unit],
      });

      await ai.planTurn(ctx);

      const waitAction = actions.find(a => a.type === 'wait');
      assert(waitAction !== undefined, 'Should have wait action');
    });
  });

  runner.describe('canMoveAndAttack restriction', () => {
    runner.it('should attack from current position when canMoveAndAttack is false', async () => {
      const ai = new GreedyAI();
      const aiUnit = createUnit('ai', 'enemy', 5, 5, {
        range: 3, canMoveAndAttack: false, templateId: 'artillery', canCapture: false
      });
      const playerUnit = createUnit('player', 'player', 7, 5, { templateId: 'infantry', canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [aiUnit, playerUnit],
        funds: 0,
      });

      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack');
      const moveAction = actions.find(a => a.type === 'move' && (a as { unitId: string }).unitId === 'ai');

      assert(attackAction !== undefined, 'Should have attack action');
      assert(moveAction === undefined, 'Should NOT have move action before attack');
    });

    runner.it('should not attack after moving when canMoveAndAttack is false', async () => {
      const ai = new GreedyAI();
      const aiUnit = createUnit('ai', 'enemy', 5, 5, {
        range: 3, canMoveAndAttack: false, templateId: 'artillery', canCapture: false
      });
      const playerUnit = createUnit('player', 'player', 11, 5, { templateId: 'infantry', canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [aiUnit, playerUnit],
        funds: 0,
      });

      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack' && (a as { unitId: string }).unitId === 'ai');
      assert(attackAction === undefined, 'Should NOT attack when it requires moving');
    });

    runner.it('should allow move-then-attack when canMoveAndAttack is true', async () => {
      const ai = new GreedyAI();
      const aiUnit = createUnit('ai', 'enemy', 5, 5, {
        range: 1, speed: 4, canMoveAndAttack: true, templateId: 'infantry', canCapture: false
      });
      const playerUnit = createUnit('player', 'player', 8, 5, { templateId: 'infantry', canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [aiUnit, playerUnit],
        funds: 0,
      });

      await ai.planTurn(ctx);

      const moveIdx = actions.findIndex(a => a.type === 'move' && (a as { unitId: string }).unitId === 'ai');
      const attackIdx = actions.findIndex(a => a.type === 'attack' && (a as { unitId: string }).unitId === 'ai');

      assert(moveIdx !== -1, 'Should have move action');
      assert(attackIdx !== -1, 'Should have attack action');
      assert(moveIdx < attackIdx, 'Move should come before attack');
    });
  });

  runner.describe('minRange restriction', () => {
    runner.it('should not attack targets closer than minRange when cannot move', async () => {
      const ai = new GreedyAI();
      const aiUnit = createUnit('ai', 'enemy', 5, 5, {
        range: 3, minRange: 2, canMoveAndAttack: false, canCapture: false, templateId: 'artillery'
      });
      const playerUnit = createUnit('player', 'player', 6, 5, { canCapture: false, templateId: 'infantry' });

      const { ctx, actions } = createMockContext({
        units: [aiUnit, playerUnit],
        funds: 0,
      });

      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack' && (a as { unitId: string }).unitId === 'ai');
      assert(attackAction === undefined, 'Should NOT attack target that is too close');
    });

    runner.it('should attack targets at or beyond minRange', async () => {
      const ai = new GreedyAI();
      const aiUnit = createUnit('ai', 'enemy', 5, 5, {
        range: 3, minRange: 2, templateId: 'artillery', canCapture: false
      });
      const playerUnit = createUnit('player', 'player', 7, 5, { templateId: 'infantry', canCapture: false });

      const { ctx, actions } = createMockContext({
        units: [aiUnit, playerUnit],
        funds: 0,
      });

      await ai.planTurn(ctx);

      const attackAction = actions.find(a => a.type === 'attack' && (a as { unitId: string }).unitId === 'ai');
      assert(attackAction !== undefined, 'Should attack target at minRange');
    });
  });
});

export default runner;
