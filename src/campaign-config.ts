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
const TIER_1_UNITS = ['recon', 'apc', 'artillery'];
const TIER_2_UNITS = ['antiAir', 'rockets'];
const TIER_3_UNITS = ['mediumTank', 'copter', 'transportCopter'];
const TIER_4_UNITS = ['heavyTank', 'bomber', 'fighter', 'missiles'];

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
    infantry: 'Unlock Infantry',
    mech: 'Unlock Mech',
    recon: 'Unlock Recon',
    tank: 'Unlock Tank',
    mediumTank: 'Unlock Md Tank',
    heavyTank: 'Unlock Mega Tank',
    apc: 'Unlock APC',
    artillery: 'Unlock Artillery',
    rockets: 'Unlock Rockets',
    antiAir: 'Unlock Anti-Air',
    missiles: 'Unlock Missiles',
    fighter: 'Unlock Fighter',
    bomber: 'Unlock Bomber',
    copter: 'Unlock B-Copter',
    transportCopter: 'Unlock T-Copter',
  };
  return makeCell(row, col, 'unit', displayNames[unitId]!, unitId);
}

/**
 * Generates a row of cells with a mix of types
 * With 4 columns and max 2 completions per row, we use fewer cells:
 * - 1 unit (if available)
 * - 1-2 upgrades
 * - 1 power
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

  // 4 columns total
  const availableCols = [0, 1, 2, 3].filter(c => !skipCols.includes(c));
  rng.shuffle(availableCols);

  // Get available units from pool
  const availableUnits = unitPool.filter(u => !usedUnits.has(u));

  for (let i = 0; i < availableCols.length; i++) {
    const col = availableCols[i]!;

    // Distribution: 1 unit, 2 upgrades, 1 power
    if (i === 0 && availableUnits.length > 0) {
      const unitId = rng.pick(availableUnits);
      availableUnits.splice(availableUnits.indexOf(unitId), 1);
      usedUnits.add(unitId);
      cells.push(makeUnitCell(row, col, unitId));
    } else if (i < 3) {
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

  // Pre-assign powers to fortresses and bosses (6 total, prioritized)
  const fortressPower1 = pickFromPool(ALL_POWERS, POWERS, usedPowers, rng);
  const fortressPower2 = pickFromPool(ALL_POWERS, POWERS, usedPowers, rng);
  const fortressPower3 = pickFromPool(ALL_POWERS, POWERS, usedPowers, rng);
  const bossPower1 = pickFromPool(ALL_POWERS, POWERS, usedPowers, rng);
  const bossPower2 = pickFromPool(ALL_POWERS, POWERS, usedPowers, rng);
  const bossPower3 = pickFromPool(ALL_POWERS, POWERS, usedPowers, rng);

  // Fortress positions (0, 1, or 2 so they span cols 0-1, 1-2, or 2-3)
  const fortress1Col = rng.pick([0, 2]);  // Avoid center starting cells
  const fortress2Col = rng.pick([0, 1, 2]);
  const fortress3Col = rng.pick([0, 1, 2]);

  // Row 0 (bottom - starting row)
  // Only 2 cells in starting row: Infantry at col 1, Tank at col 2
  // Cols 0 and 3 are left empty (they'd be instantly locked anyway)
  cells.push(makeUnitCell(0, 1, 'infantry'));
  cells.push(makeUnitCell(0, 2, 'tank'));
  usedUnits.add('infantry');
  usedUnits.add('tank');

  // Section 1: Rows 1-5 (6 rows total including row 0)
  cells.push(...generateRow(1, rng, TIER_1_UNITS, usedUpgrades, usedPowers, usedUnits));
  cells.push(...generateRow(2, rng, TIER_1_UNITS, usedUpgrades, usedPowers, usedUnits));
  cells.push(...generateRow(3, rng, TIER_2_UNITS, usedUpgrades, usedPowers, usedUnits));
  const fortress1SkipCols = [fortress1Col, fortress1Col + 1];
  cells.push(...generateRow(4, rng, TIER_2_UNITS, usedUpgrades, usedPowers, usedUnits, fortress1SkipCols));
  cells.push(...generateRow(5, rng, TIER_2_UNITS, usedUpgrades, usedPowers, usedUnits, fortress1SkipCols));
  cells.push(makeFortress(4, fortress1Col, 'Steel Bastion', fortressPower1.name));

  // Row 6: Boss 1
  cells.push(makeCell(6, 0, 'boss', 'General Steelheart', bossPower1.name));

  // Section 2: Rows 7-11 (5 rows after boss)
  cells.push(...generateRow(7, rng, TIER_2_UNITS, usedUpgrades, usedPowers, usedUnits));
  cells.push(...generateRow(8, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits));
  cells.push(...generateRow(9, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits));
  const fortress2SkipCols = [fortress2Col, fortress2Col + 1];
  cells.push(...generateRow(10, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits, fortress2SkipCols));
  cells.push(...generateRow(11, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits, fortress2SkipCols));
  cells.push(makeFortress(10, fortress2Col, 'Sky Citadel', fortressPower2.name));

  // Row 12: Boss 2
  cells.push(makeCell(12, 0, 'boss', 'Admiral Darkwave', bossPower2.name));

  // Section 3: Rows 13-17 (5 rows after boss)
  cells.push(...generateRow(13, rng, TIER_3_UNITS, usedUpgrades, usedPowers, usedUnits));
  cells.push(...generateRow(14, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits));
  cells.push(...generateRow(15, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits));
  const fortress3SkipCols = [fortress3Col, fortress3Col + 1];
  cells.push(...generateRow(16, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits, fortress3SkipCols));
  cells.push(...generateRow(17, rng, TIER_4_UNITS, usedUpgrades, usedPowers, usedUnits, fortress3SkipCols));
  cells.push(makeFortress(16, fortress3Col, 'Omega Base', fortressPower3.name));

  // Row 18: Final Boss
  cells.push(makeCell(18, 0, 'boss', 'Supreme Commander', bossPower3.name));

  return cells;
}

export function createCampaignGrid(seed: number): CampaignGrid {
  const cells = createCampaignCells(seed);

  // Find the starting cells (row 0, cols 1-2 - Infantry and Tank)
  const startingCells = cells
    .filter(c => c.row === 0 && (c.col === 1 || c.col === 2))
    .map(c => c.id);

  return {
    cells,
    startingCells,
    startingUnits: ['infantry', 'tank'],
    startingReinforcements: 3,
  };
}

// Grid dimensions for rendering
export const CAMPAIGN_GRID_COLS = 4;
export const CAMPAIGN_GRID_ROWS = 19;

// Visual configuration
export const CAMPAIGN_CELL_SIZE = 70;
export const CAMPAIGN_CELL_GAP = 8;
