// ============================================================================
// HEX DOMINION - AI Design Utilities
// ============================================================================
// Shared utilities for AI unit design to avoid duplication across AI implementations.

import { type AIAction } from './actions.js';
import { type AIGameState } from './game-state.js';

type ComponentWithWeight = { id: string; weight: number; requiresChassis?: string[] };
type ChassisWithWeight = { id: string; maxWeight: number };

/**
 * Create a design action for a new chassis.
 * Picks best fitting weapon and system for the chassis.
 */
export function designForChassis(
  chassis: ChassisWithWeight,
  weapons: ComponentWithWeight[],
  systems: ComponentWithWeight[],
  namePrefix: string
): AIAction | null {
  const chassisId = chassis.id;
  const maxWeight = chassis.maxWeight;

  // Find best weapon that fits
  const validWeapons = weapons.filter(w => {
    if (w.weight > maxWeight) return false;
    if (w.requiresChassis && !w.requiresChassis.includes(chassisId)) return false;
    return true;
  });
  const weaponId = validWeapons.length > 0 ? validWeapons[0]!.id : null;
  const weaponWeight = validWeapons.length > 0 ? validWeapons[0]!.weight : 0;
  const remainingWeight = maxWeight - weaponWeight;

  // Find compatible system
  const validSystems = systems.filter(s => {
    if (s.weight > remainingWeight) return false;
    if (s.requiresChassis && !s.requiresChassis.includes(chassisId)) return false;
    return true;
  });
  const systemIds = validSystems.length > 0 ? [validSystems[0]!.id] : [];

  const name = `${namePrefix}_${chassisId}_${Date.now() % 10000}`;
  return { type: 'design', name, chassisId, weaponId, systemIds };
}

/**
 * Create a design action for a new weapon.
 * Picks best chassis that can hold the weapon and a compatible system.
 */
export function designForWeapon(
  weapon: ComponentWithWeight,
  chassisList: ChassisWithWeight[],
  systems: ComponentWithWeight[],
  namePrefix: string
): AIAction | null {
  // Find a chassis that can hold this weapon
  const validChassis = chassisList.filter(c => {
    if (weapon.weight > c.maxWeight) return false;
    if (weapon.requiresChassis && !weapon.requiresChassis.includes(c.id)) return false;
    return true;
  });

  if (validChassis.length === 0) return null;

  const chassis = validChassis[0]!;
  const remainingWeight = chassis.maxWeight - weapon.weight;

  // Find compatible system
  const validSystems = systems.filter(s => {
    if (s.weight > remainingWeight) return false;
    if (s.requiresChassis && !s.requiresChassis.includes(chassis.id)) return false;
    return true;
  });
  const systemIds = validSystems.length > 0 ? [validSystems[0]!.id] : [];

  const name = `${namePrefix}_${weapon.id}_${Date.now() % 10000}`;
  return { type: 'design', name, chassisId: chassis.id, weaponId: weapon.id, systemIds };
}

/**
 * Create a design action for a new system.
 * Picks best chassis that can hold the system and a compatible weapon.
 */
export function designForSystem(
  system: ComponentWithWeight,
  chassisList: ChassisWithWeight[],
  weapons: ComponentWithWeight[],
  namePrefix: string
): AIAction | null {
  // Find a chassis that can hold this system
  const validChassis = chassisList.filter(c => {
    if (system.weight > c.maxWeight) return false;
    if (system.requiresChassis && !system.requiresChassis.includes(c.id)) return false;
    return true;
  });

  if (validChassis.length === 0) return null;

  const chassis = validChassis[0]!;
  const remainingWeight = chassis.maxWeight - system.weight;

  // Find best weapon that fits
  const validWeapons = weapons.filter(w => {
    if (w.weight > remainingWeight) return false;
    if (w.requiresChassis && !w.requiresChassis.includes(chassis.id)) return false;
    return true;
  });
  const weaponId = validWeapons.length > 0 ? validWeapons[0]!.id : null;

  const name = `${namePrefix}_${system.id}_${Date.now() % 10000}`;
  return { type: 'design', name, chassisId: chassis.id, weaponId, systemIds: [system.id] };
}

/**
 * Standard design phase implementation - creates templates for newly unlocked components.
 * This is the shared logic used by most AIs.
 */
export function planDesignPhase(state: AIGameState, team: string, namePrefix: string): AIAction[] {
  const actions: AIAction[] = [];
  const templates = state.getTeamTemplates(team);
  const chassisList = state.getResearchedChassis(team);
  const weapons = state.getResearchedWeapons(team);
  const systems = state.getResearchedSystems(team);

  // Track what components are already used in templates
  const usedChassis = new Set(templates.map(t => t.chassisId));
  const usedWeapons = new Set(templates.map(t => t.weaponId).filter(Boolean));
  const usedSystems = new Set(templates.flatMap(t => t.systemIds));

  // 1. Create templates for new chassis
  for (const chassis of chassisList) {
    if (usedChassis.has(chassis.id)) continue;

    const design = designForChassis(chassis, weapons, systems, namePrefix);
    if (design) {
      actions.push(design);
      usedChassis.add(chassis.id);
      if (design.weaponId) usedWeapons.add(design.weaponId);
      design.systemIds.forEach(s => usedSystems.add(s));
    }
  }

  // 2. Create templates for new weapons
  for (const weapon of weapons) {
    if (usedWeapons.has(weapon.id)) continue;

    const design = designForWeapon(weapon, chassisList, systems, namePrefix);
    if (design) {
      actions.push(design);
      usedWeapons.add(weapon.id);
      usedChassis.add(design.chassisId);
      design.systemIds.forEach(s => usedSystems.add(s));
    }
  }

  // 3. Create templates for new systems
  for (const system of systems) {
    if (usedSystems.has(system.id)) continue;

    const design = designForSystem(system, chassisList, weapons, namePrefix);
    if (design) {
      actions.push(design);
      usedSystems.add(system.id);
      usedChassis.add(design.chassisId);
      if (design.weaponId) usedWeapons.add(design.weaponId);
    }
  }

  return actions;
}
