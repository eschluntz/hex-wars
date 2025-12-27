// ============================================================================
// HEX DOMINION - Unit Module
// ============================================================================

import { MOVEMENT_COSTS, type AxialCoord, type TileType } from './core.js';
import { Pathfinder, type GameMap } from './pathfinder.js';

export class Unit {
  id: string;
  q: number;
  r: number;
  speed: number;
  goalQ: number | null = null;
  goalR: number | null = null;
  currentPath: AxialCoord[] | null = null;
  movementRemaining: number;

  constructor(id: string, q: number, r: number, speed: number = 4) {
    this.id = id;
    this.q = q;
    this.r = r;
    this.speed = speed;
    this.movementRemaining = speed;
  }

  setGoal(q: number, r: number, pathfinder: Pathfinder): boolean {
    this.goalQ = q;
    this.goalR = r;

    const result = pathfinder.findPath(this.q, this.r, q, r);
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

      const cost = MOVEMENT_COSTS[tile.type];
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
}
