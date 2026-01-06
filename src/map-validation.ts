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

/**
 * Validate a generated map for playability
 */
export function validateMap(map: GameMap): ValidationResult {
  const critical: CriticalCheck[] = [];
  const warnings: string[] = [];

  // Critical check 1: Player has at least 1 capital
  const playerCapital = map.getCapital('player');
  critical.push({
    name: 'Player has capital',
    passed: playerCapital !== undefined,
    detail: playerCapital ? `at (${playerCapital.q}, ${playerCapital.r})` : 'missing'
  });

  // Critical check 2: Enemy has at least 1 capital
  const enemyCapital = map.getCapital('enemy');
  critical.push({
    name: 'Enemy has capital',
    passed: enemyCapital !== undefined,
    detail: enemyCapital ? `at (${enemyCapital.q}, ${enemyCapital.r})` : 'missing'
  });

  // Critical check 3: Player has at least 1 factory
  const playerFactories = map.getBuildingsByType('factory').filter(b => b.owner === 'player');
  critical.push({
    name: 'Player has factory',
    passed: playerFactories.length > 0,
    detail: playerFactories.length > 0 ? `${playerFactories.length} factory(ies)` : 'missing'
  });

  // Critical check 4: Enemy has at least 1 factory
  const enemyFactories = map.getBuildingsByType('factory').filter(b => b.owner === 'enemy');
  critical.push({
    name: 'Enemy has factory',
    passed: enemyFactories.length > 0,
    detail: enemyFactories.length > 0 ? `${enemyFactories.length} factory(ies)` : 'missing'
  });

  // Critical check 5: Path exists between capitals (if both exist)
  if (playerCapital && enemyCapital) {
    const pathfinder = new Pathfinder(map);
    const pathResult = pathfinder.findPath(
      playerCapital.q, playerCapital.r,
      enemyCapital.q, enemyCapital.r,
      PATH_TERRAIN_COSTS
    );

    const pathExists = pathResult !== null && pathResult.path.length > 0;
    critical.push({
      name: 'Path between capitals',
      passed: pathExists,
      detail: pathExists ? `${pathResult!.path.length} tiles` : 'no path found'
    });
  } else {
    critical.push({
      name: 'Path between capitals',
      passed: false,
      detail: 'cannot check (missing capitals)'
    });
  }

  // Warnings (non-critical issues)
  const allBuildings = map.getAllBuildings();
  const totalBuildings = allBuildings.length;

  if (totalBuildings < 6) {
    warnings.push(`Low building count: ${totalBuildings} (expected at least 6)`);
  }

  // Check terrain distribution
  const tiles = map.getAllTiles();
  const tileCount = tiles.length;
  const tileCounts = countByType(tiles);

  const waterPercent = (tileCounts.water ?? 0) / tileCount;
  const mountainPercent = (tileCounts.mountain ?? 0) / tileCount;

  if (waterPercent > 0.5) {
    warnings.push(`Very high water coverage: ${(waterPercent * 100).toFixed(1)}%`);
  }
  if (mountainPercent > 0.4) {
    warnings.push(`Very high mountain coverage: ${(mountainPercent * 100).toFixed(1)}%`);
  }

  const allCriticalPassed = critical.every(c => c.passed);

  return {
    valid: allCriticalPassed,
    critical,
    warnings
  };
}

function countByType(tiles: Array<{ type: TileType }>): Record<TileType, number> {
  const counts: Partial<Record<TileType, number>> = {};
  for (const tile of tiles) {
    counts[tile.type] = (counts[tile.type] ?? 0) + 1;
  }
  return counts as Record<TileType, number>;
}

/**
 * Get map statistics for display
 */
export function getMapStats(map: GameMap): MapStats {
  const tiles = map.getAllTiles();
  const buildings = map.getAllBuildings();

  const tileCounts = countByType(tiles);

  const playerBuildings = buildings.filter(b => b.owner === 'player');
  const enemyBuildings = buildings.filter(b => b.owner === 'enemy');
  const neutralBuildings = buildings.filter(b => b.owner === null);

  const playerCapital = map.getCapital('player');
  const enemyCapital = map.getCapital('enemy');

  let pathLength: number | null = null;
  if (playerCapital && enemyCapital) {
    const pathfinder = new Pathfinder(map);
    const pathResult = pathfinder.findPath(
      playerCapital.q, playerCapital.r,
      enemyCapital.q, enemyCapital.r,
      PATH_TERRAIN_COSTS
    );
    if (pathResult) {
      pathLength = pathResult.path.length;
    }
  }

  return {
    totalTiles: tiles.length,
    tileCounts,
    totalBuildings: buildings.length,
    playerBuildings: playerBuildings.length,
    enemyBuildings: enemyBuildings.length,
    neutralBuildings: neutralBuildings.length,
    pathLength
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
