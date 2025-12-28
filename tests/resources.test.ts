// ============================================================================
// HEX DOMINION - Resources Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from './framework.js';
import { ResourceManager } from '../src/resources.js';
import { createBuilding, type Building } from '../src/building.js';

const runner = new TestRunner();

runner.describe('ResourceManager', () => {

  runner.describe('initialization', () => {

    runner.it('should start with zero resources', () => {
      const manager = new ResourceManager(['player', 'enemy']);
      const playerRes = manager.getResources('player');
      const enemyRes = manager.getResources('enemy');

      assertEqual(playerRes.funds, 0);
      assertEqual(playerRes.science, 0);
      assertEqual(enemyRes.funds, 0);
      assertEqual(enemyRes.science, 0);
    });

  });

  runner.describe('addFunds', () => {

    runner.it('should add funds to correct team', () => {
      const manager = new ResourceManager(['player', 'enemy']);
      manager.addFunds('player', 1000);

      assertEqual(manager.getResources('player').funds, 1000);
      assertEqual(manager.getResources('enemy').funds, 0);
    });

    runner.it('should accumulate funds', () => {
      const manager = new ResourceManager(['player']);
      manager.addFunds('player', 500);
      manager.addFunds('player', 300);

      assertEqual(manager.getResources('player').funds, 800);
    });

  });

  runner.describe('addScience', () => {

    runner.it('should add science to correct team', () => {
      const manager = new ResourceManager(['player', 'enemy']);
      manager.addScience('player', 5);

      assertEqual(manager.getResources('player').science, 5);
      assertEqual(manager.getResources('enemy').science, 0);
    });

  });

  runner.describe('spendFunds', () => {

    runner.it('should deduct funds when affordable', () => {
      const manager = new ResourceManager(['player']);
      manager.addFunds('player', 1000);
      const result = manager.spendFunds('player', 400);

      assert(result);
      assertEqual(manager.getResources('player').funds, 600);
    });

    runner.it('should return false when not affordable', () => {
      const manager = new ResourceManager(['player']);
      manager.addFunds('player', 100);
      const result = manager.spendFunds('player', 500);

      assert(!result);
      assertEqual(manager.getResources('player').funds, 100);
    });

    runner.it('should allow spending exact amount', () => {
      const manager = new ResourceManager(['player']);
      manager.addFunds('player', 500);
      const result = manager.spendFunds('player', 500);

      assert(result);
      assertEqual(manager.getResources('player').funds, 0);
    });

  });

  runner.describe('canAfford', () => {

    runner.it('should return true when funds are sufficient', () => {
      const manager = new ResourceManager(['player']);
      manager.addFunds('player', 1000);

      assert(manager.canAfford('player', 500));
      assert(manager.canAfford('player', 1000));
    });

    runner.it('should return false when funds are insufficient', () => {
      const manager = new ResourceManager(['player']);
      manager.addFunds('player', 100);

      assert(!manager.canAfford('player', 500));
    });

  });

  runner.describe('spendScience', () => {

    runner.it('should deduct science when affordable', () => {
      const manager = new ResourceManager(['player']);
      manager.addScience('player', 20);
      const result = manager.spendScience('player', 8);

      assert(result);
      assertEqual(manager.getResources('player').science, 12);
    });

    runner.it('should return false when not affordable', () => {
      const manager = new ResourceManager(['player']);
      manager.addScience('player', 5);
      const result = manager.spendScience('player', 10);

      assert(!result);
      assertEqual(manager.getResources('player').science, 5);
    });

    runner.it('should allow spending exact amount', () => {
      const manager = new ResourceManager(['player']);
      manager.addScience('player', 15);
      const result = manager.spendScience('player', 15);

      assert(result);
      assertEqual(manager.getResources('player').science, 0);
    });

  });

  runner.describe('canAffordScience', () => {

    runner.it('should return true when science is sufficient', () => {
      const manager = new ResourceManager(['player']);
      manager.addScience('player', 20);

      assert(manager.canAffordScience('player', 10));
      assert(manager.canAffordScience('player', 20));
    });

    runner.it('should return false when science is insufficient', () => {
      const manager = new ResourceManager(['player']);
      manager.addScience('player', 5);

      assert(!manager.canAffordScience('player', 10));
    });

  });

  runner.describe('collectIncome', () => {

    runner.it('should collect income from owned cities', () => {
      const manager = new ResourceManager(['player']);
      const buildings: Building[] = [
        createBuilding(0, 0, 'city', 'player'),
        createBuilding(1, 0, 'city', 'player'),
      ];

      const income = manager.collectIncome('player', buildings);

      assertEqual(income.funds, 2000); // 2 cities * 1000
      assertEqual(income.science, 0);
      assertEqual(manager.getResources('player').funds, 2000);
    });

    runner.it('should collect science from owned labs', () => {
      const manager = new ResourceManager(['player']);
      const buildings: Building[] = [
        createBuilding(0, 0, 'lab', 'player'),
        createBuilding(1, 0, 'lab', 'player'),
        createBuilding(2, 0, 'lab', 'player'),
      ];

      const income = manager.collectIncome('player', buildings);

      assertEqual(income.funds, 0);
      assertEqual(income.science, 3); // 3 labs * 1
      assertEqual(manager.getResources('player').science, 3);
    });

    runner.it('should not collect from enemy buildings', () => {
      const manager = new ResourceManager(['player', 'enemy']);
      const buildings: Building[] = [
        createBuilding(0, 0, 'city', 'player'),
        createBuilding(1, 0, 'city', 'enemy'),
      ];

      const income = manager.collectIncome('player', buildings);

      assertEqual(income.funds, 1000); // Only player city
      assertEqual(manager.getResources('player').funds, 1000);
    });

    runner.it('should not collect from neutral buildings', () => {
      const manager = new ResourceManager(['player']);
      const buildings: Building[] = [
        createBuilding(0, 0, 'city', 'player'),
        createBuilding(1, 0, 'city', null),
      ];

      const income = manager.collectIncome('player', buildings);

      assertEqual(income.funds, 1000); // Only owned city
    });

    runner.it('should not collect income from factories', () => {
      const manager = new ResourceManager(['player']);
      const buildings: Building[] = [
        createBuilding(0, 0, 'factory', 'player'),
      ];

      const income = manager.collectIncome('player', buildings);

      assertEqual(income.funds, 0);
      assertEqual(income.science, 0);
    });

    runner.it('should collect mixed income from cities and labs', () => {
      const manager = new ResourceManager(['player']);
      const buildings: Building[] = [
        createBuilding(0, 0, 'city', 'player'),
        createBuilding(1, 0, 'lab', 'player'),
        createBuilding(2, 0, 'city', 'player'),
      ];

      const income = manager.collectIncome('player', buildings);

      assertEqual(income.funds, 2000);
      assertEqual(income.science, 1);
    });

  });

});

export default runner;
