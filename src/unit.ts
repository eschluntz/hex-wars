// ============================================================================
// HEX DOMINION - Unit Module
// ============================================================================

import { DEFAULT_TERRAIN_COSTS, type AxialCoord, type TerrainCosts } from './core.js';
import { Pathfinder, type GameMap } from './pathfinder.js';

export class Unit {
  id: string;
  team: string;
  q: number;
  r: number;
  speed: number;
  terrainCosts: TerrainCosts;
  goalQ: number | null = null;
  goalR: number | null = null;
  currentPath: AxialCoord[] | null = null;
  movementRemaining: number;

  constructor(id: string, team: string, q: number, r: number, speed: number = 4, terrainCosts: TerrainCosts = DEFAULT_TERRAIN_COSTS) {
    this.id = id;
    this.team = team;
    this.q = q;
    this.r = r;
    this.speed = speed;
    this.terrainCosts = terrainCosts;
    this.movementRemaining = speed;
  }

  setGoal(q: number, r: number, pathfinder: Pathfinder): boolean {
    this.goalQ = q;
    this.goalR = r;

    const result = pathfinder.findPath(this.q, this.r, q, r, this.terrainCosts);
    if (result) {
      this.currentPath = result.path;
      // Remove the starting position from path
      if (this.currentPath.length > 0 &&
          this.currentPath[0]!.q === this.q &&
          this.currentPath[0]!.r === this.r) {
        this.currentPath.shift();
      }
      return true;
    } else {
      this.currentPath = null;
      return false;
    }
  }

  clearGoal(): void {
    this.goalQ = null;
    this.goalR = null;
    this.currentPath = null;
  }

  move(map: GameMap): AxialCoord[] {
    if (!this.currentPath || this.currentPath.length === 0) {
      return [];
    }

    const moved: AxialCoord[] = [];
    let movementLeft = this.movementRemaining;

    while (this.currentPath.length > 0 && movementLeft > 0) {
      const next = this.currentPath[0]!;
      const tile = map.getTile(next.q, next.r);

      if (!tile) break;

      const cost = this.terrainCosts[tile.type];
      if (cost > movementLeft) break;

      movementLeft -= cost;
      this.q = next.q;
      this.r = next.r;
      moved.push({ q: next.q, r: next.r });
      this.currentPath.shift();
    }

    this.movementRemaining = movementLeft;

    if (this.currentPath.length === 0) {
      this.goalQ = null;
      this.goalR = null;
    }

    return moved;
  }

  resetMovement(): void {
    this.movementRemaining = this.speed;
  }

  hasReachedGoal(): boolean {
    return this.goalQ === null && this.goalR === null;
  }

  getRemainingPathLength(): number {
    return this.currentPath ? this.currentPath.length : 0;
  }

  getReachableIndex(path: AxialCoord[], map: GameMap, occupied?: Set<string>): number {
    let movementLeft = this.movementRemaining;
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
