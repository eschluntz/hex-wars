// ============================================================================
// HEX DOMINION - Research Tests
// ============================================================================
// Tests research unlock logic with generic IDs (not tied to specific tech tree).

import { TestRunner, assertEqual, assert } from './framework.js';
import {
  initTeamResearch,
  isChassisResearched,
  isWeaponResearched,
  isSystemResearched,
  unlockChassis,
  unlockWeapon,
  unlockSystem,
  isTechUnlocked,
  unlockTech,
  getUnlockedTechs,
} from '../src/research.js';

const runner = new TestRunner();

runner.describe('Research System', () => {

  // ==========================================================================
  // Initialization tests
  // ==========================================================================

  runner.describe('initTeamResearch', () => {

    runner.it('should initialize with base chassis', () => {
      initTeamResearch('initbase1');
      assert(isChassisResearched('initbase1', 'foot'));
      assert(isChassisResearched('initbase1', 'wheels'));
      assert(isChassisResearched('initbase1', 'treads'));
    });

    runner.it('should initialize with base weapons', () => {
      initTeamResearch('initbase2');
      assert(isWeaponResearched('initbase2', 'machineGun'));
      assert(isWeaponResearched('initbase2', 'heavyMG'));
      assert(isWeaponResearched('initbase2', 'cannon'));
      assert(isWeaponResearched('initbase2', 'artillery'));
    });

    runner.it('should initialize with base systems', () => {
      initTeamResearch('initbase3');
      assert(isSystemResearched('initbase3', 'capture'));
      assert(isSystemResearched('initbase3', 'build'));
      assert(isSystemResearched('initbase3', 'armor'));
    });

    runner.it('should not have locked components unlocked', () => {
      initTeamResearch('initbase4');
      // These are locked until researched
      assert(!isChassisResearched('initbase4', 'hover'));
      assert(!isSystemResearched('initbase4', 'stealth'));
    });

    runner.it('should initialize with no techs unlocked', () => {
      initTeamResearch('initbase5');
      const techs = getUnlockedTechs('initbase5');
      assertEqual(techs.size, 0);
    });

  });

  // ==========================================================================
  // Component unlock tests
  // ==========================================================================

  runner.describe('unlockChassis', () => {

    runner.it('should unlock a locked chassis', () => {
      initTeamResearch('unlockch1');
      assert(!isChassisResearched('unlockch1', 'hover'));

      unlockChassis('unlockch1', 'hover');

      assert(isChassisResearched('unlockch1', 'hover'));
    });

    runner.it('should not affect other teams', () => {
      initTeamResearch('unlockch2a');
      initTeamResearch('unlockch2b');

      unlockChassis('unlockch2a', 'hover');

      assert(isChassisResearched('unlockch2a', 'hover'));
      assert(!isChassisResearched('unlockch2b', 'hover'));
    });

  });

  runner.describe('unlockWeapon', () => {

    runner.it('should unlock a locked weapon', () => {
      initTeamResearch('unlockwp1');
      assert(!isWeaponResearched('unlockwp1', 'laser'));

      unlockWeapon('unlockwp1', 'laser');

      assert(isWeaponResearched('unlockwp1', 'laser'));
    });

    runner.it('should unlock plasma weapon', () => {
      initTeamResearch('unlockwp2');
      assert(!isWeaponResearched('unlockwp2', 'plasma'));

      unlockWeapon('unlockwp2', 'plasma');

      assert(isWeaponResearched('unlockwp2', 'plasma'));
    });

  });

  runner.describe('unlockSystem', () => {

    runner.it('should unlock a locked system', () => {
      initTeamResearch('unlocksys1');
      assert(!isSystemResearched('unlocksys1', 'stealth'));

      unlockSystem('unlocksys1', 'stealth');

      assert(isSystemResearched('unlocksys1', 'stealth'));
    });

  });

  // ==========================================================================
  // Tech tracking tests (uses generic IDs)
  // ==========================================================================

  runner.describe('isTechUnlocked / unlockTech', () => {

    runner.it('should track unlocked techs', () => {
      initTeamResearch('techtrack1');
      assert(!isTechUnlocked('techtrack1', 'someTech'));

      unlockTech('techtrack1', 'someTech');

      assert(isTechUnlocked('techtrack1', 'someTech'));
    });

    runner.it('should track multiple unlocked techs', () => {
      initTeamResearch('techtrack2');
      unlockTech('techtrack2', 'techA');
      unlockTech('techtrack2', 'techB');

      assert(isTechUnlocked('techtrack2', 'techA'));
      assert(isTechUnlocked('techtrack2', 'techB'));
      assert(!isTechUnlocked('techtrack2', 'techC'));
    });

  });

  runner.describe('getUnlockedTechs', () => {

    runner.it('should return empty set for new team', () => {
      initTeamResearch('gettech1');
      const techs = getUnlockedTechs('gettech1');
      assertEqual(techs.size, 0);
    });

    runner.it('should return set with unlocked techs', () => {
      initTeamResearch('gettech2');
      unlockTech('gettech2', 'techX');
      unlockTech('gettech2', 'techY');

      const techs = getUnlockedTechs('gettech2');
      assertEqual(techs.size, 2);
      assert(techs.has('techX'));
      assert(techs.has('techY'));
    });

  });

  // ==========================================================================
  // Fallback behavior for uninitialized teams
  // ==========================================================================

  runner.describe('isXResearched with uninitialized team', () => {

    runner.it('should return true for base chassis on uninitialized team', () => {
      // Fall back to BASE_CHASSIS check
      assert(isChassisResearched('noexist', 'foot'));
      assert(!isChassisResearched('noexist', 'hover'));
    });

    runner.it('should return true for base weapons on uninitialized team', () => {
      assert(isWeaponResearched('noexist', 'cannon'));
      assert(!isWeaponResearched('noexist', 'laser'));
    });

    runner.it('should return true for base systems on uninitialized team', () => {
      assert(isSystemResearched('noexist', 'armor'));
      assert(!isSystemResearched('noexist', 'stealth'));
    });

  });

});

export default runner;
