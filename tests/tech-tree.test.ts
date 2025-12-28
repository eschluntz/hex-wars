// ============================================================================
// HEX DOMINION - Tech Tree Tests
// ============================================================================
// Uses a test fixture for logic tests to decouple from game balance changes.

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
import { TEST_TECH_TREE } from './fixtures/test-tech-tree.js';

const runner = new TestRunner();

runner.describe('Tech Tree', () => {

  // ==========================================================================
  // Tests using the FIXTURE (isolated from game data changes)
  // ==========================================================================

  runner.describe('getAllTechs (fixture)', () => {

    runner.it('should return all techs from the provided tree', () => {
      const techs = getAllTechs(TEST_TECH_TREE);
      assertEqual(techs.length, 6);
    });

  });

  runner.describe('getTech (fixture)', () => {

    runner.it('should return tech by id', () => {
      const tech = getTech('rootA', TEST_TECH_TREE);
      assertEqual(tech.name, 'Root A');
      assertEqual(tech.category, 'chassis');
    });

  });

  runner.describe('areTechPrereqsMet (fixture)', () => {

    runner.it('should return true for tech with no prerequisites', () => {
      initTeamResearch('fix_prereq1');
      assert(areTechPrereqsMet('fix_prereq1', 'rootA', TEST_TECH_TREE));
      assert(areTechPrereqsMet('fix_prereq1', 'rootB', TEST_TECH_TREE));
    });

    runner.it('should return false when single prerequisite not met', () => {
      initTeamResearch('fix_prereq2');
      assert(!areTechPrereqsMet('fix_prereq2', 'childA', TEST_TECH_TREE));
    });

    runner.it('should return false when any prerequisite not met', () => {
      initTeamResearch('fix_prereq3');
      // convergent requires both childA and childB
      assert(!areTechPrereqsMet('fix_prereq3', 'convergent', TEST_TECH_TREE));
    });

  });

  runner.describe('getTechAvailability (fixture)', () => {

    runner.it('should be available for root tech with enough science', () => {
      initTeamResearch('fix_avail1');
      const result = getTechAvailability('fix_avail1', 'rootA', 10, TEST_TECH_TREE);
      assert(result.available);
    });

    runner.it('should not be available with insufficient science', () => {
      initTeamResearch('fix_avail2');
      const result = getTechAvailability('fix_avail2', 'rootA', 2, TEST_TECH_TREE);
      assert(!result.available);
      assert(result.reason!.includes('Need'));
    });

    runner.it('should not be available when prereqs not met', () => {
      initTeamResearch('fix_avail3');
      const result = getTechAvailability('fix_avail3', 'childA', 100, TEST_TECH_TREE);
      assert(!result.available);
      assert(result.reason!.includes('Requires'));
    });

    runner.it('should show all missing prereqs in reason', () => {
      initTeamResearch('fix_avail4');
      const result = getTechAvailability('fix_avail4', 'convergent', 100, TEST_TECH_TREE);
      assert(!result.available);
      assert(result.reason!.includes('Child A'));
      assert(result.reason!.includes('Child B'));
    });

  });

  runner.describe('purchaseTech (fixture)', () => {

    runner.it('should successfully purchase root tech', () => {
      initTeamResearch('fix_purch1');
      const resources = new ResourceManager(['fix_purch1']);
      resources.addScience('fix_purch1', 10);

      const result = purchaseTech('fix_purch1', 'rootA', resources, TEST_TECH_TREE);

      assert(result.success);
      assertEqual(resources.getResources('fix_purch1').science, 5); // 10 - 5 cost
      assert(isTechUnlocked('fix_purch1', 'rootA'));
    });

    runner.it('should fail with insufficient science', () => {
      initTeamResearch('fix_purch2');
      const resources = new ResourceManager(['fix_purch2']);
      resources.addScience('fix_purch2', 2);

      const result = purchaseTech('fix_purch2', 'rootA', resources, TEST_TECH_TREE);

      assert(!result.success);
      assertEqual(resources.getResources('fix_purch2').science, 2);
    });

    runner.it('should fail when prerequisites not met', () => {
      initTeamResearch('fix_purch3');
      const resources = new ResourceManager(['fix_purch3']);
      resources.addScience('fix_purch3', 100);

      const result = purchaseTech('fix_purch3', 'childA', resources, TEST_TECH_TREE);

      assert(!result.success);
      assert(!isTechUnlocked('fix_purch3', 'childA'));
    });

    runner.it('should allow chained purchases', () => {
      initTeamResearch('fix_purch4');
      const resources = new ResourceManager(['fix_purch4']);
      resources.addScience('fix_purch4', 50);

      const result1 = purchaseTech('fix_purch4', 'rootA', resources, TEST_TECH_TREE);
      assert(result1.success);

      const result2 = purchaseTech('fix_purch4', 'childA', resources, TEST_TECH_TREE);
      assert(result2.success);

      assert(isTechUnlocked('fix_purch4', 'childA'));
    });

    runner.it('should require all prereqs for convergent tech', () => {
      initTeamResearch('fix_purch5');
      const resources = new ResourceManager(['fix_purch5']);
      resources.addScience('fix_purch5', 100);

      // Purchase only one branch
      purchaseTech('fix_purch5', 'rootA', resources, TEST_TECH_TREE);
      purchaseTech('fix_purch5', 'childA', resources, TEST_TECH_TREE);

      // Should fail - missing childB
      const result = purchaseTech('fix_purch5', 'convergent', resources, TEST_TECH_TREE);
      assert(!result.success);
    });

    runner.it('should succeed when all prereqs met for convergent tech', () => {
      initTeamResearch('fix_purch6');
      const resources = new ResourceManager(['fix_purch6']);
      resources.addScience('fix_purch6', 100);

      // Purchase both branches
      purchaseTech('fix_purch6', 'rootA', resources, TEST_TECH_TREE);
      purchaseTech('fix_purch6', 'rootB', resources, TEST_TECH_TREE);
      purchaseTech('fix_purch6', 'childA', resources, TEST_TECH_TREE);
      purchaseTech('fix_purch6', 'childB', resources, TEST_TECH_TREE);

      const result = purchaseTech('fix_purch6', 'convergent', resources, TEST_TECH_TREE);
      assert(result.success);
    });

  });

  runner.describe('getTechTreeState (fixture)', () => {

    runner.it('should return all techs with correct states', () => {
      initTeamResearch('fix_state1');
      const nodes = getTechTreeState('fix_state1', 100, TEST_TECH_TREE);

      assertEqual(nodes.length, 6);

      const rootA = nodes.find(n => n.tech.id === 'rootA')!;
      assertEqual(rootA.state, 'available');

      const childA = nodes.find(n => n.tech.id === 'childA')!;
      assertEqual(childA.state, 'locked');
    });

    runner.it('should mark purchased techs as unlocked', () => {
      initTeamResearch('fix_state2');
      const resources = new ResourceManager(['fix_state2']);
      resources.addScience('fix_state2', 10);
      purchaseTech('fix_state2', 'rootA', resources, TEST_TECH_TREE);

      const nodes = getTechTreeState('fix_state2', 100, TEST_TECH_TREE);

      const rootA = nodes.find(n => n.tech.id === 'rootA')!;
      assertEqual(rootA.state, 'unlocked');

      const childA = nodes.find(n => n.tech.id === 'childA')!;
      assertEqual(childA.state, 'available');
    });

  });

  runner.describe('computeTechLayout (fixture)', () => {

    runner.it('should assign tier 0 to root techs', () => {
      const layout = computeTechLayout(TEST_TECH_TREE);

      const rootA = layout.find(p => p.techId === 'rootA')!;
      assertEqual(rootA.tier, 0);

      const rootB = layout.find(p => p.techId === 'rootB')!;
      assertEqual(rootB.tier, 0);
    });

    runner.it('should assign tier 1 to techs with single prereq', () => {
      const layout = computeTechLayout(TEST_TECH_TREE);

      const childA = layout.find(p => p.techId === 'childA')!;
      assertEqual(childA.tier, 1);

      const childB = layout.find(p => p.techId === 'childB')!;
      assertEqual(childB.tier, 1);
    });

    runner.it('should assign tier 2 to convergent tech', () => {
      const layout = computeTechLayout(TEST_TECH_TREE);

      const convergent = layout.find(p => p.techId === 'convergent')!;
      assertEqual(convergent.tier, 2);
    });

    runner.it('should assign tier 3 to ultimate tech', () => {
      const layout = computeTechLayout(TEST_TECH_TREE);

      const ultimate = layout.find(p => p.techId === 'ultimate')!;
      assertEqual(ultimate.tier, 3);
    });

    runner.it('should return positions for all techs', () => {
      const layout = computeTechLayout(TEST_TECH_TREE);
      assertEqual(layout.length, 6);
    });

    runner.it('should order tier 0 alphabetically', () => {
      const layout = computeTechLayout(TEST_TECH_TREE);
      const tier0 = layout.filter(p => p.tier === 0).sort((a, b) => a.column - b.column);
      assertEqual(tier0[0]!.techId, 'rootA');
      assertEqual(tier0[1]!.techId, 'rootB');
    });

  });

  // ==========================================================================
  // Smoke tests for REAL game data (validates structure, not specific values)
  // ==========================================================================

  runner.describe('TECH_TREE validation (game data)', () => {

    runner.it('should have at least one tech', () => {
      const techs = getAllTechs();
      assert(techs.length > 0, 'Tech tree should not be empty');
    });

    runner.it('should have at least one root tech (no prerequisites)', () => {
      const techs = getAllTechs();
      const roots = techs.filter(t => t.requires.length === 0);
      assert(roots.length > 0, 'Should have at least one root tech');
    });

    runner.it('all techs should have valid category', () => {
      const validCategories = ['chassis', 'weapon', 'system'];
      for (const tech of getAllTechs()) {
        assert(validCategories.includes(tech.category),
          `Tech ${tech.id} has invalid category: ${tech.category}`);
      }
    });

    runner.it('all prerequisites should reference existing techs', () => {
      const allIds = new Set(Object.keys(TECH_TREE));
      for (const tech of getAllTechs()) {
        for (const prereq of tech.requires) {
          assert(allIds.has(prereq),
            `Tech ${tech.id} has unknown prereq: ${prereq}`);
        }
      }
    });

    runner.it('should have no circular dependencies', () => {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      function hasCycle(techId: string): boolean {
        visited.add(techId);
        recursionStack.add(techId);

        const tech = TECH_TREE[techId]!;
        for (const prereq of tech.requires) {
          if (!visited.has(prereq)) {
            if (hasCycle(prereq)) return true;
          } else if (recursionStack.has(prereq)) {
            return true;
          }
        }

        recursionStack.delete(techId);
        return false;
      }

      for (const techId of Object.keys(TECH_TREE)) {
        if (!visited.has(techId)) {
          assert(!hasCycle(techId), `Circular dependency detected involving ${techId}`);
        }
      }
    });

    runner.it('all techs should have positive cost', () => {
      for (const tech of getAllTechs()) {
        assert(tech.cost > 0, `Tech ${tech.id} should have positive cost`);
      }
    });

  });

});

export default runner;
