// ============================================================================
// HEX DOMINION - Pathfinding Tests
// ============================================================================

import { TestRunner, assert, assertEqual, assertDeepEqual, assertNull, assertNotNull } from './framework.js';
import { createTestMap } from './helpers.js';
import { Pathfinder } from '../src/pathfinder.js';

const runner = new TestRunner();

runner.describe('Pathfinder', () => {

  runner.describe('Basic pathfinding', () => {

    runner.it('should find a straight path on open terrain', () => {
      const map = createTestMap([
        'GGGGG',
        'GGGGG',
        'GGGGG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 4, 0);

      assertNotNull(result, 'Path should exist');
      assertEqual(result!.path.length, 5, 'Path length');
      assertDeepEqual(result!.path[0], { q: 0, r: 0 }, 'Start position');
      assertDeepEqual(result!.path[4], { q: 4, r: 0 }, 'End position');
      assertEqual(result!.totalCost, 4, 'Total cost (4 grass tiles)');
    });

    runner.it('should find path to adjacent tile', () => {
      const map = createTestMap([
        'GG',
        'GG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 1, 0);

      assertNotNull(result);
      assertEqual(result!.path.length, 2);
      assertEqual(result!.totalCost, 1);
    });

    runner.it('should return path with just start when start equals goal', () => {
      const map = createTestMap(['G']);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 0, 0);

      assertNotNull(result);
      assertEqual(result!.path.length, 1);
      assertEqual(result!.totalCost, 0);
    });

  });

  runner.describe('Obstacle avoidance', () => {

    runner.it('should path around water', () => {
      const map = createTestMap([
        'GGGGG',
        'GWWWG',
        'GGGGG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 1, 4, 1);

      assertNotNull(result, 'Path should exist around water');
      assert(result!.path.length > 5, 'Path should be longer than direct route');

      const crossesWater = result!.path.some(p => {
        const tile = map.getTile(p.q, p.r);
        return tile && tile.type === 'water';
      });
      assert(!crossesWater, 'Path should not cross water');
    });

    runner.it('should path around mountains', () => {
      const map = createTestMap([
        'GGGGG',
        'GMMMG',
        'GGGGG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 1, 4, 1);

      assertNotNull(result);

      const crossesMountain = result!.path.some(p => {
        const tile = map.getTile(p.q, p.r);
        return tile && tile.type === 'mountain';
      });
      assert(!crossesMountain, 'Path should not cross mountains');
    });

    runner.it('should return null when completely blocked', () => {
      const map = createTestMap([
        'GGW',
        'GGW',
        'GGW'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 2, 0);

      assertNull(result, 'No path should exist through water barrier');
    });

    runner.it('should return null when start is impassable', () => {
      const map = createTestMap([
        'WGG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 2, 0);

      assertNull(result);
    });

    runner.it('should return null when goal is impassable', () => {
      const map = createTestMap([
        'GGW'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 2, 0);

      assertNull(result);
    });

  });

  runner.describe('Terrain cost preferences', () => {

    runner.it('should prefer roads over grass', () => {
      const map = createTestMap([
        'GGGGG',
        'RRRRR',
        'GGGGG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 1, 4, 1);

      assertNotNull(result);
      assertEqual(result!.totalCost, 2, 'Road path cost should be 2 (4 * 0.5)');

      const allRoad = result!.path.every(p => {
        const tile = map.getTile(p.q, p.r);
        return tile && tile.type === 'road';
      });
      assert(allRoad, 'Path should follow road');
    });

    runner.it('should prefer grass over woods', () => {
      const map = createTestMap([
        'GGGGG',
        'FFFFF',
        'GGGGG'
      ]);

      const pathfinder = new Pathfinder(map);

      const grassResult = pathfinder.findPath(0, 0, 4, 0);
      const woodsResult = pathfinder.findPath(0, 1, 4, 1);

      assert(grassResult!.totalCost < woodsResult!.totalCost,
        'Grass path should be cheaper than woods path');
    });

    runner.it('should account for woods cost (1.5)', () => {
      const map = createTestMap([
        'FFFFF'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 4, 0);

      assertNotNull(result);
      assertEqual(result!.totalCost, 6, 'Woods cost: 4 tiles * 1.5 = 6');
    });

    runner.it('should take longer road if shorter path is blocked', () => {
      const map = createTestMap([
        'GRRRG',
        'GWWWR',
        'GRRRR'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 4, 1);

      assertNotNull(result);

      const crossesWater = result!.path.some(p => {
        const tile = map.getTile(p.q, p.r);
        return tile && tile.type === 'water';
      });
      assert(!crossesWater, 'Should take road around water');
    });

  });

  runner.describe('Edge cases', () => {

    runner.it('should handle single tile map', () => {
      const map = createTestMap(['G']);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 0, 0);

      assertNotNull(result);
      assertEqual(result!.path.length, 1);
    });

    runner.it('should return null for nonexistent tiles', () => {
      const map = createTestMap(['G']);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 10, 10);

      assertNull(result);
    });

    runner.it('should handle building tiles as passable', () => {
      const map = createTestMap([
        'GBBBG'
      ]);

      const pathfinder = new Pathfinder(map);
      const result = pathfinder.findPath(0, 0, 4, 0);

      assertNotNull(result);
      assertEqual(result!.totalCost, 4, 'Buildings cost 1 like grass');
    });

  });

});

export default runner;
