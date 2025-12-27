// ============================================================================
// HEX DOMINION - Building Tests
// ============================================================================

import { TestRunner, assertEqual, assertDeepEqual } from './framework.js';
import { createBuilding, getBuildingKey, BUILDING_INCOME, BUILDING_ICONS } from '../src/building.js';

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

  runner.describe('BUILDING_INCOME', () => {

    runner.it('should have correct income for city', () => {
      assertEqual(BUILDING_INCOME.city.funds, 1000);
      assertEqual(BUILDING_INCOME.city.science, 0);
    });

    runner.it('should have correct income for factory', () => {
      assertEqual(BUILDING_INCOME.factory.funds, 0);
      assertEqual(BUILDING_INCOME.factory.science, 0);
    });

    runner.it('should have correct income for lab', () => {
      assertEqual(BUILDING_INCOME.lab.funds, 0);
      assertEqual(BUILDING_INCOME.lab.science, 1);
    });

  });

  runner.describe('BUILDING_ICONS', () => {

    runner.it('should have icons for all building types', () => {
      assertEqual(BUILDING_ICONS.city, '🏙️');
      assertEqual(BUILDING_ICONS.factory, '🏭');
      assertEqual(BUILDING_ICONS.lab, '🔬');
    });

  });

});

export default runner;
