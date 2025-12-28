// ============================================================================
// HEX DOMINION - Component System
// ============================================================================

import { DEFAULT_TERRAIN_COSTS, type TerrainCosts } from './core.js';

// ============================================================================
// CHASSIS COMPONENTS
// ============================================================================

export interface ChassisComponent {
  id: string;
  name: string;
  speed: number;
  terrainCosts: TerrainCosts;
  maxWeight: number;
  baseCost: number;
}

const FOOT_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  road: 1,    // Foot soldiers aren't faster on roads
  woods: 1,   // Foot soldiers move through woods easily
};

const WHEELS_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  woods: 2,
  road: 0.5,
};

const TREADS_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  woods: 2,
  road: 0.5,
};

export const CHASSIS: Record<string, ChassisComponent> = {
  foot: {
    id: 'foot',
    name: 'Foot',
    speed: 3,
    terrainCosts: FOOT_TERRAIN_COSTS,
    maxWeight: 2,
    baseCost: 500,
  },
  wheels: {
    id: 'wheels',
    name: 'Wheels',
    speed: 6,
    terrainCosts: WHEELS_TERRAIN_COSTS,
    maxWeight: 3,
    baseCost: 800,
  },
  treads: {
    id: 'treads',
    name: 'Treads',
    speed: 4,
    terrainCosts: TREADS_TERRAIN_COSTS,
    maxWeight: 10,
    baseCost: 1500,
  },
};

// ============================================================================
// WEAPON COMPONENTS
// ============================================================================

export interface WeaponComponent {
  id: string;
  name: string;
  attack: number;
  armorPiercing: boolean;
  range: number;
  weight: number;
  cost: number;
  requiresChassis?: string[];  // Only these chassis can use this weapon
}

export const WEAPONS: Record<string, WeaponComponent> = {
  machineGun: {
    id: 'machineGun',
    name: 'Machine Gun',
    attack: 4,
    armorPiercing: false,
    range: 1,
    weight: 1,
    cost: 500,
  },
  heavyMG: {
    id: 'heavyMG',
    name: 'Heavy MG',
    attack: 6,
    armorPiercing: false,
    range: 1,
    weight: 2,
    cost: 800,
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    attack: 7,
    armorPiercing: true,
    range: 1,
    weight: 4,
    cost: 1500,
  },
  artillery: {
    id: 'artillery',
    name: 'Artillery',
    attack: 5,
    armorPiercing: true,
    range: 3,
    weight: 5,
    cost: 2000,
  },
};

// ============================================================================
// SYSTEM COMPONENTS
// ============================================================================

export interface SystemComponent {
  id: string;
  name: string;
  weight: number;
  cost: number;
  requiresChassis?: string[];      // Only these chassis can use this system
  grantsCapture?: boolean;         // Unit can capture buildings
  grantsBuild?: boolean;           // Unit can construct buildings
  grantsArmor?: boolean;           // Unit is armored (takes 1/5 damage from non-AP)
}

export const SYSTEMS: Record<string, SystemComponent> = {
  capture: {
    id: 'capture',
    name: 'Capture Kit',
    weight: 1,
    cost: 0,
    requiresChassis: ['foot'],
    grantsCapture: true,
  },
  build: {
    id: 'build',
    name: 'Construction Kit',
    weight: 1,
    cost: 500,
    grantsBuild: true,
  },
  armor: {
    id: 'armor',
    name: 'Armor Plating',
    weight: 2,
    cost: 1000,
    requiresChassis: ['wheels', 'treads'],
    grantsArmor: true,
  },
};

// ============================================================================
// COMPONENT ACCESSORS
// ============================================================================

export function getChassis(id: string): ChassisComponent {
  return CHASSIS[id]!;
}

export function getWeapon(id: string): WeaponComponent {
  return WEAPONS[id]!;
}

export function getSystem(id: string): SystemComponent {
  return SYSTEMS[id]!;
}

export function getAllChassis(): ChassisComponent[] {
  return Object.values(CHASSIS);
}

export function getAllWeapons(): WeaponComponent[] {
  return Object.values(WEAPONS);
}

export function getAllSystems(): SystemComponent[] {
  return Object.values(SYSTEMS);
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  totalWeight: number;
  maxWeight: number;
}

export function validateTemplate(
  chassisId: string,
  weaponId: string | null,
  systemIds: string[] = []
): ValidationResult {
  const chassis = getChassis(chassisId);
  const weapon = weaponId ? getWeapon(weaponId) : null;
  const systems = systemIds.map(id => getSystem(id));

  let totalWeight = weapon ? weapon.weight : 0;
  for (const system of systems) {
    totalWeight += system.weight;
  }

  // Check weapon chassis restrictions first
  if (weapon?.requiresChassis && !weapon.requiresChassis.includes(chassisId)) {
    return {
      valid: false,
      error: `Weapon "${weapon.name}" requires chassis: ${weapon.requiresChassis.join(', ')}`,
      totalWeight,
      maxWeight: chassis.maxWeight,
    };
  }

  // Check system chassis requirements
  for (const system of systems) {
    if (system.requiresChassis && !system.requiresChassis.includes(chassisId)) {
      return {
        valid: false,
        error: `System "${system.name}" requires chassis: ${system.requiresChassis.join(', ')}`,
        totalWeight,
        maxWeight: chassis.maxWeight,
      };
    }
  }

  // Check weight capacity last
  if (totalWeight > chassis.maxWeight) {
    return {
      valid: false,
      error: `Weight ${totalWeight} exceeds chassis capacity ${chassis.maxWeight}`,
      totalWeight,
      maxWeight: chassis.maxWeight,
    };
  }

  return {
    valid: true,
    totalWeight,
    maxWeight: chassis.maxWeight,
  };
}

// Legacy function for backwards compatibility
export function validateComponentWeight(
  chassisId: string,
  weaponId: string,
  systemIds: string[] = []
): { valid: boolean; totalWeight: number; maxWeight: number } {
  const result = validateTemplate(chassisId, weaponId, systemIds);
  return {
    valid: result.valid,
    totalWeight: result.totalWeight,
    maxWeight: result.maxWeight,
  };
}

export function computeTemplateCost(
  chassisId: string,
  weaponId: string | null,
  systemIds: string[] = []
): number {
  const chassis = getChassis(chassisId);
  const weapon = weaponId ? getWeapon(weaponId) : null;

  let cost = chassis.baseCost + (weapon?.cost ?? 0);
  for (const sysId of systemIds) {
    const system = getSystem(sysId);
    cost += system.cost;
  }

  return cost;
}
