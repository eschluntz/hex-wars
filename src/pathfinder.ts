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
}
