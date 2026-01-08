// ============================================================================
// HEX DOMINION - Game Over UI
// ============================================================================

import { type TeamStats } from './stats.js';
import { TEAM_COLORS } from './core.js';
import { type BattleScoreBreakdown } from './score.js';
import { type CellType } from './campaign-state.js';

const REWARD_ICONS: Record<CellType, string> = {
  unit: '⬡',
  upgrade: '▲',
  special: '★',
  boss: '👑',
  fortress: '🏰',
};

export interface GameOverDisplayData {
  winner: string;
  turnCount: number;
  stats: Map<string, TeamStats>;
  mapName: string;
  scoreBreakdown: BattleScoreBreakdown | null;
  reward: string | null;
  rewardType: CellType | null;
  isCampaign: boolean;
}

export interface GameOverUICallbacks {
  onContinue: () => void;
}

export class GameOverUI {
  private overlay: HTMLElement;
  private winnerText: HTMLElement;
  private mapNameEl: HTMLElement;
  private turnCountEl: HTMLElement;
  private graphCanvas: HTMLCanvasElement;
  private scoreBreakdown: HTMLElement;
  private rewardDisplay: HTMLElement;
  private rewardIcon: HTMLElement;
  private rewardItem: HTMLElement;
  private continueBtn: HTMLElement;
  private callbacks: GameOverUICallbacks;
  private isAnimating = false;
  private skipRequested = false;

  constructor(callbacks: GameOverUICallbacks) {
    this.callbacks = callbacks;
    this.overlay = document.getElementById('game-over-overlay')!;
    this.winnerText = this.overlay.querySelector('.winner-text')!;
    this.mapNameEl = this.overlay.querySelector('.map-name')!;
    this.turnCountEl = this.overlay.querySelector('.turn-count')!;
    this.graphCanvas = this.overlay.querySelector('#stats-graph-canvas')!;
    this.scoreBreakdown = this.overlay.querySelector('.score-breakdown')!;
    this.rewardDisplay = this.overlay.querySelector('.reward-display')!;
    this.rewardIcon = this.overlay.querySelector('.reward-icon')!;
    this.rewardItem = this.overlay.querySelector('.reward-item')!;
    this.continueBtn = this.overlay.querySelector('.btn-continue')!;

    this.continueBtn.addEventListener('click', () => {
      if (this.isAnimating) return;
      this.hide();
      this.callbacks.onContinue();
    });

    // Handle keyboard during game over
    document.addEventListener('keydown', (e) => {
      if (!this.overlay.classList.contains('visible')) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === ' ' || e.key === 'Enter') {
        if (this.isAnimating) {
          this.skipRequested = true;
        } else {
          this.hide();
          this.callbacks.onContinue();
        }
      } else if (e.key === 'Escape') {
        if (!this.isAnimating) {
          this.hide();
          this.callbacks.onContinue();
        }
      }
    });
  }

  async show(data: GameOverDisplayData): Promise<void> {
    // Reset state
    this.resetState();
    this.skipRequested = false;

    // Set winner text
    const isVictory = data.winner === 'player';
    this.winnerText.textContent = isVictory ? 'Victory!' : 'Defeat';
    this.winnerText.className = `winner-text ${isVictory ? 'victory' : 'defeat'}`;

    // Set map info
    this.mapNameEl.textContent = data.mapName;
    this.turnCountEl.textContent = `${data.turnCount} turns`;

    // Draw graphs
    this.drawStatsGraphs(data.stats);

    // Show overlay
    this.overlay.classList.add('visible');

    // Animate score reveal if in campaign
    if (data.isCampaign && data.scoreBreakdown) {
      this.isAnimating = true;
      await this.animateScoreReveal(data.scoreBreakdown);

      // Show reward with shine (skip if requested)
      if (data.reward && isVictory && data.rewardType) {
        this.rewardIcon.textContent = REWARD_ICONS[data.rewardType];
        this.rewardItem.textContent = data.reward;
        this.rewardDisplay.classList.remove('unit', 'upgrade', 'special', 'boss', 'fortress');
        this.rewardDisplay.classList.add(data.rewardType, 'visible');
        if (!this.skipRequested) await this.delay(500);
      }
      this.isAnimating = false;
    } else {
      // Non-campaign: just hide score breakdown
      this.scoreBreakdown.style.display = 'none';
    }

    // Show continue button
    this.continueBtn.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }

  private resetState(): void {
    // Reset all score rows
    const rows = this.scoreBreakdown.querySelectorAll('.score-row');
    rows.forEach(row => {
      row.classList.remove('visible', 'pulse');
      const valueEl = row.querySelector('.score-value')!;
      valueEl.textContent = '0';
      valueEl.classList.remove('counting');
    });

    // Hide reward and reset type classes
    this.rewardDisplay.classList.remove('visible', 'unit', 'upgrade', 'special', 'boss', 'fortress');

    // Hide continue button
    this.continueBtn.classList.remove('visible');

    // Reset score breakdown visibility
    this.scoreBreakdown.style.display = '';
  }

  private async animateScoreReveal(breakdown: BattleScoreBreakdown): Promise<void> {
    const rows = [
      { type: 'power', value: breakdown.power },
      { type: 'defense', value: breakdown.defense },
      { type: 'control', value: breakdown.control },
      { type: 'speed', value: breakdown.speed },
    ];

    // If skip requested, show everything immediately
    if (this.skipRequested) {
      this.showFinalScores(breakdown);
      return;
    }

    // Animate each row
    for (const row of rows) {
      if (this.skipRequested) {
        this.showFinalScores(breakdown);
        return;
      }

      const rowEl = this.scoreBreakdown.querySelector(`[data-type="${row.type}"]`) as HTMLElement;
      const valueEl = rowEl.querySelector('.score-value')!;

      rowEl.classList.add('visible');
      await this.delay(100);

      if (this.skipRequested) {
        this.showFinalScores(breakdown);
        return;
      }

      await this.countUp(valueEl, row.value, '');
      rowEl.classList.add('pulse');
      await this.delay(200);
    }

    if (this.skipRequested) {
      this.showFinalScores(breakdown);
      return;
    }

    // Now show total
    const totalRow = this.scoreBreakdown.querySelector('.score-row.total') as HTMLElement;
    const totalValue = totalRow.querySelector('.score-value')!;

    totalRow.classList.add('visible');
    await this.delay(100);

    if (this.skipRequested) {
      this.showFinalScores(breakdown);
      return;
    }

    await this.countUp(totalValue, breakdown.totalScore, '');
    totalRow.classList.add('pulse');
    await this.delay(500);
  }

  private showFinalScores(breakdown: BattleScoreBreakdown): void {
    const scores = [
      { type: 'power', value: breakdown.power },
      { type: 'defense', value: breakdown.defense },
      { type: 'control', value: breakdown.control },
      { type: 'speed', value: breakdown.speed },
    ];

    for (const score of scores) {
      const rowEl = this.scoreBreakdown.querySelector(`[data-type="${score.type}"]`) as HTMLElement;
      const valueEl = rowEl.querySelector('.score-value')!;
      rowEl.classList.add('visible');
      valueEl.textContent = score.value.toLocaleString();
    }

    const totalRow = this.scoreBreakdown.querySelector('.score-row.total') as HTMLElement;
    const totalValue = totalRow.querySelector('.score-value')!;
    totalRow.classList.add('visible');
    totalValue.textContent = breakdown.totalScore.toLocaleString();
  }

  private async countUp(element: Element, target: number, prefix: string, suffix: string = ''): Promise<void> {
    const duration = 300;
    const startTime = performance.now();

    element.classList.add('counting');

    return new Promise(resolve => {
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = Math.floor(target * eased);

        element.textContent = prefix + current.toLocaleString() + suffix;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          element.textContent = prefix + target.toLocaleString() + suffix;
          element.classList.remove('counting');
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private drawStatsGraphs(stats: Map<string, TeamStats>): void {
    const ctx = this.graphCanvas.getContext('2d')!;
    const teams = Array.from(stats.keys());

    // Set canvas size - compact to fit on screen
    const width = 700;
    const height = 220;
    this.graphCanvas.width = width;
    this.graphCanvas.height = height;

    // Graph layout - 2 rows of 3 graphs
    const graphConfigs = [
      { title: 'Units', getValue: (s: any) => s.totalUnits },
      { title: 'Buildings Owned', getValue: (s: any) => s.totalBuildings },
      { title: 'Income (per turn)', getValue: (s: any) => s.fundsCollected },
      { title: 'Units Killed', getValue: (s: any, stats: TeamStats, idx: number) => {
        let sum = 0;
        for (let i = 0; i <= idx; i++) sum += stats.snapshots[i]?.unitsKilled ?? 0;
        return sum;
      }},
      { title: 'Buildings Captured', getValue: (s: any, stats: TeamStats, idx: number) => {
        let sum = 0;
        for (let i = 0; i <= idx; i++) sum += stats.snapshots[i]?.buildingsCaptured ?? 0;
        return sum;
      }},
      { title: 'Funds', getValue: (s: any) => s.totalFunds },
    ];

    const cols = 3;
    const rows = 2;
    const padding = 15;
    const graphWidth = (width - padding * (cols + 1)) / cols;
    const graphHeight = (height - padding * (rows + 1)) / rows;

    for (let i = 0; i < graphConfigs.length; i++) {
      const config = graphConfigs[i]!;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (graphWidth + padding);
      const y = padding + row * (graphHeight + padding);

      this.drawGraph(ctx, x, y, graphWidth, graphHeight, config.title, stats, teams, config.getValue);
    }
  }

  private drawGraph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    stats: Map<string, TeamStats>,
    teams: string[],
    getValue: (snapshot: any, teamStats: TeamStats, index: number) => number
  ): void {
    const graphPadding = 25;
    const graphX = x + graphPadding;
    const graphY = y + 20;
    const gWidth = width - graphPadding * 2;
    const gHeight = height - 35;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + width / 2, y + 4);

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
    ctx.lineTo(graphX, graphY + gHeight);
    ctx.lineTo(graphX + gWidth, graphY + gHeight);
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
        const px = graphX + (i / (maxTurns - 1 || 1)) * gWidth;
        const py = graphY + gHeight - (val / maxValue) * gHeight;

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
      const lastX = graphX + (lastIdx / (maxTurns - 1 || 1)) * gWidth;
      const lastY = graphY + gHeight - (lastVal / maxValue) * gHeight;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Y-axis label (max value)
    ctx.fillStyle = '#666666';
    ctx.font = '9px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(Math.round(maxValue)), graphX - 3, graphY);

    // X-axis label (turns)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${maxTurns}t`, graphX + gWidth / 2, graphY + gHeight + 2);
  }
}
