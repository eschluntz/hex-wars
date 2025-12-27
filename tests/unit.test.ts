// ============================================================================
// HEX DOMINION - Unit Movement Tests
// ============================================================================

import { TestRunner, assert, assertEqual } from './framework.js';
import { createTestMap } from './helpers.js';
import { Pathfinder } from '../src/pathfinder.js';
import { Unit } from '../src/unit.js';
import { DEFAULT_TERRAIN_COSTS, type TerrainCosts } from '../src/core.js';

const runner = new TestRunner();
const TEST_TEAM = 'player';

runner.describe('Unit', () => {

  runner.describe('Initialization', () => {

    runner.it('should initialize with correct position and speed', () => {
      const unit = new Unit('test1', TEST_TEAM, 5, 3, 4);

      assertEqual(unit.id, 'test1');
      assertEqual(unit.team, TEST_TEAM);
      assertEqual(unit.q, 5);
      assertEqual(unit.r, 3);
      assertEqual(unit.speed, 4);
      assertEqual(unit.movementRemaining, 4);
    });

    runner.it('should use default speed of 4', () => {
      const unit = new Unit('test2', TEST_TEAM, 0, 0);
      assertEqual(unit.speed, 4);
    });

    runner.it('should start with no goal', () => {
      const unit = new Unit('test3', TEST_TEAM, 0, 0);

      assert(unit.hasReachedGoal(), 'Should have no goal initially');
      assertEqual(unit.getRemainingPathLength(), 0);
    });

  });

  runner.describe('Goal setting', () => {

    runner.it('should set goal and compute path', () => {
      const map = createTestMap([
        'GGGGG'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 4);

      const success = unit.setGoal(4, 0, pathfinder);

      assert(success, 'Goal should be set successfully');
      assertEqual(unit.goalQ, 4);
      assertEqual(unit.goalR, 0);
      assertEqual(unit.getRemainingPathLength(), 4, 'Path excludes starting position');
    });

    runner.it('should return false for unreachable goal', () => {
      const map = createTestMap([
        'GWG'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 4);

      const success = unit.setGoal(2, 0, pathfinder);

      assert(!success, 'Should fail for blocked path');
      assertEqual(unit.currentPath, null);
    });

    runner.it('should clear goal', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 4);

      unit.setGoal(4, 0, pathfinder);
      unit.clearGoal();

      assertEqual(unit.goalQ, null);
      assertEqual(unit.goalR, null);
      assertEqual(unit.currentPath, null);
    });

  });

  runner.describe('Movement', () => {

    runner.it('should move along path within speed limit', () => {
      const map = createTestMap([
        'GGGGG'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 4);

      unit.setGoal(4, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 4, 'Should move 4 tiles');
      assertEqual(unit.q, 4);
      assertEqual(unit.r, 0);
      assertEqual(unit.movementRemaining, 0);
      assert(unit.hasReachedGoal());
    });

    runner.it('should stop when movement runs out', () => {
      const map = createTestMap([
        'GGGGGGGG'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 3);

      unit.setGoal(7, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 3, 'Should move 3 tiles (speed limit)');
      assertEqual(unit.q, 3);
      assertEqual(unit.getRemainingPathLength(), 4);
      assert(!unit.hasReachedGoal());
    });

    runner.it('should return empty array when no path', () => {
      const map = createTestMap(['G']);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 4);

      const moved = unit.move(map);

      assertEqual(moved.length, 0);
    });

    runner.it('should return empty array when already at goal', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 10);

      unit.setGoal(4, 0, pathfinder);
      unit.move(map);

      const secondMove = unit.move(map);
      assertEqual(secondMove.length, 0);
    });

  });

  runner.describe('Multi-turn movement', () => {

    runner.it('should continue path over multiple turns', () => {
      const map = createTestMap([
        'GGGGGGGG'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 3);

      unit.setGoal(7, 0, pathfinder);

      // Turn 1
      unit.move(map);
      assertEqual(unit.q, 3, 'Turn 1: at position 3');
      assertEqual(unit.getRemainingPathLength(), 4);

      // Turn 2
      unit.resetMovement();
      unit.move(map);
      assertEqual(unit.q, 6, 'Turn 2: at position 6');
      assertEqual(unit.getRemainingPathLength(), 1);

      // Turn 3
      unit.resetMovement();
      unit.move(map);
      assertEqual(unit.q, 7, 'Turn 3: at goal');
      assert(unit.hasReachedGoal());
    });

    runner.it('should reset movement points correctly', () => {
      const unit = new Unit('test', TEST_TEAM, 0, 0, 5);

      unit.movementRemaining = 1;
      unit.resetMovement();

      assertEqual(unit.movementRemaining, 5);
    });

  });

  runner.describe('Terrain costs', () => {

    runner.it('should move further on roads', () => {
      const map = createTestMap([
        'RRRRRRRR'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 2);

      unit.setGoal(7, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 4, 'Should move 4 road tiles with 2 movement');
      assertEqual(unit.q, 4);
      assertEqual(unit.movementRemaining, 0);
    });

    runner.it('should move slower through woods', () => {
      const map = createTestMap([
        'FFFFFFFF'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 3);

      unit.setGoal(7, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 2, 'Should move 2 woods tiles with 3 movement');
      assertEqual(unit.q, 2);
      assertEqual(unit.movementRemaining, 0);
    });

    runner.it('should handle mixed terrain', () => {
      const map = createTestMap([
        'RRGGFF'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 3);

      unit.setGoal(5, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 3, 'Should move 3 tiles (R + G + G = 2.5)');
      assertEqual(unit.q, 3);
      assertEqual(unit.movementRemaining, 0.5);
    });

    runner.it('should stop if next tile costs more than remaining', () => {
      const map = createTestMap([
        'RRF'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 2);

      unit.setGoal(2, 0, pathfinder);
      unit.move(map);

      assertEqual(unit.q, 2, 'Should reach tile 2 (R at 0.5 + R at 0.5 + F at 1.5 still fits in 2)');
    });

  });

  runner.describe('Per-unit terrain costs', () => {

    runner.it('should accept custom terrain costs in constructor', () => {
      const hoverCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        water: 1
      };

      const unit = new Unit('hover1', TEST_TEAM, 0, 0, 4, hoverCosts);

      assertEqual(unit.terrainCosts.water, 1);
      assertEqual(unit.terrainCosts.grass, 1);
    });

    runner.it('should use default terrain costs when not specified', () => {
      const unit = new Unit('default1', TEST_TEAM, 0, 0, 4);

      assertEqual(unit.terrainCosts.water, Infinity);
      assertEqual(unit.terrainCosts.mountain, Infinity);
      assertEqual(unit.terrainCosts.grass, 1);
    });

    runner.it('hover unit should path and move through water', () => {
      const map = createTestMap([
        'GWWWG'
      ]);
      const pathfinder = new Pathfinder(map);

      const hoverCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        water: 1
      };

      const hoverUnit = new Unit('hover', TEST_TEAM, 0, 0, 4, hoverCosts);
      const success = hoverUnit.setGoal(4, 0, pathfinder);

      assert(success, 'Hover unit should find path through water');
      assertEqual(hoverUnit.getRemainingPathLength(), 4);

      const moved = hoverUnit.move(map);
      assertEqual(moved.length, 4);
      assertEqual(hoverUnit.q, 4);
    });

    runner.it('normal unit should not path through water', () => {
      const map = createTestMap([
        'GWWWG'
      ]);
      const pathfinder = new Pathfinder(map);

      const normalUnit = new Unit('normal', TEST_TEAM, 0, 0, 4);
      const success = normalUnit.setGoal(4, 0, pathfinder);

      assert(!success, 'Normal unit should not find path through water');
    });

    runner.it('mountain unit should move through mountains', () => {
      const map = createTestMap([
        'GMMMG'
      ]);
      const pathfinder = new Pathfinder(map);

      const mountainCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        mountain: 2
      };

      const mountainUnit = new Unit('climber', TEST_TEAM, 0, 0, 8, mountainCosts);
      const success = mountainUnit.setGoal(4, 0, pathfinder);

      assert(success, 'Mountain unit should find path through mountains');

      const moved = mountainUnit.move(map);
      assertEqual(moved.length, 4);
      assertEqual(mountainUnit.q, 4);
      assertEqual(mountainUnit.movementRemaining, 1, '8 - (1 grass + 3 mountains * 2) = 1');
    });

    runner.it('forest ranger should move faster through woods', () => {
      const map = createTestMap([
        'FFFFF'
      ]);
      const pathfinder = new Pathfinder(map);

      const rangerCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        woods: 0.5
      };

      // Normal unit: 3 movement, woods cost 1.5 = moves 2 tiles
      const normalUnit = new Unit('normal', TEST_TEAM, 0, 0, 3);
      normalUnit.setGoal(4, 0, pathfinder);
      normalUnit.move(map);
      assertEqual(normalUnit.q, 2, 'Normal unit moves 2 tiles in woods');

      // Ranger: 3 movement, woods cost 0.5 = moves all 4 tiles with movement left
      const ranger = new Unit('ranger', TEST_TEAM, 0, 0, 3, rangerCosts);
      ranger.setGoal(4, 0, pathfinder);
      ranger.move(map);
      assertEqual(ranger.q, 4, 'Ranger moves through all woods tiles');
      assertEqual(ranger.movementRemaining, 1, '3 - (4 * 0.5) = 1');
    });

  });

  runner.describe('Edge cases', () => {

    runner.it('should handle zero speed', () => {
      const map = createTestMap(['GGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 0);

      unit.setGoal(2, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 0);
      assertEqual(unit.q, 0);
    });

    runner.it('should handle changing goal mid-path', () => {
      const map = createTestMap([
        'GGGGG',
        'GGGGG'
      ]);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, 2);

      unit.setGoal(4, 0, pathfinder);
      unit.move(map);
      assertEqual(unit.q, 2);

      unit.setGoal(2, 1, pathfinder);
      unit.resetMovement();
      unit.move(map);

      assertEqual(unit.r, 1);
    });

  });

});

export default runner;
