// ============================================================================
// HEX DOMINION - Unit Designer Tests
// ============================================================================

import { TestRunner, assertEqual, assert, assertThrows } from './framework.js';
import {
  initTeamTemplates,
  getTeamTemplates,
  getTeamTemplate,
  registerTemplate,
  updateTemplate,
  unregisterTemplate,
  isNameTaken,
} from '../src/unit-templates.js';
import {
  createEmptyDesign,
  createDesignFromTemplate,
  selectChassis,
  selectWeapon,
  toggleSystem,
  getDesignPreview,
  getAvailableWeapons,
  getAvailableSystems,
} from '../src/unit-designer.js';

const runner = new TestRunner();

runner.describe('Unit Designer', () => {
  runner.describe('Team Template Registry', () => {
    runner.it('should initialize team with default templates', () => {
      initTeamTemplates('test_team_1');
      const templates = getTeamTemplates('test_team_1');

      assertEqual(templates.length, 3);
      const ids = templates.map(t => t.id);
      assert(ids.includes('soldier'));
      assert(ids.includes('tank'));
      assert(ids.includes('recon'));
    });

    runner.it('should get individual template by id', () => {
      initTeamTemplates('test_team_2');
      const soldier = getTeamTemplate('test_team_2', 'soldier');

      assert(soldier !== undefined);
      assertEqual(soldier!.name, 'Soldier');
    });

    runner.it('should return undefined for non-existent template', () => {
      initTeamTemplates('test_team_3');
      const notFound = getTeamTemplate('test_team_3', 'nonexistent');

      assertEqual(notFound, undefined);
    });

    runner.it('should register new template', () => {
      initTeamTemplates('test_team_4');
      const template = registerTemplate('test_team_4', 'Scout', 'wheels', 'machineGun', []);

      assertEqual(template.name, 'Scout');
      assertEqual(template.id, 'scout');

      const retrieved = getTeamTemplate('test_team_4', 'scout');
      assert(retrieved !== undefined);
      assertEqual(retrieved!.name, 'Scout');
    });

    runner.it('should throw when registering duplicate name', () => {
      initTeamTemplates('test_team_5');

      assertThrows(() => {
        registerTemplate('test_team_5', 'Soldier', 'foot', 'machineGun', []);
      });
    });

    runner.it('should unregister template', () => {
      initTeamTemplates('test_team_6');
      registerTemplate('test_team_6', 'ToDelete', 'foot', 'machineGun', []);

      const beforeDelete = getTeamTemplate('test_team_6', 'todelete');
      assert(beforeDelete !== undefined);

      const result = unregisterTemplate('test_team_6', 'todelete');
      assertEqual(result, true);

      const afterDelete = getTeamTemplate('test_team_6', 'todelete');
      assertEqual(afterDelete, undefined);
    });

    runner.it('should return false when unregistering non-existent template', () => {
      initTeamTemplates('test_team_7');
      const result = unregisterTemplate('test_team_7', 'nonexistent');
      assertEqual(result, false);
    });
  });

  runner.describe('isNameTaken', () => {
    runner.it('should return true for existing template name', () => {
      initTeamTemplates('test_taken_1');
      const taken = isNameTaken('test_taken_1', 'Soldier');
      assertEqual(taken, true);
    });

    runner.it('should return true for existing name with different case', () => {
      initTeamTemplates('test_taken_2');
      const taken = isNameTaken('test_taken_2', 'SOLDIER');
      assertEqual(taken, true);
    });

    runner.it('should return false for new name', () => {
      initTeamTemplates('test_taken_3');
      const taken = isNameTaken('test_taken_3', 'New Unit');
      assertEqual(taken, false);
    });

    runner.it('should return false when excludeId matches generated id', () => {
      initTeamTemplates('test_taken_4');
      // "Soldier" generates id "soldier", and we exclude "soldier"
      const taken = isNameTaken('test_taken_4', 'Soldier', 'soldier');
      assertEqual(taken, false);
    });

    runner.it('should return true when excludeId does not match', () => {
      initTeamTemplates('test_taken_5');
      // "Soldier" generates id "soldier", but we exclude "tank"
      const taken = isNameTaken('test_taken_5', 'Soldier', 'tank');
      assertEqual(taken, true);
    });

    runner.it('should handle names with spaces', () => {
      initTeamTemplates('test_taken_6');
      registerTemplate('test_taken_6', 'Heavy Tank', 'treads', 'cannon', []);

      const taken = isNameTaken('test_taken_6', 'Heavy Tank');
      assertEqual(taken, true);

      // Same name generates same id
      const takenVariant = isNameTaken('test_taken_6', 'heavy tank');
      assertEqual(takenVariant, true);
    });

    runner.it('should allow same name with excludeId for editing', () => {
      initTeamTemplates('test_taken_7');
      registerTemplate('test_taken_7', 'Custom Unit', 'foot', 'machineGun', []);

      // When editing "custom_unit", typing "Custom Unit" should be allowed
      const taken = isNameTaken('test_taken_7', 'Custom Unit', 'custom_unit');
      assertEqual(taken, false);
    });
  });

  runner.describe('updateTemplate', () => {
    runner.it('should update template keeping same name', () => {
      initTeamTemplates('test_update_1');
      registerTemplate('test_update_1', 'MyUnit', 'foot', 'machineGun', []);

      updateTemplate('test_update_1', 'myunit', 'MyUnit', 'wheels', 'heavyMG', []);

      const updated = getTeamTemplate('test_update_1', 'myunit');
      assert(updated !== undefined);
      assertEqual(updated!.chassisId, 'wheels');
      assertEqual(updated!.weaponId, 'heavyMG');
    });

    runner.it('should update template with new name', () => {
      initTeamTemplates('test_update_2');
      registerTemplate('test_update_2', 'OldName', 'foot', 'machineGun', []);

      updateTemplate('test_update_2', 'oldname', 'NewName', 'foot', 'machineGun', []);

      const oldTemplate = getTeamTemplate('test_update_2', 'oldname');
      assertEqual(oldTemplate, undefined);

      const newTemplate = getTeamTemplate('test_update_2', 'newname');
      assert(newTemplate !== undefined);
      assertEqual(newTemplate!.name, 'NewName');
    });

    runner.it('should throw when updating to existing name', () => {
      initTeamTemplates('test_update_3');
      registerTemplate('test_update_3', 'UnitA', 'foot', 'machineGun', []);
      registerTemplate('test_update_3', 'UnitB', 'wheels', 'machineGun', []);

      assertThrows(() => {
        // Try to rename UnitA to UnitB
        updateTemplate('test_update_3', 'unita', 'UnitB', 'foot', 'machineGun', []);
      });
    });
  });

  runner.describe('DesignState', () => {
    runner.it('should create default design with foot chassis', () => {
      const design = createEmptyDesign();

      assertEqual(design.chassisId, 'foot');
      assertEqual(design.weaponId, null);
      assertEqual(design.systemIds.length, 0);
    });

    runner.it('should create design from template', () => {
      initTeamTemplates('test_design_1');
      const template = getTeamTemplate('test_design_1', 'soldier')!;
      const design = createDesignFromTemplate(template);

      assertEqual(design.chassisId, 'foot');
      assertEqual(design.weaponId, 'machineGun');
      assert(design.systemIds.includes('capture'));
    });
  });

  runner.describe('selectChassis', () => {
    runner.it('should set chassis on empty design', () => {
      const design = createEmptyDesign();
      const updated = selectChassis(design, 'foot');

      assertEqual(updated.chassisId, 'foot');
    });

    runner.it('should remove incompatible weapon when changing chassis', () => {
      // Start with treads + cannon (valid)
      let design = createEmptyDesign();
      design = selectChassis(design, 'treads');
      design = selectWeapon(design, 'cannon');

      assertEqual(design.weaponId, 'cannon');

      // Change to foot - cannon is too heavy (weight 4 > max 2)
      design = selectChassis(design, 'foot');
      assertEqual(design.weaponId, null);
    });

    runner.it('should remove incompatible system when changing chassis', () => {
      // Start with foot + capture (valid)
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = toggleSystem(design, 'capture');

      assert(design.systemIds.includes('capture'));

      // Change to wheels - capture requires foot
      design = selectChassis(design, 'wheels');
      assertEqual(design.systemIds.length, 0);
    });
  });

  runner.describe('selectWeapon', () => {
    runner.it('should set weapon', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = selectWeapon(design, 'machineGun');

      assertEqual(design.weaponId, 'machineGun');
    });

    runner.it('should allow setting weapon to null', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = selectWeapon(design, 'machineGun');
      design = selectWeapon(design, null);

      assertEqual(design.weaponId, null);
    });
  });

  runner.describe('toggleSystem', () => {
    runner.it('should add system when not selected', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = toggleSystem(design, 'capture');

      assert(design.systemIds.includes('capture'));
    });

    runner.it('should remove system when already selected', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = toggleSystem(design, 'capture');
      design = toggleSystem(design, 'capture');

      assertEqual(design.systemIds.length, 0);
    });

    runner.it('should replace system (only one allowed)', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = toggleSystem(design, 'capture');
      design = toggleSystem(design, 'build');

      assertEqual(design.systemIds.length, 1);
      assert(design.systemIds.includes('build'));
    });
  });

  runner.describe('getDesignPreview', () => {
    runner.it('should return valid preview for default design', () => {
      const design = createEmptyDesign();
      const preview = getDesignPreview(design);

      assert(preview !== null);
      assertEqual(preview!.valid, true);
      assertEqual(preview!.speed, 3); // foot chassis speed
    });

    runner.it('should return valid preview for wheels chassis', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'wheels');
      const preview = getDesignPreview(design);

      assert(preview !== null);
      assertEqual(preview!.valid, true);
      assertEqual(preview!.speed, 6); // wheels chassis speed
      assertEqual(preview!.attack, 0);
      assertEqual(preview!.cost, 800); // wheels chassis base cost
    });

    runner.it('should calculate stats correctly', () => {
      let design = createEmptyDesign();
      design = selectChassis(design, 'foot');
      design = selectWeapon(design, 'machineGun');
      design = toggleSystem(design, 'capture');
      const preview = getDesignPreview(design);

      assert(preview !== null);
      assertEqual(preview!.valid, true);
      assertEqual(preview!.speed, 3);
      assertEqual(preview!.attack, 4);
      assertEqual(preview!.range, 1);
      assertEqual(preview!.canCapture, true);
      assertEqual(preview!.cost, 1000); // 500 + 500 + 0
    });
  });

  runner.describe('getAvailableWeapons', () => {
    runner.it('should mark all unavailable without chassis', () => {
      const weapons = getAvailableWeapons(null);

      for (const w of weapons) {
        assertEqual(w.available, false);
        assertEqual(w.reason, 'Select a chassis first');
      }
    });

    runner.it('should mark weapons available for matching chassis', () => {
      const weapons = getAvailableWeapons('foot');
      const machineGun = weapons.find(w => w.weapon.id === 'machineGun')!;

      assertEqual(machineGun.available, true);
    });

    runner.it('should mark heavy weapons unavailable for foot chassis', () => {
      const weapons = getAvailableWeapons('foot');
      const cannon = weapons.find(w => w.weapon.id === 'cannon')!;

      assertEqual(cannon.available, false);
      assert(cannon.reason!.includes('Weight'));
    });
  });

  runner.describe('getAvailableSystems', () => {
    runner.it('should mark all unavailable without chassis', () => {
      const systems = getAvailableSystems(null, []);

      for (const s of systems) {
        assertEqual(s.available, false);
        assertEqual(s.reason, 'Select a chassis first');
      }
    });

    runner.it('should mark capture unavailable for non-foot chassis', () => {
      const systems = getAvailableSystems('wheels', [], null);
      const capture = systems.find(s => s.system.id === 'capture')!;

      assertEqual(capture.available, false);
      assert(capture.reason!.includes('Requires'));
    });

    runner.it('should mark armor unavailable for foot chassis', () => {
      const systems = getAvailableSystems('foot', [], null);
      const armor = systems.find(s => s.system.id === 'armor')!;

      assertEqual(armor.available, false);
      assert(armor.reason!.includes('Requires'));
    });

    runner.it('should mark selected system as available (for toggle off)', () => {
      const systems = getAvailableSystems('foot', ['capture'], null);
      const capture = systems.find(s => s.system.id === 'capture')!;

      assertEqual(capture.available, true);
    });
  });
});

export default runner;
