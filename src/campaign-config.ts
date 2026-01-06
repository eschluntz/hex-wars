// ============================================================================
// HEX DOMINION - Campaign Grid Configuration
// ============================================================================

import type { CampaignCell, CampaignGrid } from './campaign-state.js';
import { SeededRandom } from './noise.js';

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

// Cell definitions for fortress rows - indexed by column
// Each fortress section has 8 cells (4 per row, excluding fortress columns)
interface FortressSectionCells {
  row0: Array<{ type: CampaignCell['type']; name: string; reward: string }>;
  row1: Array<{ type: CampaignCell['type']; name: string; reward: string }>;
}

const FORTRESS_SECTION_1: FortressSectionCells = {
  row0: [
    { type: 'special', name: 'Quick Deploy', reward: '' },
    { type: 'upgrade', name: 'Treads', reward: '' },
    { type: 'unit', name: 'Rockets', reward: 'rockets' },
    { type: 'special', name: 'Ambush', reward: '' },
  ],
  row1: [
    { type: 'special', name: 'First Strike', reward: '' },
    { type: 'upgrade', name: 'Ammo+', reward: '' },
    { type: 'upgrade', name: '+15% Air', reward: '' },
    { type: 'unit', name: 'Anti-Air', reward: 'antiAir' },
  ],
};

const FORTRESS_SECTION_2: FortressSectionCells = {
  row0: [
    { type: 'special', name: 'Air Drop', reward: '' },
    { type: 'unit', name: 'Hvy Tank', reward: 'heavyTank' },
    { type: 'upgrade', name: '+10% All', reward: '' },
    { type: 'special', name: 'Airstrike', reward: '' },
  ],
  row1: [
    { type: 'upgrade', name: 'Fuel+', reward: '' },
    { type: 'special', name: 'Entrench', reward: '' },
    { type: 'unit', name: 'Missiles', reward: 'missiles' },
    { type: 'unit', name: 'B-Copter', reward: 'copter' },
  ],
};

const FORTRESS_SECTION_3: FortressSectionCells = {
  row0: [
    { type: 'upgrade', name: 'Economy+', reward: '' },
    { type: 'special', name: 'Veterancy', reward: '' },
    { type: 'upgrade', name: '+15% All', reward: '' },
    { type: 'upgrade', name: 'Ultimate Power', reward: '' },
  ],
  row1: [
    { type: 'special', name: 'EMP', reward: '' },
    { type: 'upgrade', name: 'Elite', reward: '' },
    { type: 'upgrade', name: 'Final Strike', reward: '' },
    { type: 'special', name: '???', reward: '' },
  ],
};

function addFortressSectionCells(
  cells: CampaignCell[],
  baseRow: number,
  fortressCol: number,
  section: FortressSectionCells
): void {
  // Generate cells for columns not occupied by fortress (which spans fortressCol and fortressCol+1)
  let cellIdx = 0;
  for (let col = 0; col < 6; col++) {
    if (col === fortressCol || col === fortressCol + 1) continue;
    cells.push(makeCell(baseRow, col, section.row0[cellIdx]!.type, section.row0[cellIdx]!.name, section.row0[cellIdx]!.reward));
    cellIdx++;
  }

  cellIdx = 0;
  for (let col = 0; col < 6; col++) {
    if (col === fortressCol || col === fortressCol + 1) continue;
    cells.push(makeCell(baseRow + 1, col, section.row1[cellIdx]!.type, section.row1[cellIdx]!.name, section.row1[cellIdx]!.reward));
    cellIdx++;
  }
}

function createCampaignCells(seed: number): CampaignCell[] {
  cellIdCounter = 0;
  const cells: CampaignCell[] = [];
  const rng = new SeededRandom(seed);

  // Fortress 1 (rows 2-3): only cols 0 or 4 to avoid bordering starting cells
  const fortress1Col = rng.pick([0, 4]);
  // Fortress 2 and 3: any column 0-4
  const fortress2Col = rng.pick([0, 1, 2, 3, 4]);
  const fortress3Col = rng.pick([0, 1, 2, 3, 4]);

  // Row 0 (bottom - starting row)
  cells.push(makeCell(0, 0, 'unit', 'Recon', 'recon'));
  cells.push(makeCell(0, 1, 'upgrade', '+5% Atk', ''));
  cells.push(makeCell(0, 2, 'unit', 'Infantry', 'infantry'));
  cells.push(makeCell(0, 3, 'unit', 'Tank', 'tank'));
  cells.push(makeCell(0, 4, 'upgrade', '+1 Vision', ''));
  cells.push(makeCell(0, 5, 'unit', 'Mech', 'mech'));

  // Row 1
  cells.push(makeCell(1, 0, 'upgrade', '+1 Move', ''));
  cells.push(makeCell(1, 1, 'unit', 'APC', 'apc'));
  cells.push(makeCell(1, 2, 'special', 'Resupply', ''));
  cells.push(makeCell(1, 3, 'upgrade', '+10% Def', ''));
  cells.push(makeCell(1, 4, 'unit', 'Artillery', 'artillery'));
  cells.push(makeCell(1, 5, 'upgrade', 'Capture+', ''));

  // Rows 2-3: Fortress section 1
  addFortressSectionCells(cells, 2, fortress1Col, FORTRESS_SECTION_1);
  cells.push(makeFortress(2, fortress1Col, 'Steel Bastion', 'heavyTank'));

  // Row 4: Boss
  cells.push(makeCell(4, 0, 'boss', 'General Steelheart', 'mediumTank'));

  // Row 5
  cells.push(makeCell(5, 0, 'unit', 'Med Tank', 'mediumTank'));
  cells.push(makeCell(5, 1, 'special', 'Blitz', ''));
  cells.push(makeCell(5, 2, 'upgrade', 'Armor+', ''));
  cells.push(makeCell(5, 3, 'unit', 'Fighter', 'fighter'));
  cells.push(makeCell(5, 4, 'unit', 'Bomber', 'bomber'));
  cells.push(makeCell(5, 5, 'upgrade', '+2 Air Move', ''));

  // Rows 6-7: Fortress section 2
  addFortressSectionCells(cells, 6, fortress2Col, FORTRESS_SECTION_2);
  cells.push(makeFortress(6, fortress2Col, 'Sky Citadel', 'heavyTank'));

  // Row 8: Boss
  cells.push(makeCell(8, 0, 'boss', 'Admiral Darkwave', 'mediumTank'));

  // Row 9
  cells.push(makeCell(9, 0, 'unit', 'T-Copter', 'transportCopter'));
  cells.push(makeCell(9, 1, 'special', 'Sonar', ''));
  cells.push(makeCell(9, 2, 'upgrade', '+20% Naval', ''));
  cells.push(makeCell(9, 3, 'upgrade', 'Elite Strike', ''));
  cells.push(makeCell(9, 4, 'upgrade', '+2 Range', ''));
  cells.push(makeCell(9, 5, 'special', 'Fortress', ''));

  // Rows 10-11: Fortress section 3
  addFortressSectionCells(cells, 10, fortress3Col, FORTRESS_SECTION_3);
  cells.push(makeFortress(10, fortress3Col, 'Omega Base', 'heavyTank'));

  // Row 12: Final Boss
  cells.push(makeCell(12, 0, 'boss', 'Supreme Commander', ''));

  return cells;
}

export function createCampaignGrid(seed: number): CampaignGrid {
  const cells = createCampaignCells(seed);

  // Find the starting cells (row 0, cols 2-3)
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
