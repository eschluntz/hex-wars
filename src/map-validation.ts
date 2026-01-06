// ============================================================================
// HEX DOMINION - Map Validation
// ============================================================================

import { GameMap } from './game-map.js';
import { Pathfinder } from './pathfinder.js';
import { TILE_TYPES, type TerrainCosts, type TileType } from './core.js';

export interface ValidationResult {
  valid: boolean;
  critical: CriticalCheck[];
  warnings: string[];
}

export interface CriticalCheck {
  name: string;
  passed: boolean;
  detail: string;
}

// Terrain costs for path validation (allow all traversable terrain)
const PATH_TERRAIN_COSTS: TerrainCosts = {
  grass: 1,
  woods: 1,
  mountain: 999,  // Nearly impassable but not completely
  water: 999,
  road: 1,
  building: 1
};

function countByType(tiles: Array<{ type: TileType }>): Record<TileType, number> {
  const counts: Partial<Record<TileType, number>> = {};
  for (const tile of tiles) {
    counts[tile.type] = (counts[tile.type] ?? 0) + 1;
  }
  return counts as Record<TileType, number>;
}

function findCapitalPath(map: GameMap): { path: Array<{ q: number; r: number }>; length: number } | null {
  const playerCapital = map.getCapital('player');
  const enemyCapital = map.getCapital('enemy');

  if (!playerCapital || !enemyCapital) return null;

  const pathfinder = new Pathfinder(map);
  const pathResult = pathfinder.findPath(
    playerCapital.q, playerCapital.r,
    enemyCapital.q, enemyCapital.r,
    PATH_TERRAIN_COSTS
  );

  if (!pathResult || pathResult.path.length === 0) return null;

  return { path: pathResult.path, length: pathResult.path.length };
}

/**
 * Validate a generated map for playability
 */
export function validateMap(map: GameMap): ValidationResult {
  const critical: CriticalCheck[] = [];
  const warnings: string[] = [];

  const playerCapital = map.getCapital('player');
  const enemyCapital = map.getCapital('enemy');

  critical.push({
    name: 'Player has capital',
    passed: playerCapital !== undefined,
    detail: playerCapital ? `at (${playerCapital.q}, ${playerCapital.r})` : 'missing'
  });

  critical.push({
    name: 'Enemy has capital',
    passed: enemyCapital !== undefined,
    detail: enemyCapital ? `at (${enemyCapital.q}, ${enemyCapital.r})` : 'missing'
  });

  const playerFactories = map.getBuildingsByType('factory').filter(b => b.owner === 'player');
  critical.push({
    name: 'Player has factory',
    passed: playerFactories.length > 0,
    detail: playerFactories.length > 0 ? `${playerFactories.length} factory(ies)` : 'missing'
  });

  const enemyFactories = map.getBuildingsByType('factory').filter(b => b.owner === 'enemy');
  critical.push({
    name: 'Enemy has factory',
    passed: enemyFactories.length > 0,
    detail: enemyFactories.length > 0 ? `${enemyFactories.length} factory(ies)` : 'missing'
  });

  const capitalPath = findCapitalPath(map);
  critical.push({
    name: 'Path between capitals',
    passed: capitalPath !== null,
    detail: capitalPath ? `${capitalPath.length} tiles` : (playerCapital && enemyCapital ? 'no path found' : 'cannot check (missing capitals)')
  });

  // Warnings (non-critical issues)
  const totalBuildings = map.getAllBuildings().length;
  if (totalBuildings < 6) {
    warnings.push(`Low building count: ${totalBuildings} (expected at least 6)`);
  }

  const tiles = map.getAllTiles();
  const tileCounts = countByType(tiles);
  const tileCount = tiles.length;

  const waterPercent = (tileCounts.water ?? 0) / tileCount;
  const mountainPercent = (tileCounts.mountain ?? 0) / tileCount;

  if (waterPercent > 0.5) {
    warnings.push(`Very high water coverage: ${(waterPercent * 100).toFixed(1)}%`);
  }
  if (mountainPercent > 0.4) {
    warnings.push(`Very high mountain coverage: ${(mountainPercent * 100).toFixed(1)}%`);
  }

  return {
    valid: critical.every(c => c.passed),
    critical,
    warnings
  };
}

/**
 * Get map statistics for display
 */
export function getMapStats(map: GameMap): MapStats {
  const tiles = map.getAllTiles();
  const buildings = map.getAllBuildings();
  const tileCounts = countByType(tiles);

  const capitalPath = findCapitalPath(map);

  return {
    totalTiles: tiles.length,
    tileCounts,
    totalBuildings: buildings.length,
    playerBuildings: buildings.filter(b => b.owner === 'player').length,
    enemyBuildings: buildings.filter(b => b.owner === 'enemy').length,
    neutralBuildings: buildings.filter(b => b.owner === null).length,
    pathLength: capitalPath?.length ?? null
  };
}

export interface MapStats {
  totalTiles: number;
  tileCounts: Record<TileType, number>;
  totalBuildings: number;
  playerBuildings: number;
  enemyBuildings: number;
  neutralBuildings: number;
  pathLength: number | null;
}
