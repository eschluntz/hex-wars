// ============================================================================
// HEX DOMINION - Unit Movement Tests
// ============================================================================

import { TestRunner, assert, assertEqual } from './framework.js';
import { createTestMap } from './helpers.js';
import { Pathfinder } from '../src/pathfinder.js';
import { Unit } from '../src/unit.js';

const runner = new TestRunner();

runner.describe('Unit', () => {

  runner.describe('Initialization', () => {

    runner.it('should initialize with correct position and speed', () => {
      const unit = new Unit('test1', 5, 3, 4);

      assertEqual(unit.id, 'test1');
      assertEqual(unit.q, 5);
      assertEqual(unit.r, 3);
      assertEqual(unit.speed, 4);
      assertEqual(unit.movementRemaining, 4);
    });

    runner.it('should use default speed of 4', () => {
      const unit = new Unit('test2', 0, 0);
      assertEqual(unit.speed, 4);
    });

    runner.it('should start with no goal', () => {
      const unit = new Unit('test3', 0, 0);

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
      const unit = new Unit('test', 0, 0, 4);

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
      const unit = new Unit('test', 0, 0, 4);

      const success = unit.setGoal(2, 0, pathfinder);

      assert(!success, 'Should fail for blocked path');
      assertEqual(unit.currentPath, null);
    });

    runner.it('should clear goal', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', 0, 0, 4);

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
      const unit = new Unit('test', 0, 0, 4);

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
      const unit = new Unit('test', 0, 0, 3);

      unit.setGoal(7, 0, pathfinder);
      const moved = unit.move(map);

      assertEqual(moved.length, 3, 'Should move 3 tiles (speed limit)');
      assertEqual(unit.q, 3);
      assertEqual(unit.getRemainingPathLength(), 4);
      assert(!unit.hasReachedGoal());
    });

    runner.it('should return empty array when no path', () => {
      const map = createTestMap(['G']);
      const unit = new Unit('test', 0, 0, 4);

      const moved = unit.move(map);

      assertEqual(moved.length, 0);
    });

    runner.it('should return empty array when already at goal', () => {
      const map = createTestMap(['GGGGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', 0, 0, 10);

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
      const unit = new Unit('test', 0, 0, 3);

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
      const unit = new Unit('test', 0, 0, 5);

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
      const unit = new Unit('test', 0, 0, 2);

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
      const unit = new Unit('test', 0, 0, 3);

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
      const unit = new Unit('test', 0, 0, 3);

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
      const unit = new Unit('test', 0, 0, 2);

      unit.setGoal(2, 0, pathfinder);
      unit.move(map);

      assertEqual(unit.q, 2, 'Should reach tile 2 (R at 0.5 + R at 0.5 + F at 1.5 still fits in 2)');
    });

  });

  runner.describe('Edge cases', () => {

    runner.it('should handle zero speed', () => {
      const map = createTestMap(['GGG']);
      const pathfinder = new Pathfinder(map);
      const unit = new Unit('test', 0, 0, 0);

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
      const unit = new Unit('test', 0, 0, 2);

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
