// ============================================================================
// HEX DOMINION - Battle Info Modal
// ============================================================================

import type { CampaignCell, CampaignGrid, CampaignState } from './campaign-state.js';
import { getCampaignCellPreset, getCampaignBattleSeed } from './campaign-state.js';
import { POWERS, STACKING_UPGRADES, REWARD_TO_UPGRADE, REWARD_TO_POWER } from './upgrades.js';
import { UNIT_TYPES } from './unit-templates.js';
import { presetToMapConfig, MAP_FLAVOR_TEXT, MAP_NAMES } from './map-presets.js';
import { GameMap } from './game-map.js';
import { HexUtil } from './core.js';
import { getUnitTexture } from './textures.js';
import { getEnemyBattleConfig, type EnemyBattleConfig } from './enemy-difficulty.js';
import { audioManager } from './audio-manager.js';

const ICONS: Record<string, string> = {
  unit: '⬡',
  upgrade: '▲',
  special: '★',
  boss: '👑',
  fortress: '🏰',
};

/**
 * Get a deterministic map name based on preset, cell ID, and campaign seed.
 * Exported for use by other modules (e.g., game-over-ui).
 */
export function getMapName(presetName: string, cellId: string, campaignSeed: number): string {
  const names = MAP_NAMES[presetName]!;
  // Deterministic selection based on cell id and campaign seed
  // Use a different offset from flavor text to get independent selection
  let hash = campaignSeed + 7777;
  for (let i = 0; i < cellId.length; i++) {
    hash = ((hash << 5) - hash + cellId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % names.length;
  return names[index]!;
}

export class BattleInfoModal {
  private element: HTMLElement;
  private onAttackCallback: ((cell: CampaignCell) => void) | null = null;
  private currentCell: CampaignCell | null = null;
  private currentEnemyConfig: EnemyBattleConfig | null = null;
  private currentCampaignState: CampaignState | null = null;
  private infoBox: HTMLElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'campaign-battle-modal';
    this.element.style.display = 'none';
    document.body.appendChild(this.element);

    // Handle Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.element.style.display === 'flex') {
        e.stopPropagation();
        e.preventDefault();
        audioManager.playSfx('cancel');
        this.hide();
      }
    });
  }

  show(
    cell: CampaignCell,
    campaignSeed: number,
    campaignState: CampaignState,
    campaignGrid: CampaignGrid,
    onAttack: (cell: CampaignCell) => void
  ): void {
    this.currentCell = cell;
    this.onAttackCallback = onAttack;
    this.currentCampaignState = campaignState;

    // Compute enemy config for intel display
    this.currentEnemyConfig = getEnemyBattleConfig(cell, campaignState, campaignGrid);

    const icon = ICONS[cell.type];
    const reward = this.formatRewardDescription(cell);
    const playerHtml = this.formatPlayerInfo(campaignState);
    const enemyHtml = this.formatEnemyInfo(cell.row);
    const mapPreview = this.renderMapPreview(cell, campaignSeed, this.currentEnemyConfig);
    const preset = getCampaignCellPreset(cell, campaignSeed);
    const presetKey = preset.name.toLowerCase();
    const mapName = getMapName(presetKey, cell.id, campaignSeed);
    const flavorText = this.getFlavorText(presetKey, cell.id, campaignSeed);

    // For unit cells, we'll add the unit sprite after building the HTML
    const unitIconPlaceholder = cell.type === 'unit' ? '<div id="unit-icon-container"></div>' : '';

    this.element.innerHTML = `
      <div class="battle-modal-content">
        <div class="battle-modal-header">
          <div class="battle-modal-icon ${cell.type}">${icon}</div>
          ${unitIconPlaceholder}
          <div class="battle-modal-title">
            <h2>${mapName}</h2>
            <span class="map-type">Battlefield type: ${preset.name}</span>
          </div>
        </div>

        <div class="battle-modal-section">
          <div class="battle-modal-preview" id="battle-modal-preview-container"></div>
          <div class="battle-modal-flavor">${flavorText}</div>
        </div>

        <div class="battle-modal-section">
          <h3>Victory Reward</h3>
          <div class="battle-modal-reward ${cell.type}">${reward.html}</div>
        </div>

        <div class="battle-modal-forces">
          <div class="battle-modal-section forces-section">
            <h3>Our Forces</h3>
            <div class="battle-modal-player">${playerHtml}</div>
          </div>

          <div class="battle-modal-section forces-section">
            <h3>Enemy Forces</h3>
            <div class="battle-modal-enemy">${enemyHtml}</div>
          </div>
        </div>

        <div class="battle-modal-info-box" id="battle-info-box">
          <span class="info-placeholder">Hover over powers or upgrades for details</span>
        </div>

        <div class="battle-modal-buttons">
          <button class="battle-modal-btn attack ${cell.type}">Attack!</button>
          <button class="battle-modal-btn cancel">Cancel</button>
        </div>
      </div>
    `;

    // Insert the map preview canvas
    const previewContainer = this.element.querySelector('#battle-modal-preview-container');
    if (previewContainer) {
      previewContainer.appendChild(mapPreview);
    }

    // Insert unit icon for unit cells
    if (cell.type === 'unit') {
      const unitIconContainer = this.element.querySelector('#unit-icon-container');
      if (unitIconContainer) {
        const unitIcon = this.renderUnitIcon(cell.reward);
        if (unitIcon) {
          unitIconContainer.appendChild(unitIcon);
        }
      }
    }

    // Insert player units icons
    const playerUnitsContainer = this.element.querySelector('#player-units-icons');
    if (playerUnitsContainer && campaignState) {
      this.fillUnitIconRow(playerUnitsContainer as HTMLElement, Array.from(campaignState.unlockedUnits), 'player');
    }

    // Insert enemy units icons (uses computed enemy config)
    const enemyUnitsContainer = this.element.querySelector('#enemy-units-icons');
    if (enemyUnitsContainer && this.currentEnemyConfig) {
      this.fillUnitIconRow(enemyUnitsContainer as HTMLElement, this.currentEnemyConfig.unlockedUnits, 'enemy');
    }

    // Insert reward units icons if there's a unit filter
    if (reward.unitFilter) {
      const rewardUnitsContainer = this.element.querySelector('#reward-units-icons');
      if (rewardUnitsContainer) {
        this.fillUnitIconRow(rewardUnitsContainer as HTMLElement, reward.unitFilter, 'player');
      }
    }

    // Store info box reference and wire up hover events
    this.infoBox = this.element.querySelector('#battle-info-box');
    this.wireUpHoverEvents();

    // Wire up button handlers
    const cancelBtn = this.element.querySelector('.battle-modal-btn.cancel');
    const attackBtn = this.element.querySelector('.battle-modal-btn.attack');

    cancelBtn?.addEventListener('click', () => {
      audioManager.playSfx('cancel');
      this.hide();
    });
    attackBtn?.addEventListener('click', () => {
      audioManager.playSfx('confirm');
      const callback = this.onAttackCallback;
      const targetCell = cell;
      this.hide();
      callback?.(targetCell);
    });

    // Close on backdrop click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        audioManager.playSfx('cancel');
        this.hide();
      }
    });

    this.element.style.display = 'flex';
  }

  hide(): void {
    this.element.style.display = 'none';
    this.currentCell = null;
    this.onAttackCallback = null;
    this.currentEnemyConfig = null;
    this.currentCampaignState = null;
    this.infoBox = null;
  }

  private setInfoText(text: string): void {
    if (this.infoBox) {
      this.infoBox.innerHTML = text;
      this.infoBox.classList.add('has-content');
    }
  }

  private clearInfoText(): void {
    if (this.infoBox) {
      this.infoBox.innerHTML = '<span class="info-placeholder">Hover over powers or upgrades for details</span>';
      this.infoBox.classList.remove('has-content');
    }
  }

  private wireUpHoverEvents(): void {
    // Wire up hover for all power and upgrade elements
    const powerElements = this.element.querySelectorAll('.power-slot.filled[data-power-id]');
    powerElements.forEach(el => {
      const powerId = el.getAttribute('data-power-id');
      if (powerId) {
        const power = POWERS[powerId];
        if (power) {
          el.addEventListener('mouseenter', () => this.setInfoText(`<strong>${power.name}</strong>: ${power.description}`));
          el.addEventListener('mouseleave', () => this.clearInfoText());
        }
      }
    });

    const upgradeElements = this.element.querySelectorAll('.upgrade-item[data-upgrade-id]');
    upgradeElements.forEach(el => {
      const upgradeId = el.getAttribute('data-upgrade-id');
      if (upgradeId) {
        const upgrade = STACKING_UPGRADES[upgradeId];
        if (upgrade) {
          el.addEventListener('mouseenter', () => this.setInfoText(`<strong>${upgrade.name}</strong>: ${upgrade.description}`));
          el.addEventListener('mouseleave', () => this.clearInfoText());
        }
      }
    });
  }

  private getFlavorText(presetName: string, cellId: string, campaignSeed: number): string {
    const texts = MAP_FLAVOR_TEXT[presetName]!;
    // Deterministic selection based on cell id and campaign seed
    let hash = campaignSeed;
    for (let i = 0; i < cellId.length; i++) {
      hash = ((hash << 5) - hash + cellId.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % texts.length;
    return texts[index]!;
  }

  private formatRewardDescription(cell: CampaignCell): { html: string; unitFilter?: string[] } {
    switch (cell.type) {
      case 'unit': {
        const unitId = cell.reward;
        const unit = UNIT_TYPES[unitId];
        if (unit) {
          return { html: `Unlock <strong>${unit.name}</strong> - $${unit.cost.toLocaleString()}` };
        }
        return { html: `Unlock new unit` };
      }

      case 'upgrade': {
        const upgradeId = REWARD_TO_UPGRADE[cell.name];
        const upgrade = upgradeId ? STACKING_UPGRADES[upgradeId] : null;
        if (upgrade) {
          let html = `<strong>${upgrade.name}</strong>: ${upgrade.description}`;
          if (upgrade.unitFilter) {
            html += `<div class="applies-to">Applies to:</div><div id="reward-units-icons" class="unit-icons-row"></div>`;
            return { html, unitFilter: upgrade.unitFilter };
          }
          return { html };
        }
        return { html: cell.name };
      }

      case 'special': {
        const powerId = REWARD_TO_POWER[cell.name];
        const power = powerId ? POWERS[powerId] : null;
        if (power) {
          let html = `<strong>${power.name}</strong>: ${power.description}`;
          if ('unitFilter' in power.effect && power.effect.unitFilter) {
            html += `<div class="applies-to">Applies to:</div><div id="reward-units-icons" class="unit-icons-row"></div>`;
            return { html, unitFilter: power.effect.unitFilter };
          }
          return { html };
        }
        return { html: cell.name };
      }

      case 'boss': {
        const powerId = REWARD_TO_POWER[cell.reward];
        const power = powerId ? POWERS[powerId] : null;
        let html = '<strong>+1 Power Slot</strong>';
        if (power) {
          html += `<br><strong>${power.name}</strong>: ${power.description}`;
          if ('unitFilter' in power.effect && power.effect.unitFilter) {
            html += `<div class="applies-to">Applies to:</div><div id="reward-units-icons" class="unit-icons-row"></div>`;
            return { html, unitFilter: power.effect.unitFilter };
          }
        }
        return { html };
      }

      case 'fortress': {
        const powerId = REWARD_TO_POWER[cell.reward];
        const power = powerId ? POWERS[powerId] : null;
        if (power) {
          let html = `<strong>${power.name}</strong>: ${power.description}`;
          if ('unitFilter' in power.effect && power.effect.unitFilter) {
            html += `<div class="applies-to">Applies to:</div><div id="reward-units-icons" class="unit-icons-row"></div>`;
            return { html, unitFilter: power.effect.unitFilter };
          }
          return { html };
        }
        return { html: cell.reward };
      }

      default:
        return { html: cell.reward || cell.name };
    }
  }

  private formatUpgradesHtml(upgrades: string[]): string {
    if (upgrades.length === 0) {
      return '<span class="force-value">None</span>';
    }
    return '<div class="force-items-row">' +
      upgrades
        .map(id => {
          const name = STACKING_UPGRADES[id]?.name ?? id;
          return `<div class="upgrade-item" data-upgrade-id="${id}">${name}</div>`;
        })
        .join('') +
      '</div>';
  }

  private formatPowersHtml(powers: string[], slots: number): string {
    if (powers.length === 0) {
      return '<span class="force-value">None</span>';
    }
    const slotsInfo = `<span class="force-slots">(${powers.length}/${slots} slots)</span>`;
    return '<div class="force-items-row">' +
      powers
        .map(id => {
          const name = POWERS[id]?.name ?? id;
          return `<div class="power-slot filled" data-power-id="${id}">${name}</div>`;
        })
        .join('') +
      slotsInfo +
      '</div>';
  }

  private formatPlayerInfo(state: CampaignState): string {
    const upgradesHtml = this.formatUpgradesHtml(state.acquiredUpgrades);
    const powersHtml = this.formatPowersHtml(state.activePowers, state.powerSlots);

    return `
      <div><span class="force-label">Available units:</span></div>
      <div id="player-units-icons" class="unit-icons-row"></div>
      <div><span class="force-label">Upgrades:</span> ${upgradesHtml}</div>
      <div><span class="force-label">Powers:</span> ${powersHtml}</div>
    `;
  }

  private formatEnemyInfo(row: number): string {
    const config = this.currentEnemyConfig;

    const upgradesHtml = this.formatUpgradesHtml(config?.activeUpgrades ?? []);
    const powersHtml = this.formatPowersHtml(config?.activePowers ?? [], config?.powerSlots ?? 0);

    // Calculate row bonus
    const rowBonus = row * 2;

    // Cluster info for fortress/boss
    let clusterInfo = '';
    if (config && (config.enemyClusters > 1 || config.playerClusters > 1)) {
      clusterInfo = `<div><span class="force-label">Clusters:</span> <span class="force-value">Player: ${config.playerClusters}, Enemy: ${config.enemyClusters}</span></div>`;
    }

    return `
      <div><span class="force-label">Available units:</span></div>
      <div id="enemy-units-icons" class="unit-icons-row"></div>
      <div><span class="force-label">Upgrades:</span> ${upgradesHtml}</div>
      <div><span class="force-label">Powers:</span> ${powersHtml}</div>
      <div><span class="force-label">Row Bonus:</span> <span class="force-value">+${rowBonus}% AV/DV</span></div>
      ${clusterInfo}
    `;
  }

  private renderMapPreview(cell: CampaignCell, campaignSeed: number, enemyConfig?: EnemyBattleConfig): HTMLCanvasElement {
    const preset = getCampaignCellPreset(cell, campaignSeed);
    const seed = getCampaignBattleSeed(cell.id, campaignSeed);
    // Pass cluster counts if available
    const config = presetToMapConfig(preset, seed, enemyConfig?.playerClusters, enemyConfig?.enemyClusters);
    const map = new GameMap(config);

    // Small hex size for preview
    const hexSize = 4;
    const canvas = document.createElement('canvas');
    canvas.width = config.width * hexSize * 1.8 + hexSize * 2;
    canvas.height = config.height * hexSize * 1.5 + hexSize * 2;

    const ctx = canvas.getContext('2d')!;

    // Dark background
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const colors: Record<string, string> = {
      grass: '#4a7c23',
      water: '#2a5f9e',
      woods: '#2d5a1e',
      mountain: '#6b6b6b',
      road: '#a89078',
      building: '#8d6e63',
    };

    // Offset to center the map in canvas
    const offsetX = hexSize * 2;
    const offsetY = hexSize * 2;

    for (const tile of map.getAllTiles()) {
      const pos = HexUtil.axialToPixel(tile.q, tile.r, hexSize);
      ctx.fillStyle = colors[tile.type] ?? '#888888';
      ctx.beginPath();
      ctx.arc(pos.x + offsetX, pos.y + offsetY, hexSize * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mark buildings with team color
    for (const building of map.getAllBuildings()) {
      const pos = HexUtil.axialToPixel(building.q, building.r, hexSize);
      if (building.owner === 'player') {
        ctx.fillStyle = '#4488ff';
      } else if (building.owner === 'enemy') {
        ctx.fillStyle = '#ff4444';
      } else {
        ctx.fillStyle = '#888888';
      }
      ctx.beginPath();
      ctx.arc(pos.x + offsetX, pos.y + offsetY, hexSize * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  }

  private renderUnitIcon(unitId: string, team: string = 'player', size: number = 60): HTMLCanvasElement | null {
    const texture = getUnitTexture(unitId, team, false);
    if (!texture) return null;

    const frameWidth = 16;
    const frameHeight = 16;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; // Keep pixel art crisp

    // Draw first frame of sprite, scaled to fill the canvas
    ctx.drawImage(
      texture,
      0, 0, frameWidth, frameHeight,  // Source: first frame
      0, 0, size, size                 // Dest: full canvas
    );

    return canvas;
  }

  private fillUnitIconRow(container: HTMLElement, unitIds: string[], team: string): void {
    const iconSize = 28;
    for (const unitId of unitIds) {
      const icon = this.renderUnitIcon(unitId, team, iconSize);
      if (icon) {
        icon.title = UNIT_TYPES[unitId]?.name ?? unitId;
        container.appendChild(icon);
      }
    }
  }
}
