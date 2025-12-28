// ============================================================================
// HEX DOMINION - Production/Unit Templates Tests
// ============================================================================

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
  runner.describe('UNIT_TEMPLATES', () => {
    runner.it('should have soldier template', () => {
      const soldier = UNIT_TEMPLATES.soldier!;

      assertEqual(soldier.id, 'soldier');
      assertEqual(soldier.name, 'Soldier');
      assertEqual(soldier.cost, 1000); // foot (500) + machineGun (500) + capture (0)
      assertEqual(soldier.speed, 3);
      assertEqual(soldier.attack, 4);
      assertEqual(soldier.range, 1);
    });

    runner.it('should have tank template', () => {
      const tank = UNIT_TEMPLATES.tank!;

      assertEqual(tank.id, 'tank');
      assertEqual(tank.name, 'Tank');
      assertEqual(tank.cost, 4000); // treads (1500) + cannon (1500) + armor (1000)
      assertEqual(tank.speed, 4);
      assertEqual(tank.attack, 7);
      assertEqual(tank.range, 1);
    });

    runner.it('should have recon template', () => {
      const recon = UNIT_TEMPLATES.recon!;

      assertEqual(recon.id, 'recon');
      assertEqual(recon.name, 'Recon');
      assertEqual(recon.cost, 1300); // wheels (800) + machineGun (500)
      assertEqual(recon.speed, 6);
      assertEqual(recon.attack, 4);
      assertEqual(recon.range, 1);
    });

    runner.it('soldier should have foot terrain costs', () => {
      const soldier = UNIT_TEMPLATES.soldier!;

      assertEqual(soldier.terrainCosts.woods, 1);  // Foot moves easily through woods
      assertEqual(soldier.terrainCosts.road, 1);   // Foot isn't faster on roads
      assertEqual(soldier.terrainCosts.grass, 1);
      assertEqual(soldier.terrainCosts.water, Infinity);
    });

    runner.it('tank should be slower in woods (treads)', () => {
      const tank = UNIT_TEMPLATES.tank!;

      assertEqual(tank.terrainCosts.woods, 2);
      assertEqual(tank.terrainCosts.grass, 1);
    });
  });

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

  runner.describe('getAvailableTemplates', () => {
    runner.it('should return array of templates', () => {
      const templates = getAvailableTemplates();

      assert(Array.isArray(templates));
      assertEqual(templates.length, 3);
    });

    runner.it('should include soldier, tank, and recon', () => {
      const templates = getAvailableTemplates();
      const ids = templates.map((t) => t.id);

      assert(ids.includes('soldier'));
      assert(ids.includes('tank'));
      assert(ids.includes('recon'));
    });
  });

  runner.describe('getTemplate', () => {
    runner.it('should return soldier template by id', () => {
      const template = getTemplate('soldier');

      assertEqual(template.id, 'soldier');
      assertEqual(template.name, 'Soldier');
    });

    runner.it('should return tank template by id', () => {
      const template = getTemplate('tank');

      assertEqual(template.id, 'tank');
      assertEqual(template.name, 'Tank');
    });
  });

  runner.describe('createTemplate', () => {
    runner.it('should create template with foot + machineGun (no capture)', () => {
      const template = createTemplate('test', 'Test Unit', 'foot', 'machineGun');

      assertEqual(template.id, 'test');
      assertEqual(template.speed, 3);
      assertEqual(template.attack, 4);
      assertEqual(template.armored, false);
      assertEqual(template.armorPiercing, false);
      assertEqual(template.canCapture, false); // No capture system
    });

    runner.it('should create template with foot + machineGun + capture', () => {
      const template = createTemplate('inf', 'Infantry', 'foot', 'machineGun', ['capture']);

      assertEqual(template.canCapture, true);
      assertEqual(template.cost, 1000); // 500 + 500 + 0
    });

    runner.it('should create template with treads + artillery (no armor)', () => {
      const template = createTemplate('artillery', 'Artillery', 'treads', 'artillery');

      assertEqual(template.id, 'artillery');
      assertEqual(template.speed, 4);
      assertEqual(template.attack, 5);
      assertEqual(template.range, 3);
      assertEqual(template.armored, false); // No armor system
      assertEqual(template.armorPiercing, true);
      assertEqual(template.cost, 3500); // 1500 + 2000
    });

    runner.it('should create armored artillery', () => {
      const template = createTemplate('heavy_art', 'Heavy Artillery', 'treads', 'artillery', ['armor']);

      assertEqual(template.armored, true);
      assertEqual(template.cost, 4500); // 1500 + 2000 + 1000
    });

    runner.it('should throw when weight exceeds capacity', () => {
      assertThrows(() => {
        createTemplate('invalid', 'Invalid', 'foot', 'cannon'); // cannon weight 4 > foot max 2
      });
    });

    runner.it('should throw when wheels try to carry cannon', () => {
      assertThrows(() => {
        createTemplate('invalid', 'Invalid', 'wheels', 'cannon'); // cannon weight 4 > wheels max 3
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

    runner.it('should create weaponless builder', () => {
      const template = createTemplate('engineer', 'Engineer', 'foot', null, ['build', 'capture']);

      assertEqual(template.attack, 0);
      assertEqual(template.range, 0);
      assertEqual(template.canBuild, true);
      assertEqual(template.canCapture, true);
    });
  });

  runner.describe('getTemplateComponents', () => {
    runner.it('should return chassis, weapon, and systems for soldier', () => {
      const soldier = getTemplate('soldier');
      const components = getTemplateComponents(soldier);

      assertEqual(components.chassis.id, 'foot');
      assertEqual(components.weapon!.id, 'machineGun');
      assertEqual(components.systems.length, 1);
      assertEqual(components.systems[0]!.id, 'capture');
    });

    runner.it('should return chassis, weapon, and systems for tank', () => {
      const tank = getTemplate('tank');
      const components = getTemplateComponents(tank);

      assertEqual(components.chassis.id, 'treads');
      assertEqual(components.weapon!.id, 'cannon');
      assertEqual(components.systems.length, 1);
      assertEqual(components.systems[0]!.id, 'armor');
    });

    runner.it('should return null weapon for weaponless template', () => {
      const builder = createTemplate('builder', 'Builder', 'foot', null, ['build']);
      const components = getTemplateComponents(builder);

      assertEqual(components.chassis.id, 'foot');
      assertEqual(components.weapon, null);
    });
  });

  runner.describe('production costs', () => {
    runner.it('soldier should be cheapest', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      const recon = getTemplate('recon');

      assert(soldier.cost < recon.cost);
      assert(recon.cost < tank.cost);
    });

    runner.it('tank should have highest attack', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      const recon = getTemplate('recon');

      assert(tank.attack > soldier.attack);
      assert(tank.attack > recon.attack);
    });

    runner.it('recon should be fastest', () => {
      const soldier = getTemplate('soldier');
      const tank = getTemplate('tank');
      const recon = getTemplate('recon');

      assert(recon.speed > soldier.speed);
      assert(recon.speed > tank.speed);
    });
  });

  runner.describe('capture ability', () => {
    runner.it('soldier should be able to capture (has capture system)', () => {
      const soldier = getTemplate('soldier');
      assertEqual(soldier.canCapture, true);
    });

    runner.it('tank should not be able to capture (no capture system)', () => {
      const tank = getTemplate('tank');
      assertEqual(tank.canCapture, false);
    });

    runner.it('recon should not be able to capture (no capture system)', () => {
      const recon = getTemplate('recon');
      assertEqual(recon.canCapture, false);
    });
  });

  runner.describe('build ability', () => {
    runner.it('soldier should not be able to build', () => {
      const soldier = getTemplate('soldier');
      assertEqual(soldier.canBuild, false);
    });

    runner.it('builder template can build', () => {
      const builder = createTemplate('builder', 'Builder', 'foot', null, ['build']);
      assertEqual(builder.canBuild, true);
    });
  });
});

export default runner;
