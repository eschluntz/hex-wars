// ============================================================================
// HEX DOMINION - Campaign HTML UI
// ============================================================================

import type { CampaignCell, CampaignGrid, CampaignState } from './campaign-state.js';
import { isCellAvailable } from './campaign-state.js';
import { POWERS, STACKING_UPGRADES } from './upgrades.js';

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
  onEquipPower?: (powerId: string) => void;
  onUnequipPower?: (powerId: string) => void;
}

export class CampaignUI {
  private overlay: HTMLElement;
  private gridContainer: HTMLElement;
  private heartsContainer: HTMLElement;
  private backBtn: HTMLElement;
  private powersPanel: HTMLElement | null = null;
  private upgradesPanel: HTMLElement | null = null;
  private infoBox: HTMLElement | null = null;
  private callbacks: CampaignUICallbacks;

  constructor(callbacks: CampaignUICallbacks) {
    this.callbacks = callbacks;
    this.overlay = document.getElementById('campaign-overlay')!;
    this.gridContainer = document.getElementById('campaign-grid')!;
    this.heartsContainer = this.overlay.querySelector('.campaign-hearts')!;
    this.backBtn = document.getElementById('campaign-back-btn')!;

    this.backBtn.addEventListener('click', () => this.callbacks.onBackClick());

    // Create panels (will be filled on render)
    this.createPowersPanelContainer();
    this.createUpgradesPanelContainer();
    this.createInfoBox();
  }

  private createPowersPanelContainer(): void {
    // Insert after the grid container
    const container = document.querySelector('.campaign-grid-container');
    if (!container) return;

    this.powersPanel = document.createElement('div');
    this.powersPanel.className = 'campaign-powers-panel';
    container.parentElement?.insertBefore(this.powersPanel, container.nextSibling);
  }

  private createUpgradesPanelContainer(): void {
    // Insert after powers panel
    if (!this.powersPanel) return;

    this.upgradesPanel = document.createElement('div');
    this.upgradesPanel.className = 'campaign-upgrades-panel';
    this.powersPanel.parentElement?.insertBefore(this.upgradesPanel, this.powersPanel.nextSibling);
  }

  private createInfoBox(): void {
    // Will be added inside powers panel during render
    this.infoBox = document.createElement('div');
    this.infoBox.className = 'powers-info-box';
    this.infoBox.innerHTML = '<span class="info-text info-placeholder">Hover for details</span>';
  }

  private setInfoText(text: string): void {
    if (this.infoBox) {
      this.infoBox.innerHTML = `<span class="info-text">${text}</span>`;
    }
  }

  private clearInfoText(): void {
    if (this.infoBox) {
      this.infoBox.innerHTML = '<span class="info-text info-placeholder">Hover for details</span>';
    }
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
    this.renderPowersPanel(state);
    this.renderUpgradesPanel(state);
  }

  private renderPowersPanel(state: CampaignState): void {
    if (!this.powersPanel) return;

    this.powersPanel.innerHTML = '';

    // Header with slot count
    const header = document.createElement('div');
    header.className = 'powers-header';
    header.innerHTML = `
      <span class="powers-title">Powers</span>
      <span class="powers-slots">Slots: ${state.activePowers.length}/${state.powerSlots}</span>
    `;
    this.powersPanel.appendChild(header);

    // Active powers row
    const activeRow = document.createElement('div');
    activeRow.className = 'powers-active-row';

    for (let i = 0; i < state.powerSlots; i++) {
      const slot = document.createElement('div');
      const powerId = state.activePowers[i];

      if (powerId) {
        const power = POWERS[powerId]!;
        slot.className = 'power-slot filled';
        slot.innerHTML = `
          <span class="power-name">${power.name}</span>
          <span class="power-unequip">×</span>
        `;
        slot.addEventListener('mouseenter', () => this.setInfoText(`<strong>${power.name}</strong>: ${power.description}`));
        slot.addEventListener('mouseleave', () => this.clearInfoText());
        slot.addEventListener('click', () => {
          this.callbacks.onUnequipPower?.(powerId);
        });
      } else {
        slot.className = 'power-slot empty';
        slot.innerHTML = '<span class="power-empty">Empty</span>';
      }
      activeRow.appendChild(slot);
    }
    this.powersPanel.appendChild(activeRow);

    // Unlocked powers (not yet equipped)
    const unequippedPowers = state.unlockedPowers.filter(
      id => !state.activePowers.includes(id)
    );

    if (unequippedPowers.length > 0) {
      const collectionLabel = document.createElement('div');
      collectionLabel.className = 'powers-collection-label';
      collectionLabel.textContent = 'Available:';
      this.powersPanel.appendChild(collectionLabel);
      const collection = document.createElement('div');
      collection.className = 'powers-collection';

      for (const powerId of unequippedPowers) {
        const power = POWERS[powerId]!;
        const card = document.createElement('div');
        card.className = 'power-card';
        card.innerHTML = `<span class="power-name">${power.name}</span>`;

        card.addEventListener('mouseenter', () => this.setInfoText(`<strong>${power.name}</strong>: ${power.description}`));
        card.addEventListener('mouseleave', () => this.clearInfoText());

        // Can equip if there's room
        if (state.activePowers.length < state.powerSlots) {
          card.classList.add('can-equip');
          card.addEventListener('click', () => {
            this.callbacks.onEquipPower?.(powerId);
          });
        }

        collection.appendChild(card);
      }
      this.powersPanel.appendChild(collection);
    }

    // Add info box inside powers panel
    if (this.infoBox) {
      this.clearInfoText();
      this.powersPanel.appendChild(this.infoBox);
    }
  }

  private renderUpgradesPanel(state: CampaignState): void {
    if (!this.upgradesPanel) return;

    this.upgradesPanel.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'upgrades-header';
    header.innerHTML = `
      <span class="upgrades-title">Upgrades</span>
      <span class="upgrades-count">${state.acquiredUpgrades.length} acquired</span>
    `;
    this.upgradesPanel.appendChild(header);

    // Upgrades list
    const list = document.createElement('div');
    list.className = 'upgrades-list';

    if (state.acquiredUpgrades.length === 0) {
      const emptyText = document.createElement('div');
      emptyText.className = 'upgrades-empty';
      emptyText.textContent = 'No upgrades yet';
      list.appendChild(emptyText);
    } else {
      for (const upgradeId of state.acquiredUpgrades) {
        const upgrade = STACKING_UPGRADES[upgradeId];
        if (!upgrade) continue;

        const item = document.createElement('div');
        item.className = 'upgrade-item';
        item.innerHTML = `<span class="upgrade-name">${upgrade.name}</span>`;
        item.addEventListener('mouseenter', () => this.setInfoText(`<strong>${upgrade.name}</strong>: ${upgrade.description}`));
        item.addEventListener('mouseleave', () => this.clearInfoText());
        list.appendChild(item);
      }
    }

    this.upgradesPanel.appendChild(list);
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
        <span class="boss-reward">★ ${boss.reward}</span>
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

    // Fortress (spans 2 cols starting at fortress.col, rows 1-2)
    const fortressEl = this.createFortressElement(fortress, state, grid);
    fortressEl.style.gridColumn = `${fortress.col + 1} / span 2`;  // CSS grid is 1-indexed
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

    const fortressEl = document.createElement('div');
    fortressEl.className = `campaign-fortress-cell ${isCompleted ? 'completed' : isAvailable ? 'available' : 'locked'}`;

    fortressEl.innerHTML = `
      <div class="fortress-tag">Fortress</div>
      <span class="fortress-icon">${ICONS.fortress}</span>
      <span class="fortress-name">${fortress.name}</span>
      <span class="fortress-reward">★ ${fortress.reward}</span>
    `;

    if (isAvailable) {
      fortressEl.addEventListener('click', () => this.callbacks.onCellClick(fortress));
    }

    return fortressEl;
  }
}
