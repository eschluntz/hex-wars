// ============================================================================
// HEX DOMINION - Production/Unit Templates Tests
// ============================================================================
// Tests static unit templates - structure, properties, and lookup functions.

import { TestRunner, assertEqual, assert } from './framework.js';
import {
  UNIT_TYPES,
  getAllUnitTypes,
  getUnitType,
  getUnlockedUnitTypes,
  getTemplateStats,
  DEFAULT_UNLOCKED_UNITS,
} from '../src/unit-templates.js';

const runner = new TestRunner();

runner.describe('Unit Templates', () => {

  // ==========================================================================
  // Base template validation
  // ==========================================================================

  runner.describe('UNIT_TYPES structure', () => {
    runner.it('should have infantry, tank, and recon templates', () => {
      assert(UNIT_TYPES.infantry !== undefined, 'Should have infantry');
      assert(UNIT_TYPES.tank !== undefined, 'Should have tank');
      assert(UNIT_TYPES.recon !== undefined, 'Should have recon');
    });

    runner.it('all templates should have required properties', () => {
      for (const template of getAllUnitTypes()) {
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

    runner.it('should have all Advance Wars unit types', () => {
      const expectedUnits = [
        'infantry', 'mech', 'recon', 'tank', 'mediumTank', 'heavyTank',
        'artillery', 'rockets', 'antiAir', 'missiles', 'apc',
        'fighter', 'bomber', 'copter', 'transportCopter'
      ];
      for (const id of expectedUnits) {
        assert(UNIT_TYPES[id] !== undefined, `Should have ${id}`);
      }
    });
  });

  // ==========================================================================
  // Template properties (game rules, not balance)
  // ==========================================================================

  runner.describe('template armor/AP properties', () => {
    runner.it('infantry should not be armored and not have AP', () => {
      const infantry = getUnitType('infantry');
      assertEqual(infantry.armored, false);
      assertEqual(infantry.armorPiercing, false);
    });

    runner.it('tank should be armored and have AP', () => {
      const tank = getUnitType('tank');
      assertEqual(tank.armored, true);
      assertEqual(tank.armorPiercing, true);
    });

    runner.it('recon should not be armored and not have AP', () => {
      const recon = getUnitType('recon');
      assertEqual(recon.armored, false);
      assertEqual(recon.armorPiercing, false);
    });
  });

  runner.describe('template components', () => {
    runner.it('infantry should be foot + machineGun + capture', () => {
      const infantry = getUnitType('infantry');
      assertEqual(infantry.chassisId, 'foot');
      assertEqual(infantry.weaponId, 'machineGun');
      assert(infantry.systemIds.includes('capture'));
    });

    runner.it('tank should be treads + cannon + armor', () => {
      const tank = getUnitType('tank');
      assertEqual(tank.chassisId, 'treads');
      assertEqual(tank.weaponId, 'cannon');
      assert(tank.systemIds.includes('armor'));
    });

    runner.it('recon should be wheels + machineGun (no systems)', () => {
      const recon = getUnitType('recon');
      assertEqual(recon.chassisId, 'wheels');
      assertEqual(recon.weaponId, 'machineGun');
      assertEqual(recon.systemIds.length, 0);
    });
  });

  // ==========================================================================
  // Template lookup
  // ==========================================================================

  runner.describe('getAllUnitTypes', () => {
    runner.it('should return array of templates', () => {
      const templates = getAllUnitTypes();
      assert(Array.isArray(templates));
      assert(templates.length >= 15, `Should have at least 15 unit types, got ${templates.length}`);
    });

    runner.it('should include base templates', () => {
      const templates = getAllUnitTypes();
      const ids = templates.map((t) => t.id);
      assert(ids.includes('infantry'));
      assert(ids.includes('tank'));
      assert(ids.includes('recon'));
    });
  });

  runner.describe('getUnitType', () => {
    runner.it('should return template by id', () => {
      const infantry = getUnitType('infantry');
      assertEqual(infantry.id, 'infantry');

      const tank = getUnitType('tank');
      assertEqual(tank.id, 'tank');
    });
  });

  runner.describe('getUnlockedUnitTypes', () => {
    runner.it('should return only unlocked templates', () => {
      const unlocked = new Set(['infantry', 'tank']);
      const templates = getUnlockedUnitTypes(unlocked);

      assertEqual(templates.length, 2);
      assert(templates.some(t => t.id === 'infantry'));
      assert(templates.some(t => t.id === 'tank'));
      assert(!templates.some(t => t.id === 'recon'));
    });

    runner.it('should return empty array for empty set', () => {
      const templates = getUnlockedUnitTypes(new Set());
      assertEqual(templates.length, 0);
    });
  });

  runner.describe('DEFAULT_UNLOCKED_UNITS', () => {
    runner.it('should include infantry, recon, and tank', () => {
      assert(DEFAULT_UNLOCKED_UNITS.includes('infantry'));
      assert(DEFAULT_UNLOCKED_UNITS.includes('recon'));
      assert(DEFAULT_UNLOCKED_UNITS.includes('tank'));
    });
  });

  // ==========================================================================
  // Template stats extraction
  // ==========================================================================

  runner.describe('getTemplateStats', () => {
    runner.it('should return all required stats', () => {
      const infantry = getUnitType('infantry');
      const stats = getTemplateStats(infantry);

      assertEqual(stats.speed, infantry.speed);
      assertEqual(stats.attack, infantry.attack);
      assertEqual(stats.range, infantry.range);
      assertEqual(stats.minRange, infantry.minRange);
      assertEqual(stats.canMoveAndAttack, infantry.canMoveAndAttack);
      assertEqual(stats.canCapture, infantry.canCapture);
      assertEqual(stats.canBuild, infantry.canBuild);
      assertEqual(stats.armored, infantry.armored);
      assertEqual(stats.armorPiercing, infantry.armorPiercing);
      assertEqual(stats.flying, infantry.flying);
      assertEqual(stats.chassisId, infantry.chassisId);
    });
  });

  // ==========================================================================
  // Relative comparisons (stable even if values change)
  // ==========================================================================

  runner.describe('template relative properties', () => {
    runner.it('infantry should be cheaper than tank', () => {
      const infantry = getUnitType('infantry');
      const tank = getUnitType('tank');
      assert(infantry.cost < tank.cost);
    });

    runner.it('tank should have higher attack than infantry', () => {
      const infantry = getUnitType('infantry');
      const tank = getUnitType('tank');
      assert(tank.attack > infantry.attack);
    });

    runner.it('recon should be faster than infantry', () => {
      const infantry = getUnitType('infantry');
      const recon = getUnitType('recon');
      assert(recon.speed > infantry.speed);
    });

    runner.it('fighter should be fastest air unit', () => {
      const fighter = getUnitType('fighter');
      const bomber = getUnitType('bomber');
      const copter = getUnitType('copter');
      assert(fighter.speed >= bomber.speed);
      assert(fighter.speed >= copter.speed);
    });
  });

  // ==========================================================================
  // Ability tests
  // ==========================================================================

  runner.describe('capture ability', () => {
    runner.it('infantry should be able to capture', () => {
      const infantry = getUnitType('infantry');
      assertEqual(infantry.canCapture, true);
    });

    runner.it('mech should be able to capture', () => {
      const mech = getUnitType('mech');
      assertEqual(mech.canCapture, true);
    });

    runner.it('tank should not be able to capture', () => {
      const tank = getUnitType('tank');
      assertEqual(tank.canCapture, false);
    });

    runner.it('recon should not be able to capture', () => {
      const recon = getUnitType('recon');
      assertEqual(recon.canCapture, false);
    });
  });

  runner.describe('flying ability', () => {
    runner.it('air units should be flying', () => {
      assertEqual(getUnitType('fighter').flying, true);
      assertEqual(getUnitType('bomber').flying, true);
      assertEqual(getUnitType('copter').flying, true);
      assertEqual(getUnitType('transportCopter').flying, true);
    });

    runner.it('ground units should not be flying', () => {
      assertEqual(getUnitType('infantry').flying, false);
      assertEqual(getUnitType('tank').flying, false);
      assertEqual(getUnitType('artillery').flying, false);
    });
  });

  runner.describe('indirect fire', () => {
    runner.it('artillery should have minRange > 0', () => {
      const artillery = getUnitType('artillery');
      assert(artillery.minRange > 0, 'Artillery should have minimum range');
      assert(artillery.range > artillery.minRange, 'Artillery range should exceed minRange');
    });

    runner.it('artillery should not move and attack', () => {
      const artillery = getUnitType('artillery');
      assertEqual(artillery.canMoveAndAttack, false);
    });

    runner.it('rockets should have higher range than artillery', () => {
      const artillery = getUnitType('artillery');
      const rockets = getUnitType('rockets');
      assert(rockets.range > artillery.range, 'Rockets should have longer range');
    });
  });

  runner.describe('transport ability', () => {
    runner.it('apc should be able to transport foot units', () => {
      const apc = getUnitType('apc');
      assert(apc.transportCapacity > 0, 'APC should have transport capacity');
      assert(apc.transportFilter.includes('foot'), 'APC should transport foot units');
    });

    runner.it('transport copter should be able to transport foot units', () => {
      const tCopter = getUnitType('transportCopter');
      assert(tCopter.transportCapacity > 0, 'T-Copter should have transport capacity');
      assert(tCopter.transportFilter.includes('foot'), 'T-Copter should transport foot units');
    });

    runner.it('transport units should have no attack', () => {
      assertEqual(getUnitType('apc').attack, 0);
      assertEqual(getUnitType('transportCopter').attack, 0);
    });
  });

  runner.describe('targeting restrictions', () => {
    runner.it('infantry should not be able to target airplanes', () => {
      const infantry = getUnitType('infantry');
      assert(infantry.cannotTarget.includes('airplane'), 'Infantry cannot target airplanes');
    });

    runner.it('fighter should only target air units', () => {
      const fighter = getUnitType('fighter');
      assert(fighter.cannotTarget.includes('foot'));
      assert(fighter.cannotTarget.includes('wheels'));
      assert(fighter.cannotTarget.includes('treads'));
    });

    runner.it('bomber should only target ground units', () => {
      const bomber = getUnitType('bomber');
      assert(bomber.cannotTarget.includes('airplane'));
      assert(bomber.cannotTarget.includes('helicopter'));
    });

    runner.it('anti-air should target everything', () => {
      const antiAir = getUnitType('antiAir');
      assertEqual(antiAir.cannotTarget.length, 0);
    });
  });

});

export default runner;
