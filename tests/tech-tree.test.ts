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

    runner.it('should have 19 techs defined', () => {
      const techs = getAllTechs();
      assertEqual(techs.length, 19);
    });

    runner.it('should have advancedMobility with no prerequisites', () => {
      const tech = getTech('advancedMobility');
      assertEqual(tech.name, 'Adv. Mobility');
      assertEqual(tech.requires.length, 0);
      assertEqual(tech.unlocks, 'hover');
      assertEqual(tech.category, 'chassis');
    });

    runner.it('should have amphibiousDrive requiring advancedMobility', () => {
      const tech = getTech('amphibiousDrive');
      assertEqual(tech.requires.length, 1);
      assertEqual(tech.requires[0], 'advancedMobility');
      assertEqual(tech.unlocks, 'amphibious');
      assertEqual(tech.category, 'chassis');
    });

    runner.it('should have railgun requiring two techs', () => {
      const tech = getTech('railgun');
      assertEqual(tech.requires.length, 2);
      assert(tech.requires.includes('plasmaTech'));
      assert(tech.requires.includes('targeting'));
      assertEqual(tech.unlocks, 'railgun');
    });

  });

  runner.describe('isTechUnlocked', () => {

    runner.it('should return false for uninitialized team', () => {
      assert(!isTechUnlocked('newteam', 'advancedMobility'));
    });

    runner.it('should return false for unlocked tech on initialized team', () => {
      initTeamResearch('testplayer1');
      assert(!isTechUnlocked('testplayer1', 'advancedMobility'));
    });

  });

  runner.describe('areTechPrereqsMet', () => {

    runner.it('should return true for tech with no prerequisites', () => {
      initTeamResearch('prereqtest1');
      assert(areTechPrereqsMet('prereqtest1', 'advancedMobility'));
    });

    runner.it('should return false when prerequisites not met', () => {
      initTeamResearch('prereqtest2');
      assert(!areTechPrereqsMet('prereqtest2', 'amphibiousDrive'));
    });

  });

  runner.describe('getTechAvailability', () => {

    runner.it('should be available for root tech with enough science', () => {
      initTeamResearch('availtest1');
      const result = getTechAvailability('availtest1', 'advancedMobility', 10);
      assert(result.available);
    });

    runner.it('should not be available with insufficient science', () => {
      initTeamResearch('availtest2');
      const result = getTechAvailability('availtest2', 'advancedMobility', 2);
      assert(!result.available);
      assert(result.reason!.includes('Need'));
    });

    runner.it('should not be available when prereqs not met', () => {
      initTeamResearch('availtest3');
      const result = getTechAvailability('availtest3', 'amphibiousDrive', 100);
      assert(!result.available);
      assert(result.reason!.includes('Requires'));
    });

  });

  runner.describe('purchaseTech', () => {

    runner.it('should successfully purchase root tech with enough science', () => {
      initTeamResearch('purchtest1');
      const resources = new ResourceManager(['purchtest1']);
      resources.addScience('purchtest1', 10);

      const result = purchaseTech('purchtest1', 'advancedMobility', resources);

      assert(result.success);
      assertEqual(resources.getResources('purchtest1').science, 5); // 10 - 5 cost
      assert(isTechUnlocked('purchtest1', 'advancedMobility'));
    });

    runner.it('should unlock the corresponding component', () => {
      initTeamResearch('purchtest2');
      const resources = new ResourceManager(['purchtest2']);
      resources.addScience('purchtest2', 10);

      // Hover should not be available before purchase
      assert(!isChassisResearched('purchtest2', 'hover'));

      purchaseTech('purchtest2', 'advancedMobility', resources);

      // Hover should be available after purchase
      assert(isChassisResearched('purchtest2', 'hover'));
    });

    runner.it('should fail with insufficient science', () => {
      initTeamResearch('purchtest3');
      const resources = new ResourceManager(['purchtest3']);
      resources.addScience('purchtest3', 2);

      const result = purchaseTech('purchtest3', 'advancedMobility', resources);

      assert(!result.success);
      assertEqual(resources.getResources('purchtest3').science, 2); // unchanged
    });

    runner.it('should fail when prerequisites not met', () => {
      initTeamResearch('purchtest4');
      const resources = new ResourceManager(['purchtest4']);
      resources.addScience('purchtest4', 100);

      const result = purchaseTech('purchtest4', 'amphibiousDrive', resources);

      assert(!result.success);
      assert(!isTechUnlocked('purchtest4', 'amphibiousDrive'));
    });

    runner.it('should allow chained purchases', () => {
      initTeamResearch('purchtest5');
      const resources = new ResourceManager(['purchtest5']);
      resources.addScience('purchtest5', 50);

      // Purchase advancedMobility first
      const result1 = purchaseTech('purchtest5', 'advancedMobility', resources);
      assert(result1.success);

      // Now amphibiousDrive should be purchasable
      const result2 = purchaseTech('purchtest5', 'amphibiousDrive', resources);
      assert(result2.success);

      assert(isChassisResearched('purchtest5', 'amphibious'));
    });

    runner.it('should unlock system component for stealthTech', () => {
      initTeamResearch('purchtest6');
      const resources = new ResourceManager(['purchtest6']);
      resources.addScience('purchtest6', 30);

      purchaseTech('purchtest6', 'defenseTech', resources);
      purchaseTech('purchtest6', 'shieldTech', resources);
      purchaseTech('purchtest6', 'stealthTech', resources);

      assert(isSystemResearched('purchtest6', 'stealth'));
    });

  });

  runner.describe('getTechTreeState', () => {

    runner.it('should return all techs with correct states', () => {
      initTeamResearch('statetest1');
      const nodes = getTechTreeState('statetest1', 100);

      assertEqual(nodes.length, 19);

      // Root techs should be available
      const advMobility = nodes.find(n => n.tech.id === 'advancedMobility')!;
      assertEqual(advMobility.state, 'available');

      // Tier 1 techs should be locked (prereqs not met)
      const amphib = nodes.find(n => n.tech.id === 'amphibiousDrive')!;
      assertEqual(amphib.state, 'locked');
    });

    runner.it('should mark purchased techs as unlocked', () => {
      initTeamResearch('statetest2');
      const resources = new ResourceManager(['statetest2']);
      resources.addScience('statetest2', 10);
      purchaseTech('statetest2', 'advancedMobility', resources);

      const nodes = getTechTreeState('statetest2', 100);
      const advMobility = nodes.find(n => n.tech.id === 'advancedMobility')!;
      assertEqual(advMobility.state, 'unlocked');

      // Dependent techs should now be available
      const amphib = nodes.find(n => n.tech.id === 'amphibiousDrive')!;
      assertEqual(amphib.state, 'available');
    });

  });

  runner.describe('computeTechLayout', () => {

    runner.it('should assign tier 0 to root techs', () => {
      const layout = computeTechLayout();
      const advMobility = layout.find(p => p.techId === 'advancedMobility')!;
      assertEqual(advMobility.tier, 0);

      const energy = layout.find(p => p.techId === 'energyWeapons')!;
      assertEqual(energy.tier, 0);

      const defense = layout.find(p => p.techId === 'defenseTech')!;
      assertEqual(defense.tier, 0);
    });

    runner.it('should assign tier 1 to techs with one prereq', () => {
      const layout = computeTechLayout();
      const amphib = layout.find(p => p.techId === 'amphibiousDrive')!;
      assertEqual(amphib.tier, 1);

      const plasma = layout.find(p => p.techId === 'plasmaTech')!;
      assertEqual(plasma.tier, 1);

      const shield = layout.find(p => p.techId === 'shieldTech')!;
      assertEqual(shield.tier, 1);
    });

    runner.it('should assign higher tiers to techs with deeper prereqs', () => {
      const layout = computeTechLayout();

      // Tier 2
      const jumpJets = layout.find(p => p.techId === 'jumpJets')!;
      assertEqual(jumpJets.tier, 2);

      // Tier 3
      const railgun = layout.find(p => p.techId === 'railgun')!;
      assertEqual(railgun.tier, 3);

      // Tier 6 (ultimate)
      const fusion = layout.find(p => p.techId === 'fusionCore')!;
      assertEqual(fusion.tier, 6);
    });

    runner.it('should return positions for all techs', () => {
      const layout = computeTechLayout();
      assertEqual(layout.length, 19);
    });

    runner.it('should order nodes by barycenter to minimize crossings', () => {
      const layout = computeTechLayout();

      // Tier 0 should be alphabetically sorted
      const tier0 = layout.filter(p => p.tier === 0).sort((a, b) => a.column - b.column);
      assertEqual(tier0[0]!.techId, 'advancedMobility');
      assertEqual(tier0[1]!.techId, 'defenseTech');
      assertEqual(tier0[2]!.techId, 'energyWeapons');
    });

  });

});

export default runner;
