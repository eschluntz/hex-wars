// ============================================================================
// HEX DOMINION - Menu System
// ============================================================================

import { type TeamStats } from './stats.js';
import { TEAM_COLORS } from './core.js';
import { getAIMetadata } from './ai/registry.js';
import { type PlayerConfig } from './player.js';

export type GamePhase = 'main_menu' | 'playing' | 'game_over';

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

  renderGameOver(data: GameOverData): void {
    const ctx = this.ctx;
    this.buttons = [];

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, this.width, this.height);

    const winnerColor = TEAM_COLORS[data.winner]?.primary ?? '#ffffff';

    // Victory text
    ctx.fillStyle = winnerColor;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${data.winner.toUpperCase()} WINS!`, this.width / 2, 60);

    ctx.fillStyle = '#888888';
    ctx.font = '20px Arial';
    ctx.fillText(`Victory in ${data.turnCount} turns`, this.width / 2, 100);

    // Draw statistics graphs
    this.drawStatsGraphs(data);

    // Main Menu button
    const btnWidth = 200;
    const btnHeight = 50;
    const btnX = this.width / 2 - btnWidth / 2;
    const btnY = this.height - 80;

    const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, btnX, btnY, btnWidth, btnHeight);

    ctx.fillStyle = isHovered ? '#4caf50' : '#2e7d32';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Main Menu', this.width / 2, btnY + btnHeight / 2);

    this.buttons.push({
      label: 'Main Menu',
      action: 'main_menu',
      x: btnX,
      y: btnY,
      width: btnWidth,
      height: btnHeight
    });
  }

  private drawStatsGraphs(data: GameOverData): void {
    const ctx = this.ctx;
    const teams = Array.from(data.stats.keys());

    // Graph layout - 2 rows of 3 graphs
    const graphConfigs = [
      { title: 'Units', getValue: (s: any) => s.totalUnits },
      { title: 'Buildings Owned', getValue: (s: any) => s.totalBuildings },
      { title: 'Income (per turn)', getValue: (s: any) => s.fundsCollected },
      { title: 'Units Killed (Cumulative)', getValue: (s: any, stats: TeamStats, idx: number) => {
        let sum = 0;
        for (let i = 0; i <= idx; i++) sum += stats.snapshots[i]?.unitsKilled ?? 0;
        return sum;
      }},
      { title: 'Buildings Captured (Cumulative)', getValue: (s: any, stats: TeamStats, idx: number) => {
        let sum = 0;
        for (let i = 0; i <= idx; i++) sum += stats.snapshots[i]?.buildingsCaptured ?? 0;
        return sum;
      }},
      { title: 'Science', getValue: (s: any) => s.totalScience },
    ];

    const cols = 3;
    const rows = 2;
    const padding = 20;
    const graphWidth = (this.width - padding * (cols + 1)) / cols;
    const graphHeight = (this.height - 200 - padding * (rows + 1)) / rows;
    const startY = 140;

    for (let i = 0; i < graphConfigs.length; i++) {
      const config = graphConfigs[i]!;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (graphWidth + padding);
      const y = startY + row * (graphHeight + padding);

      this.drawGraph(x, y, graphWidth, graphHeight, config.title, data.stats, teams, config.getValue);
    }
  }

  private drawGraph(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    stats: Map<string, TeamStats>,
    teams: string[],
    getValue: (snapshot: any, teamStats: TeamStats, index: number) => number
  ): void {
    const ctx = this.ctx;
    const graphPadding = 30;
    const graphX = x + graphPadding;
    const graphY = y + 25;
    const graphWidth = width - graphPadding * 2;
    const graphHeight = height - 40;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + width / 2, y + 5);

    // Find max value across all teams
    let maxValue = 0;
    let maxTurns = 0;
    for (const team of teams) {
      const teamStats = stats.get(team)!;
      maxTurns = Math.max(maxTurns, teamStats.snapshots.length);
      for (let i = 0; i < teamStats.snapshots.length; i++) {
        const val = getValue(teamStats.snapshots[i], teamStats, i);
        maxValue = Math.max(maxValue, val);
      }
    }

    if (maxValue === 0) maxValue = 1;
    if (maxTurns === 0) return;

    // Draw axes
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY);
    ctx.lineTo(graphX, graphY + graphHeight);
    ctx.lineTo(graphX + graphWidth, graphY + graphHeight);
    ctx.stroke();

    // Draw lines for each team
    for (const team of teams) {
      const teamStats = stats.get(team)!;
      const color = TEAM_COLORS[team]?.primary ?? '#ffffff';

      if (teamStats.snapshots.length === 0) continue;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < teamStats.snapshots.length; i++) {
        const val = getValue(teamStats.snapshots[i], teamStats, i);
        const px = graphX + (i / (maxTurns - 1 || 1)) * graphWidth;
        const py = graphY + graphHeight - (val / maxValue) * graphHeight;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // Draw endpoint dot
      const lastIdx = teamStats.snapshots.length - 1;
      const lastVal = getValue(teamStats.snapshots[lastIdx], teamStats, lastIdx);
      const lastX = graphX + (lastIdx / (maxTurns - 1 || 1)) * graphWidth;
      const lastY = graphY + graphHeight - (lastVal / maxValue) * graphHeight;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Y-axis label (max value)
    ctx.fillStyle = '#666666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(Math.round(maxValue)), graphX - 4, graphY);

    // X-axis label (turns)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${maxTurns} turns`, graphX + graphWidth / 2, graphY + graphHeight + 4);
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
}

export class HTMLMenuController {
  private overlay: HTMLElement;
  private playerSelect: HTMLSelectElement;
  private enemySelect: HTMLSelectElement;
  private btnSmall: HTMLButtonElement;
  private btnNormal: HTMLButtonElement;
  private callbacks: HTMLMenuCallbacks;

  constructor(callbacks: HTMLMenuCallbacks) {
    this.callbacks = callbacks;

    this.overlay = document.getElementById('main-menu')!;
    this.playerSelect = document.getElementById('player-select') as HTMLSelectElement;
    this.enemySelect = document.getElementById('enemy-select') as HTMLSelectElement;
    this.btnSmall = document.getElementById('btn-small-map') as HTMLButtonElement;
    this.btnNormal = document.getElementById('btn-normal-map') as HTMLButtonElement;

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
    this.btnSmall.addEventListener('click', () => this.startGame('small'));
    this.btnNormal.addEventListener('click', () => this.startGame('normal'));
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

  show(): void {
    this.overlay.classList.remove('hidden');
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }
}
