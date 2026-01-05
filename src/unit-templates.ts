// ============================================================================
// HEX DOMINION - Unit Templates
// ============================================================================
// Static Advance Wars-style unit types. All unlocked units are available
// immediately at factories. No in-battle research - unlocks happen between
// battles (roguelike-style, future feature).

import { type TerrainCosts } from './core.js';

// ============================================================================
// UNIT TEMPLATE INTERFACE
// ============================================================================

export interface UnitTemplate {
  id: string;
  name: string;

  // Stats
  cost: number;
  speed: number;
  range: number;
  minRange: number;
  canMoveAndAttack: boolean;
  terrainCosts: TerrainCosts;
  flying: boolean;
  canCapture: boolean;
  canBuild: boolean;
  transportCapacity: number;
  transportFilter: string[];
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
    cost: 1000,
    speed: 3,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: FOOT_TERRAIN,
    flying: false,
    canCapture: true,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  mech: {
    id: 'mech',
    name: 'Mech',
    cost: 3000,
    speed: 2,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: MECH_TERRAIN,
    flying: false,
    canCapture: true,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },

  // ---- VEHICLES ----
  recon: {
    id: 'recon',
    name: 'Recon',
    cost: 4000,
    speed: 8,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: WHEELS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    cost: 7000,
    speed: 6,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  mediumTank: {
    id: 'mediumTank',
    name: 'Md Tank',
    cost: 16000,
    speed: 5,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  heavyTank: {
    id: 'heavyTank',
    name: 'Mega Tank',
    cost: 28000,
    speed: 4,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },

  // ---- INDIRECT FIRE ----
  artillery: {
    id: 'artillery',
    name: 'Artillery',
    cost: 6000,
    speed: 5,
    range: 3,
    minRange: 2,
    canMoveAndAttack: false,
    terrainCosts: TREADS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  rockets: {
    id: 'rockets',
    name: 'Rockets',
    cost: 15000,
    speed: 5,
    range: 5,
    minRange: 3,
    canMoveAndAttack: false,
    terrainCosts: WHEELS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },

  // ---- ANTI-AIR ----
  antiAir: {
    id: 'antiAir',
    name: 'Anti-Air',
    cost: 8000,
    speed: 6,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  missiles: {
    id: 'missiles',
    name: 'Missiles',
    cost: 12000,
    speed: 4,
    range: 5,
    minRange: 3,
    canMoveAndAttack: false,
    terrainCosts: WHEELS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },

  // ---- TRANSPORT ----
  apc: {
    id: 'apc',
    name: 'APC',
    cost: 5000,
    speed: 6,
    range: 0,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: TREADS_TERRAIN,
    flying: false,
    canCapture: false,
    canBuild: false,
    transportCapacity: 1,
    transportFilter: ['infantry', 'mech'],
  },

  // ---- AIR UNITS ----
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    cost: 20000,
    speed: 9,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    cost: 22000,
    speed: 7,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  copter: {
    id: 'copter',
    name: 'Copter',
    cost: 9000,
    speed: 6,
    range: 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 0,
    transportFilter: [],
  },
  transportCopter: {
    id: 'transportCopter',
    name: 'T-Copter',
    cost: 5000,
    speed: 6,
    range: 0,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: AIR_TERRAIN,
    flying: true,
    canCapture: false,
    canBuild: false,
    transportCapacity: 1,
    transportFilter: ['infantry', 'mech'],
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

