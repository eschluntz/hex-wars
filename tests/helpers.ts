// ============================================================================
// HEX DOMINION - Test Helpers
// ============================================================================

import type { Tile, TileType } from '../src/core.js';
import type { GameMap } from '../src/pathfinder.js';

/**
 * Create a test map from a simple ASCII grid
 * Legend: G=grass, W=water, M=mountain, R=road, F=forest/woods, B=building
 *
 * Example:
 *   createTestMap([
 *     'GGGGG',
 *     'GWWWG',
 *     'GGGGG'
 *   ])
 */
export function createTestMap(grid: string[]): GameMap {
  const tiles = new Map<string, Tile>();

  const typeMap: Record<string, TileType> = {
    'G': 'grass',
    'W': 'water',
    'M': 'mountain',
    'R': 'road',
    'F': 'woods',
    'B': 'building'
  };

  for (let r = 0; r < grid.length; r++) {
    for (let q = 0; q < grid[r]!.length; q++) {
      const char = grid[r]![q]!;
      const type = typeMap[char];
      if (type) {
        tiles.set(`${q},${r}`, { q, r, type });
      }
    }
  }

  return {
    getTile(q: number, r: number): Tile | undefined {
      return tiles.get(`${q},${r}`);
    }
  };
}

/**
 * Visualize a path on a map for debugging
 */
export function visualizePath(grid: string[], path: Array<{ q: number; r: number }>): string {
  const result = grid.map(row => row.split(''));

  for (let i = 0; i < path.length; i++) {
    const { q, r } = path[i]!;
    if (r >= 0 && r < result.length && q >= 0 && q < result[r]!.length) {
      result[r]![q] = i === 0 ? 'S' : (i === path.length - 1 ? 'E' : '*');
    }
  }

  return result.map(row => row.join('')).join('\n');
}
