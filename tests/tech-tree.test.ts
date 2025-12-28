// ============================================================================
// HEX DOMINION - Tech Tree Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from './framework.js';
import {
  TECH_TREE,
  getAllTechs,
  getTech,
  isTechUnlocked,
  areTechPrereqsMet,
  getTechAvailability,
  purchaseTech,
  getTechTreeState,
  computeTechLayout,
} from '../src/tech-tree.js';
import { initTeamResearch, isChassisResearched, isWeaponResearched, isSystemResearched } from '../src/research.js';
import { ResourceManager } from '../src/resources.js';

const runner = new TestRunner();

runner.describe('Tech Tree', () => {

  runner.describe('TECH_TREE data', () => {

    runner.it('should have 24 techs defined', () => {
      const techs = getAllTechs();
      assertEqual(techs.length, 24);
    });

    runner.it('should have advancedTreads with no prerequisites', () => {
      const tech = getTech('advancedTreads');
      assertEqual(tech.name, 'Advanced Treads');
      assertEqual(tech.requires.length, 0);
      assertEqual(tech.unlocks, 'hover');
      assertEqual(tech.category, 'chassis');
    });

    runner.it('should have rocketLauncher requiring advancedTreads', () => {
      const tech = getTech('rocketLauncher');
      assertEqual(tech.requires.length, 1);
      assertEqual(tech.requires[0], 'advancedTreads');
      assertEqual(tech.unlocks, 'rockets');
      assertEqual(tech.category, 'weapon');
    });

    runner.it('should have advancedRockets requiring two techs', () => {
      const tech = getTech('advancedRockets');
      assertEqual(tech.requires.length, 2);
      assert(tech.requires.includes('rocketLauncher'));
      assert(tech.requires.includes('stealthPlating'));
      assertEqual(tech.unlocks, 'missiles');
    });

  });

  runner.describe('isTechUnlocked', () => {

    runner.it('should return false for uninitialized team', () => {
      assert(!isTechUnlocked('newteam', 'advancedTreads'));
    });

    runner.it('should return false for unlocked tech on initialized team', () => {
      initTeamResearch('testplayer1');
      assert(!isTechUnlocked('testplayer1', 'advancedTreads'));
    });

  });

  runner.describe('areTechPrereqsMet', () => {

    runner.it('should return true for tech with no prerequisites', () => {
      initTeamResearch('prereqtest1');
      assert(areTechPrereqsMet('prereqtest1', 'advancedTreads'));
    });

    runner.it('should return false when prerequisites not met', () => {
      initTeamResearch('prereqtest2');
      assert(!areTechPrereqsMet('prereqtest2', 'rocketLauncher'));
    });

  });

  runner.describe('getTechAvailability', () => {

    runner.it('should be available for root tech with enough science', () => {
      initTeamResearch('availtest1');
      const result = getTechAvailability('availtest1', 'advancedTreads', 10);
      assert(result.available);
    });

    runner.it('should not be available with insufficient science', () => {
      initTeamResearch('availtest2');
      const result = getTechAvailability('availtest2', 'advancedTreads', 2);
      assert(!result.available);
      assert(result.reason!.includes('Need'));
    });

    runner.it('should not be available when prereqs not met', () => {
      initTeamResearch('availtest3');
      const result = getTechAvailability('availtest3', 'rocketLauncher', 100);
      assert(!result.available);
      assert(result.reason!.includes('Requires'));
    });

  });

  runner.describe('purchaseTech', () => {

    runner.it('should successfully purchase root tech with enough science', () => {
      initTeamResearch('purchtest1');
      const resources = new ResourceManager(['purchtest1']);
      resources.addScience('purchtest1', 10);

      const result = purchaseTech('purchtest1', 'advancedTreads', resources);

      assert(result.success);
      assertEqual(resources.getResources('purchtest1').science, 5); // 10 - 5 cost
      assert(isTechUnlocked('purchtest1', 'advancedTreads'));
    });

    runner.it('should unlock the corresponding component', () => {
      initTeamResearch('purchtest2');
      const resources = new ResourceManager(['purchtest2']);
      resources.addScience('purchtest2', 10);

      // Hover should not be available before purchase
      assert(!isChassisResearched('purchtest2', 'hover'));

      purchaseTech('purchtest2', 'advancedTreads', resources);

      // Hover should be available after purchase
      assert(isChassisResearched('purchtest2', 'hover'));
    });

    runner.it('should fail with insufficient science', () => {
      initTeamResearch('purchtest3');
      const resources = new ResourceManager(['purchtest3']);
      resources.addScience('purchtest3', 2);

      const result = purchaseTech('purchtest3', 'advancedTreads', resources);

      assert(!result.success);
      assertEqual(resources.getResources('purchtest3').science, 2); // unchanged
    });

    runner.it('should fail when prerequisites not met', () => {
      initTeamResearch('purchtest4');
      const resources = new ResourceManager(['purchtest4']);
      resources.addScience('purchtest4', 100);

      const result = purchaseTech('purchtest4', 'rocketLauncher', resources);

      assert(!result.success);
      assert(!isTechUnlocked('purchtest4', 'rocketLauncher'));
    });

    runner.it('should allow chained purchases', () => {
      initTeamResearch('purchtest5');
      const resources = new ResourceManager(['purchtest5']);
      resources.addScience('purchtest5', 50);

      // Purchase advancedTreads first
      const result1 = purchaseTech('purchtest5', 'advancedTreads', resources);
      assert(result1.success);

      // Now rocketLauncher should be purchasable
      const result2 = purchaseTech('purchtest5', 'rocketLauncher', resources);
      assert(result2.success);

      assert(isWeaponResearched('purchtest5', 'rockets'));
    });

    runner.it('should unlock system component for stealthPlating', () => {
      initTeamResearch('purchtest6');
      const resources = new ResourceManager(['purchtest6']);
      resources.addScience('purchtest6', 20);

      purchaseTech('purchtest6', 'advancedTreads', resources);
      purchaseTech('purchtest6', 'stealthPlating', resources);

      assert(isSystemResearched('purchtest6', 'stealth'));
    });

  });

  runner.describe('getTechTreeState', () => {

    runner.it('should return all techs with correct states', () => {
      initTeamResearch('statetest1');
      const nodes = getTechTreeState('statetest1', 100);

      assertEqual(nodes.length, 24);

      // Root techs should be available
      const advTreads = nodes.find(n => n.tech.id === 'advancedTreads')!;
      assertEqual(advTreads.state, 'available');

      // Tier 1 techs should be locked (prereqs not met)
      const rockets = nodes.find(n => n.tech.id === 'rocketLauncher')!;
      assertEqual(rockets.state, 'locked');
    });

    runner.it('should mark purchased techs as unlocked', () => {
      initTeamResearch('statetest2');
      const resources = new ResourceManager(['statetest2']);
      resources.addScience('statetest2', 10);
      purchaseTech('statetest2', 'advancedTreads', resources);

      const nodes = getTechTreeState('statetest2', 100);
      const advTreads = nodes.find(n => n.tech.id === 'advancedTreads')!;
      assertEqual(advTreads.state, 'unlocked');

      // Dependent techs should now be available
      const rockets = nodes.find(n => n.tech.id === 'rocketLauncher')!;
      assertEqual(rockets.state, 'available');
    });

  });

  runner.describe('computeTechLayout', () => {

    runner.it('should assign tier 0 to root techs', () => {
      const layout = computeTechLayout();
      const advTreads = layout.find(p => p.techId === 'advancedTreads')!;
      assertEqual(advTreads.tier, 0);

      const laser = layout.find(p => p.techId === 'laserTechnology')!;
      assertEqual(laser.tier, 0);

      const sensors = layout.find(p => p.techId === 'advancedSensors')!;
      assertEqual(sensors.tier, 0);

      const reactive = layout.find(p => p.techId === 'reactiveArmor')!;
      assertEqual(reactive.tier, 0);
    });

    runner.it('should assign tier 1 to techs with one prereq', () => {
      const layout = computeTechLayout();
      const rockets = layout.find(p => p.techId === 'rocketLauncher')!;
      assertEqual(rockets.tier, 1);

      const stealth = layout.find(p => p.techId === 'stealthPlating')!;
      assertEqual(stealth.tier, 1);

      const plasma = layout.find(p => p.techId === 'plasmaCannon')!;
      assertEqual(plasma.tier, 1);
    });

    runner.it('should assign tier 2 to techs with tier-1 prereqs', () => {
      const layout = computeTechLayout();
      const advRockets = layout.find(p => p.techId === 'advancedRockets')!;
      assertEqual(advRockets.tier, 2);

      const jumpJets = layout.find(p => p.techId === 'jumpJets')!;
      assertEqual(jumpJets.tier, 2);

      const ionCannon = layout.find(p => p.techId === 'ionCannon')!;
      assertEqual(ionCannon.tier, 2);
    });

    runner.it('should assign tier 3 to ultimate techs', () => {
      const layout = computeTechLayout();
      const fusion = layout.find(p => p.techId === 'fusionCore')!;
      assertEqual(fusion.tier, 3);

      const antimatter = layout.find(p => p.techId === 'antimatterWeapons')!;
      assertEqual(antimatter.tier, 3);

      const titan = layout.find(p => p.techId === 'titanClass')!;
      assertEqual(titan.tier, 3);
    });

    runner.it('should return positions for all techs', () => {
      const layout = computeTechLayout();
      assertEqual(layout.length, 24);
    });

  });

});

export default runner;
