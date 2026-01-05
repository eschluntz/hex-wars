// ============================================================================
// HEX DOMINION - Campaign State Management
// ============================================================================

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
