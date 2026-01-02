// ============================================================================
// HEX DOMINION - Building Tests
// ============================================================================

import { TestRunner, assertEqual, assertDeepEqual, assertNull, assert } from './framework.js';
import { createBuilding, getBuildingKey, CAPTURE_RESISTANCE } from '../src/building.js';
import { GameMap } from '../src/game-map.js';
import { MAP_CONFIGS } from '../src/config.js';

const runner = new TestRunner();

runner.describe('Building', () => {

  runner.describe('createBuilding', () => {

    runner.it('should create a city with correct properties', () => {
      const building = createBuilding(5, 3, 'city', 'player');

      assertEqual(building.q, 5);
      assertEqual(building.r, 3);
      assertEqual(building.type, 'city');
      assertEqual(building.owner, 'player');
    });

    runner.it('should create a factory with null owner (neutral)', () => {
      const building = createBuilding(0, 0, 'factory', null);

      assertEqual(building.type, 'factory');
      assertEqual(building.owner, null);
    });

    runner.it('should create a lab with enemy owner', () => {
      const building = createBuilding(10, 5, 'lab', 'enemy');

      assertEqual(building.type, 'lab');
      assertEqual(building.owner, 'enemy');
    });

  });

  runner.describe('getBuildingKey', () => {

    runner.it('should return correct key format', () => {
      assertEqual(getBuildingKey(5, 3), '5,3');
      assertEqual(getBuildingKey(0, 0), '0,0');
      assertEqual(getBuildingKey(-2, 10), '-2,10');
    });

  });

  runner.describe('capital building', () => {

    runner.it('should create a capital with correct properties', () => {
      const building = createBuilding(5, 3, 'capital', 'player');

      assertEqual(building.q, 5);
      assertEqual(building.r, 3);
      assertEqual(building.type, 'capital');
      assertEqual(building.owner, 'player');
    });

    runner.it('capital can be captured like other buildings', () => {
      const building = createBuilding(0, 0, 'capital', 'enemy');
      assertEqual(building.owner, 'enemy');

      // Simulate capture by changing owner
      building.owner = 'player';
      assertEqual(building.owner, 'player');
    });

  });

  runner.describe('capture mechanics', () => {

    runner.it('neutral building can be captured', () => {
      const building = createBuilding(0, 0, 'city', null);
      assertEqual(building.owner, null);

      // Simulate capture by changing owner
      building.owner = 'player';
      assertEqual(building.owner, 'player');
    });

    runner.it('enemy building can be captured', () => {
      const building = createBuilding(0, 0, 'factory', 'enemy');
      assertEqual(building.owner, 'enemy');

      // Simulate capture by changing owner
      building.owner = 'player';
      assertEqual(building.owner, 'player');
    });

    runner.it('all building types are capturable', () => {
      const city = createBuilding(0, 0, 'city', 'enemy');
      const factory = createBuilding(1, 0, 'factory', 'enemy');
      const lab = createBuilding(2, 0, 'lab', null);

      // All can have their owner changed
      city.owner = 'player';
      factory.owner = 'player';
      lab.owner = 'player';

      assertEqual(city.owner, 'player');
      assertEqual(factory.owner, 'player');
      assertEqual(lab.owner, 'player');
    });

  });

  runner.describe('capture resistance', () => {

    runner.it('building starts with 20 resistance and no capturing unit', () => {
      const building = createBuilding(0, 0, 'city', null);
      assertEqual(building.captureResistance, CAPTURE_RESISTANCE);
      assertNull(building.capturingUnitId);
    });

    runner.it('CAPTURE_RESISTANCE constant equals 20', () => {
      assertEqual(CAPTURE_RESISTANCE, 20);
    });

    runner.it('full health unit (10 HP) captures in 2 turns', () => {
      const building = createBuilding(0, 0, 'city', null);

      // Turn 1: 10 damage
      building.capturingUnitId = 'unit1';
      building.captureResistance -= 10;
      assertEqual(building.captureResistance, 10);

      // Turn 2: 10 more damage - captured
      building.captureResistance -= 10;
      assertEqual(building.captureResistance <= 0, true);
    });

    runner.it('9 HP unit captures in 3 turns', () => {
      const building = createBuilding(0, 0, 'city', null);

      // Turn 1: 9 damage
      building.capturingUnitId = 'unit1';
      building.captureResistance -= 9;
      assertEqual(building.captureResistance, 11);

      // Turn 2: 9 more damage
      building.captureResistance -= 9;
      assertEqual(building.captureResistance, 2);

      // Turn 3: 9 more damage - captured
      building.captureResistance -= 9;
      assertEqual(building.captureResistance <= 0, true);
    });

    runner.it('different unit taking over resets resistance', () => {
      const building = createBuilding(0, 0, 'city', null);

      // Unit 1 starts capturing
      building.capturingUnitId = 'unit1';
      building.captureResistance -= 10;
      assertEqual(building.captureResistance, 10);

      // Unit 2 takes over - reset resistance first
      building.captureResistance = CAPTURE_RESISTANCE;
      building.capturingUnitId = 'unit2';
      assertEqual(building.captureResistance, 20);
      assertEqual(building.capturingUnitId, 'unit2');
    });

    runner.it('tracking capturingUnitId', () => {
      const building = createBuilding(0, 0, 'city', null);
      assertNull(building.capturingUnitId);

      building.capturingUnitId = 'soldier_1';
      assertEqual(building.capturingUnitId, 'soldier_1');

      // Clear on capture complete
      building.capturingUnitId = null;
      assertNull(building.capturingUnitId);
    });

  });

  runner.describe('GameMap capture methods', () => {

    runner.it('applyCaptureProgress subtracts damage from resistance', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));

      const captured = map.applyCaptureProgress(0, 0, 'unit1', 10);

      assertEqual(captured, false);
      const building = map.getBuilding(0, 0)!;
      assertEqual(building.captureResistance, 10);
      assertEqual(building.capturingUnitId, 'unit1');
    });

    runner.it('applyCaptureProgress returns true when resistance reaches 0', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));

      // First turn
      map.applyCaptureProgress(0, 0, 'unit1', 10);
      // Second turn - should capture
      const captured = map.applyCaptureProgress(0, 0, 'unit1', 10);

      assertEqual(captured, true);
      const building = map.getBuilding(0, 0)!;
      assertEqual(building.captureResistance, CAPTURE_RESISTANCE);
      assertNull(building.capturingUnitId);
    });

    runner.it('applyCaptureProgress resets resistance when different unit captures', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));

      // Unit1 starts capturing
      map.applyCaptureProgress(0, 0, 'unit1', 10);
      const building = map.getBuilding(0, 0)!;
      assertEqual(building.captureResistance, 10);

      // Unit2 takes over - should reset resistance first, then apply damage
      map.applyCaptureProgress(0, 0, 'unit2', 5);
      assertEqual(building.captureResistance, 15); // Reset to 20, then -5
      assertEqual(building.capturingUnitId, 'unit2');
    });

    runner.it('applyCaptureProgress same unit continues from previous progress', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));

      map.applyCaptureProgress(0, 0, 'unit1', 8);
      map.applyCaptureProgress(0, 0, 'unit1', 8);

      const building = map.getBuilding(0, 0)!;
      assertEqual(building.captureResistance, 4); // 20 - 8 - 8
    });

    runner.it('resetCaptureByUnit resets matching building', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));

      map.applyCaptureProgress(0, 0, 'unit1', 10);
      map.resetCaptureByUnit('unit1');

      const building = map.getBuilding(0, 0)!;
      assertEqual(building.captureResistance, CAPTURE_RESISTANCE);
      assertNull(building.capturingUnitId);
    });

    runner.it('resetCaptureByUnit does not affect other buildings', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));
      map.addBuilding(createBuilding(1, 0, 'factory', 'enemy'));

      map.applyCaptureProgress(0, 0, 'unit1', 10);
      map.applyCaptureProgress(1, 0, 'unit2', 5);
      map.resetCaptureByUnit('unit1');

      // unit1's building should be reset
      const building1 = map.getBuilding(0, 0)!;
      assertEqual(building1.captureResistance, CAPTURE_RESISTANCE);
      assertNull(building1.capturingUnitId);

      // unit2's building should be unchanged
      const building2 = map.getBuilding(1, 0)!;
      assertEqual(building2.captureResistance, 15);
      assertEqual(building2.capturingUnitId, 'unit2');
    });

    runner.it('resetCaptureByUnit handles non-existent unit', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'enemy'));

      map.applyCaptureProgress(0, 0, 'unit1', 10);
      map.resetCaptureByUnit('nonexistent'); // Should not throw

      // Original capture should be unchanged
      const building = map.getBuilding(0, 0)!;
      assertEqual(building.captureResistance, 10);
      assertEqual(building.capturingUnitId, 'unit1');
    });

  });

  runner.describe('getCapital', () => {

    runner.it('should return capital for owner', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'capital', 'player'));
      map.addBuilding(createBuilding(5, 5, 'city', 'player'));

      const capital = map.getCapital('player');
      assert(capital !== undefined, 'Should find capital');
      assertEqual(capital!.type, 'capital');
      assertEqual(capital!.owner, 'player');
      assertEqual(capital!.q, 0);
      assertEqual(capital!.r, 0);
    });

    runner.it('should return undefined when no capital exists', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'city', 'player'));

      const capital = map.getCapital('player');
      assertEqual(capital, undefined);
    });

    runner.it('should return undefined for wrong owner', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'capital', 'player'));

      const capital = map.getCapital('enemy');
      assertEqual(capital, undefined);
    });

    runner.it('should return undefined after capital is captured', () => {
      const map = new GameMap(MAP_CONFIGS.small);
      map.addBuilding(createBuilding(0, 0, 'capital', 'player'));

      // Initially player owns it
      let capital = map.getCapital('player');
      assert(capital !== undefined, 'Player should own capital');

      // Capture by enemy
      map.setBuildingOwner(0, 0, 'enemy');

      // getCapital('player') now returns undefined - player lost their capital
      assertEqual(map.getCapital('player'), undefined);
      // Enemy now has a capital
      assert(map.getCapital('enemy') !== undefined, 'Enemy should now own the capital');
    });

  });

});

export default runner;
