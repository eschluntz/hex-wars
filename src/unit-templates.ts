// ============================================================================
// HEX DOMINION - Unit Templates
// ============================================================================
// Static Advance Wars-style unit types. All unlocked units are available
// immediately at factories. No in-battle research - unlocks happen between
// battles (roguelike-style, future feature).

import { type TerrainCosts, DEFAULT_TERRAIN_COSTS } from './core.js';

// ============================================================================
// UNIT TEMPLATE INTERFACE
// ============================================================================

export interface UnitTemplate {
  id: string;
  name: string;
  // Component references (for sprite lookup)
  chassisId: string;
  weaponId: string | null;
  systemIds: string[];

  // Stats
  cost: number;
  speed: number;
  attack: number;
  range: number;
  minRange: number;
  canMoveAndAttack: boolean;
  terrainCosts: TerrainCosts;
  armored: boolean;
  armorPiercing: boolean;
  flying: boolean;
  canCapture: boolean;
  canBuild: boolean;
  transportCapacity: number;
  transportFilter: string[];
  cannotTarget: string[];
}

// ============================================================================
// TERRAIN COSTS BY MOVEMENT TYPE (matches Advance Wars)
// ============================================================================

// Infantry: can climb mountains (cost 2)
const FOOT_TERRAIN: TerrainCosts = {
  grass: 1,
  woods: 1,
  mountain: 2,
  road: 1,
  building: 1,
  water: Infinity,
};

// Mech: mountain specialists (cost 1)
const MECH_TERRAIN: TerrainCosts = {
  grass: 1,
  woods: 1,
  mountain: 1,
  road: 1,
  building: 1,
  water: Infinity,
};

// Tires: fast on roads, slow on rough terrain
const WHEELS_TERRAIN: TerrainCosts = {
  grass: 2,
  woods: 3,
  mountain: Infinity,
  road: 1,
  building: 1,
  water: Infinity,
};

// Treads: balanced, can't climb mountains
const TREADS_TERRAIN: TerrainCosts = {
  grass: 1,
  woods: 2,
  mountain: Infinity,
  road: 1,
  building: 1,
  water: Infinity,
};

// Air: uniform cost everywhere
const AIR_TERRAIN: TerrainCosts = {
  grass: 1,
  water: 1,
  woods: 1,
  mountain: 1,
  road: 1,
  building: 1,
};

// ============================================================================
// STATIC UNIT ROSTER (Advance Wars inspired)
// ============================================================================

export const UNIT_TYPES: Record<string, UnitTemplate> = {
  // ---- INFANTRY ----
  infantry: {
    id: 'infantry',
    name: 'Infantry',
    chassisId: 'foot',
    weaponId: 'machineGun',
    systemIds: ['capture'],
    cost: 1000,
    speed: 3,
    attack: 4,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: FOOT_TERRAIN,
    armored: false,
    armorPiercing: false,
    flying: false,
    canCapture: true,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },
  mech: {
    id: 'mech',
    name: 'Mech',
    chassisId: 'foot',
    weaponId: 'rockets',
    systemIds: ['capture'],
    cost: 3000,
    speed: 2,
    attack: 6,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: MECH_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: false,
    canCapture: true,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: [],
  },

  // ---- VEHICLES ----
  recon: {
    id: 'recon',
    name: 'Recon',
    chassisId: 'wheels',
    weaponId: 'machineGun',
    systemIds: [],
    cost: 4000,
    speed: 8,
    attack: 4,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: WHEELS_TERRAIN,
    armored: false,
    armorPiercing: false,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    chassisId: 'treads',
    weaponId: 'cannon',
    systemIds: ['armor'],
    cost: 7000,
    speed: 6,
    attack: 7,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    armored: true,
    armorPiercing: true,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },
  mediumTank: {
    id: 'mediumTank',
    name: 'Md Tank',
    chassisId: 'treads',
    weaponId: 'cannon',
    systemIds: ['armor'],
    cost: 16000,
    speed: 5,
    attack: 8,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    armored: true,
    armorPiercing: true,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },
  heavyTank: {
    id: 'heavyTank',
    name: 'Mega Tank',
    chassisId: 'treads',
    weaponId: 'cannon',
    systemIds: ['armor'],
    cost: 28000,
    speed: 4,
    attack: 10,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    armored: true,
    armorPiercing: true,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },

  // ---- INDIRECT FIRE ----
  artillery: {
    id: 'artillery',
    name: 'Artillery',
    chassisId: 'treads',
    weaponId: 'artillery',
    systemIds: [],
    cost: 6000,
    speed: 5,
    attack: 5,
    range: 3,
    minRange: 2,
    canMoveAndAttack: false,
    terrainCosts: TREADS_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },
  rockets: {
    id: 'rockets',
    name: 'Rockets',
    chassisId: 'wheels',
    weaponId: 'rockets',
    systemIds: [],
    cost: 15000,
    speed: 5,
    attack: 8,
    range: 5,
    minRange: 3,
    canMoveAndAttack: false,
    terrainCosts: WHEELS_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane'],
  },

  // ---- ANTI-AIR ----
  antiAir: {
    id: 'antiAir',
    name: 'Anti-Air',
    chassisId: 'treads',
    weaponId: 'heavyMG',
    systemIds: [],
    cost: 8000,
    speed: 6,
    attack: 6,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    armored: false,
    armorPiercing: false,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: [],  // Can target everything including air
  },
  missiles: {
    id: 'missiles',
    name: 'Missiles',
    chassisId: 'wheels',
    weaponId: 'missiles',
    systemIds: [],
    cost: 12000,
    speed: 4,
    attack: 9,
    range: 5,
    minRange: 3,
    canMoveAndAttack: false,
    terrainCosts: WHEELS_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['foot', 'wheels', 'treads'],  // Anti-air only
  },

  // ---- TRANSPORT ----
  apc: {
    id: 'apc',
    name: 'APC',
    chassisId: 'treads',
    weaponId: null,
    systemIds: ['troopBay'],
    cost: 5000,
    speed: 6,
    attack: 0,
    range: 0,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    armored: false,
    armorPiercing: false,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 1,
    transportFilter: ['foot'],
    cannotTarget: [],
  },

  // ---- AIR UNITS ----
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    chassisId: 'airplane',
    weaponId: 'missiles',
    systemIds: [],
    cost: 20000,
    speed: 9,
    attack: 8,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['foot', 'wheels', 'treads'],  // Air-to-air only
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    chassisId: 'airplane',
    weaponId: 'cannon',
    systemIds: [],
    cost: 22000,
    speed: 7,
    attack: 10,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: ['airplane', 'helicopter'],  // Ground only
  },
  copter: {
    id: 'copter',
    name: 'Copter',
    chassisId: 'helicopter',
    weaponId: 'rockets',
    systemIds: [],
    cost: 9000,
    speed: 6,
    attack: 6,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    armored: false,
    armorPiercing: true,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
    cannotTarget: [],  // Can target everything
  },
  transportCopter: {
    id: 'transportCopter',
    name: 'T-Copter',
    chassisId: 'helicopter',
    weaponId: null,
    systemIds: ['troopBay'],
    cost: 5000,
    speed: 6,
    attack: 0,
    range: 0,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    armored: false,
    armorPiercing: false,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 1,
    transportFilter: ['foot'],
    cannotTarget: [],
  },
};

// ============================================================================
// DEFAULT UNLOCKED UNITS (for game start)
// ============================================================================

export const DEFAULT_UNLOCKED_UNITS: string[] = [
  'infantry', 'mech', 'recon', 'tank', 'mediumTank', 'heavyTank',
  'artillery', 'rockets', 'antiAir', 'missiles', 'apc',
  'fighter', 'bomber', 'copter', 'transportCopter'
];

// ============================================================================
// TEMPLATE ACCESSORS
// ============================================================================

/** Get all unit types in the game */
export function getAllUnitTypes(): UnitTemplate[] {
  return Object.values(UNIT_TYPES);
}

/** Get a specific unit type by ID */
export function getUnitType(id: string): UnitTemplate {
  return UNIT_TYPES[id]!;
}

/** Get unit types that are unlocked based on a set of unit IDs */
export function getUnlockedUnitTypes(unlockedSet: Set<string>): UnitTemplate[] {
  return getAllUnitTypes().filter(t => unlockedSet.has(t.id));
}

// ============================================================================
// TEMPLATE UTILITIES
// ============================================================================

/** Extract stats from a template for creating a Unit (add color separately) */
export function getTemplateStats(template: UnitTemplate): {
  speed: number;
  attack: number;
  range: number;
  minRange: number;
  canMoveAndAttack: boolean;
  terrainCosts: TerrainCosts;
  canCapture: boolean;
  canBuild: boolean;
  armored: boolean;
  armorPiercing: boolean;
  flying: boolean;
  chassisId: string;
  weaponId: string | undefined;
  systemIds: string[];
  transportCapacity: number;
  transportFilter: string[];
  cannotTarget: string[];
  templateId: string;
} {
  return {
    speed: template.speed,
    attack: template.attack,
    range: template.range,
    minRange: template.minRange,
    canMoveAndAttack: template.canMoveAndAttack,
    terrainCosts: template.terrainCosts,
    canCapture: template.canCapture,
    canBuild: template.canBuild,
    armored: template.armored,
    armorPiercing: template.armorPiercing,
    flying: template.flying,
    chassisId: template.chassisId,
    weaponId: template.weaponId ?? undefined,
    systemIds: template.systemIds,
    transportCapacity: template.transportCapacity,
    transportFilter: template.transportFilter,
    cannotTarget: template.cannotTarget,
    templateId: template.id,
  };
}

// ============================================================================
// PER-TEAM AVAILABLE UNITS
// ============================================================================
// Each team has their own set of unlocked units. In the future, this will
// be configured between battles (roguelike unlocks). For now, all teams
// get the default unlocked units.

const teamUnlockedUnits: Record<string, Set<string>> = {};

export function initTeamUnits(team: string, unlockedUnits: string[] = DEFAULT_UNLOCKED_UNITS): void {
  teamUnlockedUnits[team] = new Set(unlockedUnits);
}

export function getTeamTemplates(team: string): UnitTemplate[] {
  const unlocked = teamUnlockedUnits[team] ?? new Set(DEFAULT_UNLOCKED_UNITS);
  return getUnlockedUnitTypes(unlocked);
}

export function getTeamTemplate(team: string, id: string): UnitTemplate | undefined {
  const unlocked = teamUnlockedUnits[team] ?? new Set(DEFAULT_UNLOCKED_UNITS);
  if (!unlocked.has(id)) return undefined;
  return UNIT_TYPES[id];
}

// ============================================================================
// LEGACY EXPORTS (for backwards compatibility during transition)
// ============================================================================

/** @deprecated Use getTeamTemplates or getUnlockedUnitTypes instead */
export function getAvailableTemplates(): UnitTemplate[] {
  return getUnlockedUnitTypes(new Set(DEFAULT_UNLOCKED_UNITS));
}

/** @deprecated Use getUnitType instead */
export function getTemplate(id: string): UnitTemplate {
  return getUnitType(id);
}

/** @deprecated Use initTeamUnits instead */
export function initTeamTemplates(team: string): void {
  initTeamUnits(team);
}
