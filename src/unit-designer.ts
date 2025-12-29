// ============================================================================
// HEX DOMINION - Unit Designer Business Logic
// ============================================================================
// This module provides pure functions for unit design that can be reused by AI.

import {
  getChassis,
  getWeapon,
  getSystem,
  getAllChassis,
  getAllWeapons,
  getAllSystems,
  validateTemplate,
  computeTemplateCost,
  type ChassisComponent,
  type WeaponComponent,
  type SystemComponent,
} from './components.js';
import { type Building } from './building.js';
import {
  isChassisResearched,
  isWeaponResearched,
  isSystemResearched,
} from './research.js';

// ============================================================================
// Design State
// ============================================================================

export interface DesignState {
  chassisId: string | null;
  weaponId: string | null;
  systemIds: string[];
}

export function createEmptyDesign(): DesignState {
  return {
    chassisId: 'foot',
    weaponId: null,
    systemIds: [],
  };
}

export function createDesignFromTemplate(template: {
  chassisId: string;
  weaponId: string | null;
  systemIds: string[];
}): DesignState {
  return {
    chassisId: template.chassisId,
    weaponId: template.weaponId,
    systemIds: [...template.systemIds],
  };
}

// ============================================================================
// Component Availability (for greying out incompatible options)
// ============================================================================

export interface WeaponAvailability {
  weapon: WeaponComponent;
  available: boolean;
  reason?: string;
}

export interface SystemAvailability {
  system: SystemComponent;
  available: boolean;
  reason?: string;
}

// Get only researched chassis for the team
export function getResearchedChassis(team: string): ChassisComponent[] {
  return getAllChassis().filter(chassis => isChassisResearched(team, chassis.id));
}

// Get only researched weapons for the team
export function getResearchedWeapons(team: string): WeaponComponent[] {
  return getAllWeapons().filter(weapon => isWeaponResearched(team, weapon.id));
}

// Get only researched systems for the team
export function getResearchedSystems(team: string): SystemComponent[] {
  return getAllSystems().filter(system => isSystemResearched(team, system.id));
}

export function getAvailableWeapons(
  chassisId: string | null,
  selectedSystems: string[] = [],
  team: string = ''
): WeaponAvailability[] {
  // Filter to only researched weapons (unresearched are hidden, not greyed)
  const weapons = team
    ? getAllWeapons().filter(w => isWeaponResearched(team, w.id))
    : getAllWeapons();

  if (!chassisId) {
    return weapons.map(weapon => ({
      weapon,
      available: false,
      reason: 'Select a chassis first',
    }));
  }

  const chassis = getChassis(chassisId);

  // Calculate weight used by selected systems
  let systemWeight = 0;
  for (const sysId of selectedSystems) {
    systemWeight += getSystem(sysId).weight;
  }
  const remainingCapacity = chassis.maxWeight - systemWeight;

  return weapons.map(weapon => {
    // Check chassis requirement
    if (weapon.requiresChassis && !weapon.requiresChassis.includes(chassisId)) {
      return {
        weapon,
        available: false,
        reason: `Requires: ${weapon.requiresChassis.map(id => getChassis(id).name).join(', ')}`,
      };
    }

    // Check weight (considering system weight)
    if (weapon.weight > remainingCapacity) {
      return {
        weapon,
        available: false,
        reason: `Weight ${weapon.weight} exceeds capacity (${remainingCapacity} remaining)`,
      };
    }

    return { weapon, available: true };
  });
}

export function getAvailableSystems(
  chassisId: string | null,
  selectedSystems: string[],
  weaponId: string | null = null,
  team: string = ''
): SystemAvailability[] {
  // Filter to only researched systems (unresearched are hidden, not greyed)
  // But always include currently selected systems even if somehow unresearched
  const systems = team
    ? getAllSystems().filter(s => isSystemResearched(team, s.id) || selectedSystems.includes(s.id))
    : getAllSystems();

  if (!chassisId) {
    return systems.map(system => ({
      system,
      available: false,
      reason: 'Select a chassis first',
    }));
  }

  const chassis = getChassis(chassisId);
  const weaponWeight = weaponId ? getWeapon(weaponId).weight : 0;

  return systems.map(system => {
    // Already selected - show as available (for toggle off)
    if (selectedSystems.includes(system.id)) {
      return { system, available: true };
    }

    // Check chassis requirement
    if (system.requiresChassis && !system.requiresChassis.includes(chassisId)) {
      return {
        system,
        available: false,
        reason: `Requires: ${system.requiresChassis.map(id => getChassis(id).name).join(', ')}`,
      };
    }

    // Check weight capacity (system + weapon must fit)
    const totalWeight = weaponWeight + system.weight;
    if (totalWeight > chassis.maxWeight) {
      return {
        system,
        available: false,
        reason: `Weight ${system.weight} exceeds capacity (${chassis.maxWeight - weaponWeight} remaining)`,
      };
    }

    return { system, available: true };
  });
}

// ============================================================================
// Selection Logic (handles auto-deselection)
// ============================================================================

export function selectChassis(design: DesignState, chassisId: string): DesignState {
  const chassis = getChassis(chassisId);
  let weaponId = design.weaponId;
  let systemIds = [...design.systemIds];

  // Check if current weapon is still compatible
  if (weaponId) {
    const weapon = getWeapon(weaponId);
    if (weapon.requiresChassis && !weapon.requiresChassis.includes(chassisId)) {
      weaponId = null;
    } else if (weapon.weight > chassis.maxWeight) {
      weaponId = null;
    }
  }

  // Remove incompatible systems
  systemIds = systemIds.filter(sysId => {
    const system = getSystem(sysId);
    if (system.requiresChassis && !system.requiresChassis.includes(chassisId)) {
      return false;
    }
    return true;
  });

  // Check weight capacity and remove systems if needed
  let totalWeight = weaponId ? getWeapon(weaponId).weight : 0;
  const validSystemIds: string[] = [];

  for (const sysId of systemIds) {
    const system = getSystem(sysId);
    if (totalWeight + system.weight <= chassis.maxWeight) {
      totalWeight += system.weight;
      validSystemIds.push(sysId);
    }
  }

  return {
    chassisId,
    weaponId,
    systemIds: validSystemIds,
  };
}

export function selectWeapon(design: DesignState, weaponId: string | null): DesignState {
  return {
    ...design,
    weaponId,
  };
}

export function toggleSystem(design: DesignState, systemId: string): DesignState {
  // Only one system allowed at a time - toggle off if already selected, otherwise replace
  const systemIds = design.systemIds.includes(systemId)
    ? []
    : [systemId];

  return {
    ...design,
    systemIds,
  };
}

// ============================================================================
// Preview (stats without creating template)
// ============================================================================

export interface DesignPreview {
  valid: boolean;
  error?: string;
  cost: number;
  speed: number;
  attack: number;
  range: number;
  armored: boolean;
  armorPiercing: boolean;
  canCapture: boolean;
  canBuild: boolean;
  totalWeight: number;
  maxWeight: number;
}

export function getDesignPreview(design: DesignState): DesignPreview | null {
  if (!design.chassisId) {
    return null;
  }

  const chassis = getChassis(design.chassisId);
  const weapon = design.weaponId ? getWeapon(design.weaponId) : null;
  const systems = design.systemIds.map(id => getSystem(id));

  const validation = validateTemplate(design.chassisId, design.weaponId, design.systemIds);
  const cost = computeTemplateCost(design.chassisId, design.weaponId, design.systemIds);

  // Derive abilities
  const canCapture = systems.some(s => s.grantsCapture === true);
  const canBuild = systems.some(s => s.grantsBuild === true);
  const armored = systems.some(s => s.grantsArmor === true);

  return {
    valid: validation.valid,
    error: validation.error,
    cost,
    speed: chassis.speed,
    attack: weapon?.attack ?? 0,
    range: weapon?.range ?? 0,
    armored,
    armorPiercing: weapon?.armorPiercing ?? false,
    canCapture,
    canBuild,
    totalWeight: validation.totalWeight,
    maxWeight: validation.maxWeight,
  };
}

// ============================================================================
// Component Details (for hover tooltip)
// ============================================================================

export interface ComponentDetails {
  name: string;
  stats: string[];
  cost: number;
  abilities?: string[];
  requirements?: string;
}

export function getChassisDetails(id: string): ComponentDetails {
  const chassis = getChassis(id);

  // Format terrain costs for display
  const tc = chassis.terrainCosts;
  const terrainParts: string[] = [];
  if (tc.road !== 1) terrainParts.push(`Road ${tc.road}`);
  if (tc.woods !== 1) terrainParts.push(`Woods ${tc.woods}`);
  if (tc.water !== Infinity) terrainParts.push(`Water ${tc.water}`);
  if (tc.mountain !== Infinity) terrainParts.push(`Mountain ${tc.mountain}`);

  const abilities = terrainParts.length > 0
    ? terrainParts
    : ['All terrain cost 1'];

  return {
    name: chassis.name,
    stats: [
      `Speed ${chassis.speed}`,
      `Max Weight ${chassis.maxWeight}`,
    ],
    cost: chassis.baseCost,
    abilities,
  };
}

export function getWeaponDetails(id: string): ComponentDetails {
  const weapon = getWeapon(id);
  const details: ComponentDetails = {
    name: weapon.name,
    stats: [
      `Attack ${weapon.attack}`,
      `Range ${weapon.range}`,
      `Weight ${weapon.weight}`,
    ],
    cost: weapon.cost,
  };

  if (weapon.armorPiercing) {
    details.abilities = ['Armor Piercing'];
  }

  if (weapon.requiresChassis) {
    details.requirements = `Requires: ${weapon.requiresChassis.map(id => getChassis(id).name).join(', ')}`;
  }

  return details;
}

export function getSystemDetails(id: string): ComponentDetails {
  const system = getSystem(id);
  const details: ComponentDetails = {
    name: system.name,
    stats: [`Weight ${system.weight}`],
    cost: system.cost,
  };

  const abilities: string[] = [];
  if (system.grantsCapture) abilities.push('Can Capture');
  if (system.grantsBuild) abilities.push('Can Build');
  if (system.grantsArmor) abilities.push('Grants Armor');
  if (abilities.length > 0) {
    details.abilities = abilities;
  }

  if (system.requiresChassis) {
    details.requirements = `Requires: ${system.requiresChassis.map(id => getChassis(id).name).join(', ')}`;
  }

  return details;
}

// ============================================================================
// Lab Access Check (for AI and UI)
// ============================================================================

export function canAccessDesigner(team: string, buildings: Building[]): boolean {
  return buildings.some(b => b.type === 'lab' && b.owner === team);
}

// ============================================================================
// Re-export component accessors for convenience
// ============================================================================

export { getAllChassis, getAllWeapons, getAllSystems };
