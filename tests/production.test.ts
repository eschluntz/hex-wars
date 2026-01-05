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
  DEFAULT_UNLOCKED_UNITS,
} from '../src/unit-templates.js';
import { Unit } from '../src/unit.js';

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
        assert(typeof template.range === 'number' && template.range >= 0);
        assert(typeof template.flying === 'boolean');
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
  // Unit constructor from templateId
  // ==========================================================================

  runner.describe('Unit constructor', () => {
    runner.it('should create unit with correct template stats', () => {
      const infantry = getUnitType('infantry');
      const unit = new Unit('test', 'player', 0, 0, 'infantry');

      assertEqual(unit.speed, infantry.speed);
      assertEqual(unit.range, infantry.range);
      assertEqual(unit.minRange, infantry.minRange);
      assertEqual(unit.canMoveAndAttack, infantry.canMoveAndAttack);
      assertEqual(unit.canCapture, infantry.canCapture);
      assertEqual(unit.canBuild, infantry.canBuild);
      assertEqual(unit.flying, infantry.flying);
      assertEqual(unit.templateId, infantry.id);
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
    runner.it('apc should be able to transport infantry and mech', () => {
      const apc = getUnitType('apc');
      assert(apc.transportCapacity > 0, 'APC should have transport capacity');
      assert(apc.transportFilter.includes('infantry'), 'APC should transport infantry');
      assert(apc.transportFilter.includes('mech'), 'APC should transport mech');
    });

    runner.it('transport copter should be able to transport infantry and mech', () => {
      const tCopter = getUnitType('transportCopter');
      assert(tCopter.transportCapacity > 0, 'T-Copter should have transport capacity');
      assert(tCopter.transportFilter.includes('infantry'), 'T-Copter should transport infantry');
      assert(tCopter.transportFilter.includes('mech'), 'T-Copter should transport mech');
    });

    runner.it('transport units should have zero range (unarmed)', () => {
      assertEqual(getUnitType('apc').range, 0);
      assertEqual(getUnitType('transportCopter').range, 0);
    });
  });

});

export default runner;
