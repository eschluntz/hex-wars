// ============================================================================
// HEX DOMINION - Campaign Grid Configuration
// ============================================================================

import type { CampaignCell, CampaignGrid } from './campaign-state.js';
import { SeededRandom } from './noise.js';
import { STACKING_UPGRADES, POWERS } from './upgrades.js';

/**
 * Campaign grid layout: 6 columns, 13 rows with boss barriers and fortress blocks
 *
 * Row layout (bottom to top):
 *   Row 0: Starting row (6 normal cells)
 *   Row 1: Normal row
 *   Rows 2-3: Fortress block (fortress position randomized)
 *   Row 4: Boss
 *   Row 5: Normal row
 *   Rows 6-7: Fortress block (fortress position randomized)
 *   Row 8: Boss
 *   Row 9: Normal row
 *   Rows 10-11: Fortress block (fortress position randomized)
 *   Row 12: Final Boss
 */

// Unit unlocks by tier (row ranges)
const TIER_1_UNITS = ['recon', 'apc', 'artillery'];  // Rows 0-1
const TIER_2_UNITS = ['antiAir', 'rockets'];  // Rows 2-4
const TIER_3_UNITS = ['mediumTank', 'fighter', 'bomber', 'copter'];  // Rows 5-8
const TIER_4_UNITS = ['heavyTank', 'missiles', 'transportCopter'];  // Rows 9+

// All upgrade IDs from the registry
const ALL_UPGRADES = Object.keys(STACKING_UPGRADES);

// All power IDs from the registry
const ALL_POWERS = Object.keys(POWERS);

let cellIdCounter = 0;

function makeCell(
  row: number,
  col: number,
  type: CampaignCell['type'],
  name: string,
  reward: string = ''
): CampaignCell {
  return {
    id: `cell_${cellIdCounter++}`,
    row,
    col,
    type,
    name,
    reward,
  };
}

function makeFortress(
  row: number,
  col: number,
  name: string,
  reward: string
): CampaignCell {
  return {
    id: `cell_${cellIdCounter++}`,
    row,
    col,
    type: 'fortress',
    name,
    reward,
    width: 2,
    height: 2,
  };
}

/**
 * Pick a random item from a pool, preferring unused items
 */
function pickFromPool<T extends { name: string }>(
  allItems: string[],
  registry: Record<string, T>,
  used: Set<string>,
  rng: SeededRandom
): T {
  const available = allItems.filter(id => !used.has(id));
  const pool = available.length > 0 ? available : allItems;
  const id = rng.pick(pool);
  used.add(id);
  return registry[id]!;
}

function makeRandomUpgradeCell(row: number, col: number, rng: SeededRandom, used: Set<string>): CampaignCell {
  const upgrade = pickFromPool(ALL_UPGRADES, STACKING_UPGRADES, used, rng);
  return makeCell(row, col, 'upgrade', upgrade.name, '');
}

function makeRandomPowerCell(row: number, col: number, rng: SeededRandom, used: Set<string>): CampaignCell {
  const power = pickFromPool(ALL_POWERS, POWERS, used, rng);
  return makeCell(row, col, 'special', power.name, '');
}

/**
 * Creates a unit unlock cell
 */
function makeUnitCell(
  row: number,
  col: number,
  unitId: string
): CampaignCell {
  // Get display name from unit ID
  const displayNames: Record<string, string> = {
    infantry: 'Infantry',
    mech: 'Mech',
    recon: 'Recon',
    tank: 'Tank',
    mediumTank: 'Md Tank',
    heavyTank: 'Hvy Tank',
    apc: 'APC',
    artillery: 'Artillery',
    rockets: 'Rockets',
    antiAir: 'Anti-Air',
    missiles: 'Missiles',
    fighter: 'Fighter',
    bomber: 'Bomber',
    copter: 'B-Copter',
    transportCopter: 'T-Copter',
  };
  return makeCell(row, col, 'unit', displayNames[unitId] ?? unitId, unitId);
}

/**
 * Generates a row of cells with a mix of types
 */
function generateRow(
  row: number,
  rng: SeededRandom,
  unitPool: string[],
  usedUpgrades: Set<string>,
  usedPowers: Set<string>,
  usedUnits: Set<string>,
  skipCols: number[] = []
): CampaignCell[] {
  const cells: CampaignCell[] = [];

  // Determine cell types for this row (roughly 2 units, 2 upgrades, 2 powers per row)
  // But randomize the distribution
  const availableCols = [0, 1, 2, 3, 4, 5].filter(c => !skipCols.includes(c));
  rng.shuffle(availableCols);

  // Get available units from pool
  const availableUnits = unitPool.filter(u => !usedUnits.has(u));

  for (let i = 0; i < availableCols.length; i++) {
    const col = availableCols[i]!;

    // Decide cell type based on position in shuffled order
    // First 1-2 are units (if available), next 2-3 are upgrades, rest are powers
    if (i < 2 && availableUnits.length > 0) {
      const unitId = rng.pick(availableUnits);
      availableUnits.splice(availableUnits.indexOf(unitId), 1);
      usedUnits.add(unitId);
      cells.push(makeUnitCell(row, col, unitId));
    } else if (i < 4) {
      cells.push(makeRandomUpgradeCell(row, col, rng, usedUpgrades));
    } else {
      cells.push(makeRandomPowerCell(row, col, rng, usedPowers));
    }
  }

  return cells;
}

function createCampaignCells(seed: number): CampaignCell[] {
  cellIdCounter = 0;
  const cells: CampaignCell[] = [];
  const rng = new SeededRandom(seed);

  const usedUpgrades = new Set<string>();
  const usedPowers = new Set<string>();
  const usedUnits = new Set<string>();

  // Fortress positions (randomized)
  const fortress1Col = rng.pick([0, 4]);  // Avoid starting cells
  const fortress2Col = rng.pick([0, 1, 2, 3, 4]);
  const fortress3Col = rng.pick([0, 1, 2, 3, 4]);

  // Row 0 (bottom - starting row)
  // Fixed: Infantry and Tank are starting units, rest randomized
  cells.push(makeUnitCell(0, 2, 'infantry'));
  cells.push(makeUnitCell(0, 3, 'tank'));
  usedUnits.add('infantry');
  usedUnits.add('tank');

  // Fill remaining spots with tier 1 content
  const row0Remaining = [0, 1, 4, 5];
  rng.shuffle(row0Remaining);

  // Add mech as third starting unit option
  cells.push(makeUnitCell(0, row0Remaining[0]!, 'mech'));
  usedUnits.add('mech');

  // Rest are upgrades/powers
  cells.push(makeRandomUpgradeCell(0, row0Remaining[1]!, rng, usedUpgrades));
  cells.push(makeRandomUpgradeCell(0, row0Remaining[2]!, rng, usedUpgrades));
  cells.push(makeRandomPowerCell(0, row0Remaining[3]!, rng, usedPowers));

  // Row 1: Mix of tier 1 units and upgrades/powers
  cells.push(...generateRow(1, rng, TIER_1_UNITS, usedUpgrades, usedPowers, usedUnits));

  // Rows 2-3: Fortress section 1
  const fortress1SkipCols = [fortress1Col, fortress1Col + 1];
  cells.push(...generateRow(2, rng, TIER_2_UNITS, usedUpgrades, usedPowers, usedUnits, fortress1SkipCols));
  cells.push(...generateRow(3, rng, TIER_2_UNITS, usedUpgrades, usedPowers, usedUnits, fortress1SkipCols));
  cells.push(makeFortress(2, fortress1Col, 'Steel Bastion', ''));

  // Row 4: Boss
  cells.push(makeCell(4, 0, 'boss', 'General Steelheart', ''));

  // Row 5: After first boss, tier 3 units
  cells.push(...generateRow(5, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits));

  // Rows 6-7: Fortress section 2
  const fortress2SkipCols = [fortress2Col, fortress2Col + 1];
  cells.push(...generateRow(6, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits, fortress2SkipCols));
  cells.push(...generateRow(7, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits, fortress2SkipCols));
  cells.push(makeFortress(6, fortress2Col, 'Sky Citadel', ''));

  // Row 8: Boss
  cells.push(makeCell(8, 0, 'boss', 'Admiral Darkwave', ''));

  // Row 9: After second boss, tier 4 units
  cells.push(...generateRow(9, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits));

  // Rows 10-11: Fortress section 3
  const fortress3SkipCols = [fortress3Col, fortress3Col + 1];
  cells.push(...generateRow(10, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits, fortress3SkipCols));
  cells.push(...generateRow(11, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits, fortress3SkipCols));
  cells.push(makeFortress(10, fortress3Col, 'Omega Base', ''));

  // Row 12: Final Boss
  cells.push(makeCell(12, 0, 'boss', 'Supreme Commander', ''));

  return cells;
}

export function createCampaignGrid(seed: number): CampaignGrid {
  const cells = createCampaignCells(seed);

  // Find the starting cells (row 0, cols 2-3 - Infantry and Tank)
  const startingCells = cells
    .filter(c => c.row === 0 && (c.col === 2 || c.col === 3))
    .map(c => c.id);

  return {
    cells,
    startingCells,
    startingUnits: ['infantry', 'tank'],
    startingReinforcements: 3,
  };
}

// Grid dimensions for rendering
export const CAMPAIGN_GRID_COLS = 6;
export const CAMPAIGN_GRID_ROWS = 13;

// Visual configuration
export const CAMPAIGN_CELL_SIZE = 70;
export const CAMPAIGN_CELL_GAP = 8;
