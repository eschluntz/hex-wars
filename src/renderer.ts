// ============================================================================
// HEX DOMINION - Renderer
// ============================================================================

import { HexUtil, TILE_COLORS, TILE_ICONS, TEAM_COLORS, type AxialCoord, type Tile } from './core.js';
import { CONFIG } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Unit } from './unit.js';
import { BUILDING_ICONS, type Building } from './building.js';
import { type UnitTemplate } from './unit-templates.js';
import { type TeamResources } from './resources.js';

export interface PathPreview {
  path: AxialCoord[];
  reachableIndex: number;  // last index the unit can reach this turn
}

export interface ActionMenu {
  unit: Unit;
  canAttack: boolean;
}

export interface AttackTargets {
  unit: Unit;
  validTargets: Set<string>;
}

export interface ProductionMenu {
  factory: Building;
  templates: UnitTemplate[];
}

interface MenuButton {
  label: string;
  action: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: GameMap;
  private viewport: Viewport;
  private menuButtons: MenuButton[] = [];
  hoveredHex: AxialCoord | null = null;
  units: Unit[] = [];
  selectedUnit: Unit | null = null;
  pathPreview: PathPreview | null = null;
  actionMenu: ActionMenu | null = null;
  attackTargets: AttackTargets | null = null;
  productionMenu: ProductionMenu | null = null;
  menuHighlightIndex: number = 0;
  currentTeam: string = '';
  turnNumber: number = 1;
  activeUnits: number = 0;
  totalUnits: number = 0;
  resources: TeamResources = { funds: 0, science: 0 };

  constructor(canvas: HTMLCanvasElement, map: GameMap, viewport: Viewport) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.map = map;
    this.viewport = viewport;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousemove', e => {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (!this.viewport.isDragging) {
        const world = this.viewport.screenToWorld(e.clientX, e.clientY);
        this.hoveredHex = HexUtil.pixelToAxial(world.x, world.y, CONFIG.hexSize);
      }
    });
  }

  private lastMouseX = 0;
  private lastMouseY = 0;

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private drawPathPreview(preview: PathPreview, zoom: number): void {
    const ctx = this.ctx;
    const { path, reachableIndex } = preview;

    // Convert path to screen coordinates
    const screenPath = path.map(p => {
      const world = HexUtil.axialToPixel(p.q, p.r, CONFIG.hexSize);
      return this.viewport.worldToScreen(world.x, world.y);
    });

    const lineWidth = Math.max(3, 5 * zoom);

    // Draw green (reachable) portion
    if (reachableIndex > 0) {
      ctx.beginPath();
      ctx.moveTo(screenPath[0]!.x, screenPath[0]!.y);
      for (let i = 1; i <= reachableIndex; i++) {
        ctx.lineTo(screenPath[i]!.x, screenPath[i]!.y);
      }
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Draw red (unreachable) portion
    if (reachableIndex < path.length - 1) {
      ctx.beginPath();
      ctx.moveTo(screenPath[reachableIndex]!.x, screenPath[reachableIndex]!.y);
      for (let i = reachableIndex + 1; i < path.length; i++) {
        ctx.lineTo(screenPath[i]!.x, screenPath[i]!.y);
      }
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Draw arrow head at reachable position
    if (reachableIndex > 0) {
      const tipIdx = reachableIndex;
      const prevIdx = reachableIndex - 1;
      const tip = screenPath[tipIdx]!;
      const prev = screenPath[prevIdx]!;

      const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
      const arrowSize = Math.max(10, 15 * zoom);

      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(
        tip.x - arrowSize * Math.cos(angle - Math.PI / 6),
        tip.y - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        tip.x - arrowSize * Math.cos(angle + Math.PI / 6),
        tip.y - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = '#4caf50';
      ctx.fill();
    }

    // Draw destination marker if unreachable
    if (reachableIndex < path.length - 1) {
      const dest = screenPath[path.length - 1]!;
      const markerSize = Math.max(8, 12 * zoom);
      ctx.beginPath();
      ctx.arc(dest.x, dest.y, markerSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 67, 54, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2 * zoom;
      ctx.stroke();
    }
  }

  private drawUnit(cx: number, cy: number, unit: Unit, zoom: number): void {
    const ctx = this.ctx;
    const size = CONFIG.hexSize * zoom * 0.5;
    const isSelected = this.selectedUnit === unit;
    const baseColor = unit.color;
    const hasActed = unit.hasActed;

    // Desaturate color if unit has acted
    const color = hasActed ? this.desaturateColor(baseColor, 0.5) : baseColor;

    // Check if this is an attack target
    const isValidTarget = this.attackTargets?.validTargets.has(`${unit.q},${unit.r}`);
    const isInvalidTarget = this.attackTargets && !isValidTarget && unit.team !== this.attackTargets.unit.team;

    // Draw attack target highlight
    if (isValidTarget) {
      ctx.beginPath();
      ctx.arc(cx, cy, size + 8 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 3 * zoom;
      ctx.stroke();
    } else if (isInvalidTarget) {
      ctx.beginPath();
      ctx.arc(cx, cy, size + 8 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 3 * zoom;
      ctx.stroke();
    }

    // Draw selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(cx, cy, size + 4 * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * zoom;
      ctx.stroke();
    }

    // Draw unit body
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();

    // Draw unit ID
    if (zoom > 0.5) {
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${12 * zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.id[0]!.toUpperCase(), cx, cy);
    }

    // Draw health bar
    if (zoom > 0.3) {
      const barWidth = size * 1.6;
      const barHeight = 4 * zoom;
      const barX = cx - barWidth / 2;
      const barY = cy + size + 4 * zoom;
      const healthRatio = unit.health / 10;

      // Background
      ctx.fillStyle = '#333333';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Health
      const healthColor = healthRatio > 0.5 ? '#4caf50' : healthRatio > 0.25 ? '#ff9800' : '#f44336';
      ctx.fillStyle = healthColor;
      ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);

      // Border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Draw "acted" overlay
    if (hasActed) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  private drawHex(cx: number, cy: number, tile: Tile, isHovered: boolean, zoom: number): void {
    const ctx = this.ctx;
    const size = CONFIG.hexSize * zoom;
    const corners = HexUtil.getHexCorners(cx, cy, size);
    const colors = TILE_COLORS[tile.type];

    ctx.beginPath();
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i]!.x, corners[i]!.y);
    }
    ctx.closePath();

    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = Math.max(1, 2 * zoom);
    ctx.stroke();

    // Check for building at this tile
    const building = this.map.getBuilding(tile.q, tile.r);
    if (building) {
      this.drawBuilding(cx, cy, building, zoom);
    } else {
      // Only draw terrain icon if no building
      const icon = TILE_ICONS[tile.type];
      if (icon && zoom > 0.4) {
        ctx.font = `${size * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, cx, cy);
      }
    }

    if (isHovered) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 3 * zoom);
      ctx.stroke();
    }
  }

  private drawBuilding(cx: number, cy: number, building: Building, zoom: number): void {
    const ctx = this.ctx;
    const size = CONFIG.hexSize * zoom * 0.6;

    // Draw team color background circle
    if (building.owner) {
      const teamColor = TEAM_COLORS[building.owner];
      if (teamColor) {
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = teamColor.primary + '60'; // 60 = ~37% opacity
        ctx.fill();
        ctx.strokeStyle = teamColor.primary;
        ctx.lineWidth = 2 * zoom;
        ctx.stroke();
      }
    } else {
      // Neutral building - gray background
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
      ctx.fill();
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 2 * zoom;
      ctx.stroke();
    }

    // Draw building icon
    if (zoom > 0.3) {
      const icon = BUILDING_ICONS[building.type];
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, cx, cy);
    }
  }

  render(): void {
    const ctx = this.ctx;
    const zoom = this.viewport.zoom;

    ctx.fillStyle = CONFIG.backgroundColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const padding = CONFIG.hexSize * 2;
    const topLeft = this.viewport.screenToWorld(-padding, -padding);
    const bottomRight = this.viewport.screenToWorld(
      this.canvas.width + padding,
      this.canvas.height + padding
    );

    for (const tile of this.map.getAllTiles()) {
      const world = HexUtil.axialToPixel(tile.q, tile.r, CONFIG.hexSize);

      if (world.x < topLeft.x - CONFIG.hexSize * 2 ||
          world.x > bottomRight.x + CONFIG.hexSize * 2 ||
          world.y < topLeft.y - CONFIG.hexSize * 2 ||
          world.y > bottomRight.y + CONFIG.hexSize * 2) {
        continue;
      }

      const screen = this.viewport.worldToScreen(world.x, world.y);
      const isHovered = this.hoveredHex !== null &&
                        this.hoveredHex.q === tile.q &&
                        this.hoveredHex.r === tile.r;

      this.drawHex(screen.x, screen.y, tile, isHovered, zoom);
    }

    // Draw path preview
    if (this.pathPreview && this.pathPreview.path.length > 1) {
      this.drawPathPreview(this.pathPreview, zoom);
    }

    // Draw units
    for (const unit of this.units) {
      const world = HexUtil.axialToPixel(unit.q, unit.r, CONFIG.hexSize);
      const screen = this.viewport.worldToScreen(world.x, world.y);
      this.drawUnit(screen.x, screen.y, unit, zoom);
    }

    // Draw action menu
    if (this.actionMenu) {
      this.drawActionMenu(this.actionMenu, zoom);
    }

    // Draw production menu
    if (this.productionMenu) {
      this.drawProductionMenu(this.productionMenu, zoom);
    }

    this.updateInfoPanel(zoom);
  }

  private drawProductionMenu(menu: ProductionMenu, zoom: number): void {
    const ctx = this.ctx;
    const factory = menu.factory;

    // Position menu near the factory
    const world = HexUtil.axialToPixel(factory.q, factory.r, CONFIG.hexSize);
    const screen = this.viewport.worldToScreen(world.x, world.y);

    const buttonWidth = 140;
    const buttonHeight = 36;
    const padding = 8;
    const menuX = screen.x + CONFIG.hexSize * zoom + 10;
    const menuY = screen.y - buttonHeight * 1.5;

    this.menuButtons = [];

    // Draw menu background
    const menuWidth = buttonWidth + padding * 2;
    const menuHeight = (menu.templates.length + 1) * (buttonHeight + padding) + padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 6);
    ctx.fill();
    ctx.stroke();

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Build Unit', menuX + menuWidth / 2, menuY + padding + 10);

    // Draw template buttons
    for (let i = 0; i < menu.templates.length; i++) {
      const template = menu.templates[i]!;
      const btnX = menuX + padding;
      const btnY = menuY + padding + 24 + i * (buttonHeight + padding);

      // Check if hovered
      const isMouseHovered = this.isPointInRect(
        this.lastMouseX, this.lastMouseY,
        btnX, btnY, buttonWidth, buttonHeight
      );
      const isKeyboardHighlighted = this.menuHighlightIndex === i;
      const isHighlighted = isMouseHovered || isKeyboardHighlighted;
      const canAfford = this.resources.funds >= template.cost;

      // Button background
      if (!canAfford) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
      } else if (isHighlighted) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      }
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, buttonWidth, buttonHeight, 4);
      ctx.fill();

      if (isKeyboardHighlighted && canAfford) {
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Number prefix
      ctx.fillStyle = canAfford ? '#888888' : '#555555';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, btnX + 8, btnY + buttonHeight / 2);

      // Unit name
      ctx.fillStyle = canAfford ? '#ffffff' : '#666666';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(template.name, btnX + 24, btnY + buttonHeight / 2 - 6);

      // Cost
      ctx.fillStyle = canAfford ? '#4caf50' : '#f44336';
      ctx.font = '11px Arial';
      ctx.fillText(`$${template.cost}`, btnX + 24, btnY + buttonHeight / 2 + 8);

      // Stats
      ctx.fillStyle = canAfford ? '#aaaaaa' : '#555555';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`ATK:${template.attack} SPD:${template.speed}`, btnX + buttonWidth - 8, btnY + buttonHeight / 2);

      this.menuButtons.push({
        label: template.name,
        action: `build_${template.id}`,
        x: btnX,
        y: btnY,
        width: buttonWidth,
        height: buttonHeight
      });
    }

    // Cancel button
    const cancelY = menuY + padding + 24 + menu.templates.length * (buttonHeight + padding);
    const cancelX = menuX + padding;
    const isCancelHovered = this.isPointInRect(
      this.lastMouseX, this.lastMouseY,
      cancelX, cancelY, buttonWidth, buttonHeight
    );
    const isCancelHighlighted = this.menuHighlightIndex === menu.templates.length;

    ctx.fillStyle = (isCancelHovered || isCancelHighlighted) ? 'rgba(244, 67, 54, 0.3)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(cancelX, cancelY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    if (isCancelHighlighted) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#888888';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${menu.templates.length + 1}`, cancelX + 8, cancelY + buttonHeight / 2);

    ctx.fillStyle = '#ff8888';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Cancel', cancelX + buttonWidth / 2 + 8, cancelY + buttonHeight / 2);

    this.menuButtons.push({
      label: 'Cancel',
      action: 'cancel',
      x: cancelX,
      y: cancelY,
      width: buttonWidth,
      height: buttonHeight
    });
  }

  private drawActionMenu(menu: ActionMenu, zoom: number): void {
    const ctx = this.ctx;
    const unit = menu.unit;

    // Position menu near the unit
    const world = HexUtil.axialToPixel(unit.q, unit.r, CONFIG.hexSize);
    const screen = this.viewport.worldToScreen(world.x, world.y);

    const buttonWidth = 80;
    const buttonHeight = 28;
    const padding = 8;
    const menuX = screen.x + CONFIG.hexSize * zoom + 10;
    const menuY = screen.y - buttonHeight * 1.5;

    this.menuButtons = [];

    const buttons = [
      { label: 'Wait', action: 'wait' },
      { label: 'Cancel', action: 'cancel' },
    ];

    if (menu.canAttack) {
      buttons.push({ label: 'Attack', action: 'attack' });
    }

    // Draw menu background
    const menuWidth = buttonWidth + padding * 2;
    const menuHeight = buttons.length * (buttonHeight + padding) + padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 6);
    ctx.fill();
    ctx.stroke();

    // Draw buttons
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]!;
      const btnX = menuX + padding;
      const btnY = menuY + padding + i * (buttonHeight + padding);

      // Check if hovered by mouse or keyboard
      const isMouseHovered = this.isPointInRect(
        this.lastMouseX, this.lastMouseY,
        btnX, btnY, buttonWidth, buttonHeight
      );
      const isKeyboardHighlighted = this.menuHighlightIndex === i;
      const isHighlighted = isMouseHovered || isKeyboardHighlighted;

      // Button background
      ctx.fillStyle = isHighlighted ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, buttonWidth, buttonHeight, 4);
      ctx.fill();

      if (isKeyboardHighlighted) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Number prefix
      ctx.fillStyle = '#888888';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, btnX + 8, btnY + buttonHeight / 2);

      // Button text
      ctx.fillStyle = btn.action === 'attack' ? '#ff9800' : '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btnX + buttonWidth / 2 + 8, btnY + buttonHeight / 2);

      this.menuButtons.push({
        label: btn.label,
        action: btn.action,
        x: btnX,
        y: btnY,
        width: buttonWidth,
        height: buttonHeight
      });
    }
  }

  getMenuButtonCount(): number {
    return this.menuButtons.length;
  }

  getMenuAction(index: number): string | null {
    return this.menuButtons[index]?.action ?? null;
  }

  private isPointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  private desaturateColor(hex: string, amount: number): string {
    // Parse hex color
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Convert to grayscale and blend
    const gray = 0.3 * r + 0.59 * g + 0.11 * b;
    const newR = Math.round(r + (gray - r) * amount);
    const newG = Math.round(g + (gray - g) * amount);
    const newB = Math.round(b + (gray - b) * amount);

    return `rgb(${newR}, ${newG}, ${newB})`;
  }

  getActionMenuClick(): string | null {
    // Check if click is on any menu button
    for (const btn of this.menuButtons) {
      if (this.isPointInRect(this.lastMouseX, this.lastMouseY, btn.x, btn.y, btn.width, btn.height)) {
        return btn.action;
      }
    }
    return null;
  }

  private updateInfoPanel(zoom: number): void {
    const infoEl = document.getElementById('coords');
    if (!infoEl) return;

    const lines: string[] = [];

    // Turn info with resources
    const teamName = this.currentTeam === 'player' ? 'PLAYER' : 'ENEMY';
    lines.push(`Turn ${this.turnNumber} | ${teamName} | Units: ${this.activeUnits}/${this.totalUnits} | Tab=End Turn`);
    lines.push(`<span style="color: #4caf50">Funds: $${this.resources.funds}</span> | <span style="color: #2196f3">Science: ${this.resources.science}</span>`);
    lines.push('');

    // Hovered hex
    if (this.hoveredHex) {
      const tile = this.map.getTile(this.hoveredHex.q, this.hoveredHex.r);
      if (tile) {
        let hexInfo = `Hex: (${this.hoveredHex.q}, ${this.hoveredHex.r}) ${tile.type}`;
        if (this.selectedUnit) {
          const cost = this.selectedUnit.terrainCosts[tile.type];
          hexInfo += ` [cost: ${cost === Infinity ? '∞' : cost}]`;
        }
        lines.push(hexInfo);

        // Show building info
        const building = this.map.getBuilding(this.hoveredHex.q, this.hoveredHex.r);
        if (building) {
          const ownerStr = building.owner ? building.owner.toUpperCase() : 'NEUTRAL';
          lines.push(`Building: ${building.type.toUpperCase()} (${ownerStr})`);
        }
      } else {
        lines.push(`Hex: (${this.hoveredHex.q}, ${this.hoveredHex.r}) empty`);
      }
    }

    // Selected unit
    if (this.selectedUnit) {
      const u = this.selectedUnit;
      const costs = u.terrainCosts;
      const fmt = (v: number) => v === Infinity ? '∞' : String(v);
      lines.push('');
      lines.push(`Unit: ${u.id.toUpperCase()} | HP: ${u.health}/10 | ATK: ${u.attack} | RNG: ${u.range} | SPD: ${u.speed}`);
      lines.push(`Terrain: grass=${fmt(costs.grass)} road=${fmt(costs.road)} woods=${fmt(costs.woods)} water=${fmt(costs.water)} mountain=${fmt(costs.mountain)}`);
    }

    // Action menu hint
    if (this.actionMenu) {
      lines.push('');
      lines.push('1=Wait 2=Cancel' + (this.actionMenu.canAttack ? ' 3=Attack' : '') + ' | Arrows+Enter');
    }

    // Attack mode hint
    if (this.attackTargets) {
      lines.push('');
      lines.push('Select target (ESC to cancel)');
    }

    // Production menu hint
    if (this.productionMenu) {
      lines.push('');
      lines.push('Select unit to build | ESC to cancel');
    }

    infoEl.innerHTML = lines.join('<br>');
  }
}
