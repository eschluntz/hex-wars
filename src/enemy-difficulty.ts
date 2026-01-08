// ============================================================================
// HEX DOMINION - Enemy Difficulty Progression
// ============================================================================

import type { CampaignCell, CampaignGrid, CampaignState } from './campaign-state.js';
import { TIER_1_UNITS, TIER_2_UNITS, TIER_3_UNITS } from './campaign-config.js';
import {
  type CampaignModifiers,
  computeCampaignModifiers,
  STACKING_UPGRADES,
  POWERS,
  REWARD_TO_UPGRADE,
  REWARD_TO_POWER,
} from './upgrades.js';
import { SeededRandom } from './noise.js';
import { getCampaignBattleSeed } from './campaign-state.js';

// ============================================================================
// TYPES
// ============================================================================

export interface EnemyBattleConfig {
  unlockedUnits: string[];        // Units enemy can build
  modifiers: CampaignModifiers;   // Combined modifiers for combat
  activeUpgrades: string[];       // All accumulated upgrades (always active)
  activePowers: string[];         // Powers actually equipped (limited by slots)
  powerSlots: number;             // Same as player's current slots
  playerClusters: number;         // Clusters for player (default 1)
  enemyClusters: number;          // Clusters for enemy (default 1)
}

// ============================================================================
// SECTION BOUNDARIES
// ============================================================================

// Section 1: Rows 0-6 (through first boss at row 6)
const SECTION_1_END = 6;
// Section 2: Rows 7-12 (through second boss at row 12)
const SECTION_2_END = 12;
// Section 3: Rows 13-18 (through final boss at row 18)

// Linear scaling per row
const AV_DV_PER_ROW = 2;   // +2% per row

// ============================================================================
// UNIT UNLOCKS BY SECTION
// ============================================================================

/**
 * Get the units available to the enemy based on the cell's row.
 * Clean 1:1 mapping: Section N gives access to Tiers 1 through N.
 */
export function getEnemyUnlockedUnits(row: number): string[] {
  // Always have infantry, tank, and Tier 1 units
  const units = ['infantry', 'tank', ...TIER_1_UNITS];

  // Section 2+ (rows 7-18) also get Tier 2 units
  if (row > SECTION_1_END) {
    units.push(...TIER_2_UNITS);
  }

  // Section 3 (rows 13-18) also get Tier 3 units
  if (row > SECTION_2_END) {
    units.push(...TIER_3_UNITS);
  }

  return units;
}

// ============================================================================
// CASCADING UPGRADES AND POWERS
// ============================================================================

/**
 * Get all uncompleted cells in rows below the given row.
 * The enemy inherits rewards from cells the player skipped.
 */
function getUncompletedCellsBelow(
  targetRow: number,
  state: CampaignState,
  grid: CampaignGrid
): CampaignCell[] {
  return grid.cells.filter(cell => {
    // Only consider cells in lower rows
    if (cell.row >= targetRow) return false;
    // Ignore starting cells (row 0, cols 1-2)
    if (cell.row === 0 && (cell.col === 1 || cell.col === 2)) return false;
    // Only include uncompleted cells
    return !state.completedCells.has(cell.id);
  });
}

/**
 * Get the current cell's reward (upgrade or power).
 * The enemy always has the cell's upgrade/power active during that battle.
 */
function getCellReward(cell: CampaignCell): { upgrade?: string; power?: string } {
  if (cell.type === 'upgrade') {
    const upgradeId = REWARD_TO_UPGRADE[cell.name];
    if (upgradeId) {
      return { upgrade: upgradeId };
    }
  }

  if (cell.type === 'special' || cell.type === 'fortress' || cell.type === 'boss') {
    // Special cells use name, boss/fortress use reward field
    const rewardName = cell.type === 'special' ? cell.name : cell.reward;
    const powerId = REWARD_TO_POWER[rewardName];
    if (powerId) {
      return { power: powerId };
    }
  }

  return {};
}

/**
 * Compute the enemy's modifiers, upgrades, and powers for a battle.
 *
 * Includes:
 * 1. Linear row scaling (+2% AV/DV per row)
 * 2. Current cell's reward (upgrade or power)
 * 3. Cascading rewards from uncompleted cells in lower rows
 */
function computeEnemyBattleConfig(
  cell: CampaignCell,
  state: CampaignState,
  grid: CampaignGrid,
  powerSlots: number
): { modifiers: CampaignModifiers; activeUpgrades: string[]; activePowers: string[] } {
  const activeUpgrades: string[] = [];
  const availablePowers: string[] = [];

  // 1. Add current cell's reward
  const cellReward = getCellReward(cell);
  if (cellReward.upgrade) {
    activeUpgrades.push(cellReward.upgrade);
  }
  if (cellReward.power) {
    availablePowers.push(cellReward.power);
  }

  // 2. Add cascading rewards from uncompleted cells below
  const uncompletedBelow = getUncompletedCellsBelow(cell.row, state, grid);
  for (const skippedCell of uncompletedBelow) {
    const reward = getCellReward(skippedCell);
    if (reward.upgrade && !activeUpgrades.includes(reward.upgrade)) {
      activeUpgrades.push(reward.upgrade);
    }
    if (reward.power && !availablePowers.includes(reward.power)) {
      availablePowers.push(reward.power);
    }
  }

  // 3. Determine active powers (limited by slots)
  // The cell's own reward power is always active if present
  let activePowers: string[];

  if (availablePowers.length <= powerSlots) {
    // All powers fit in slots
    activePowers = [...availablePowers];
  } else {
    // Too many powers - randomly select, but cell's reward power is guaranteed
    const seed = getCampaignBattleSeed(cell.id, state.campaignSeed);
    const rng = new SeededRandom(seed);

    if (cellReward.power) {
      // Start with the cell's reward power, fill rest randomly
      const otherPowers = availablePowers.filter(p => p !== cellReward.power);
      rng.shuffle(otherPowers);
      activePowers = [cellReward.power, ...otherPowers.slice(0, powerSlots - 1)];
    } else {
      // No cell reward power, pure random selection
      const shuffled = [...availablePowers];
      rng.shuffle(shuffled);
      activePowers = shuffled.slice(0, powerSlots);
    }
  }

  // 4. Compute base modifiers from upgrades and active powers
  const baseModifiers = computeCampaignModifiers(activeUpgrades, activePowers);

  // 5. Apply linear row scaling (+2% AV/DV per row)
  const rowScaling = cell.row * AV_DV_PER_ROW;
  const modifiers: CampaignModifiers = {
    ...baseModifiers,
    attackAV: baseModifiers.attackAV + rowScaling,
    defenseAV: baseModifiers.defenseAV + rowScaling,
  };

  return { modifiers, activeUpgrades, activePowers };
}

// ============================================================================
// CLUSTER BONUSES
// ============================================================================

/**
 * Get cell-type bonuses for fortress and boss battles.
 */
function getCellBonuses(cell: CampaignCell): {
  playerClusters: number;
  enemyClusters: number;
  enemyPowerSlotBonus: number;
} {
  if (cell.type === 'fortress') {
    return { playerClusters: 1, enemyClusters: 2, enemyPowerSlotBonus: 1 };
  }
  if (cell.type === 'boss') {
    return { playerClusters: 2, enemyClusters: 4, enemyPowerSlotBonus: 1 };
  }
  return { playerClusters: 1, enemyClusters: 1, enemyPowerSlotBonus: 0 };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Get the complete enemy battle configuration for a campaign cell.
 * This is the main entry point for the enemy difficulty system.
 */
export function getEnemyBattleConfig(
  cell: CampaignCell,
  state: CampaignState,
  grid: CampaignGrid
): EnemyBattleConfig {
  const unlockedUnits = getEnemyUnlockedUnits(cell.row);
  const { playerClusters, enemyClusters, enemyPowerSlotBonus } = getCellBonuses(cell);

  // Enemy power slots = player's slots + bonus for fortress/boss
  const powerSlots = state.powerSlots + enemyPowerSlotBonus;

  const { modifiers, activeUpgrades, activePowers } = computeEnemyBattleConfig(
    cell, state, grid, powerSlots
  );

  return {
    unlockedUnits,
    modifiers,
    activeUpgrades,
    activePowers,
    powerSlots,
    playerClusters,
    enemyClusters,
  };
}
