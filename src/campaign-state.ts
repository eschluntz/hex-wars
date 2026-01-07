// ============================================================================
// HEX DOMINION - Campaign State Management
// ============================================================================

import { MAP_PRESETS, REGULAR_PRESETS, type MapPreset } from './map-presets.js';
import {
  REWARD_TO_UPGRADE,
  REWARD_TO_POWER,
  computeCampaignModifiers,
  type CampaignModifiers,
} from './upgrades.js';

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

  // Upgrade system
  acquiredUpgrades: string[];   // IDs of stacking upgrades earned
  unlockedPowers: string[];     // IDs of powers unlocked
  activePowers: string[];       // IDs of powers currently equipped
  powerSlots: number;           // Number of power slots (starts at 1, +1 per boss)
  bossesDefeated: number;       // Number of bosses defeated
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
export function createInitialCampaignState(grid: CampaignGrid, seed: number): CampaignState {
  return {
    completedCells: new Set(grid.startingCells),
    unlockedUnits: new Set(grid.startingUnits),
    reinforcements: grid.startingReinforcements,
    campaignSeed: seed,
    acquiredUpgrades: [],
    unlockedPowers: [],
    activePowers: [],
    powerSlots: 1,
    bossesDefeated: 0,
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
 * Check if a position is within a fortress's span
 */
function isPositionInFortress(row: number, col: number, fortress: CampaignCell): boolean {
  const width = fortress.width ?? 2;
  const height = fortress.height ?? 2;
  return row >= fortress.row && row < fortress.row + height &&
         col >= fortress.col && col < fortress.col + width;
}

/**
 * Find a cell at a position, accounting for multi-tile cells (fortresses)
 */
function findCellAtPosition(row: number, col: number, grid: CampaignGrid): CampaignCell | undefined {
  // First check for exact match
  const exact = grid.cells.find(c => c.row === row && c.col === col);
  if (exact) return exact;

  // Check if position is within a fortress
  const fortress = grid.cells.find(c => c.type === 'fortress' && isPositionInFortress(row, col, c));
  if (fortress) return fortress;

  // Check if position is in a boss row (bosses span full row)
  const boss = grid.cells.find(c => c.type === 'boss' && c.row === row);
  if (boss) return boss;

  return undefined;
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
    // For fortresses, check if they span into the row below
    const rowBelow = cell.row - 1;
    const cellsInRowBelow = grid.cells.filter(c => {
      if (c.type === 'fortress') {
        const height = c.height ?? 2;
        return c.row <= rowBelow && rowBelow < c.row + height;
      }
      return c.row === rowBelow;
    });
    return cellsInRowBelow.some(c => state.completedCells.has(c.id));
  }

  if (cell.type === 'fortress') {
    // Fortress (2x2): available when ANY adjacent cell is completed
    const perimeterPositions = getFortressPerimeter(cell);
    for (const pos of perimeterPositions) {
      const neighbor = findCellAtPosition(pos.row, pos.col, grid);
      if (neighbor && state.completedCells.has(neighbor.id)) {
        return true;
      }
    }
    return false;
  }

  // Normal cells: available when an adjacent (orthogonal) cell is completed
  const neighbors = getNeighborPositions(cell.row, cell.col);
  for (const pos of neighbors) {
    const neighbor = findCellAtPosition(pos.row, pos.col, grid);
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
  const newAcquiredUpgrades = [...state.acquiredUpgrades];
  const newUnlockedPowers = [...state.unlockedPowers];
  const newActivePowers = [...state.activePowers];
  let newPowerSlots = state.powerSlots;
  let newBossesDefeated = state.bossesDefeated;

  // Helper to unlock a power by name and auto-equip if slots available
  function unlockPower(powerName: string): void {
    const powerId = REWARD_TO_POWER[powerName];
    if (!powerId || newUnlockedPowers.includes(powerId)) return;
    newUnlockedPowers.push(powerId);
    console.log(`Unlocked power: ${powerName} (${powerId})`);
    if (newActivePowers.length < newPowerSlots) {
      newActivePowers.push(powerId);
      console.log(`Auto-equipped power: ${powerId}`);
    }
  }

  if (cell) {
    // Unit unlock
    if (cell.type === 'unit' && cell.reward) {
      newUnlockedUnits.add(cell.reward);
    }

    // Upgrade acquisition
    if (cell.type === 'upgrade') {
      const upgradeId = REWARD_TO_UPGRADE[cell.name];
      if (upgradeId && !newAcquiredUpgrades.includes(upgradeId)) {
        newAcquiredUpgrades.push(upgradeId);
        console.log(`Acquired upgrade: ${cell.name} (${upgradeId})`);
      }
    }

    // Power unlock (special cells use name, boss/fortress use reward)
    if (cell.type === 'special') {
      unlockPower(cell.name);
    }

    if (cell.type === 'boss') {
      newBossesDefeated++;
      newPowerSlots++;
      console.log(`Boss defeated! Power slots: ${newPowerSlots}`);
      unlockPower(cell.reward);
    }

    if (cell.type === 'fortress') {
      console.log(`Fortress conquered: ${cell.name}`);
      unlockPower(cell.reward);
    }
  }

  return {
    ...state,
    completedCells: newCompleted,
    unlockedUnits: newUnlockedUnits,
    acquiredUpgrades: newAcquiredUpgrades,
    unlockedPowers: newUnlockedPowers,
    activePowers: newActivePowers,
    powerSlots: newPowerSlots,
    bossesDefeated: newBossesDefeated,
  };
}

/**
 * Equip a power (add to active powers)
 */
export function equipPower(powerId: string, state: CampaignState): CampaignState {
  // Check if power is unlocked
  if (!state.unlockedPowers.includes(powerId)) {
    return state;
  }

  // Check if already equipped
  if (state.activePowers.includes(powerId)) {
    return state;
  }

  // Check if we have room
  if (state.activePowers.length >= state.powerSlots) {
    return state;
  }

  return {
    ...state,
    activePowers: [...state.activePowers, powerId],
  };
}

/**
 * Unequip a power (remove from active powers)
 */
export function unequipPower(powerId: string, state: CampaignState): CampaignState {
  if (!state.activePowers.includes(powerId)) {
    return state;
  }

  return {
    ...state,
    activePowers: state.activePowers.filter(id => id !== powerId),
  };
}

/**
 * Get computed campaign modifiers from acquired upgrades and active powers
 */
export function getCampaignModifiers(state: CampaignState): CampaignModifiers {
  return computeCampaignModifiers(state.acquiredUpgrades, state.activePowers);
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

// Cells that border the starting cells (Infantry at 0,2 and Tank at 0,3)
// These should always use tiny maps for an easier start
const STARTER_BORDER_CELLS = new Set([
  '0,1',  // left of Infantry
  '0,4',  // right of Tank
  '1,2',  // above Infantry
  '1,3',  // above Tank
]);

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

  // Starter border cells always get tiny maps
  if (STARTER_BORDER_CELLS.has(`${cell.row},${cell.col}`)) {
    return MAP_PRESETS['tiny']!;
  }

  // Regular cells: pick from the pool deterministically based on cell seed
  const seed = getCampaignBattleSeed(cell.id, campaignSeed);
  const presetIndex = seed % REGULAR_PRESETS.length;
  const presetName = REGULAR_PRESETS[presetIndex]!;
  return MAP_PRESETS[presetName]!;
}
