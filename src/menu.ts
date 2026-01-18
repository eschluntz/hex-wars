// ============================================================================
// HEX DOMINION - Menu System
// ============================================================================

import { type TeamStats } from './stats.js';
import { getAIMetadata } from './ai/registry.js';
import { type PlayerConfig } from './player.js';
import { audioManager } from './audio-manager.js';

export type GamePhase = 'main_menu' | 'campaign' | 'playing' | 'game_over';

export interface GameOverData {
  winner: string;
  loser: string;
  turnCount: number;
  stats: Map<string, TeamStats>;
}

export interface MenuButton {
  label: string;
  action: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MenuRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private buttons: MenuButton[] = [];
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  updateSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  updateMouse(x: number, y: number): void {
    this.lastMouseX = x;
    this.lastMouseY = y;
  }

  renderMainMenu(): void {
    const ctx = this.ctx;
    this.buttons = [];

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HEX DOMINION', this.width / 2, this.height / 3);

    // Subtitle
    ctx.fillStyle = '#888888';
    ctx.font = '24px Arial';
    ctx.fillText('A Turn-Based Strategy Game', this.width / 2, this.height / 3 + 50);

    // Map selection label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial';
    ctx.fillText('Select Map Size', this.width / 2, this.height / 2);

    // Map buttons
    const btnWidth = 180;
    const btnHeight = 60;
    const btnGap = 20;
    const totalWidth = btnWidth * 2 + btnGap;
    const startX = this.width / 2 - totalWidth / 2;
    const btnY = this.height / 2 + 30;

    // Small map button
    const smallX = startX;
    const isSmallHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, smallX, btnY, btnWidth, btnHeight);

    ctx.fillStyle = isSmallHovered ? '#ff9800' : '#e65100';
    ctx.beginPath();
    ctx.roundRect(smallX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Small', smallX + btnWidth / 2, btnY + 22);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffcc80';
    ctx.fillText('Test map - all grass', smallX + btnWidth / 2, btnY + 44);

    this.buttons.push({
      label: 'Small',
      action: 'new_game_small',
      x: smallX,
      y: btnY,
      width: btnWidth,
      height: btnHeight
    });

    // Normal map button
    const normalX = startX + btnWidth + btnGap;
    const isNormalHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, normalX, btnY, btnWidth, btnHeight);

    ctx.fillStyle = isNormalHovered ? '#4caf50' : '#2e7d32';
    ctx.beginPath();
    ctx.roundRect(normalX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Normal', normalX + btnWidth / 2, btnY + 22);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#a5d6a7';
    ctx.fillText('Full procedural map', normalX + btnWidth / 2, btnY + 44);

    this.buttons.push({
      label: 'Normal',
      action: 'new_game_normal',
      x: normalX,
      y: btnY,
      width: btnWidth,
      height: btnHeight
    });

    // Instructions
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial';
    ctx.fillText('Click a map to start', this.width / 2, this.height - 50);
  }

  getClickedAction(): string | null {
    for (const btn of this.buttons) {
      if (this.isPointInRect(this.lastMouseX, this.lastMouseY, btn.x, btn.y, btn.width, btn.height)) {
        return btn.action;
      }
    }
    return null;
  }

  private isPointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }
}

// ============================================================================
// HTML Menu Controller
// ============================================================================

export interface HTMLMenuCallbacks {
  onStartGame: (mapType: string, playerConfigs: PlayerConfig[]) => void;
  onStartCampaign: () => void;
  onContinueCampaign: () => void;
  onRerollSeed: () => number;
}

export class HTMLMenuController {
  private overlay: HTMLElement;
  private playerSelect: HTMLSelectElement;
  private enemySelect: HTMLSelectElement;
  private btnSmall: HTMLButtonElement;
  private btnNormal: HTMLButtonElement;
  private btnCampaign: HTMLButtonElement;
  private btnContinue: HTMLButtonElement;
  private btnReroll: HTMLButtonElement;
  private seedDisplay: HTMLElement;
  private callbacks: HTMLMenuCallbacks;

  constructor(callbacks: HTMLMenuCallbacks) {
    this.callbacks = callbacks;

    this.overlay = document.getElementById('main-menu')!;
    this.playerSelect = document.getElementById('player-select') as HTMLSelectElement;
    this.enemySelect = document.getElementById('enemy-select') as HTMLSelectElement;
    this.btnSmall = document.getElementById('btn-small-map') as HTMLButtonElement;
    this.btnNormal = document.getElementById('btn-normal-map') as HTMLButtonElement;
    this.btnCampaign = document.getElementById('btn-campaign') as HTMLButtonElement;
    this.btnContinue = document.getElementById('btn-continue') as HTMLButtonElement;
    this.btnReroll = document.getElementById('btn-reroll-seed') as HTMLButtonElement;
    this.seedDisplay = document.getElementById('seed-display')!;

    this.populateDropdowns();
    this.setupEventListeners();
  }

  private populateDropdowns(): void {
    const aiOptions = getAIMetadata();

    for (const option of aiOptions) {
      const playerOpt = document.createElement('option');
      playerOpt.value = option.id;
      playerOpt.textContent = option.name;
      this.playerSelect.appendChild(playerOpt);

      const enemyOpt = document.createElement('option');
      enemyOpt.value = option.id;
      enemyOpt.textContent = option.name;
      this.enemySelect.appendChild(enemyOpt);
    }

    // Set defaults: Human vs Greedy AI
    this.playerSelect.value = 'human';
    this.enemySelect.value = 'greedy';
  }

  private setupEventListeners(): void {
    this.btnSmall.addEventListener('click', () => {
      audioManager.playSfx('confirm');
      this.startGame('small');
    });
    this.btnNormal.addEventListener('click', () => {
      audioManager.playSfx('confirm');
      this.startGame('normal');
    });
    this.btnCampaign.addEventListener('click', () => {
      audioManager.playSfx('confirm');
      this.callbacks.onStartCampaign();
    });
    this.btnContinue.addEventListener('click', () => {
      audioManager.playSfx('confirm');
      this.callbacks.onContinueCampaign();
    });
    this.btnReroll.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.rerollSeed();
    });
  }

  private rerollSeed(): void {
    const newSeed = this.callbacks.onRerollSeed();
    this.seedDisplay.textContent = String(newSeed);
  }

  updateSeedDisplay(seed: number): void {
    this.seedDisplay.textContent = String(seed);
  }

  private startGame(mapType: string): void {
    const playerConfigs = this.buildPlayerConfigs();
    this.callbacks.onStartGame(mapType, playerConfigs);
  }

  private buildPlayerConfigs(): PlayerConfig[] {
    const playerId = this.playerSelect.value;
    const enemyId = this.enemySelect.value;

    const configs: PlayerConfig[] = [
      {
        id: 'player',
        name: 'Player',
        type: playerId === 'human' ? 'human' : 'ai',
        aiType: playerId === 'human' ? undefined : playerId,
      },
      {
        id: 'enemy',
        name: 'Enemy',
        type: enemyId === 'human' ? 'human' : 'ai',
        aiType: enemyId === 'human' ? undefined : enemyId,
      },
    ];

    return configs;
  }

  show(hasSave: boolean = false): void {
    this.overlay.classList.remove('hidden');
    // Show/hide continue button based on save state
    this.btnContinue.style.display = hasSave ? 'block' : 'none';
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }
}
