// ============================================================================
// HEX DOMINION - Battle Info Modal
// ============================================================================

import type { CampaignCell } from './campaign-state.js';
import { getCampaignCellPreset, getCampaignBattleSeed } from './campaign-state.js';
import { POWERS, STACKING_UPGRADES, REWARD_TO_UPGRADE, REWARD_TO_POWER } from './upgrades.js';
import { UNIT_TYPES, DEFAULT_UNLOCKED_UNITS } from './unit-templates.js';
import { presetToMapConfig, MAP_FLAVOR_TEXT } from './map-presets.js';
import { GameMap } from './game-map.js';
import { HexUtil } from './core.js';
import { getUnitTexture } from './textures.js';

const ICONS: Record<string, string> = {
  unit: '⬡',
  upgrade: '▲',
  special: '★',
  boss: '👑',
  fortress: '🏰',
};

export class BattleInfoModal {
  private element: HTMLElement;
  private onAttackCallback: ((cell: CampaignCell) => void) | null = null;
  private currentCell: CampaignCell | null = null;

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
        this.hide();
      }
    });
  }

  show(cell: CampaignCell, campaignSeed: number, onAttack: (cell: CampaignCell) => void): void {
    this.currentCell = cell;
    this.onAttackCallback = onAttack;

    const icon = ICONS[cell.type];
    const reward = this.formatRewardDescription(cell);
    const enemyHtml = this.formatEnemyInfo();
    const mapPreview = this.renderMapPreview(cell, campaignSeed);
    const preset = getCampaignCellPreset(cell, campaignSeed);
    const flavorText = this.getFlavorText(preset.name.toLowerCase(), cell.id, campaignSeed);

    // For unit cells, we'll add the unit sprite after building the HTML
    const unitIconPlaceholder = cell.type === 'unit' ? '<div id="unit-icon-container"></div>' : '';

    this.element.innerHTML = `
      <div class="battle-modal-content">
        <div class="battle-modal-header">
          <div class="battle-modal-icon ${cell.type}">${icon}</div>
          ${unitIconPlaceholder}
          <div class="battle-modal-title">
            <h2>${cell.name}</h2>
            <span class="cell-type">${this.getCellTypeLabel(cell.type)}</span>
          </div>
        </div>

        <div class="battle-modal-section">
          <h3>Enemy Forces</h3>
          <div class="battle-modal-enemy">${enemyHtml}</div>
        </div>

        <div class="battle-modal-section">
          <h3>Battlefield Preview</h3>
          <div class="battle-modal-preview" id="battle-modal-preview-container"></div>
          <div class="battle-modal-flavor">${flavorText}</div>
        </div>

        <div class="battle-modal-section">
          <h3>Victory Reward</h3>
          <div class="battle-modal-reward">${reward.html}</div>
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

    // Insert enemy units icons
    const enemyUnitsContainer = this.element.querySelector('#enemy-units-icons');
    if (enemyUnitsContainer) {
      this.fillUnitIconRow(enemyUnitsContainer as HTMLElement, DEFAULT_UNLOCKED_UNITS, 'enemy');
    }

    // Insert reward units icons if there's a unit filter
    if (reward.unitFilter) {
      const rewardUnitsContainer = this.element.querySelector('#reward-units-icons');
      if (rewardUnitsContainer) {
        this.fillUnitIconRow(rewardUnitsContainer as HTMLElement, reward.unitFilter, 'player');
      }
    }

    // Wire up button handlers
    const cancelBtn = this.element.querySelector('.battle-modal-btn.cancel');
    const attackBtn = this.element.querySelector('.battle-modal-btn.attack');

    cancelBtn?.addEventListener('click', () => this.hide());
    attackBtn?.addEventListener('click', () => {
      const callback = this.onAttackCallback;
      const targetCell = cell;
      this.hide();
      callback?.(targetCell);
    });

    // Close on backdrop click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.hide();
      }
    });

    this.element.style.display = 'flex';
  }

  hide(): void {
    this.element.style.display = 'none';
    this.currentCell = null;
    this.onAttackCallback = null;
  }

  private getCellTypeLabel(type: string): string {
    switch (type) {
      case 'unit': return 'Unit Unlock';
      case 'upgrade': return 'Upgrade';
      case 'special': return 'Special Power';
      case 'boss': return 'Boss Battle';
      case 'fortress': return 'Fortress Assault';
      default: return type;
    }
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

  private formatEnemyInfo(): string {
    // Current state: Enemy has all units, no upgrades/powers
    return `
      <div><span class="enemy-label">Available units:</span></div>
      <div id="enemy-units-icons" class="unit-icons-row"></div>
      <div><span class="enemy-label">Upgrades:</span> <span class="enemy-value">None</span></div>
      <div><span class="enemy-label">Powers:</span> <span class="enemy-value">None</span></div>
    `;
  }

  private renderMapPreview(cell: CampaignCell, campaignSeed: number): HTMLCanvasElement {
    const preset = getCampaignCellPreset(cell, campaignSeed);
    const seed = getCampaignBattleSeed(cell.id, campaignSeed);
    const config = presetToMapConfig(preset, seed);
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
