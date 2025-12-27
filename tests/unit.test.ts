// ============================================================================
// HEX DOMINION - Unit Tests
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

    runner.it('should initialize with correct position and stats', () => {
      const unit = new Unit('test1', TEST_TEAM, 5, 3, { speed: 4, attack: 6, range: 2 });

      assertEqual(unit.id, 'test1');
      assertEqual(unit.team, TEST_TEAM);
      assertEqual(unit.q, 5);
      assertEqual(unit.r, 3);
      assertEqual(unit.speed, 4);
      assertEqual(unit.attack, 6);
      assertEqual(unit.range, 2);
      assertEqual(unit.health, 10);
    });

    runner.it('should use default stats when not specified', () => {
      const unit = new Unit('test2', TEST_TEAM, 0, 0);

      assertEqual(unit.speed, 4);
      assertEqual(unit.attack, 5);
      assertEqual(unit.range, 1);
      assertEqual(unit.health, 10);
      assertEqual(unit.color, '#ffffff');
    });

    runner.it('should accept custom color', () => {
      const unit = new Unit('test3', TEST_TEAM, 0, 0, { color: '#ff0000' });
      assertEqual(unit.color, '#ff0000');
    });

    runner.it('should start with hasActed as false', () => {
      const unit = new Unit('test4', TEST_TEAM, 0, 0);
      assertEqual(unit.hasActed, false);
    });

  });

  runner.describe('isAlive', () => {

    runner.it('should return true when health > 0', () => {
      const unit = new Unit('test', TEST_TEAM, 0, 0);
      unit.health = 5;
      assert(unit.isAlive());
    });

    runner.it('should return false when health = 0', () => {
      const unit = new Unit('test', TEST_TEAM, 0, 0);
      unit.health = 0;
      assert(!unit.isAlive());
    });

  });

  runner.describe('getReachableIndex', () => {

    runner.it('should return correct index for path within speed', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 4 });

      const result = pathfinder.findPath(0, 0, 4, 0, unit.terrainCosts);
      const reachable = unit.getReachableIndex(result!.path, map);

      assertEqual(reachable, 4); // Can reach end of path
    });

    runner.it('should stop at speed limit', () => {
      const map = createTestMap(['GGGGGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 3 });

      const result = pathfinder.findPath(0, 0, 7, 0, unit.terrainCosts);
      const reachable = unit.getReachableIndex(result!.path, map);

      assertEqual(reachable, 3); // Can only reach 3 tiles with speed 3
    });

    runner.it('should account for road terrain (0.5 cost)', () => {
      const map = createTestMap(['RRRRRRRR']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 2 });

      const result = pathfinder.findPath(0, 0, 7, 0, unit.terrainCosts);
      const reachable = unit.getReachableIndex(result!.path, map);

      assertEqual(reachable, 4); // 4 road tiles cost 2 movement
    });

    runner.it('should account for woods terrain (1.5 cost)', () => {
      const map = createTestMap(['FFFFFFFF']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 3 });

      const result = pathfinder.findPath(0, 0, 7, 0, unit.terrainCosts);
      const reachable = unit.getReachableIndex(result!.path, map);

      assertEqual(reachable, 2); // 2 woods tiles cost 3 movement
    });

    runner.it('should handle mixed terrain', () => {
      const map = createTestMap(['RRGGFF']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 3 });

      const result = pathfinder.findPath(0, 0, 5, 0, unit.terrainCosts);
      const reachable = unit.getReachableIndex(result!.path, map);

      // R(0.5) + G(1) + G(1) = 2.5, can fit one more R but not F
      assertEqual(reachable, 3);
    });

    runner.it('should skip occupied tiles when determining reachable', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 4 });

      const result = pathfinder.findPath(0, 0, 4, 0, unit.terrainCosts);
      const occupied = new Set(['2,0']); // Tile at index 2 is occupied

      const reachable = unit.getReachableIndex(result!.path, map, occupied);

      // Can reach tile 4, skipping tile 2 as a stop point
      assertEqual(reachable, 4);
    });

    runner.it('should stop before occupied tile if not enough movement to pass', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 2 });

      const result = pathfinder.findPath(0, 0, 4, 0, unit.terrainCosts);
      const occupied = new Set(['2,0']); // Tile at index 2 is occupied

      const reachable = unit.getReachableIndex(result!.path, map, occupied);

      // Can only reach tile 1 (tile 2 is occupied, can't stop there)
      assertEqual(reachable, 1);
    });

    runner.it('should return 0 for zero speed', () => {
      const map = createTestMap(['GGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', TEST_TEAM, 0, 0, { speed: 0 });

      const result = pathfinder.findPath(0, 0, 2, 0, unit.terrainCosts);
      const reachable = unit.getReachableIndex(result!.path, map);

      assertEqual(reachable, 0);
    });

  });

  runner.describe('Custom terrain costs', () => {

    runner.it('should accept custom terrain costs', () => {
      const hoverCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        water: 1
      };

      const unit = new Unit('hover', TEST_TEAM, 0, 0, { terrainCosts: hoverCosts });

      assertEqual(unit.terrainCosts.water, 1);
      assertEqual(unit.terrainCosts.grass, 1);
    });

    runner.it('should use default terrain costs when not specified', () => {
      const unit = new Unit('normal', TEST_TEAM, 0, 0);

      assertEqual(unit.terrainCosts.water, Infinity);
      assertEqual(unit.terrainCosts.mountain, Infinity);
      assertEqual(unit.terrainCosts.grass, 1);
    });

    runner.it('hover unit can path through water', () => {
      const map = createTestMap(['GWWWG']);
      const pathfinder = new Pathfinder(map);

      const hoverCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        water: 1
      };

      const unit = new Unit('hover', TEST_TEAM, 0, 0, { speed: 4, terrainCosts: hoverCosts });
      const result = pathfinder.findPath(0, 0, 4, 0, unit.terrainCosts);

      assert(result !== null, 'Hover unit should find path through water');
      assertEqual(result!.path.length, 5);
    });

    runner.it('normal unit cannot path through water', () => {
      const map = createTestMap(['GWWWG']);
      const pathfinder = new Pathfinder(map);

      const unit = new Unit('normal', TEST_TEAM, 0, 0, { speed: 4 });
      const result = pathfinder.findPath(0, 0, 4, 0, unit.terrainCosts);

      assert(result === null, 'Normal unit should not find path through water');
    });

    runner.it('mountain unit can path through mountains', () => {
      const map = createTestMap(['GMMMG']);
      const pathfinder = new Pathfinder(map);

      const mountainCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        mountain: 2
      };

      const unit = new Unit('climber', TEST_TEAM, 0, 0, { speed: 8, terrainCosts: mountainCosts });
      const result = pathfinder.findPath(0, 0, 4, 0, unit.terrainCosts);

      assert(result !== null, 'Mountain unit should find path');
      const reachable = unit.getReachableIndex(result!.path, map);
      assertEqual(reachable, 4); // 8 speed covers 1 grass + 3 mountains*2 = 7
    });

    runner.it('forest ranger moves faster through woods', () => {
      const map = createTestMap(['FFFFF']);
      const pathfinder = new Pathfinder(map);

      const rangerCosts: TerrainCosts = {
        ...DEFAULT_TERRAIN_COSTS,
        woods: 0.5
      };

      // Normal unit: speed 3, woods cost 1.5 = reaches 2 tiles
      const normalUnit = new Unit('normal', TEST_TEAM, 0, 0, { speed: 3 });
      const normalResult = pathfinder.findPath(0, 0, 4, 0, normalUnit.terrainCosts);
      const normalReachable = normalUnit.getReachableIndex(normalResult!.path, map);
      assertEqual(normalReachable, 2);

      // Ranger: speed 3, woods cost 0.5 = reaches all 4 tiles (cost 2)
      const ranger = new Unit('ranger', TEST_TEAM, 0, 0, { speed: 3, terrainCosts: rangerCosts });
      const rangerResult = pathfinder.findPath(0, 0, 4, 0, ranger.terrainCosts);
      const rangerReachable = ranger.getReachableIndex(rangerResult!.path, map);
      assertEqual(rangerReachable, 4);
    });

  });

});

export default runner;
