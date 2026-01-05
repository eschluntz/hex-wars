// ============================================================================
// HEX DOMINION - Campaign HTML UI
// ============================================================================

import type { CampaignCell, CampaignGrid, CampaignState } from './campaign-state.js';
import { isCellAvailable, getFortressProgress } from './campaign-state.js';

const ICONS: Record<string, string> = {
  unit: '⬡',
  upgrade: '▲',
  special: '★',
  boss: '👑',
  fortress: '🏰',
};

export interface CampaignUICallbacks {
  onCellClick: (cell: CampaignCell) => void;
  onBackClick: () => void;
}

export class CampaignUI {
  private overlay: HTMLElement;
  private gridContainer: HTMLElement;
  private heartsContainer: HTMLElement;
  private backBtn: HTMLElement;
  private callbacks: CampaignUICallbacks;

  constructor(callbacks: CampaignUICallbacks) {
    this.callbacks = callbacks;
    this.overlay = document.getElementById('campaign-overlay')!;
    this.gridContainer = document.getElementById('campaign-grid')!;
    this.heartsContainer = this.overlay.querySelector('.campaign-hearts')!;
    this.backBtn = document.getElementById('campaign-back-btn')!;

    this.backBtn.addEventListener('click', () => this.callbacks.onBackClick());
  }

  show(): void {
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }

  render(grid: CampaignGrid, state: CampaignState): void {
    this.renderHearts(state.reinforcements);
    this.renderGrid(grid, state);
  }

  private renderHearts(reinforcements: number): void {
    this.heartsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.className = `campaign-heart ${i < reinforcements ? 'filled' : 'empty'}`;
      heart.textContent = '♥';
      this.heartsContainer.appendChild(heart);
    }
  }

  private renderGrid(grid: CampaignGrid, state: CampaignState): void {
    this.gridContainer.innerHTML = '';

    // Group cells by row
    const rowMap = new Map<number, CampaignCell[]>();
    const fortresses: CampaignCell[] = [];
    const bosses: CampaignCell[] = [];

    for (const cell of grid.cells) {
      if (cell.type === 'fortress') {
        fortresses.push(cell);
      } else if (cell.type === 'boss') {
        bosses.push(cell);
      } else {
        const row = cell.row;
        if (!rowMap.has(row)) rowMap.set(row, []);
        rowMap.get(row)!.push(cell);
      }
    }

    // Get max row number
    const maxRow = Math.max(...grid.cells.map(c => c.row));

    // Render rows from top to bottom (highest row number first)
    for (let row = maxRow; row >= 0; row--) {
      // Check if this row has a boss
      const boss = bosses.find(b => b.row === row);
      if (boss) {
        this.renderBossRow(boss, state, grid);
        continue;
      }

      // Check if this is a fortress row (rows where fortress spans)
      const fortress = fortresses.find(f => f.row === row || f.row + 1 === row);
      if (fortress && fortress.row + 1 === row) {
        // This is the top row of a fortress block - render the tall row
        this.renderFortressBlock(fortress, row, rowMap, state, grid);
        continue;
      }
      if (fortress && fortress.row === row) {
        // Bottom row of fortress - already rendered, skip
        continue;
      }

      // Normal row
      const cells = rowMap.get(row) ?? [];
      if (cells.length > 0) {
        this.renderNormalRow(cells, state, grid);
      }
    }
  }

  private renderNormalRow(cells: CampaignCell[], state: CampaignState, grid: CampaignGrid): void {
    const rowEl = document.createElement('div');
    rowEl.className = 'campaign-row';

    // Sort cells by column
    cells.sort((a, b) => a.col - b.col);

    // Fill in all 6 columns
    for (let col = 0; col < 6; col++) {
      const cell = cells.find(c => c.col === col);
      if (cell) {
        rowEl.appendChild(this.createCellElement(cell, state, grid));
      } else {
        // Empty placeholder
        const placeholder = document.createElement('div');
        rowEl.appendChild(placeholder);
      }
    }

    this.gridContainer.appendChild(rowEl);
  }

  private renderBossRow(boss: CampaignCell, state: CampaignState, grid: CampaignGrid): void {
    const rowEl = document.createElement('div');
    rowEl.className = 'campaign-row boss-row';

    const isCompleted = state.completedCells.has(boss.id);
    const isAvailable = !isCompleted && isCellAvailable(boss, state, grid);

    const bossEl = document.createElement('div');
    bossEl.className = `campaign-boss-cell ${isCompleted ? 'completed' : isAvailable ? 'available' : 'locked'}`;
    bossEl.innerHTML = `
      <div class="boss-tag">Boss Battle</div>
      <span class="boss-icon">${ICONS.boss}</span>
      <div class="boss-info">
        <span class="boss-name">${boss.name}</span>
        <span class="boss-reward">🎁 ${boss.reward || 'Victory'}</span>
      </div>
    `;

    if (isAvailable) {
      bossEl.addEventListener('click', () => this.callbacks.onCellClick(boss));
    }

    rowEl.appendChild(bossEl);
    this.gridContainer.appendChild(rowEl);
  }

  private renderFortressBlock(
    fortress: CampaignCell,
    topRow: number,
    rowMap: Map<number, CampaignCell[]>,
    state: CampaignState,
    grid: CampaignGrid
  ): void {
    const rowEl = document.createElement('div');
    rowEl.className = 'campaign-row tall-row';
    rowEl.style.display = 'grid';
    rowEl.style.gridTemplateColumns = 'repeat(6, var(--cell-size))';
    rowEl.style.gridTemplateRows = 'repeat(2, var(--cell-size))';
    rowEl.style.gap = 'var(--gap)';
    rowEl.style.height = 'auto';

    const bottomRow = fortress.row;

    // Get cells from both rows
    const topCells = rowMap.get(topRow) ?? [];
    const bottomCells = rowMap.get(bottomRow) ?? [];

    // Top row cells (cols 0, 1, 4, 5)
    for (const cell of topCells) {
      const cellEl = this.createCellElement(cell, state, grid);
      cellEl.style.gridColumn = String(cell.col + 1);
      cellEl.style.gridRow = '1';
      rowEl.appendChild(cellEl);
    }

    // Bottom row cells (cols 0, 1, 4, 5)
    for (const cell of bottomCells) {
      const cellEl = this.createCellElement(cell, state, grid);
      cellEl.style.gridColumn = String(cell.col + 1);
      cellEl.style.gridRow = '2';
      rowEl.appendChild(cellEl);
    }

    // Fortress (spans cols 3-4, rows 1-2)
    const fortressEl = this.createFortressElement(fortress, state, grid);
    fortressEl.style.gridColumn = '3 / span 2';
    fortressEl.style.gridRow = '1 / span 2';
    rowEl.appendChild(fortressEl);

    this.gridContainer.appendChild(rowEl);
  }

  private createCellElement(cell: CampaignCell, state: CampaignState, grid: CampaignGrid): HTMLElement {
    const isCompleted = state.completedCells.has(cell.id);
    const isAvailable = !isCompleted && isCellAvailable(cell, state, grid);

    const cellEl = document.createElement('div');
    cellEl.className = `campaign-cell ${cell.type} ${isCompleted ? 'completed' : isAvailable ? 'available' : 'locked'}`;
    cellEl.innerHTML = `
      <span class="cell-icon">${ICONS[cell.type]}</span>
      <span class="cell-label">${cell.name}</span>
    `;

    if (isAvailable) {
      cellEl.addEventListener('click', () => this.callbacks.onCellClick(cell));
    }

    return cellEl;
  }

  private createFortressElement(fortress: CampaignCell, state: CampaignState, grid: CampaignGrid): HTMLElement {
    const isCompleted = state.completedCells.has(fortress.id);
    const isAvailable = !isCompleted && isCellAvailable(fortress, state, grid);
    const progress = getFortressProgress(fortress, state, grid);

    const fortressEl = document.createElement('div');
    fortressEl.className = `campaign-fortress-cell ${isCompleted ? 'completed' : isAvailable ? 'available' : 'locked'}`;

    const reqText = isCompleted
      ? '✓ Conquered'
      : `Surround: <span class="${progress.completed >= progress.needed ? 'filled' : ''}">${progress.completed}</span>/${progress.needed}`;

    fortressEl.innerHTML = `
      <div class="fortress-tag">Fortress</div>
      <span class="fortress-icon">${ICONS.fortress}</span>
      <span class="fortress-name">${fortress.name}</span>
      <span class="fortress-reward">🎁 ${fortress.reward || 'Reward'}</span>
      <span class="fortress-req">${reqText}</span>
    `;

    if (isAvailable) {
      fortressEl.addEventListener('click', () => this.callbacks.onCellClick(fortress));
    }

    return fortressEl;
  }
}
