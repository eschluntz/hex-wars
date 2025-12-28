// ============================================================================
// HEX DOMINION - Research System
// ============================================================================
// Tracks which components are unlocked for each team.
// Currently all base components are unlocked; future tech tree will gate advanced ones.

// Components that are always available (don't require research)
const BASE_CHASSIS = new Set(['foot', 'wheels', 'treads']);
const BASE_WEAPONS = new Set(['machineGun', 'heavyMG', 'cannon', 'artillery']);
const BASE_SYSTEMS = new Set(['capture', 'build', 'armor']);

// Team research state (for future tech tree)
const teamResearch: Record<string, {
  unlockedChassis: Set<string>;
  unlockedWeapons: Set<string>;
  unlockedSystems: Set<string>;
}> = {};

export function initTeamResearch(team: string): void {
  teamResearch[team] = {
    unlockedChassis: new Set(BASE_CHASSIS),
    unlockedWeapons: new Set(BASE_WEAPONS),
    unlockedSystems: new Set(BASE_SYSTEMS),
  };
}

export function isChassisResearched(team: string, chassisId: string): boolean {
  const research = teamResearch[team];
  if (!research) {
    // Team not initialized - assume base components available
    return BASE_CHASSIS.has(chassisId);
  }
  return research.unlockedChassis.has(chassisId);
}

export function isWeaponResearched(team: string, weaponId: string): boolean {
  const research = teamResearch[team];
  if (!research) {
    return BASE_WEAPONS.has(weaponId);
  }
  return research.unlockedWeapons.has(weaponId);
}

export function isSystemResearched(team: string, systemId: string): boolean {
  const research = teamResearch[team];
  if (!research) {
    return BASE_SYSTEMS.has(systemId);
  }
  return research.unlockedSystems.has(systemId);
}

// Future: unlock functions for tech tree
export function unlockChassis(team: string, chassisId: string): void {
  if (teamResearch[team]) {
    teamResearch[team].unlockedChassis.add(chassisId);
  }
}

export function unlockWeapon(team: string, weaponId: string): void {
  if (teamResearch[team]) {
    teamResearch[team].unlockedWeapons.add(weaponId);
  }
}

export function unlockSystem(team: string, systemId: string): void {
  if (teamResearch[team]) {
    teamResearch[team].unlockedSystems.add(systemId);
  }
}
