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

const HOVER_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  woods: 1,     // Hover glides over terrain
  water: 2,     // Can cross water!
  road: 0.5,
};

const AMPHIBIOUS_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  water: 1.5,   // Can cross water
  woods: 2,
  road: 0.5,
};

const JUMP_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  woods: 1,
  water: 1,     // Can jump over
  mountain: 2,  // Can traverse mountains!
  road: 0.5,
};

const FUSION_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  woods: 0.5,   // Blazes through everything
  water: 0.5,
  mountain: 1,
  road: 0.5,
};

const TITAN_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  woods: 1,     // Crushes trees
  water: Infinity, // Too heavy
  mountain: 3,  // Can climb slowly
  road: 1,      // Too big for road bonus
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
  // Locked: requires advancedTreads tech
  hover: {
    id: 'hover',
    name: 'Hover',
    speed: 5,
    terrainCosts: HOVER_TERRAIN_COSTS,
    maxWeight: 6,
    baseCost: 2000,
  },
  // Locked: requires amphibiousHull tech
  amphibious: {
    id: 'amphibious',
    name: 'Amphibious',
    speed: 4,
    terrainCosts: AMPHIBIOUS_TERRAIN_COSTS,
    maxWeight: 8,
    baseCost: 2200,
  },
  // Locked: requires jumpJets tech
  jump: {
    id: 'jump',
    name: 'Jump Jets',
    speed: 5,
    terrainCosts: JUMP_TERRAIN_COSTS,
    maxWeight: 5,
    baseCost: 2800,
  },
  // Locked: requires fusionCore tech
  fusion: {
    id: 'fusion',
    name: 'Fusion',
    speed: 8,
    terrainCosts: FUSION_TERRAIN_COSTS,
    maxWeight: 8,
    baseCost: 5000,
  },
  // Locked: requires titanClass tech
  titan: {
    id: 'titan',
    name: 'Titan',
    speed: 2,
    terrainCosts: TITAN_TERRAIN_COSTS,
    maxWeight: 20,
    baseCost: 6000,
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
  // Locked: requires rocketLauncher tech
  rockets: {
    id: 'rockets',
    name: 'Rockets',
    attack: 6,
    armorPiercing: true,
    range: 2,
    weight: 3,
    cost: 1800,
  },
  // Locked: requires advancedRockets tech
  missiles: {
    id: 'missiles',
    name: 'Missiles',
    attack: 8,
    armorPiercing: true,
    range: 4,
    weight: 4,
    cost: 3000,
  },
  // Locked: requires laserTechnology tech
  laser: {
    id: 'laser',
    name: 'Laser',
    attack: 5,
    armorPiercing: false,
    range: 2,
    weight: 2,
    cost: 1200,
  },
  // Locked: requires plasmaCannon tech
  plasma: {
    id: 'plasma',
    name: 'Plasma Cannon',
    attack: 8,
    armorPiercing: true,
    range: 1,
    weight: 3,
    cost: 2000,
  },
  // Locked: requires ionCannon tech
  ion: {
    id: 'ion',
    name: 'Ion Cannon',
    attack: 6,
    armorPiercing: true,
    range: 2,
    weight: 4,
    cost: 2500,
  },
  // Locked: requires railgun tech
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    attack: 10,
    armorPiercing: true,
    range: 3,
    weight: 5,
    cost: 3500,
  },
  // Locked: requires siegeWeapons tech
  siege: {
    id: 'siege',
    name: 'Siege Cannon',
    attack: 12,
    armorPiercing: true,
    range: 4,
    weight: 8,
    cost: 4000,
  },
  // Locked: requires antimatterWeapons tech
  antimatter: {
    id: 'antimatter',
    name: 'Antimatter',
    attack: 15,
    armorPiercing: true,
    range: 2,
    weight: 6,
    cost: 6000,
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
  grantsStealth?: boolean;         // Unit has reduced visibility
  grantsSensors?: boolean;         // Enhanced detection range
  grantsECM?: boolean;             // Electronic countermeasures
  grantsTargeting?: boolean;       // Improved accuracy
  grantsShield?: boolean;          // Energy shield absorption
  grantsRepair?: boolean;          // Can repair other units
  grantsDrones?: boolean;          // Deploys combat drones
  grantsCloak?: boolean;           // Full invisibility
  grantsNanoRepair?: boolean;      // Self-healing
  grantsPsychic?: boolean;         // Mind control abilities
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
  // Locked: requires stealthPlating tech
  stealth: {
    id: 'stealth',
    name: 'Stealth Plating',
    weight: 1,
    cost: 1500,
    grantsStealth: true,
  },
  // Locked: requires advancedSensors tech
  sensors: {
    id: 'sensors',
    name: 'Advanced Sensors',
    weight: 1,
    cost: 800,
    grantsSensors: true,
  },
  // Locked: requires reactiveArmor tech
  reactive: {
    id: 'reactive',
    name: 'Reactive Armor',
    weight: 2,
    cost: 1200,
    grantsArmor: true,
  },
  // Locked: requires electronicWarfare tech
  ecm: {
    id: 'ecm',
    name: 'ECM Suite',
    weight: 1,
    cost: 1000,
    grantsECM: true,
  },
  // Locked: requires targetingComputer tech
  targeting: {
    id: 'targeting',
    name: 'Targeting Computer',
    weight: 1,
    cost: 900,
    grantsTargeting: true,
  },
  // Locked: requires shieldGenerator tech
  shield: {
    id: 'shield',
    name: 'Shield Generator',
    weight: 3,
    cost: 2000,
    grantsShield: true,
  },
  // Locked: requires fieldRepair tech
  repair: {
    id: 'repair',
    name: 'Repair System',
    weight: 2,
    cost: 1000,
    grantsRepair: true,
  },
  // Locked: requires droneSwarm tech
  drones: {
    id: 'drones',
    name: 'Drone Swarm',
    weight: 2,
    cost: 1800,
    grantsDrones: true,
  },
  // Locked: requires cloakingDevice tech
  cloak: {
    id: 'cloak',
    name: 'Cloaking Device',
    weight: 2,
    cost: 3000,
    grantsCloak: true,
  },
  // Locked: requires nanoRepair tech
  nanorepair: {
    id: 'nanorepair',
    name: 'Nano Repair',
    weight: 1,
    cost: 2500,
    grantsNanoRepair: true,
  },
  // Locked: requires psychicAmplifier tech
  psychic: {
    id: 'psychic',
    name: 'Psychic Amplifier',
    weight: 3,
    cost: 4000,
    grantsPsychic: true,
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
