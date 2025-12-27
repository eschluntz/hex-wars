// ============================================================================
// HEX DOMINION - Production/Unit Templates Tests
// ============================================================================

import { TestRunner, assertEqual, assert, assertNotNull } from './framework.js';
import { UNIT_TEMPLATES, getAvailableTemplates, getTemplate } from '../src/unit-templates.js';
import { DEFAULT_TERRAIN_COSTS } from '../src/core.js';

const runner = new TestRunner();

runner.describe('Unit Templates', () => {

  runner.describe('UNIT_TEMPLATES', () => {

    runner.it('should have infantry template', () => {
      const infantry = UNIT_TEMPLATES.infantry!;

      assertEqual(infantry.id, 'infantry');
      assertEqual(infantry.name, 'Infantry');
      assertEqual(infantry.cost, 1000);
      assertEqual(infantry.speed, 3);
      assertEqual(infantry.attack, 4);
      assertEqual(infantry.range, 1);
    });

    runner.it('should have tank template', () => {
      const tank = UNIT_TEMPLATES.tank!;

      assertEqual(tank.id, 'tank');
      assertEqual(tank.name, 'Tank');
      assertEqual(tank.cost, 3000);
      assertEqual(tank.speed, 5);
      assertEqual(tank.attack, 7);
      assertEqual(tank.range, 1);
    });

    runner.it('infantry should have default terrain costs', () => {
      const infantry = UNIT_TEMPLATES.infantry!;

      assertEqual(infantry.terrainCosts.grass, 1);
      assertEqual(infantry.terrainCosts.water, Infinity);
      assertEqual(infantry.terrainCosts.mountain, Infinity);
    });

    runner.it('tank should be slower in woods', () => {
      const tank = UNIT_TEMPLATES.tank!;

      assertEqual(tank.terrainCosts.woods, 2);
      assertEqual(tank.terrainCosts.grass, 1);
    });

  });

  runner.describe('getAvailableTemplates', () => {

    runner.it('should return array of templates', () => {
      const templates = getAvailableTemplates();

      assert(Array.isArray(templates));
      assert(templates.length >= 2);
    });

    runner.it('should include infantry and tank', () => {
      const templates = getAvailableTemplates();
      const ids = templates.map(t => t.id);

      assert(ids.includes('infantry'));
      assert(ids.includes('tank'));
    });

  });

  runner.describe('getTemplate', () => {

    runner.it('should return infantry template by id', () => {
      const template = getTemplate('infantry');

      assertEqual(template.id, 'infantry');
      assertEqual(template.name, 'Infantry');
    });

    runner.it('should return tank template by id', () => {
      const template = getTemplate('tank');

      assertEqual(template.id, 'tank');
      assertEqual(template.name, 'Tank');
    });

  });

  runner.describe('production costs', () => {

    runner.it('infantry should be cheaper than tank', () => {
      const infantry = getTemplate('infantry');
      const tank = getTemplate('tank');

      assert(infantry.cost < tank.cost);
    });

    runner.it('tank should have higher attack than infantry', () => {
      const infantry = getTemplate('infantry');
      const tank = getTemplate('tank');

      assert(tank.attack > infantry.attack);
    });

    runner.it('tank should be faster than infantry', () => {
      const infantry = getTemplate('infantry');
      const tank = getTemplate('tank');

      assert(tank.speed > infantry.speed);
    });

  });

  runner.describe('capture ability', () => {

    runner.it('infantry should be able to capture', () => {
      const infantry = getTemplate('infantry');
      assertEqual(infantry.canCapture, true);
    });

    runner.it('tank should not be able to capture', () => {
      const tank = getTemplate('tank');
      assertEqual(tank.canCapture, false);
    });

  });

});

export default runner;
