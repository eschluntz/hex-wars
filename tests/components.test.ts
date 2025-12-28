// ============================================================================
// HEX DOMINION - Component System Tests
// ============================================================================

import { TestRunner, assertEqual, assert, assertThrows } from './framework.js';
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
  validateComponentWeight,
  computeTemplateCost,
} from '../src/components.js';

const runner = new TestRunner();

runner.describe('Components', () => {
  runner.describe('CHASSIS', () => {
    runner.it('should have foot chassis with correct properties', () => {
      const foot = CHASSIS.foot!;

      assertEqual(foot.id, 'foot');
      assertEqual(foot.name, 'Foot');
      assertEqual(foot.speed, 3);
      assertEqual(foot.maxWeight, 2);
      assertEqual(foot.baseCost, 500);
    });

    runner.it('should have wheels chassis with correct properties', () => {
      const wheels = CHASSIS.wheels!;

      assertEqual(wheels.id, 'wheels');
      assertEqual(wheels.speed, 6);
      assertEqual(wheels.maxWeight, 3);
      assertEqual(wheels.baseCost, 800);
    });

    runner.it('should have treads chassis with high weight capacity', () => {
      const treads = CHASSIS.treads!;

      assertEqual(treads.id, 'treads');
      assertEqual(treads.speed, 4);
      assertEqual(treads.maxWeight, 10);
      assertEqual(treads.baseCost, 1500);
    });

    runner.it('foot should move equally on all passable terrain', () => {
      const foot = CHASSIS.foot!;
      assertEqual(foot.terrainCosts.grass, 1);
      assertEqual(foot.terrainCosts.road, 1);   // Not faster on roads
      assertEqual(foot.terrainCosts.woods, 1);  // Not slower in woods
    });

    runner.it('treads should be slower in woods', () => {
      const treads = CHASSIS.treads!;
      assertEqual(treads.terrainCosts.woods, 2);
    });
  });

  runner.describe('WEAPONS', () => {
    runner.it('should have machineGun without armor piercing', () => {
      const mg = WEAPONS.machineGun!;

      assertEqual(mg.id, 'machineGun');
      assertEqual(mg.attack, 4);
      assertEqual(mg.armorPiercing, false);
      assertEqual(mg.range, 1);
      assertEqual(mg.weight, 1);
      assertEqual(mg.cost, 500);
    });

    runner.it('should have heavyMG with higher attack', () => {
      const hmg = WEAPONS.heavyMG!;

      assertEqual(hmg.attack, 6);
      assertEqual(hmg.armorPiercing, false);
      assertEqual(hmg.weight, 2);
    });

    runner.it('should have cannon with armor piercing', () => {
      const cannon = WEAPONS.cannon!;

      assertEqual(cannon.id, 'cannon');
      assertEqual(cannon.attack, 7);
      assertEqual(cannon.armorPiercing, true);
      assertEqual(cannon.range, 1);
      assertEqual(cannon.weight, 4);
      assertEqual(cannon.cost, 1500);
    });

    runner.it('should have artillery with long range and armor piercing', () => {
      const artillery = WEAPONS.artillery!;

      assertEqual(artillery.attack, 5);
      assertEqual(artillery.armorPiercing, true);
      assertEqual(artillery.range, 3);
      assertEqual(artillery.weight, 5);
      assertEqual(artillery.cost, 2000);
    });
  });

  runner.describe('SYSTEMS', () => {
    runner.it('should have capture system for foot only', () => {
      const capture = SYSTEMS.capture!;

      assertEqual(capture.id, 'capture');
      assertEqual(capture.weight, 1);
      assertEqual(capture.cost, 0);
      assertEqual(capture.grantsCapture, true);
      assert(capture.requiresChassis!.includes('foot'));
      assertEqual(capture.requiresChassis!.length, 1);
    });

    runner.it('should have build system', () => {
      const build = SYSTEMS.build!;

      assertEqual(build.id, 'build');
      assertEqual(build.weight, 1);
      assertEqual(build.cost, 500);
      assertEqual(build.grantsBuild, true);
    });

    runner.it('should have armor system for wheels and treads', () => {
      const armor = SYSTEMS.armor!;

      assertEqual(armor.id, 'armor');
      assertEqual(armor.weight, 2);
      assertEqual(armor.cost, 1000);
      assertEqual(armor.grantsArmor, true);
      assert(armor.requiresChassis!.includes('wheels'));
      assert(armor.requiresChassis!.includes('treads'));
      assert(!armor.requiresChassis!.includes('foot'));
    });
  });

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

  runner.describe('getAllChassis / getAllWeapons / getAllSystems', () => {
    runner.it('should return all chassis as array', () => {
      const all = getAllChassis();
      assert(Array.isArray(all));
      assertEqual(all.length, 3);
    });

    runner.it('should return all weapons as array', () => {
      const all = getAllWeapons();
      assert(Array.isArray(all));
      assertEqual(all.length, 4);
    });

    runner.it('should return all systems as array', () => {
      const all = getAllSystems();
      assert(Array.isArray(all));
      assertEqual(all.length, 3);
    });
  });

  runner.describe('validateTemplate', () => {
    runner.it('should validate foot + machineGun + capture', () => {
      const result = validateTemplate('foot', 'machineGun', ['capture']);

      assertEqual(result.valid, true);
      assertEqual(result.totalWeight, 2); // MG (1) + capture (1)
      assertEqual(result.maxWeight, 2);
    });

    runner.it('should reject capture on wheels', () => {
      const result = validateTemplate('wheels', 'machineGun', ['capture']);

      assertEqual(result.valid, false);
      assert(result.error!.includes('requires chassis'));
    });

    runner.it('should reject capture on treads', () => {
      const result = validateTemplate('treads', 'cannon', ['capture']);

      assertEqual(result.valid, false);
      assert(result.error!.includes('requires chassis'));
    });

    runner.it('should validate treads + cannon + armor', () => {
      const result = validateTemplate('treads', 'cannon', ['armor']);

      assertEqual(result.valid, true);
      assertEqual(result.totalWeight, 6); // cannon (4) + armor (2)
    });

    runner.it('should validate wheels + armor (no weapon)', () => {
      const result = validateTemplate('wheels', null, ['armor']);

      assertEqual(result.valid, true);
      assertEqual(result.totalWeight, 2);
    });

    runner.it('should reject armor on foot', () => {
      const result = validateTemplate('foot', 'machineGun', ['armor']);

      assertEqual(result.valid, false);
      assert(result.error!.includes('requires chassis'));
    });

    runner.it('should validate build with weapon (combat engineer)', () => {
      const result = validateTemplate('foot', 'machineGun', ['build']);

      assertEqual(result.valid, true);
      assertEqual(result.totalWeight, 2); // MG (1) + build (1)
    });

    runner.it('should validate build without weapon', () => {
      const result = validateTemplate('foot', null, ['build']);

      assertEqual(result.valid, true);
    });

    runner.it('should validate wheeled builder with weapon', () => {
      const result = validateTemplate('wheels', 'machineGun', ['build']);

      assertEqual(result.valid, true);
      assertEqual(result.totalWeight, 2);
    });
  });

  runner.describe('validateComponentWeight (legacy)', () => {
    runner.it('should validate foot + machineGun (weight 1 <= 2)', () => {
      const result = validateComponentWeight('foot', 'machineGun');

      assertEqual(result.valid, true);
      assertEqual(result.totalWeight, 1);
      assertEqual(result.maxWeight, 2);
    });

    runner.it('should reject foot + cannon (weight 4 > 2)', () => {
      const result = validateComponentWeight('foot', 'cannon');

      assertEqual(result.valid, false);
      assertEqual(result.totalWeight, 4);
      assertEqual(result.maxWeight, 2);
    });
  });

  runner.describe('computeTemplateCost', () => {
    runner.it('should compute soldier cost (foot + MG + capture = 1000)', () => {
      const cost = computeTemplateCost('foot', 'machineGun', ['capture']);
      assertEqual(cost, 1000); // 500 + 500 + 0
    });

    runner.it('should compute tank cost (treads + cannon + armor = 4000)', () => {
      const cost = computeTemplateCost('treads', 'cannon', ['armor']);
      assertEqual(cost, 4000); // 1500 + 1500 + 1000
    });

    runner.it('should compute recon cost (wheels + MG = 1300)', () => {
      const cost = computeTemplateCost('wheels', 'machineGun');
      assertEqual(cost, 1300); // 800 + 500
    });

    runner.it('should compute builder cost (foot + build = 1000)', () => {
      const cost = computeTemplateCost('foot', null, ['build']);
      assertEqual(cost, 1000); // 500 + 500
    });

    runner.it('should compute armored recon (wheels + MG + armor = 2300)', () => {
      const cost = computeTemplateCost('wheels', 'machineGun', ['armor']);
      assertEqual(cost, 2300); // 800 + 500 + 1000
    });
  });
});

export default runner;
