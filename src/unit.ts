// ============================================================================
// HEX DOMINION - Unit Module
// ============================================================================

import { DEFAULT_TERRAIN_COSTS, type AxialCoord, type TerrainCosts } from './core.js';
import { type GameMap } from './pathfinder.js';
import { getUnitType } from './unit-templates.js';

// Coordinate value for units inside a carrier (obviously invalid map position)
export const CARRIED_COORD = -9999;

/** Stats for creating units with custom properties (mainly for tests) */
export interface UnitStats {
  speed?: number;
  range?: number;
  minRange?: number;
  canMoveAndAttack?: boolean;
  terrainCosts?: TerrainCosts;
  canCapture?: boolean;
  canBuild?: boolean;
  flying?: boolean;
  transportCapacity?: number;
  transportFilter?: string[];
  templateId?: string;
}

export class Unit {
  id: string;
  team: string;
  q: number;
  r: number;
  speed: number;
  range: number;
  minRange: number;
  canMoveAndAttack: boolean;
  health: number;
  terrainCosts: TerrainCosts;
  canCapture: boolean;
  canBuild: boolean;
  flying: boolean;
  templateId: string;
  hasActed: boolean = false;
  // Transport properties
  cargo: Unit[] = [];
  transportCapacity: number = 0;
  transportFilter: string[] = [];
  carriedBy: Unit | null = null;

  /** Create a unit from a template ID (e.g., 'infantry', 'tank') */
  constructor(id: string, team: string, q: number, r: number, templateId: string) {
    const template = getUnitType(templateId);
    this.id = id;
    this.team = team;
    this.q = q;
    this.r = r;
    this.templateId = templateId;
    this.speed = template.speed;
    this.range = template.range;
    this.minRange = template.minRange;
    this.canMoveAndAttack = template.canMoveAndAttack;
    this.health = 10;
    this.terrainCosts = template.terrainCosts;
    this.canCapture = template.canCapture;
    this.canBuild = template.canBuild;
    this.flying = template.flying;
    this.transportCapacity = template.transportCapacity;
    this.transportFilter = template.transportFilter;
  }

  /** Create a unit with custom stats (for tests) */
  static withStats(id: string, team: string, q: number, r: number, stats: UnitStats): Unit {
    const unit = Object.create(Unit.prototype) as Unit;
    unit.id = id;
    unit.team = team;
    unit.q = q;
    unit.r = r;
    unit.templateId = stats.templateId ?? 'infantry';
    unit.speed = stats.speed ?? 4;
    unit.range = stats.range ?? 1;
    unit.minRange = stats.minRange ?? 0;
    unit.canMoveAndAttack = stats.canMoveAndAttack ?? true;
    unit.health = 10;
    unit.terrainCosts = stats.terrainCosts ?? DEFAULT_TERRAIN_COSTS;
    unit.canCapture = stats.canCapture ?? false;
    unit.canBuild = stats.canBuild ?? false;
    unit.flying = stats.flying ?? false;
    unit.transportCapacity = stats.transportCapacity ?? 0;
    unit.transportFilter = stats.transportFilter ?? [];
    unit.hasActed = false;
    unit.cargo = [];
    unit.carriedBy = null;
    return unit;
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
    // Check transport filter by templateId (empty filter = any allowed)
    if (this.transportFilter.length > 0 && unit.templateId) {
      if (!this.transportFilter.includes(unit.templateId)) return false;
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
