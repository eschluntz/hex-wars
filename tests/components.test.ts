// ============================================================================
// HEX DOMINION - Component System Tests
// ============================================================================
// Tests validation logic, not specific balance values.

import { TestRunner, assertEqual, assert } from './framework.js';
import {
  CHASSIS,
  WEAPONS,
  SYSTEMS,
  getChassis,
  getWeapon,
  getSystem,
  getAllChassis,
  getAllWeapons,
  getAllSystems,
  validateTemplate,
  computeTemplateCost,
} from '../src/components.js';

const runner = new TestRunner();

runner.describe('Components', () => {

  // ==========================================================================
  // Structure validation (ensures components are properly defined)
  // ==========================================================================

  runner.describe('Component structure', () => {
    runner.it('all chassis should have required properties', () => {
      for (const chassis of getAllChassis()) {
        assert(typeof chassis.id === 'string', `${chassis.id} should have string id`);
        assert(typeof chassis.name === 'string', `${chassis.id} should have string name`);
        assert(typeof chassis.speed === 'number' && chassis.speed > 0, `${chassis.id} should have positive speed`);
        assert(typeof chassis.maxWeight === 'number' && chassis.maxWeight > 0, `${chassis.id} should have positive maxWeight`);
        assert(typeof chassis.baseCost === 'number' && chassis.baseCost > 0, `${chassis.id} should have positive baseCost`);
        assert(chassis.terrainCosts !== undefined, `${chassis.id} should have terrainCosts`);
      }
    });

    runner.it('all weapons should have required properties', () => {
      for (const weapon of getAllWeapons()) {
        assert(typeof weapon.id === 'string', `${weapon.id} should have string id`);
        assert(typeof weapon.name === 'string', `${weapon.id} should have string name`);
        assert(typeof weapon.attack === 'number' && weapon.attack > 0, `${weapon.id} should have positive attack`);
        assert(typeof weapon.range === 'number' && weapon.range > 0, `${weapon.id} should have positive range`);
        assert(typeof weapon.weight === 'number' && weapon.weight > 0, `${weapon.id} should have positive weight`);
        assert(typeof weapon.cost === 'number' && weapon.cost >= 0, `${weapon.id} should have non-negative cost`);
        assert(typeof weapon.armorPiercing === 'boolean', `${weapon.id} should have boolean armorPiercing`);
      }
    });

    runner.it('all systems should have required properties', () => {
      for (const system of getAllSystems()) {
        assert(typeof system.id === 'string', `${system.id} should have string id`);
        assert(typeof system.name === 'string', `${system.id} should have string name`);
        assert(typeof system.weight === 'number' && system.weight > 0, `${system.id} should have positive weight`);
        assert(typeof system.cost === 'number' && system.cost >= 0, `${system.id} should have non-negative cost`);
      }
    });

    runner.it('should have at least one chassis, weapon, and system', () => {
      assert(getAllChassis().length > 0, 'Should have at least one chassis');
      assert(getAllWeapons().length > 0, 'Should have at least one weapon');
      assert(getAllSystems().length > 0, 'Should have at least one system');
    });
  });

  // ==========================================================================
  // Accessor tests
  // ==========================================================================

  runner.describe('getChassis / getWeapon / getSystem', () => {
    runner.it('should return chassis by id', () => {
      const foot = getChassis('foot');
      assertEqual(foot.id, 'foot');
    });

    runner.it('should return weapon by id', () => {
      const cannon = getWeapon('cannon');
      assertEqual(cannon.id, 'cannon');
    });

    runner.it('should return system by id', () => {
      const capture = getSystem('capture');
      assertEqual(capture.id, 'capture');
    });
  });

  // ==========================================================================
  // Validation logic tests
  // ==========================================================================

  runner.describe('validateTemplate', () => {
    runner.it('should validate foot + machineGun + capture', () => {
      const result = validateTemplate('foot', 'machineGun', ['capture']);
      assertEqual(result.valid, true);
    });

    runner.it('should reject capture on non-foot chassis', () => {
      const wheelsResult = validateTemplate('wheels', 'machineGun', ['capture']);
      assertEqual(wheelsResult.valid, false);
      assert(wheelsResult.error!.includes('requires chassis'));

      const treadsResult = validateTemplate('treads', 'cannon', ['capture']);
      assertEqual(treadsResult.valid, false);
    });

    runner.it('should validate treads + cannon + armor', () => {
      const result = validateTemplate('treads', 'cannon', ['armor']);
      assertEqual(result.valid, true);
    });

    runner.it('should validate chassis + armor without weapon', () => {
      const result = validateTemplate('wheels', null, ['armor']);
      assertEqual(result.valid, true);
    });

    runner.it('should reject armor on foot', () => {
      const result = validateTemplate('foot', 'machineGun', ['armor']);
      assertEqual(result.valid, false);
      assert(result.error!.includes('requires chassis'));
    });

    runner.it('should validate build system with weapon', () => {
      const result = validateTemplate('foot', 'machineGun', ['build']);
      assertEqual(result.valid, true);
    });

    runner.it('should validate build system without weapon', () => {
      const result = validateTemplate('foot', null, ['build']);
      assertEqual(result.valid, true);
    });

    runner.it('should reject when weight exceeds chassis capacity', () => {
      // Cannon (weight 4) on foot (maxWeight 2)
      const result = validateTemplate('foot', 'cannon', []);
      assertEqual(result.valid, false);
      assert(result.error!.includes('Weight') || result.error!.includes('exceeds'));
    });

    runner.it('should track total and max weight correctly', () => {
      const result = validateTemplate('treads', 'cannon', ['armor']);
      // Should report weights regardless of validity
      assert(result.totalWeight > 0);
      assert(result.maxWeight > 0);
      assert(result.totalWeight <= result.maxWeight);
    });
  });

  // ==========================================================================
  // Cost calculation tests
  // ==========================================================================

  runner.describe('computeTemplateCost', () => {
    runner.it('should sum chassis + weapon + system costs', () => {
      const chassis = getChassis('foot');
      const weapon = getWeapon('machineGun');
      const system = getSystem('capture');

      const cost = computeTemplateCost('foot', 'machineGun', ['capture']);
      assertEqual(cost, chassis.baseCost + weapon.cost + system.cost);
    });

    runner.it('should handle null weapon', () => {
      const chassis = getChassis('foot');
      const system = getSystem('build');

      const cost = computeTemplateCost('foot', null, ['build']);
      assertEqual(cost, chassis.baseCost + system.cost);
    });

    runner.it('should handle no systems', () => {
      const chassis = getChassis('wheels');
      const weapon = getWeapon('machineGun');

      const cost = computeTemplateCost('wheels', 'machineGun', []);
      assertEqual(cost, chassis.baseCost + weapon.cost);
    });

    runner.it('should handle chassis only', () => {
      const chassis = getChassis('foot');
      const cost = computeTemplateCost('foot', null, []);
      assertEqual(cost, chassis.baseCost);
    });
  });

});

export default runner;
