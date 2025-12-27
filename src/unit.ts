// ============================================================================
// HEX DOMINION - Unit Module
// ============================================================================

import { DEFAULT_TERRAIN_COSTS, type AxialCoord, type TerrainCosts } from './core.js';
import { type GameMap } from './pathfinder.js';

export interface UnitStats {
  speed: number;
  attack: number;
  range: number;
  terrainCosts: TerrainCosts;
  color: string;
  canCapture: boolean;
}

const DEFAULT_STATS: UnitStats = {
  speed: 4,
  attack: 5,
  range: 1,
  terrainCosts: DEFAULT_TERRAIN_COSTS,
  color: '#ffffff',
  canCapture: false
};

export class Unit {
  id: string;
  team: string;
  q: number;
  r: number;
  speed: number;
  attack: number;
  range: number;
  health: number;
  terrainCosts: TerrainCosts;
  color: string;
  canCapture: boolean;
  hasActed: boolean = false;

  constructor(id: string, team: string, q: number, r: number, stats: Partial<UnitStats> = {}) {
    this.id = id;
    this.team = team;
    this.q = q;
    this.r = r;
    this.speed = stats.speed ?? DEFAULT_STATS.speed;
    this.attack = stats.attack ?? DEFAULT_STATS.attack;
    this.range = stats.range ?? DEFAULT_STATS.range;
    this.health = 10;
    this.terrainCosts = stats.terrainCosts ?? DEFAULT_STATS.terrainCosts;
    this.color = stats.color ?? DEFAULT_STATS.color;
    this.canCapture = stats.canCapture ?? DEFAULT_STATS.canCapture;
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
}
