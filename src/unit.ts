// ============================================================================
// HEX DOMINION - Unit Module
// ============================================================================

import { DEFAULT_TERRAIN_COSTS, type AxialCoord, type TerrainCosts } from './core.js';
import { type GameMap } from './pathfinder.js';

// Coordinate value for units inside a carrier (obviously invalid map position)
export const CARRIED_COORD = -9999;

export interface UnitStats {
  speed: number;
  attack: number;
  range: number;
  minRange: number;
  canMoveAndAttack: boolean;
  terrainCosts: TerrainCosts;
  color: string;
  canCapture: boolean;
  canBuild: boolean;
  armored: boolean;
  armorPiercing: boolean;
  chassisId?: string;
  weaponId?: string;
  systemIds?: string[];
  transportCapacity?: number;
  transportFilter?: string[];
}

const DEFAULT_STATS: UnitStats = {
  speed: 4,
  attack: 5,
  range: 1,
  minRange: 0,
  canMoveAndAttack: true,
  terrainCosts: DEFAULT_TERRAIN_COSTS,
  color: '#ffffff',
  canCapture: false,
  canBuild: false,
  armored: false,
  armorPiercing: false,
  chassisId: undefined,
  weaponId: undefined,
  systemIds: [],
  transportCapacity: 0,
  transportFilter: [],
};

export class Unit {
  id: string;
  team: string;
  q: number;
  r: number;
  speed: number;
  attack: number;
  range: number;
  minRange: number;
  canMoveAndAttack: boolean;
  health: number;
  terrainCosts: TerrainCosts;
  color: string;
  canCapture: boolean;
  canBuild: boolean;
  armored: boolean;
  armorPiercing: boolean;
  chassisId: string | undefined;
  weaponId: string | undefined;
  systemIds: string[];
  hasActed: boolean = false;
  // Transport properties
  cargo: Unit[] = [];
  transportCapacity: number = 0;
  transportFilter: string[] = [];
  carriedBy: Unit | null = null;

  constructor(id: string, team: string, q: number, r: number, stats: Partial<UnitStats> = {}) {
    this.id = id;
    this.team = team;
    this.q = q;
    this.r = r;
    this.speed = stats.speed ?? DEFAULT_STATS.speed;
    this.attack = stats.attack ?? DEFAULT_STATS.attack;
    this.range = stats.range ?? DEFAULT_STATS.range;
    this.minRange = stats.minRange ?? DEFAULT_STATS.minRange;
    this.canMoveAndAttack = stats.canMoveAndAttack ?? DEFAULT_STATS.canMoveAndAttack;
    this.health = 10;
    this.terrainCosts = stats.terrainCosts ?? DEFAULT_STATS.terrainCosts;
    this.color = stats.color ?? DEFAULT_STATS.color;
    this.canCapture = stats.canCapture ?? DEFAULT_STATS.canCapture;
    this.canBuild = stats.canBuild ?? DEFAULT_STATS.canBuild;
    this.armored = stats.armored ?? DEFAULT_STATS.armored;
    this.armorPiercing = stats.armorPiercing ?? DEFAULT_STATS.armorPiercing;
    this.chassisId = stats.chassisId ?? DEFAULT_STATS.chassisId;
    this.weaponId = stats.weaponId ?? DEFAULT_STATS.weaponId;
    this.systemIds = stats.systemIds ?? DEFAULT_STATS.systemIds ?? [];
    this.transportCapacity = stats.transportCapacity ?? DEFAULT_STATS.transportCapacity ?? 0;
    this.transportFilter = stats.transportFilter ?? DEFAULT_STATS.transportFilter ?? [];
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  getReachableIndex(path: AxialCoord[], map: GameMap, occupied?: Set<string>): number {
    let movementLeft = this.speed;
    let reachable = 0;
    for (let i = 1; i < path.length; i++) {
      const pos = path[i]!;
      const tile = map.getTile(pos.q, pos.r)!;
      const cost = this.terrainCosts[tile.type];
      if (cost > movementLeft) break;
      movementLeft -= cost;
      // Can only stop on unoccupied tiles
      if (!occupied?.has(`${pos.q},${pos.r}`)) {
        reachable = i;
      }
    }
    return reachable;
  }

  // Transport methods
  canTransport(): boolean {
    return this.transportCapacity > 0;
  }

  hasCargoSpace(): boolean {
    return this.cargo.length < this.transportCapacity;
  }

  canLoadUnit(unit: Unit): boolean {
    // Must be same team
    if (unit.team !== this.team) return false;
    // Must have space
    if (!this.hasCargoSpace()) return false;
    // Cannot load transports (no nested transports)
    if (unit.canTransport()) return false;
    // Cannot load if already being carried
    if (unit.carriedBy !== null) return false;
    // Check chassis filter (empty filter = any allowed)
    if (this.transportFilter.length > 0 && unit.chassisId) {
      if (!this.transportFilter.includes(unit.chassisId)) return false;
    }
    return true;
  }

  loadUnit(unit: Unit): void {
    this.cargo.push(unit);
    unit.carriedBy = this;
    unit.q = CARRIED_COORD;
    unit.r = CARRIED_COORD;
  }

  unloadUnit(unit: Unit, q: number, r: number): void {
    const idx = this.cargo.indexOf(unit);
    this.cargo.splice(idx, 1);
    unit.carriedBy = null;
    unit.q = q;
    unit.r = r;
    unit.hasActed = true;
  }
}
