// ============================================================================
// HEX DOMINION - Campaign State Management
// ============================================================================

import { MAP_PRESETS, REGULAR_PRESETS, type MapPreset } from './map-presets.js';

export type CellType = 'unit' | 'upgrade' | 'special' | 'boss' | 'fortress';

export interface CampaignCell {
  id: string;
  row: number;
  col: number;
  type: CellType;
  name: string;
  reward: string;
  // For fortress cells, defines the 2x2 span
  width?: number;
  height?: number;
}

export interface CampaignState {
  completedCells: Set<string>;  // Cell IDs
  unlockedUnits: Set<string>;   // Unit template IDs
  reinforcements: number;       // Lives remaining
  campaignSeed: number;         // Base seed for the entire campaign
}

export interface CampaignGrid {
  cells: CampaignCell[];
  startingCells: string[];  // Cell IDs that are pre-completed
  startingUnits: string[];  // Unit template IDs available at start
  startingReinforcements: number;
}

/**
 * Create a fresh campaign state from a grid configuration
 */
export function createInitialCampaignState(grid: CampaignGrid): CampaignState {
  return {
    completedCells: new Set(grid.startingCells),
    unlockedUnits: new Set(grid.startingUnits),
    reinforcements: grid.startingReinforcements,
    campaignSeed: Math.floor(Math.random() * 1000000),
  };
}

/**
 * Get the neighbors of a cell in the grid (orthogonal adjacency)
 */
function getNeighborPositions(row: number, col: number): Array<{ row: number; col: number }> {
  return [
    { row: row - 1, col },  // above
    { row: row + 1, col },  // below
    { row, col: col - 1 },  // left
    { row, col: col + 1 },  // right
  ];
}

/**
 * Check if a cell is available to play
 */
export function isCellAvailable(
  cell: CampaignCell,
  state: CampaignState,
  grid: CampaignGrid
): boolean {
  // Already completed
  if (state.completedCells.has(cell.id)) {
    return false;
  }

  if (cell.type === 'boss') {
    // Boss cells: available when ANY cell in the row below is completed
    const rowBelow = cell.row - 1;
    const cellsInRowBelow = grid.cells.filter(c => c.row === rowBelow);
    return cellsInRowBelow.some(c => state.completedCells.has(c.id));
  }

  if (cell.type === 'fortress') {
    // Fortress (2x2): available when 50%+ of perimeter cells are completed
    const perimeterPositions = getFortressPerimeter(cell);
    const perimeterCells = perimeterPositions
      .map(pos => grid.cells.find(c => c.row === pos.row && c.col === pos.col))
      .filter((c): c is CampaignCell => c !== undefined);

    const completedCount = perimeterCells.filter(c => state.completedCells.has(c.id)).length;
    const needed = Math.ceil(perimeterCells.length * 0.5);
    return completedCount >= needed;
  }

  // Normal cells: available when an adjacent (orthogonal) cell is completed
  const neighbors = getNeighborPositions(cell.row, cell.col);
  for (const pos of neighbors) {
    const neighbor = grid.cells.find(c => c.row === pos.row && c.col === pos.col);
    if (neighbor && state.completedCells.has(neighbor.id)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the perimeter positions around a 2x2 fortress
 */
function getFortressPerimeter(fortress: CampaignCell): Array<{ row: number; col: number }> {
  const positions: Array<{ row: number; col: number }> = [];
  const width = fortress.width ?? 2;
  const height = fortress.height ?? 2;

  // Left column (adjacent to fortress left edge)
  for (let r = fortress.row; r < fortress.row + height; r++) {
    positions.push({ row: r, col: fortress.col - 1 });
  }

  // Right column (adjacent to fortress right edge)
  for (let r = fortress.row; r < fortress.row + height; r++) {
    positions.push({ row: r, col: fortress.col + width });
  }

  // Bottom row (below fortress)
  for (let c = fortress.col; c < fortress.col + width; c++) {
    positions.push({ row: fortress.row - 1, col: c });
  }

  // Top row (above fortress)
  for (let c = fortress.col; c < fortress.col + width; c++) {
    positions.push({ row: fortress.row + height, col: c });
  }

  return positions;
}

/**
 * Mark a cell as completed and return the updated state
 */
export function completeCell(
  cellId: string,
  state: CampaignState,
  grid: CampaignGrid
): CampaignState {
  const newCompleted = new Set(state.completedCells);
  newCompleted.add(cellId);

  // Apply any rewards from the cell
  const cell = grid.cells.find(c => c.id === cellId);
  const newUnlockedUnits = new Set(state.unlockedUnits);

  if (cell?.type === 'unit' && cell.reward) {
    newUnlockedUnits.add(cell.reward);
  }

  return {
    ...state,
    completedCells: newCompleted,
    unlockedUnits: newUnlockedUnits,
  };
}

/**
 * Lose a reinforcement (after losing a battle)
 */
export function loseReinforcement(state: CampaignState): CampaignState {
  return {
    ...state,
    reinforcements: Math.max(0, state.reinforcements - 1),
  };
}

/**
 * Check if the campaign is over (no reinforcements left)
 */
export function isCampaignOver(state: CampaignState): boolean {
  return state.reinforcements <= 0;
}

/**
 * Get info about fortress unlock progress
 */
export function getFortressProgress(
  fortress: CampaignCell,
  state: CampaignState,
  grid: CampaignGrid
): { completed: number; needed: number; total: number } {
  const perimeterPositions = getFortressPerimeter(fortress);
  const perimeterCells = perimeterPositions
    .map(pos => grid.cells.find(c => c.row === pos.row && c.col === pos.col))
    .filter((c): c is CampaignCell => c !== undefined);

  const completed = perimeterCells.filter(c => state.completedCells.has(c.id)).length;
  const total = perimeterCells.length;
  const needed = Math.ceil(total * 0.5);

  return { completed, needed, total };
}

// ============================================================================
// SEED AND PRESET DERIVATION
// ============================================================================

/**
 * Simple hash function for strings
 * djb2 algorithm - fast and well-distributed for string hashing
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Derive a deterministic seed for a campaign battle from the cell ID and campaign seed.
 * This ensures replaying the same cell always produces the same map.
 */
export function getCampaignBattleSeed(cellId: string, campaignSeed: number): number {
  return (hashString(cellId) ^ campaignSeed) >>> 0;
}

/**
 * Get the map preset for a campaign cell based on its type.
 * Regular cells get a random preset from the pool, fortress/boss get fixed presets.
 */
export function getCampaignCellPreset(cell: CampaignCell, campaignSeed: number): MapPreset {
  if (cell.type === 'boss') {
    return MAP_PRESETS['boss']!;
  }

  if (cell.type === 'fortress') {
    return MAP_PRESETS['fortress']!;
  }

  // Regular cells: pick from the pool deterministically based on cell seed
  const seed = getCampaignBattleSeed(cell.id, campaignSeed);
  const presetIndex = seed % REGULAR_PRESETS.length;
  const presetName = REGULAR_PRESETS[presetIndex]!;
  return MAP_PRESETS[presetName]!;
}
