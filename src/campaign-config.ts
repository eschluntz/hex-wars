// ============================================================================
// HEX DOMINION - Campaign Grid Configuration
// ============================================================================

import type { CampaignCell, CampaignGrid } from './campaign-state.js';

/**
 * Campaign grid layout: 6 columns, 13 rows with boss barriers and fortress blocks
 *
 * Row layout (bottom to top):
 *   Row 0: Starting row (6 normal cells)
 *   Row 1: Normal row
 *   Rows 2-3: Fortress block (fortress spans cols 2-3)
 *   Row 4: Boss
 *   Row 5: Normal row
 *   Rows 6-7: Fortress block
 *   Row 8: Boss
 *   Row 9: Normal row
 *   Rows 10-11: Fortress block
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

function createCampaignCells(): CampaignCell[] {
  cellIdCounter = 0;
  const cells: CampaignCell[] = [];

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

  // Row 2 (bottom of fortress block) - cols 0, 1, 4, 5 only
  cells.push(makeCell(2, 0, 'special', 'Quick Deploy', ''));
  cells.push(makeCell(2, 1, 'upgrade', 'Treads', ''));
  cells.push(makeCell(2, 4, 'unit', 'Rockets', 'rockets'));
  cells.push(makeCell(2, 5, 'special', 'Ambush', ''));

  // Row 3 (top of fortress block) - cols 0, 1, 4, 5 only
  cells.push(makeCell(3, 0, 'special', 'First Strike', ''));
  cells.push(makeCell(3, 1, 'upgrade', 'Ammo+', ''));
  cells.push(makeCell(3, 4, 'upgrade', '+15% Air', ''));
  cells.push(makeCell(3, 5, 'unit', 'Anti-Air', 'antiAir'));

  // Fortress 1 (rows 2-3, cols 2-3)
  cells.push(makeFortress(2, 2, 'Steel Bastion', 'heavyTank'));

  // Row 4: Boss
  cells.push(makeCell(4, 0, 'boss', 'General Steelheart', 'mediumTank'));

  // Row 5
  cells.push(makeCell(5, 0, 'unit', 'Med Tank', 'mediumTank'));
  cells.push(makeCell(5, 1, 'special', 'Blitz', ''));
  cells.push(makeCell(5, 2, 'upgrade', 'Armor+', ''));
  cells.push(makeCell(5, 3, 'unit', 'Fighter', 'fighter'));
  cells.push(makeCell(5, 4, 'unit', 'Bomber', 'bomber'));
  cells.push(makeCell(5, 5, 'upgrade', '+2 Air Move', ''));

  // Row 6 (bottom of fortress block) - cols 0, 1, 4, 5 only
  cells.push(makeCell(6, 0, 'special', 'Air Drop', ''));
  cells.push(makeCell(6, 1, 'unit', 'Hvy Tank', 'heavyTank'));
  cells.push(makeCell(6, 4, 'upgrade', '+10% All', ''));
  cells.push(makeCell(6, 5, 'special', 'Airstrike', ''));

  // Row 7 (top of fortress block) - cols 0, 1, 4, 5 only
  cells.push(makeCell(7, 0, 'upgrade', 'Fuel+', ''));
  cells.push(makeCell(7, 1, 'special', 'Entrench', ''));
  cells.push(makeCell(7, 4, 'unit', 'Missiles', 'missiles'));
  cells.push(makeCell(7, 5, 'unit', 'B-Copter', 'copter'));

  // Fortress 2 (rows 6-7, cols 2-3)
  cells.push(makeFortress(6, 2, 'Sky Citadel', 'heavyTank'));

  // Row 8: Boss
  cells.push(makeCell(8, 0, 'boss', 'Admiral Darkwave', 'mediumTank'));

  // Row 9
  cells.push(makeCell(9, 0, 'unit', 'T-Copter', 'transportCopter'));
  cells.push(makeCell(9, 1, 'special', 'Sonar', ''));
  cells.push(makeCell(9, 2, 'upgrade', '+20% Naval', ''));
  cells.push(makeCell(9, 3, 'upgrade', 'Elite Strike', ''));
  cells.push(makeCell(9, 4, 'upgrade', '+2 Range', ''));
  cells.push(makeCell(9, 5, 'special', 'Fortress', ''));

  // Row 10 (bottom of fortress block) - cols 0, 1, 4, 5 only
  cells.push(makeCell(10, 0, 'upgrade', 'Economy+', ''));
  cells.push(makeCell(10, 1, 'special', 'Veterancy', ''));
  cells.push(makeCell(10, 4, 'upgrade', '+15% All', ''));
  cells.push(makeCell(10, 5, 'upgrade', 'Ultimate Power', ''));

  // Row 11 (top of fortress block) - cols 0, 1, 4, 5 only
  cells.push(makeCell(11, 0, 'special', 'EMP', ''));
  cells.push(makeCell(11, 1, 'upgrade', 'Elite', ''));
  cells.push(makeCell(11, 4, 'upgrade', 'Final Strike', ''));
  cells.push(makeCell(11, 5, 'special', '???', ''));

  // Fortress 3 (rows 10-11, cols 2-3)
  cells.push(makeFortress(10, 2, 'Omega Base', 'heavyTank'));

  // Row 12: Final Boss
  cells.push(makeCell(12, 0, 'boss', 'Supreme Commander', ''));

  return cells;
}

export function createCampaignGrid(): CampaignGrid {
  const cells = createCampaignCells();

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
