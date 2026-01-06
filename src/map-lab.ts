// ============================================================================
// HEX DOMINION - Map Lab Controller
// ============================================================================

import { MAP_PRESETS, getPresetNames, presetToMapConfig } from './map-presets.js';
import { validateMap, getMapStats, type ValidationResult, type MapStats } from './map-validation.js';
import { GameMap } from './game-map.js';
import { type MapConfig } from './config.js';

export interface MapLabState {
  preset: string;
  seed: number;
  validation: ValidationResult | null;
  stats: MapStats | null;
}

export interface MapLabCallbacks {
  onGenerateMap: (config: MapConfig) => void;
}

export class MapLabController {
  private state: MapLabState;
  private callbacks: MapLabCallbacks;
  private overlay: HTMLElement | null = null;

  constructor(callbacks: MapLabCallbacks) {
    this.callbacks = callbacks;
    this.state = {
      preset: 'standard',
      seed: Math.floor(Math.random() * 1000000),
      validation: null,
      stats: null
    };
  }

  /**
   * Check if Map Lab mode is enabled via URL param
   */
  static isEnabled(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('maplab');
  }

  /**
   * Initialize the Map Lab overlay
   */
  init(): void {
    this.overlay = document.getElementById('map-lab-overlay');
    if (!this.overlay) throw new Error('map-lab-overlay element not found');

    // Hide main menu when Map Lab is active
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
      mainMenu.classList.add('hidden');
    }

    this.bindEvents();
    this.updateUI();
    this.show();

    // Generate initial map
    this.generateMap();
  }

  private bindEvents(): void {
    // Preset dropdown
    const presetSelect = document.getElementById('maplab-preset') as HTMLSelectElement;
    presetSelect?.addEventListener('change', () => {
      this.state.preset = presetSelect.value;
      this.generateMap();
    });

    // Seed input
    const seedInput = document.getElementById('maplab-seed') as HTMLInputElement;
    seedInput?.addEventListener('change', () => {
      const value = parseInt(seedInput.value, 10);
      if (!isNaN(value)) {
        this.state.seed = value;
        this.generateMap();
      }
    });

    // Reroll button
    const rerollBtn = document.getElementById('maplab-reroll');
    rerollBtn?.addEventListener('click', () => this.reroll());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (!this.overlay?.classList.contains('visible')) return;

      if (e.key === 'r' || e.key === 'R') {
        this.reroll();
      } else if (e.key >= '1' && e.key <= '9') {
        const presets = getPresetNames();
        const index = parseInt(e.key, 10) - 1;
        if (index < presets.length) {
          this.state.preset = presets[index]!;
          this.generateMap();
          this.updateUI();
        }
      }
    });
  }

  private reroll(): void {
    this.state.seed = Math.floor(Math.random() * 1000000);
    this.generateMap();
    this.updateUI();
  }

  private generateMap(): void {
    const preset = MAP_PRESETS[this.state.preset]!;

    const config = presetToMapConfig(preset, this.state.seed);

    // Generate map and validate
    const map = new GameMap(config);
    this.state.validation = validateMap(map, config.constraints);
    this.state.stats = getMapStats(map);

    // Notify the game to use this config
    this.callbacks.onGenerateMap(config);

    this.updateUI();
  }

  private updateUI(): void {
    // Update preset dropdown
    const presetSelect = document.getElementById('maplab-preset') as HTMLSelectElement;
    if (presetSelect) {
      presetSelect.value = this.state.preset;
    }

    // Update seed input
    const seedInput = document.getElementById('maplab-seed') as HTMLInputElement;
    if (seedInput) {
      seedInput.value = this.state.seed.toString();
    }

    // Update preset info
    const preset = MAP_PRESETS[this.state.preset];
    const presetInfo = document.getElementById('maplab-preset-info');
    if (presetInfo && preset) {
      presetInfo.textContent = `${preset.width}x${preset.height} - ${preset.description}`;
    }

    // Update validation display
    this.updateValidationDisplay();

    // Update stats display
    this.updateStatsDisplay();
  }

  private updateValidationDisplay(): void {
    if (!this.state.validation) return;
    const container = document.getElementById('maplab-validation')!;

    const { critical, warnings } = this.state.validation;

    let html = '<div class="maplab-validation-checks">';

    for (const check of critical) {
      const icon = check.passed ? '✓' : '✗';
      const cls = check.passed ? 'passed' : 'failed';
      html += `<div class="maplab-check ${cls}">
        <span class="maplab-check-icon">${icon}</span>
        <span class="maplab-check-name">${check.name}</span>
        <span class="maplab-check-detail">${check.detail}</span>
      </div>`;
    }

    html += '</div>';

    if (warnings.length > 0) {
      html += '<div class="maplab-warnings">';
      for (const warning of warnings) {
        html += `<div class="maplab-warning">⚠ ${warning}</div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  private updateStatsDisplay(): void {
    if (!this.state.stats) return;
    const container = document.getElementById('maplab-stats')!;

    const { totalTiles, tileCounts, totalBuildings, playerBuildings, enemyBuildings, neutralBuildings, pathLength } = this.state.stats;

    const grassPct = ((tileCounts.grass ?? 0) / totalTiles * 100).toFixed(0);
    const waterPct = ((tileCounts.water ?? 0) / totalTiles * 100).toFixed(0);
    const mountainPct = ((tileCounts.mountain ?? 0) / totalTiles * 100).toFixed(0);
    const woodsPct = ((tileCounts.woods ?? 0) / totalTiles * 100).toFixed(0);
    const roadPct = ((tileCounts.road ?? 0) / totalTiles * 100).toFixed(0);

    container.innerHTML = `
      <div class="maplab-stat-group">
        <div class="maplab-stat-title">Tiles</div>
        <div class="maplab-stat">Total: ${totalTiles}</div>
        <div class="maplab-stat">Grass: ${grassPct}%</div>
        <div class="maplab-stat">Woods: ${woodsPct}%</div>
        <div class="maplab-stat">Water: ${waterPct}%</div>
        <div class="maplab-stat">Mountains: ${mountainPct}%</div>
        <div class="maplab-stat">Roads: ${roadPct}%</div>
      </div>
      <div class="maplab-stat-group">
        <div class="maplab-stat-title">Buildings</div>
        <div class="maplab-stat">Total: ${totalBuildings}</div>
        <div class="maplab-stat">Player: ${playerBuildings}</div>
        <div class="maplab-stat">Enemy: ${enemyBuildings}</div>
        <div class="maplab-stat">Neutral: ${neutralBuildings}</div>
      </div>
      <div class="maplab-stat-group">
        <div class="maplab-stat-title">Path</div>
        <div class="maplab-stat">Capital distance: ${pathLength ?? 'N/A'}</div>
      </div>
    `;
  }

  show(): void {
    this.overlay?.classList.add('visible');
  }

  hide(): void {
    this.overlay?.classList.remove('visible');
  }

  toggle(): void {
    this.overlay?.classList.toggle('visible');
  }

  getState(): MapLabState {
    return { ...this.state };
  }

  setPreset(presetName: string): void {
    if (MAP_PRESETS[presetName]) {
      this.state.preset = presetName;
      this.generateMap();
      this.updateUI();
    }
  }

  setSeed(seed: number): void {
    this.state.seed = seed;
    this.generateMap();
    this.updateUI();
  }
}
