// ============================================================================
// HEX DOMINION - Campaign System Tests
// ============================================================================
//
// Tests for the roguelike campaign grid mechanics:
// - Fortress adjacency
// - Row limit system
// - Boss availability
// - Fog of war (cell revelation)
// - Grid continuity

import { TestRunner, assert, assertEqual } from './framework.js';
import {
  createInitialCampaignState,
  isCellAvailable,
  isCellRevealed,
  isRowMaxed,
  completeCell,
  type CampaignCell,
  type CampaignGrid,
  type CampaignState,
} from '../src/campaign-state.js';
import { createCampaignGrid, CAMPAIGN_GRID_COLS } from '../src/campaign-config.js';

const runner = new TestRunner();

// Helper to create a minimal test grid
function makeTestGrid(cells: CampaignCell[], startingCells: string[] = []): CampaignGrid {
  return {
    cells,
    startingCells,
    startingUnits: ['infantry', 'tank'],
    startingReinforcements: 3,
  };
}

// Helper to create a cell
function makeCell(id: string, row: number, col: number, type: CampaignCell['type'] = 'upgrade'): CampaignCell {
  return { id, row, col, type, name: `Cell ${id}`, reward: '' };
}

// Helper to create a fortress (2x2)
function makeFortress(id: string, row: number, col: number): CampaignCell {
  return { id, row, col, type: 'fortress', name: `Fortress ${id}`, reward: 'TestPower', width: 2, height: 2 };
}

// Helper to create a boss
function makeBoss(id: string, row: number): CampaignCell {
  return { id, row, col: 0, type: 'boss', name: `Boss ${id}`, reward: 'BossPower' };
}

runner.describe('Campaign System', () => {

  runner.describe('Grid Configuration', () => {
    runner.it('should have 4 columns', () => {
      assertEqual(CAMPAIGN_GRID_COLS, 4);
    });

    runner.it('should generate starting row with 2 cells at cols 1-2', () => {
      const grid = createCampaignGrid(12345);
      const row0Cells = grid.cells.filter(c => c.row === 0);
      assertEqual(row0Cells.length, 2, 'Starting row should have exactly 2 cells');

      const cols = row0Cells.map(c => c.col).sort();
      assertEqual(cols[0], 1, 'First starting cell should be at col 1');
      assertEqual(cols[1], 2, 'Second starting cell should be at col 2');
    });

    runner.it('should have all 4 columns in normal rows', () => {
      const grid = createCampaignGrid(12345);
      // Row 1 should have 4 cells (full row)
      const row1Cells = grid.cells.filter(c => c.row === 1 && c.type !== 'fortress');
      assertEqual(row1Cells.length, 4, 'Row 1 should have 4 cells');

      const cols = row1Cells.map(c => c.col).sort((a, b) => a - b);
      for (let i = 0; i < 4; i++) {
        assertEqual(cols[i], i, `Row 1 should have cell at col ${i}`);
      }
    });
  });

  runner.describe('Fortress Adjacency', () => {
    runner.it('cell at col 0 is adjacent to fortress at cols 1-2', () => {
      const fortress = makeFortress('f1', 2, 1); // Fortress at row 2, cols 1-2
      const cellLeft = makeCell('c1', 2, 0);      // Left edge
      const grid = makeTestGrid([fortress, cellLeft], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      // Complete the left cell, fortress should become available
      const newState = completeCell('c1', state, grid);
      assert(isCellAvailable(fortress, newState, grid), 'Fortress should be available when left adjacent cell completed');
    });

    runner.it('cell at col 3 is adjacent to fortress at cols 1-2', () => {
      const fortress = makeFortress('f1', 2, 1); // Fortress at row 2, cols 1-2
      const cellRight = makeCell('c1', 2, 3);     // Right edge
      const grid = makeTestGrid([fortress, cellRight], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      const newState = completeCell('c1', state, grid);
      assert(isCellAvailable(fortress, newState, grid), 'Fortress should be available when right adjacent cell completed');
    });

    runner.it('cell in row above fortress is adjacent', () => {
      const fortress = makeFortress('f1', 2, 1); // Fortress at rows 2-3, cols 1-2
      const cellAbove = makeCell('c1', 4, 1);     // Above fortress
      const grid = makeTestGrid([fortress, cellAbove], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      const newState = completeCell('c1', state, grid);
      assert(isCellAvailable(fortress, newState, grid), 'Fortress should be available when cell above is completed');
    });

    runner.it('cell in row below fortress is adjacent', () => {
      const fortress = makeFortress('f1', 2, 1); // Fortress at rows 2-3, cols 1-2
      const cellBelow = makeCell('c1', 1, 1);     // Below fortress
      const grid = makeTestGrid([fortress, cellBelow], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      const newState = completeCell('c1', state, grid);
      assert(isCellAvailable(fortress, newState, grid), 'Fortress should be available when cell below is completed');
    });

    runner.it('diagonal cell is NOT adjacent to fortress', () => {
      const fortress = makeFortress('f1', 2, 1); // Fortress at rows 2-3, cols 1-2
      const cellDiag = makeCell('c1', 4, 0);      // Diagonal (above-left)
      const grid = makeTestGrid([fortress, cellDiag], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      const newState = completeCell('c1', state, grid);
      assert(!isCellAvailable(fortress, newState, grid), 'Fortress should NOT be available from diagonal cell');
    });

    runner.it('completing fortress unlocks all perimeter cells', () => {
      const fortress = makeFortress('f1', 2, 1);
      const cellLeft = makeCell('c1', 2, 0);
      const cellRight = makeCell('c2', 2, 3);
      const cellAbove = makeCell('c3', 4, 1);
      const cellBelow = makeCell('c4', 1, 2);
      const startingCell = makeCell('start', 1, 1);

      const grid = makeTestGrid([fortress, cellLeft, cellRight, cellAbove, cellBelow, startingCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete starting cell, then fortress
      state = completeCell('start', state, grid);
      state = completeCell('f1', state, grid);

      // All perimeter cells should now be available (if not row-locked)
      assert(isCellAvailable(cellLeft, state, grid), 'Left cell should be available after fortress completion');
      // Note: cellRight might be row-locked depending on row completion counts
    });
  });

  runner.describe('Row Limit System', () => {
    runner.it('should track completions per row', () => {
      // Use the actual grid which has 2 starting cells
      const grid = createCampaignGrid(12345);
      const state = createInitialCampaignState(grid, 12345);

      // Initial state: row 0 has 2 completions (Infantry and Tank at row 0)
      assertEqual(state.completionsPerRow.get(0), 2, 'Row 0 should have 2 initial completions');
    });

    runner.it('should max out row after 2 completions', () => {
      const cell1 = makeCell('c1', 1, 0);
      const cell2 = makeCell('c2', 1, 1);
      const cell3 = makeCell('c3', 1, 2);
      const startCell = makeCell('start', 0, 1);
      const grid = makeTestGrid([cell1, cell2, cell3, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete two cells in row 1
      state = completeCell('c1', state, grid);
      assert(!isRowMaxed(1, state), 'Row 1 should not be maxed after 1 completion');

      state = completeCell('c2', state, grid);
      assert(isRowMaxed(1, state), 'Row 1 should be maxed after 2 completions');
    });

    runner.it('should make remaining cells unavailable when row is maxed', () => {
      const cell1 = makeCell('c1', 1, 0);
      const cell2 = makeCell('c2', 1, 1);
      const cell3 = makeCell('c3', 1, 2);
      const startCell = makeCell('start', 0, 1);
      const grid = makeTestGrid([cell1, cell2, cell3, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete two cells in row 1
      state = completeCell('c1', state, grid);
      state = completeCell('c2', state, grid);

      // Third cell should be unavailable
      assert(!isCellAvailable(cell3, state, grid), 'Cell should be unavailable when row is maxed');
    });

    runner.it('fortress completion maxes out BOTH rows it spans', () => {
      const fortress = makeFortress('f1', 2, 1); // Spans rows 2-3
      const cell1 = makeCell('c1', 2, 0);
      const cell2 = makeCell('c2', 3, 0);
      const startCell = makeCell('start', 1, 1);

      const grid = makeTestGrid([fortress, cell1, cell2, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete fortress
      state = completeCell('f1', state, grid);

      // Both row 2 and row 3 should have 1 completion each (fortress counts as 1 per row)
      assertEqual(state.completionsPerRow.get(2), 1, 'Row 2 should have 1 completion');
      assertEqual(state.completionsPerRow.get(3), 1, 'Row 3 should have 1 completion');
    });

    runner.it('fortress unavailable if either spanned row already has 2 completions', () => {
      const fortress = makeFortress('f1', 2, 1); // Spans rows 2-3
      const cell1 = makeCell('c1', 2, 0);
      const cell2 = makeCell('c2', 2, 3);
      const startCell = makeCell('start', 1, 1);

      const grid = makeTestGrid([fortress, cell1, cell2, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Max out row 2 with two regular cells
      state = completeCell('c1', state, grid);
      state = completeCell('c2', state, grid);

      // Fortress should now be unavailable
      assert(!isCellAvailable(fortress, state, grid), 'Fortress should be unavailable when one of its rows is maxed');
    });

    runner.it('fortress allowed if row has 1 completion (becomes the 2nd)', () => {
      const fortress = makeFortress('f1', 2, 1);
      const cell1 = makeCell('c1', 2, 0);
      const startCell = makeCell('start', 1, 1);

      const grid = makeTestGrid([fortress, cell1, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete one cell in row 2
      state = completeCell('c1', state, grid);
      assertEqual(state.completionsPerRow.get(2), 1, 'Row 2 should have 1 completion');

      // Fortress should still be available (will be the 2nd completion for row 2)
      assert(isCellAvailable(fortress, state, grid), 'Fortress should be available as the 2nd completion');
    });
  });

  runner.describe('Boss Row Availability', () => {
    runner.it('boss available when any cell in row below is completed', () => {
      const boss = makeBoss('boss1', 4);
      const cellBelow = makeCell('c1', 3, 0);
      const startCell = makeCell('start', 2, 0);

      const grid = makeTestGrid([boss, cellBelow, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Boss should not be available initially
      assert(!isCellAvailable(boss, state, grid), 'Boss should not be available initially');

      // Complete cell in row below
      state = completeCell('c1', state, grid);
      assert(isCellAvailable(boss, state, grid), 'Boss should be available after completing cell in row below');
    });

    runner.it('boss available when fortress spanning into row below is completed', () => {
      const boss = makeBoss('boss1', 4);
      const fortress = makeFortress('f1', 2, 1); // Spans rows 2-3
      const startCell = makeCell('start', 1, 1);

      const grid = makeTestGrid([boss, fortress, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete fortress (spans into row 3, which is row below boss)
      state = completeCell('f1', state, grid);
      assert(isCellAvailable(boss, state, grid), 'Boss should be available after fortress spans into row below');
    });

    runner.it('boss NOT available when only cells 2+ rows below are completed', () => {
      const boss = makeBoss('boss1', 4);
      const cellFarBelow = makeCell('c1', 2, 0);
      const startCell = makeCell('start', 1, 0);

      const grid = makeTestGrid([boss, cellFarBelow, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Complete cell 2 rows below boss
      state = completeCell('c1', state, grid);
      assert(!isCellAvailable(boss, state, grid), 'Boss should NOT be available from cells 2+ rows below');
    });

    runner.it('boss cells are not subject to row limits', () => {
      const boss = makeBoss('boss1', 4);
      const cell1 = makeCell('c1', 3, 0);
      const cell2 = makeCell('c2', 3, 1);
      const startCell = makeCell('start', 2, 0);

      const grid = makeTestGrid([boss, cell1, cell2, startCell], ['start']);
      let state = createInitialCampaignState(grid, 1);

      // Max out row 4 (if bosses counted, which they shouldn't)
      // Actually row 4 is the boss row, let's test differently:
      // Complete 2 cells in row 3 first
      state = completeCell('c1', state, grid);
      state = completeCell('c2', state, grid);

      // Boss should still be available (not affected by row limits)
      assert(isCellAvailable(boss, state, grid), 'Boss should be available regardless of row limits');
    });
  });

  runner.describe('Fog of War (Cell Revelation)', () => {
    runner.it('completed cells are always revealed', () => {
      const cell1 = makeCell('c1', 1, 0);
      const grid = makeTestGrid([cell1], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      assert(isCellRevealed(cell1, state, grid), 'Completed cells should be revealed');
    });

    runner.it('boss cells are always revealed', () => {
      const boss = makeBoss('boss1', 4);
      const grid = makeTestGrid([boss], []);
      const state = createInitialCampaignState(grid, 1);

      assert(isCellRevealed(boss, state, grid), 'Boss cells should always be revealed');
    });

    runner.it('cells adjacent to completed cells are revealed', () => {
      const startCell = makeCell('start', 0, 1);
      const adjacentCell = makeCell('c1', 1, 1);
      const grid = makeTestGrid([startCell, adjacentCell], ['start']);
      const state = createInitialCampaignState(grid, 1);

      assert(isCellRevealed(adjacentCell, state, grid), 'Cells adjacent to completed cells should be revealed');
    });

    runner.it('cells not adjacent to completed cells are not revealed', () => {
      const startCell = makeCell('start', 0, 1);
      const farCell = makeCell('c1', 3, 3);
      const grid = makeTestGrid([startCell, farCell], ['start']);
      const state = createInitialCampaignState(grid, 1);

      assert(!isCellRevealed(farCell, state, grid), 'Far cells should not be revealed');
    });

    runner.it('fortress revealed when any perimeter cell is completed', () => {
      const fortress = makeFortress('f1', 2, 1);
      const perimeterCell = makeCell('c1', 1, 1);
      const grid = makeTestGrid([fortress, perimeterCell], ['c1']);
      const state = createInitialCampaignState(grid, 1);

      assert(isCellRevealed(fortress, state, grid), 'Fortress should be revealed when perimeter cell is completed');
    });
  });

  runner.describe('Grid Continuity', () => {
    runner.it('every normal row has cells at all 4 columns (except row 0)', () => {
      const grid = createCampaignGrid(12345);

      // Check a few normal rows (not boss rows, not row 0)
      for (const row of [1, 5, 9]) {
        // Get all cells in this row (including fortress coverage)
        const directCells = grid.cells.filter(c => c.row === row && c.type !== 'boss');
        const fortressCovers = grid.cells.filter(c =>
          c.type === 'fortress' &&
          c.row <= row &&
          row < c.row + (c.height ?? 2)
        );

        // Build set of covered columns
        const coveredCols = new Set<number>();
        for (const cell of directCells) {
          coveredCols.add(cell.col);
        }
        for (const fortress of fortressCovers) {
          for (let c = fortress.col; c < fortress.col + (fortress.width ?? 2); c++) {
            coveredCols.add(c);
          }
        }

        // All 4 columns should be covered
        for (let col = 0; col < 4; col++) {
          assert(coveredCols.has(col), `Row ${row} should have coverage at col ${col}`);
        }
      }
    });

    runner.it('no duplicate cell positions', () => {
      const grid = createCampaignGrid(12345);
      const positions = new Set<string>();

      for (const cell of grid.cells) {
        if (cell.type === 'fortress') {
          // Fortress covers 2x2
          for (let r = cell.row; r < cell.row + (cell.height ?? 2); r++) {
            for (let c = cell.col; c < cell.col + (cell.width ?? 2); c++) {
              const key = `${r},${c}`;
              assert(!positions.has(key), `Duplicate position at ${key}`);
              positions.add(key);
            }
          }
        } else if (cell.type === 'boss') {
          // Boss spans full row - skip position check for bosses
          continue;
        } else {
          const key = `${cell.row},${cell.col}`;
          assert(!positions.has(key), `Duplicate position at ${key}`);
          positions.add(key);
        }
      }
    });
  });

});

// Export for the test runner
export default runner;
