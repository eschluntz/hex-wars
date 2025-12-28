// ============================================================================
// HEX DOMINION - Production/Unit Templates Tests
// ============================================================================
// Tests template creation logic and validation, not specific balance values.

import { TestRunner, assertEqual, assert, assertThrows } from './framework.js';
import {
  UNIT_TEMPLATES,
  getAvailableTemplates,
  getTemplate,
  createTemplate,
  getTemplateComponents,
} from '../src/unit-templates.js';

const runner = new TestRunner();

runner.describe('Unit Templates', () => {

  // ==========================================================================
  // Base template validation
  // ==========================================================================

  runner.describe('UNIT_TEMPLATES structure', () => {
    runner.it('should have soldier, tank, and recon templates', () => {
      assert(UNIT_TEMPLATES.soldier !== undefined, 'Should have soldier');
      assert(UNIT_TEMPLATES.tank !== undefined, 'Should have tank');
      assert(UNIT_TEMPLATES.recon !== undefined, 'Should have recon');
    });

    runner.it('all templates should have required properties', () => {
      for (const template of getAvailableTemplates()) {
        assert(typeof template.id === 'string');
        assert(typeof template.name === 'string');
        assert(typeof template.cost === 'number' && template.cost > 0);
        assert(typeof template.speed === 'number' && template.speed > 0);
        assert(typeof template.attack === 'number' && template.attack >= 0);
        assert(typeof template.range === 'number' && template.range >= 0);
        assert(typeof template.armored === 'boolean');
        assert(typeof template.armorPiercing === 'boolean');
        assert(template.terrainCosts !== undefined);
      }
    });
  });

  // ==========================================================================
  // Template properties (game rules, not balance)
  // ==========================================================================

  runner.describe('template armor/AP properties', () => {
    runner.it('soldier should not be armored and not have AP', () => {
      const soldier = getTemplate('soldier');
      assertEqual(soldier.armored, false);
      assertEqual(soldier.armorPiercing, false);
    });

    runner.it('tank should be armored and have AP', () => {
      const tank = getTemplate('tank');
      assertEqual(tank.armored, true);
      assertEqual(tank.armorPiercing, true);
    });

    runner.it('recon should not be armored and not have AP', () => {
      const recon = getTemplate('recon');
      assertEqual(recon.armored, false);
      assertEqual(recon.armorPiercing, false);
    });
  });

  runner.describe('template components', () => {
    runner.it('soldier should be foot + machineGun + capture', () => {
      const soldier = getTemplate('soldier');
      assertEqual(soldier.chassisId, 'foot');
      assertEqual(soldier.weaponId, 'machineGun');
      assert(soldier.systemIds.includes('capture'));
    });

    runner.it('tank should be treads + cannon + armor', () => {
      const tank = getTemplate('tank');
      assertEqual(tank.chassisId, 'treads');
      assertEqual(tank.weaponId, 'cannon');
      assert(tank.systemIds.includes('armor'));
    });

    runner.it('recon should be wheels + machineGun (no systems)', () => {
      const recon = getTemplate('recon');
      assertEqual(recon.chassisId, 'wheels');
      assertEqual(recon.weaponId, 'machineGun');
      assertEqual(recon.systemIds.length, 0);
    });
  });

  // ==========================================================================
  // Template lookup
  // ==========================================================================

  runner.describe('getAvailableTemplates', () => {
    runner.it('should return array of templates', () => {
      const templates = getAvailableTemplates();
      assert(Array.isArray(templates));
      assert(templates.length >= 3, 'Should have at least soldier, tank, recon');
    });

    runner.it('should include base templates', () => {
      const templates = getAvailableTemplates();
      const ids = templates.map((t) => t.id);
      assert(ids.includes('soldier'));
      assert(ids.includes('tank'));
      assert(ids.includes('recon'));
    });
  });

  runner.describe('getTemplate', () => {
    runner.it('should return template by id', () => {
      const soldier = getTemplate('soldier');
      assertEqual(soldier.id, 'soldier');

      const tank = getTemplate('tank');
      assertEqual(tank.id, 'tank');
    });
  });

  // ==========================================================================
  // Template creation and validation
  // ==========================================================================

  runner.describe('createTemplate', () => {
    runner.it('should create valid template with foot + machineGun', () => {
      const template = createTemplate('test', 'Test Unit', 'foot', 'machineGun');
      assertEqual(template.id, 'test');
      assert(template.speed > 0);
      assert(template.attack > 0);
    });

    runner.it('should set canCapture when capture system included', () => {
      const withCapture = createTemplate('inf', 'Infantry', 'foot', 'machineGun', ['capture']);
      assertEqual(withCapture.canCapture, true);

      const without = createTemplate('inf2', 'Infantry2', 'foot', 'machineGun', []);
      assertEqual(without.canCapture, false);
    });

    runner.it('should set armored when armor system included', () => {
      const armored = createTemplate('heavy', 'Heavy', 'treads', 'cannon', ['armor']);
      assertEqual(armored.armored, true);

      const unarmored = createTemplate('light', 'Light', 'treads', 'cannon', []);
      assertEqual(unarmored.armored, false);
    });

    runner.it('should set armorPiercing from weapon', () => {
      const ap = createTemplate('ap', 'AP Unit', 'treads', 'cannon', []);
      assertEqual(ap.armorPiercing, true);

      const noAp = createTemplate('noap', 'No AP', 'foot', 'machineGun', []);
      assertEqual(noAp.armorPiercing, false);
    });

    runner.it('should throw when weight exceeds capacity', () => {
      assertThrows(() => {
        createTemplate('invalid', 'Invalid', 'foot', 'cannon'); // cannon too heavy for foot
      });
    });

    runner.it('should throw when capture used on non-foot chassis', () => {
      assertThrows(() => {
        createTemplate('invalid', 'Invalid', 'wheels', 'machineGun', ['capture']);
      });
    });

    runner.it('should throw when armor used on foot chassis', () => {
      assertThrows(() => {
        createTemplate('invalid', 'Invalid', 'foot', 'machineGun', ['armor']);
      });
    });

    runner.it('should create weaponless template', () => {
      const template = createTemplate('engineer', 'Engineer', 'foot', null, ['build']);
      assertEqual(template.attack, 0);
      assertEqual(template.range, 0);
      assertEqual(template.canBuild, true);
    });
  });

  // ==========================================================================
  // Template component extraction
  // ==========================================================================

  runner.describe('getTemplateComponents', () => {
    runner.it('should return chassis, weapon, and systems', () => {
      const soldier = getTemplate('soldier');
      const components = getTemplateComponents(soldier);

      assertEqual(components.chassis.id, 'foot');
      assertEqual(components.weapon!.id, 'machineGun');
      assertEqual(components.systems.length, 1);
      assertEqual(components.systems[0]!.id, 'capture');
    });

    runner.it('should return null weapon for weaponless template', () => {
      const builder = createTemplate('builder', 'Builder', 'foot', null, ['build']);
      const components = getTemplateComponents(builder);

      assertEqual(components.chassis.id, 'foot');
      assertEqual(components.weapon, null);
    });
  });

  // ==========================================================================
  // Relative comparisons (stable even if values change)
  // ==========================================================================

  runner.describe('template relative properties', () => {
    runner.it('soldier should be cheaper than tank', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      assert(soldier.cost < tank.cost);
    });

    runner.it('tank should have highest attack of base units', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      const recon = getTemplate('recon');

      assert(tank.attack > soldier.attack);
      assert(tank.attack > recon.attack);
    });

    runner.it('recon should be fastest of base units', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      const recon = getTemplate('recon');

      assert(recon.speed > soldier.speed);
      assert(recon.speed > tank.speed);
    });
  });

  // ==========================================================================
  // Ability tests
  // ==========================================================================

  runner.describe('capture ability', () => {
    runner.it('soldier should be able to capture', () => {
      const soldier = getTemplate('soldier');
      assertEqual(soldier.canCapture, true);
    });

    runner.it('tank should not be able to capture', () => {
      const tank = getTemplate('tank');
      assertEqual(tank.canCapture, false);
    });

    runner.it('recon should not be able to capture', () => {
      const recon = getTemplate('recon');
      assertEqual(recon.canCapture, false);
    });
  });

  runner.describe('build ability', () => {
    runner.it('base templates should not be able to build', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      const recon = getTemplate('recon');

      assertEqual(soldier.canBuild, false);
      assertEqual(tank.canBuild, false);
      assertEqual(recon.canBuild, false);
    });

    runner.it('builder template can build', () => {
      const builder = createTemplate('builder', 'Builder', 'foot', null, ['build']);
      assertEqual(builder.canBuild, true);
    });
  });

});

export default runner;
