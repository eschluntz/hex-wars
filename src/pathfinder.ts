// ============================================================================
// HEX DOMINION - Pathfinder Module (A* Algorithm)
// ============================================================================

import { HexUtil, DEFAULT_TERRAIN_COSTS, type AxialCoord, type Tile, type TileType, type TerrainCosts } from './core.js';

export interface GameMap {
  getTile(q: number, r: number): Tile | undefined;
}

export interface PathResult {
  path: AxialCoord[];
  totalCost: number;
}

export class Pathfinder {
  private map: GameMap;

  constructor(map: GameMap) {
    this.map = map;
  }

  getMovementCost(tileType: TileType, terrainCosts: TerrainCosts = DEFAULT_TERRAIN_COSTS): number {
    return terrainCosts[tileType];
  }

  isPassable(q: number, r: number, terrainCosts: TerrainCosts = DEFAULT_TERRAIN_COSTS, blocked?: Set<string>): boolean {
    if (blocked?.has(`${q},${r}`)) return false;
    const tile = this.map.getTile(q, r);
    if (!tile) return false;
    return this.getMovementCost(tile.type, terrainCosts) < Infinity;
  }

  heuristic(q1: number, r1: number, q2: number, r2: number): number {
    return HexUtil.distance(q1, r1, q2, r2);
  }

  findPath(startQ: number, startR: number, goalQ: number, goalR: number, terrainCosts: TerrainCosts = DEFAULT_TERRAIN_COSTS, blocked?: Set<string>): PathResult | null {
    if (!this.isPassable(startQ, startR, terrainCosts, blocked) || !this.isPassable(goalQ, goalR, terrainCosts, blocked)) {
      return null;
    }

    const openSet: Array<{ q: number; r: number; f: number }> = [];
    const closedSet = new Set<string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const cameFrom = new Map<string, AxialCoord>();

    const startKey = `${startQ},${startR}`;

    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(startQ, startR, goalQ, goalR));
    openSet.push({ q: startQ, r: startR, f: fScore.get(startKey)! });

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentKey = `${current.q},${current.r}`;

      if (current.q === goalQ && current.r === goalR) {
        return this.reconstructPath(cameFrom, current, gScore.get(currentKey)!);
      }

      closedSet.add(currentKey);

      for (const neighbor of HexUtil.getNeighbors(current.q, current.r)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;

        if (closedSet.has(neighborKey)) continue;
        if (!this.isPassable(neighbor.q, neighbor.r, terrainCosts, blocked)) continue;

        const tile = this.map.getTile(neighbor.q, neighbor.r)!;
        const moveCost = this.getMovementCost(tile.type, terrainCosts);
        const tentativeG = gScore.get(currentKey)! + moveCost;

        const existingG = gScore.get(neighborKey);
        if (existingG === undefined || tentativeG < existingG) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + this.heuristic(neighbor.q, neighbor.r, goalQ, goalR);
          fScore.set(neighborKey, f);

          if (!openSet.some(n => n.q === neighbor.q && n.r === neighbor.r)) {
            openSet.push({ q: neighbor.q, r: neighbor.r, f });
          }
        }
      }
    }

    return null;
  }

  private reconstructPath(cameFrom: Map<string, AxialCoord>, current: AxialCoord, totalCost: number): PathResult {
    const path: AxialCoord[] = [{ q: current.q, r: current.r }];
    let key = `${current.q},${current.r}`;

    while (cameFrom.has(key)) {
      const prev = cameFrom.get(key)!;
      path.unshift({ q: prev.q, r: prev.r });
      key = `${prev.q},${prev.r}`;
    }

    return { path, totalCost };
  }

  /**
   * Get all positions reachable from start within movement budget.
   * Uses Dijkstra's algorithm limited by speed.
   * @param startQ Starting q coordinate
   * @param startR Starting r coordinate
   * @param speed Maximum movement points
   * @param terrainCosts Cost to enter each terrain type
   * @param blocked Positions that cannot be entered (e.g., enemy units)
   * @param occupied Positions that can be passed through but not stopped on (e.g., friendly units)
   * @returns Map from "q,r" to position info with cost
   */
  getReachablePositions(
    startQ: number,
    startR: number,
    speed: number,
    terrainCosts: TerrainCosts,
    blocked?: Set<string>,
    occupied?: Set<string>
  ): Map<string, { q: number; r: number; cost: number }> {
    const reachable = new Map<string, { q: number; r: number; cost: number }>();
    const visited = new Set<string>();
    const queue: Array<{ q: number; r: number; cost: number }> = [];

    const startKey = `${startQ},${startR}`;
    queue.push({ q: startQ, r: startR, cost: 0 });
    reachable.set(startKey, { q: startQ, r: startR, cost: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const currentKey = `${current.q},${current.r}`;

      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      for (const neighbor of HexUtil.getNeighbors(current.q, current.r)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;

        if (visited.has(neighborKey)) continue;
        if (blocked?.has(neighborKey)) continue;

        const tile = this.map.getTile(neighbor.q, neighbor.r);
        if (!tile) continue;

        const moveCost = this.getMovementCost(tile.type, terrainCosts);
        if (moveCost >= Infinity) continue;

        const totalCost = current.cost + moveCost;
        if (totalCost > speed) continue;

        const existing = reachable.get(neighborKey);
        if (!existing || totalCost < existing.cost) {
          reachable.set(neighborKey, { q: neighbor.q, r: neighbor.r, cost: totalCost });
          queue.push({ q: neighbor.q, r: neighbor.r, cost: totalCost });
        }
      }
    }

    // Remove occupied positions (can pass through but not stop on)
    if (occupied) {
      for (const key of occupied) {
        if (key !== startKey) {
          reachable.delete(key);
        }
      }
    }

    return reachable;
  }
}
