// ============================================================================
// HEX DOMINION - AI Game State View
// ============================================================================
// Read-only interface for AI to query game state without direct access to
// internal game objects.

import { type Tile, type TerrainCosts } from '../core.js';
import { type Building } from '../building.js';
import { type UnitTemplate } from '../unit-templates.js';

// Component info for AI design decisions
export interface ComponentInfo {
  id: string;
  name: string;
}

// Extended component info with constraints
export interface ChassisInfo extends ComponentInfo {
  maxWeight: number;
}

export interface WeaponInfo extends ComponentInfo {
  weight: number;
}

export interface SystemInfo extends ComponentInfo {
  weight: number;
  requiresChassis?: string[];  // Only these chassis can use this system
}

// Tech info for AI decision making
export interface TechInfo {
  id: string;
  name: string;
  cost: number;
  state: 'unlocked' | 'available' | 'locked';
}

// Read-only unit representation for AI
export interface UnitView {
  id: string;
  team: string;
  q: number;
  r: number;
  speed: number;
  attack: number;
  range: number;
  health: number;
  terrainCosts: TerrainCosts;
  canCapture: boolean;
  canBuild: boolean;
  armored: boolean;
  armorPiercing: boolean;
  hasActed: boolean;
}

// Read-only game state for AI decision making
export interface GameStateView {
  // Current team/turn info
  readonly currentTeam: string;
  readonly turnNumber: number;

  // Map queries
  getTile(q: number, r: number): Tile | undefined;
  getAllTiles(): Tile[];

  // Building queries
  getBuilding(q: number, r: number): Building | undefined;
  getAllBuildings(): Building[];
  getBuildingsByOwner(owner: string): Building[];
  getBuildingsByType(type: string): Building[];

  // Unit queries
  getUnit(id: string): UnitView | undefined;
  getUnitAt(q: number, r: number): UnitView | undefined;
  getAllUnits(): UnitView[];
  getTeamUnits(team: string): UnitView[];
  getActiveUnits(team: string): UnitView[]; // Units that haven't acted yet

  // Resource queries
  getResources(team: string): { funds: number; science: number };

  // Template queries
  getTeamTemplates(team: string): UnitTemplate[];

  // Research queries
  getUnlockedTechs(team: string): Set<string>;
  getAvailableTechs(team: string): TechInfo[];

  // Component queries (for unit design)
  getUnlockedChassis(team: string): ChassisInfo[];
  getUnlockedWeapons(team: string): WeaponInfo[];
  getUnlockedSystems(team: string): SystemInfo[];

  // Pathfinding queries
  getReachablePositions(
    startQ: number,
    startR: number,
    speed: number,
    terrainCosts: TerrainCosts,
    blocked?: Set<string>,
    occupied?: Set<string>
  ): Map<string, { q: number; r: number; cost: number }>;

  findPath(
    startQ: number,
    startR: number,
    goalQ: number,
    goalR: number,
    terrainCosts: TerrainCosts,
    blocked?: Set<string>
  ): { path: Array<{ q: number; r: number }>; totalCost: number } | null;

  // Combat queries
  calculateExpectedDamage(attacker: UnitView, defender: UnitView): number;
  isInRange(attacker: UnitView, target: UnitView): boolean;
  getTargetsInRange(attacker: UnitView): UnitView[];
}
