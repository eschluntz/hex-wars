// ============================================================================
// HEX DOMINION - Renderer
// ============================================================================

import { HexUtil, TILE_COLORS, TILE_ICONS, TEAM_COLORS, type AxialCoord, type Tile } from './core.js';
import { CONFIG } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Unit } from './unit.js';
import { BUILDING_ICONS, type Building } from './building.js';
import { type UnitTemplate, isNameTaken } from './unit-templates.js';
import {
  type DesignState,
  getDesignPreview,
  getAvailableWeapons,
  getAvailableSystems,
  getAllChassis,
  getChassisDetails,
  getWeaponDetails,
  getSystemDetails,
} from './unit-designer.js';
import { type TeamResources } from './resources.js';

export interface PathPreview {
  path: AxialCoord[];
  reachableIndex: number;  // last index the unit can reach this turn
}

export interface ActionMenu {
  unit: Unit;
  canAttack: boolean;
  canCapture: boolean;
}

export interface AttackTargets {
  unit: Unit;
  validTargets: Set<string>;
}

export interface ProductionMenu {
  factory: Building;
  templates: UnitTemplate[];
}

export type LabPhase = 'list' | 'designing';

export interface LabMenu {
  lab: Building;
  phase: LabPhase;
  design: DesignState;
  templates: UnitTemplate[];
  editingId?: string;
  nameInput: string;
  nameError: string | null;
  hoveredComponent: { type: 'chassis' | 'weapon' | 'system'; id: string; unavailableReason?: string } | null;
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
  labMenu: LabMenu | null = null;
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
      if (!this.viewport.isDragging && !this.labMenu) {
        const world = this.viewport.screenToWorld(e.clientX, e.clientY);
        this.hoveredHex = HexUtil.pixelToAxial(world.x, world.y, CONFIG.hexSize);
      } else if (this.labMenu) {
        this.hoveredHex = null;
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
      const hasUnit = this.units.some(u => u.q === tile.q && u.r === tile.r);
      this.drawBuilding(cx, cy, building, zoom, hasUnit);
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

  private drawBuilding(cx: number, cy: number, building: Building, zoom: number, hasUnit: boolean): void {
    const ctx = this.ctx;
    const size = CONFIG.hexSize * zoom * 0.6;

    // Draw team color background - larger ring if unit is on top
    const ringSize = hasUnit ? CONFIG.hexSize * zoom * 0.85 : size * 0.9;
    const ringWidth = hasUnit ? 4 * zoom : 2 * zoom;

    if (building.owner) {
      const teamColor = TEAM_COLORS[building.owner];
      if (teamColor) {
        ctx.beginPath();
        ctx.arc(cx, cy, ringSize, 0, Math.PI * 2);
        if (!hasUnit) {
          ctx.fillStyle = teamColor.primary + '60'; // 60 = ~37% opacity
          ctx.fill();
        }
        ctx.strokeStyle = teamColor.primary;
        ctx.lineWidth = ringWidth;
        ctx.stroke();
      }
    } else {
      // Neutral building - gray background
      ctx.beginPath();
      ctx.arc(cx, cy, ringSize, 0, Math.PI * 2);
      if (!hasUnit) {
        ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
        ctx.fill();
      }
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = ringWidth;
      ctx.stroke();
    }

    // Draw building icon (smaller and offset if unit present)
    if (zoom > 0.3) {
      const icon = BUILDING_ICONS[building.type];
      if (hasUnit) {
        // Draw small icon in corner
        const iconSize = size * 0.6;
        const offsetX = CONFIG.hexSize * zoom * 0.5;
        const offsetY = -CONFIG.hexSize * zoom * 0.5;
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, cx + offsetX, cy + offsetY);
      } else {
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, cx, cy);
      }
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

    // Draw lab menu
    if (this.labMenu) {
      this.drawLabMenu(this.labMenu);
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
    const titleHeight = 24;

    // Calculate menu dimensions first
    const menuWidth = buttonWidth + padding * 2;
    const menuHeight = titleHeight + (menu.templates.length + 1) * (buttonHeight + padding) + padding;

    // Position menu, clamping to screen bounds
    const margin = 10;
    let menuX = screen.x + CONFIG.hexSize * zoom + 10;
    let menuY = screen.y - menuHeight / 2;

    // Clamp horizontally
    if (menuX + menuWidth > this.canvas.width - margin) {
      menuX = screen.x - CONFIG.hexSize * zoom - menuWidth - 10;
    }
    if (menuX < margin) {
      menuX = margin;
    }

    // Clamp vertically
    if (menuY < margin) {
      menuY = margin;
    }
    if (menuY + menuHeight > this.canvas.height - margin) {
      menuY = this.canvas.height - menuHeight - margin;
    }

    this.menuButtons = [];

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
    ctx.fillText('Build Unit', menuX + menuWidth / 2, menuY + padding + titleHeight / 2);

    // Draw template buttons
    for (let i = 0; i < menu.templates.length; i++) {
      const template = menu.templates[i]!;
      const btnX = menuX + padding;
      const btnY = menuY + padding + titleHeight + i * (buttonHeight + padding);

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
    const cancelY = menuY + padding + titleHeight + menu.templates.length * (buttonHeight + padding);
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

  // ============================================================================
  // LAB MENU RENDERING
  // ============================================================================

  private drawLabMenu(menu: LabMenu): void {
    if (menu.phase === 'list') {
      this.drawLabListPhase(menu);
    } else if (menu.phase === 'designing') {
      this.drawLabDesignPhase(menu);
    }
  }

  private drawLabListPhase(menu: LabMenu): void {
    const ctx = this.ctx;

    const buttonWidth = 200;
    const buttonHeight = 32;
    const padding = 10;
    const titleHeight = 30;

    const menuWidth = buttonWidth + padding * 2;
    // templates + new + cancel buttons
    const menuHeight = titleHeight + (menu.templates.length + 2) * (buttonHeight + padding) + padding;

    const menuX = (this.canvas.width - menuWidth) / 2;
    const menuY = (this.canvas.height - menuHeight) / 2;

    this.menuButtons = [];

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#6495ED';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UNIT DESIGNER', menuX + menuWidth / 2, menuY + padding + titleHeight / 2);

    let btnIndex = 0;

    // Template buttons with edit/delete
    for (let i = 0; i < menu.templates.length; i++) {
      const template = menu.templates[i]!;
      const btnY = menuY + padding + titleHeight + i * (buttonHeight + padding);
      const btnX = menuX + padding;

      const isMouseHovered = this.isPointInRect(
        this.lastMouseX, this.lastMouseY,
        btnX, btnY, buttonWidth, buttonHeight
      );
      const isKeyboardHighlighted = this.menuHighlightIndex === btnIndex;
      const isHighlighted = isMouseHovered || isKeyboardHighlighted;

      // Button background
      ctx.fillStyle = isHighlighted ? 'rgba(100, 149, 237, 0.3)' : 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, buttonWidth, buttonHeight, 4);
      ctx.fill();

      if (isKeyboardHighlighted) {
        ctx.strokeStyle = '#6495ED';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Template name and cost
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.name, btnX + 10, btnY + buttonHeight / 2);

      ctx.fillStyle = '#4caf50';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${template.cost}`, btnX + buttonWidth - 10, btnY + buttonHeight / 2);

      this.menuButtons.push({
        label: template.name,
        action: `edit_${template.id}`,
        x: btnX,
        y: btnY,
        width: buttonWidth,
        height: buttonHeight
      });

      btnIndex++;
    }

    // New Design button
    const newY = menuY + padding + titleHeight + menu.templates.length * (buttonHeight + padding);
    const newX = menuX + padding;

    const isNewHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, newX, newY, buttonWidth, buttonHeight);
    const isNewHighlighted = this.menuHighlightIndex === btnIndex;

    ctx.fillStyle = (isNewHovered || isNewHighlighted) ? 'rgba(76, 175, 80, 0.4)' : 'rgba(76, 175, 80, 0.2)';
    ctx.beginPath();
    ctx.roundRect(newX, newY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    if (isNewHighlighted) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+ Create New Design', newX + buttonWidth / 2, newY + buttonHeight / 2);

    this.menuButtons.push({
      label: 'New',
      action: 'new',
      x: newX,
      y: newY,
      width: buttonWidth,
      height: buttonHeight
    });

    btnIndex++;

    // Cancel button
    const cancelY = newY + buttonHeight + padding;
    const cancelX = menuX + padding;

    const isCancelHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, cancelX, cancelY, buttonWidth, buttonHeight);
    const isCancelHighlighted = this.menuHighlightIndex === btnIndex;

    ctx.fillStyle = (isCancelHovered || isCancelHighlighted) ? 'rgba(244, 67, 54, 0.3)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(cancelX, cancelY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    if (isCancelHighlighted) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#ff8888';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Close', cancelX + buttonWidth / 2, cancelY + buttonHeight / 2);

    this.menuButtons.push({
      label: 'Cancel',
      action: 'cancel',
      x: cancelX,
      y: cancelY,
      width: buttonWidth,
      height: buttonHeight
    });
  }

  private drawLabDesignPhase(menu: LabMenu): void {
    const ctx = this.ctx;

    const columnWidth = 140;
    const previewWidth = 160;
    const rowHeight = 28;
    const padding = 12;
    const titleHeight = 30;
    const sectionTitleHeight = 24;

    const chassisList = getAllChassis();
    const weaponAvail = getAvailableWeapons(menu.design.chassisId, menu.design.systemIds);
    const systemAvail = getAvailableSystems(menu.design.chassisId, menu.design.systemIds, menu.design.weaponId);

    const maxRows = Math.max(chassisList.length, weaponAvail.length + 1, systemAvail.length);
    const contentHeight = sectionTitleHeight + maxRows * rowHeight;

    const tooltipHeight = 50;
    const previewHeight = 80;
    const nameInputHeight = 50;
    const saveButtonHeight = 40;

    const menuWidth = columnWidth * 3 + previewWidth + padding * 5;
    const menuHeight = titleHeight + contentHeight + tooltipHeight + previewHeight + nameInputHeight + saveButtonHeight + padding * 6;

    const menuX = (this.canvas.width - menuWidth) / 2;
    const menuY = (this.canvas.height - menuHeight) / 2;

    this.menuButtons = [];

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#6495ED';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleText = menu.editingId ? 'EDIT DESIGN' : 'NEW DESIGN';
    ctx.fillText(titleText, menuX + menuWidth / 2, menuY + padding + titleHeight / 2);

    // Close button
    const closeX = menuX + menuWidth - 30;
    const closeY = menuY + 8;
    const isCloseHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, closeX, closeY, 22, 22);

    ctx.fillStyle = isCloseHovered ? 'rgba(244, 67, 54, 0.5)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(closeX, closeY, 22, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X', closeX + 11, closeY + 12);

    this.menuButtons.push({
      label: 'Close',
      action: 'cancel',
      x: closeX,
      y: closeY,
      width: 22,
      height: 22
    });

    const contentY = menuY + titleHeight + padding * 2;

    // Draw columns
    this.drawChassisColumn(ctx, menuX + padding, contentY, columnWidth, chassisList, menu.design.chassisId);
    this.drawWeaponColumn(ctx, menuX + padding + columnWidth + padding, contentY, columnWidth, weaponAvail, menu.design.weaponId);
    this.drawSystemColumn(ctx, menuX + padding + (columnWidth + padding) * 2, contentY, columnWidth, systemAvail, menu.design.systemIds);

    // Preview panel (right side)
    const previewX = menuX + padding + (columnWidth + padding) * 3;
    const previewY = contentY;
    this.drawDesignPreviewPanel(ctx, previewX, previewY, previewWidth, contentHeight, menu.design);

    // Tooltip area
    const tooltipY = contentY + contentHeight + padding;
    this.drawTooltipArea(ctx, menuX + padding, tooltipY, menuWidth - padding * 2, tooltipHeight, menu.hoveredComponent);

    // Stats preview bar
    const statsY = tooltipY + tooltipHeight + padding;
    this.drawStatsPreview(ctx, menuX + padding, statsY, menuWidth - padding * 2, previewHeight, menu.design);

    // Name input row
    const nameY = statsY + previewHeight + padding;
    this.drawNameInput(ctx, menuX + padding, nameY, menuWidth - padding * 2, nameInputHeight, menu);

    // Save button
    const saveY = nameY + nameInputHeight + padding;
    const preview = getDesignPreview(menu.design);
    const nameTrimmed2 = menu.nameInput.trim();
    const isDuplicate2 = nameTrimmed2.length > 0 && this.currentTeam && isNameTaken(this.currentTeam, nameTrimmed2, menu.editingId);
    const canSave = (preview?.valid ?? false) && nameTrimmed2.length > 0 && !isDuplicate2;
    this.drawSaveButton(ctx, menuX + padding, saveY, menuWidth - padding * 2, saveButtonHeight - padding, canSave);
  }

  private drawNameInput(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    menu: LabMenu
  ): void {
    // Check for duplicate name in real-time
    const nameTrimmed = menu.nameInput.trim();
    const isDuplicate = nameTrimmed.length > 0 && this.currentTeam && isNameTaken(this.currentTeam, nameTrimmed, menu.editingId);
    const hasError = menu.nameError !== null || isDuplicate;

    // Label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NAME:', x, y + 10);

    // Input field
    const inputX = x + 50;
    const inputWidth = width - 50;
    const inputHeight = 28;
    const inputY = y + height / 2 - inputHeight / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(inputX, inputY, inputWidth, inputHeight, 4);
    ctx.fill();

    ctx.strokeStyle = hasError ? '#f44336' : '#6495ED';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Input text with cursor
    ctx.fillStyle = hasError ? '#ff8888' : '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayText = menu.nameInput + (Date.now() % 1000 < 500 ? '|' : '');
    ctx.fillText(displayText, inputX + 10, inputY + inputHeight / 2);

    // Error message
    const errorMsg = isDuplicate ? 'Name already exists' : menu.nameError;
    if (errorMsg) {
      console.log('Showing error:', errorMsg, 'isDuplicate:', isDuplicate, 'nameError:', menu.nameError, 'name:', nameTrimmed);
      ctx.fillStyle = '#f44336';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(errorMsg, x + width, y + 10);
    }
  }

  private drawSaveButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    canSave: boolean
  ): void {
    const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, y, width, height);

    if (!canSave) {
      ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    } else {
      ctx.fillStyle = isHovered ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.3)';
    }
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    ctx.fillStyle = canSave ? '#4caf50' : '#666666';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Save Design', x + width / 2, y + height / 2);

    if (canSave) {
      this.menuButtons.push({
        label: 'Save',
        action: 'confirm_name',
        x, y, width, height
      });
    }
  }

  private drawChassisColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number,
    chassisList: ReturnType<typeof getAllChassis>,
    selectedId: string | null
  ): void {
    // Section title
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHASSIS', x, y + 12);

    const rowHeight = 28;
    let offsetY = y + 24;

    for (const chassis of chassisList) {
      const isSelected = chassis.id === selectedId;
      const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

      ctx.fillStyle = isSelected ? 'rgba(100, 149, 237, 0.4)' : isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
      ctx.fill();

      // Radio button
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? '#6495ED' : '#666666';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6495ED';
        ctx.fill();
      }

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(chassis.name, x + 26, offsetY + rowHeight / 2 - 1);

      // Cost
      ctx.fillStyle = '#888888';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${chassis.baseCost}`, x + width - 6, offsetY + rowHeight / 2 - 1);

      this.menuButtons.push({
        label: chassis.name,
        action: `chassis_${chassis.id}`,
        x, y: offsetY, width, height: rowHeight
      });

      // Track hover for tooltip
      if (isHovered && this.labMenu) {
        this.labMenu.hoveredComponent = { type: 'chassis', id: chassis.id };
      }

      offsetY += rowHeight;
    }
  }

  private drawWeaponColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number,
    weaponAvail: ReturnType<typeof getAvailableWeapons>,
    selectedId: string | null
  ): void {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WEAPON', x, y + 12);

    const rowHeight = 28;
    let offsetY = y + 24;

    // None option
    const noneSelected = selectedId === null;
    const noneHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

    ctx.fillStyle = noneSelected ? 'rgba(100, 149, 237, 0.4)' : noneHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
    ctx.strokeStyle = noneSelected ? '#6495ED' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (noneSelected) {
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#6495ED';
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('None', x + 26, offsetY + rowHeight / 2 - 1);

    this.menuButtons.push({
      label: 'None',
      action: 'weapon_none',
      x, y: offsetY, width, height: rowHeight
    });

    offsetY += rowHeight;

    for (const { weapon, available, reason } of weaponAvail) {
      const isSelected = weapon.id === selectedId;
      const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

      if (!available) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
      } else {
        ctx.fillStyle = isSelected ? 'rgba(100, 149, 237, 0.4)' : isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      }
      ctx.beginPath();
      ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
      ctx.fill();

      // Radio button
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
      ctx.strokeStyle = !available ? '#444444' : isSelected ? '#6495ED' : '#666666';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6495ED';
        ctx.fill();
      }

      // Name
      ctx.fillStyle = available ? '#ffffff' : '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(weapon.name, x + 26, offsetY + rowHeight / 2 - 1);

      // Cost
      ctx.fillStyle = available ? '#888888' : '#444444';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${weapon.cost}`, x + width - 6, offsetY + rowHeight / 2 - 1);

      if (available) {
        this.menuButtons.push({
          label: weapon.name,
          action: `weapon_${weapon.id}`,
          x, y: offsetY, width, height: rowHeight
        });
      }

      // Track hover for tooltip
      if (isHovered && this.labMenu) {
        this.labMenu.hoveredComponent = { type: 'weapon', id: weapon.id, unavailableReason: available ? undefined : reason };
      }

      offsetY += rowHeight;
    }
  }

  private drawSystemColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number,
    systemAvail: ReturnType<typeof getAvailableSystems>,
    selectedIds: string[]
  ): void {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SYSTEMS', x, y + 12);

    const rowHeight = 28;
    let offsetY = y + 24;

    // "None" option
    const noneSelected = selectedIds.length === 0;
    const noneHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

    ctx.fillStyle = noneSelected ? 'rgba(100, 149, 237, 0.4)' : noneHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
    ctx.strokeStyle = noneSelected ? '#6495ED' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (noneSelected) {
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#6495ED';
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('None', x + 26, offsetY + rowHeight / 2 - 1);

    this.menuButtons.push({
      label: 'None',
      action: 'system_none',
      x, y: offsetY, width, height: rowHeight
    });

    offsetY += rowHeight;

    for (const { system, available, reason } of systemAvail) {
      const isSelected = selectedIds.includes(system.id);
      const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

      if (!available && !isSelected) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
      } else {
        ctx.fillStyle = isSelected ? 'rgba(100, 149, 237, 0.4)' : isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      }
      ctx.beginPath();
      ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
      ctx.fill();

      // Radio button
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
      ctx.strokeStyle = (!available && !isSelected) ? '#444444' : isSelected ? '#6495ED' : '#666666';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6495ED';
        ctx.fill();
      }

      // Name
      ctx.fillStyle = (available || isSelected) ? '#ffffff' : '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(system.name, x + 26, offsetY + rowHeight / 2 - 1);

      // Cost
      ctx.fillStyle = (available || isSelected) ? '#888888' : '#444444';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${system.cost}`, x + width - 6, offsetY + rowHeight / 2 - 1);

      if (available || isSelected) {
        this.menuButtons.push({
          label: system.name,
          action: `system_${system.id}`,
          x, y: offsetY, width, height: rowHeight
        });
      }

      // Track hover for tooltip
      if (isHovered && this.labMenu) {
        const unavailableReason = (!available && !isSelected) ? reason : undefined;
        this.labMenu.hoveredComponent = { type: 'system', id: system.id, unavailableReason };
      }

      offsetY += rowHeight;
    }
  }

  private drawDesignPreviewPanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    design: DesignState
  ): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PREVIEW', x + width / 2, y + 12);

    // Placeholder for unit visual
    ctx.fillStyle = 'rgba(100, 149, 237, 0.2)';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Show chassis type indicator
    if (design.chassisId) {
      ctx.fillStyle = '#6495ED';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = design.chassisId === 'foot' ? '🚶' : design.chassisId === 'wheels' ? '🚗' : '🛡️';
      ctx.fillText(icon, x + width / 2, y + height / 2);
    } else {
      ctx.fillStyle = '#666666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select chassis', x + width / 2, y + height / 2);
    }
  }

  private drawTooltipArea(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    hoveredComponent: { type: 'chassis' | 'weapon' | 'system'; id: string; unavailableReason?: string } | null
  ): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    if (!hoveredComponent) {
      ctx.fillStyle = '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hover over a component for details', x + width / 2, y + height / 2);
      return;
    }

    let details;
    if (hoveredComponent.type === 'chassis') {
      details = getChassisDetails(hoveredComponent.id);
    } else if (hoveredComponent.type === 'weapon') {
      details = getWeaponDetails(hoveredComponent.id);
    } else {
      details = getSystemDetails(hoveredComponent.id);
    }

    // Name
    ctx.fillStyle = hoveredComponent.unavailableReason ? '#888888' : '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(details.name, x + 10, y + 8);

    // Cost or unavailable indicator
    if (hoveredComponent.unavailableReason) {
      ctx.fillStyle = '#f44336';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('UNAVAILABLE', x + width - 10, y + 8);
    } else {
      ctx.fillStyle = '#4caf50';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${details.cost}`, x + width - 10, y + 8);
    }

    // Stats
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(details.stats.join(' | '), x + 10, y + 26);

    // Unavailable reason (replaces abilities line when unavailable)
    if (hoveredComponent.unavailableReason) {
      ctx.fillStyle = '#ff9800';
      ctx.fillText(hoveredComponent.unavailableReason, x + 10, y + 40);
    } else if (details.abilities || details.requirements) {
      let line = '';
      if (details.abilities) line += details.abilities.join(', ');
      if (details.requirements) {
        if (line) line += ' | ';
        line += details.requirements;
      }
      ctx.fillStyle = '#ffb74d';
      ctx.fillText(line, x + 10, y + 40);
    }
  }

  private drawStatsPreview(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    design: DesignState
  ): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    const preview = getDesignPreview(design);
    if (!preview) {
      ctx.fillStyle = '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select a chassis to see stats', x + width / 2, y + height / 2);
      return;
    }

    const leftX = x + 10;
    const rightX = x + width / 2 + 10;

    // Stats on left
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillText(`Speed: ${preview.speed}`, leftX, y + 10);
    ctx.fillText(`Attack: ${preview.attack}`, leftX, y + 26);
    ctx.fillText(`Range: ${preview.range}`, leftX, y + 42);

    // Weight and cost on right
    ctx.fillText(`Weight: ${preview.totalWeight}/${preview.maxWeight}`, rightX, y + 10);
    ctx.fillStyle = '#4caf50';
    ctx.fillText(`Total Cost: $${preview.cost}`, rightX, y + 26);

    // Abilities
    const abilities: string[] = [];
    if (preview.armored) abilities.push('Armored');
    if (preview.armorPiercing) abilities.push('AP');
    if (preview.canCapture) abilities.push('Capture');
    if (preview.canBuild) abilities.push('Build');

    if (abilities.length > 0) {
      ctx.fillStyle = '#64b5f6';
      ctx.fillText(`Traits: ${abilities.join(', ')}`, rightX, y + 42);
    }

    // Error message
    if (!preview.valid && preview.error) {
      ctx.fillStyle = '#f44336';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(preview.error, x + width / 2, y + height - 10);
    }
  }

  // Helper methods for lab name input
  handleLabNameInput(char: string): void {
    if (!this.labMenu) {
      console.log('handleLabNameInput: labMenu is null!');
      return;
    }
    if (this.labMenu.nameInput.length < 20) {
      this.labMenu.nameInput += char;
      this.labMenu.nameError = null;
      console.log('handleLabNameInput:', char, 'nameInput now:', this.labMenu.nameInput);
    }
  }

  handleLabNameBackspace(): void {
    if (!this.labMenu) {
      console.log('handleLabNameBackspace: labMenu is null!');
      return;
    }
    if (this.labMenu.nameInput.length > 0) {
      this.labMenu.nameInput = this.labMenu.nameInput.slice(0, -1);
      this.labMenu.nameError = null;
      console.log('handleLabNameBackspace: nameInput now:', this.labMenu.nameInput);
    }
  }

  setLabNameError(error: string): void {
    if (this.labMenu) {
      this.labMenu.nameError = error;
    }
  }

  clearLabNameError(): void {
    if (this.labMenu) {
      this.labMenu.nameError = null;
    }
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

    if (menu.canCapture) {
      buttons.push({ label: 'Capture', action: 'capture' });
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
      ctx.fillStyle = btn.action === 'attack' ? '#ff9800' : btn.action === 'capture' ? '#4caf50' : '#ffffff';
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

  private getHoveredUnit(): Unit | null {
    if (!this.hoveredHex) return null;
    return this.units.find(u => u.q === this.hoveredHex!.q && u.r === this.hoveredHex!.r) ?? null;
  }

  private formatUnitStats(u: Unit, label: string): string[] {
    const lines: string[] = [];
    const costs = u.terrainCosts;
    const fmt = (v: number) => v === Infinity ? '∞' : String(v);

    // Team color
    const teamColor = u.team === 'player' ? '#4caf50' : '#f44336';
    const teamName = u.team.toUpperCase();

    // Basic stats line
    let statsLine = `${label}: <span style="color: ${teamColor}">${u.id.toUpperCase()}</span> (${teamName})`;
    statsLine += ` | HP: ${u.health}/10 | ATK: ${u.attack} | RNG: ${u.range} | SPD: ${u.speed}`;
    lines.push(statsLine);

    // Armor/AP indicators
    const traits: string[] = [];
    if (u.armored) {
      traits.push('<span style="color: #64b5f6">ARMORED</span>');
    }
    if (u.armorPiercing) {
      traits.push('<span style="color: #ffb74d">ARMOR-PIERCING</span>');
    }
    if (u.canCapture) {
      traits.push('<span style="color: #81c784">CAN CAPTURE</span>');
    }

    if (traits.length > 0) {
      lines.push(`Traits: ${traits.join(' | ')}`);
    }

    // Terrain costs
    lines.push(`Terrain: grass=${fmt(costs.grass)} road=${fmt(costs.road)} woods=${fmt(costs.woods)} water=${fmt(costs.water)} mountain=${fmt(costs.mountain)}`);

    return lines;
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

    // Hovered unit (show stats for any unit being hovered, friend or enemy)
    const hoveredUnit = this.getHoveredUnit();
    if (hoveredUnit && hoveredUnit !== this.selectedUnit) {
      lines.push('');
      lines.push(...this.formatUnitStats(hoveredUnit, 'Hovered'));
    }

    // Selected unit
    if (this.selectedUnit) {
      lines.push('');
      lines.push(...this.formatUnitStats(this.selectedUnit, 'Selected'));
    }

    // Action menu hint
    if (this.actionMenu) {
      lines.push('');
      let hint = '1=Wait 2=Cancel';
      let num = 3;
      if (this.actionMenu.canAttack) {
        hint += ` ${num}=Attack`;
        num++;
      }
      if (this.actionMenu.canCapture) {
        hint += ` ${num}=Capture`;
      }
      hint += ' | Arrows+Enter';
      lines.push(hint);
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
