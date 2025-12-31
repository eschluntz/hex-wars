// ============================================================================
// HEX DOMINION - Renderer
// ============================================================================

import { HexUtil, TILE_ICONS, TEAM_COLORS, type AxialCoord, type Tile } from './core.js';
import { CONFIG } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Unit } from './unit.js';
import { type Building, CAPTURE_RESISTANCE } from './building.js';
import { type UnitTemplate } from './unit-templates.js';
import { type TeamResources } from './resources.js';
import { drawHex as drawHexBase, drawBuildingIcon } from './rendering-utils.js';
import { getTexture, getBuildingTexture, areTexturesLoaded, TEXTURE_WIDTH, TEXTURE_HEIGHT, TEXTURE_HEX_CENTER_Y } from './textures.js';

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


interface MenuButton {
  label: string;
  action: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Popup Menu System
// ============================================================================

export interface PopupMenuItem {
  label: string;
  action: string;
  cost?: number;          // Shows as "$X" on right side
  stats?: string;         // Shows as smaller text on right side
  enabled?: boolean;      // Grayed out if false (default: true)
  color?: string;         // Text color override
}

export interface PopupMenuConfig {
  title?: string;
  items: PopupMenuItem[];
  worldPos: { q: number; r: number };
  clampToScreen?: boolean;
  buttonWidth?: number;
  buttonHeight?: number;
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
  animationPath: PathPreview | null = null;  // For move animations (separate from player pathPreview)
  activeToast: { q: number; r: number; text: string; progress: number } | null = null;
  turnAnnouncement: { text: string; progress: number } | null = null;
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

    // Check for building to determine if we need team color overlay
    const building = this.map.getBuilding(tile.q, tile.r);

    // Try to draw texture - use building texture if available (with team tinting), otherwise tile texture
    const buildingTex = building ? getBuildingTexture(building.type, building.owner) : undefined;
    const texture = buildingTex ?? getTexture(tile.type, tile.q, tile.r);
    if (texture && areTexturesLoaded()) {
      // Calculate scale: texture width (256) should match hex width (hexSize * sqrt(3))
      const hexWidth = size * Math.sqrt(3);
      const scale = hexWidth / TEXTURE_WIDTH;
      const drawWidth = TEXTURE_WIDTH * scale;
      const baseHeight = TEXTURE_HEIGHT * scale;
      const drawHeight = baseHeight * 1.13; // Stretch vertically by 13%

      // The hex center in the texture is at TEXTURE_HEX_CENTER_Y from top
      // Position image so bottom stays fixed, stretch extends upward
      const drawX = cx - drawWidth / 2;
      const drawY = cy - (TEXTURE_HEX_CENTER_Y * scale) - (drawHeight - baseHeight);

      ctx.drawImage(texture, drawX, drawY, drawWidth, drawHeight);

      // Draw team color overlay for buildings without custom textures (factory, lab)
      if (building && !buildingTex) {
        const teamColor = (TEAM_COLORS[building.owner ?? 'neutral'] ?? TEAM_COLORS.neutral)!.primary;
        ctx.globalAlpha = 0.4;
        const corners = HexUtil.getHexCorners(cx, cy, size);
        ctx.beginPath();
        ctx.moveTo(corners[0]!.x, corners[0]!.y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(corners[i]!.x, corners[i]!.y);
        }
        ctx.closePath();
        ctx.fillStyle = teamColor;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw hover highlight
      if (isHovered) {
        const corners = HexUtil.getHexCorners(cx, cy, size);
        ctx.beginPath();
        ctx.moveTo(corners[0]!.x, corners[0]!.y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(corners[i]!.x, corners[i]!.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 3 * zoom);
        ctx.stroke();
      }
    } else {
      // Fallback to solid colors if textures not loaded
      let fillColorOverride: string | undefined;
      if (building) {
        fillColorOverride = (TEAM_COLORS[building.owner ?? 'neutral'] ?? TEAM_COLORS.neutral)!.primary;
      }
      drawHexBase(ctx as any, cx, cy, tile, size, { zoom, isHovered, fillColorOverride });

      // Draw terrain icon
      const icon = TILE_ICONS[tile.type];
      if (icon && zoom > 0.4) {
        ctx.font = `${size * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, cx, cy);
      }
    }

    // Draw building icon (only if no custom building texture)
    if (building && !buildingTex) {
      const hasUnit = this.units.some(u => u.q === tile.q && u.r === tile.r);
      this.drawBuilding(cx, cy, building, zoom, hasUnit);
    }
  }

  private drawBuilding(cx: number, cy: number, building: Building, zoom: number, hasUnit: boolean): void {
    // Use shared rendering utility for building icons
    // Always render buildings regardless of zoom level
    const size = CONFIG.hexSize * zoom * 0.6;
    drawBuildingIcon(this.ctx as any, cx, cy, building, size, { zoom, hasUnit });
  }

  private drawTurnAnnouncement(announcement: { text: string; progress: number }): void {
    const ctx = this.ctx;

    // Center of screen
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Fade in/out based on progress (peak at 0.5)
    const fadeProgress = announcement.progress < 0.2
      ? announcement.progress / 0.2
      : announcement.progress > 0.8
        ? (1 - announcement.progress) / 0.2
        : 1;
    const alpha = Math.max(0, Math.min(1, fadeProgress));

    // Measure text
    ctx.font = 'bold 48px Arial';
    const textWidth = ctx.measureText(announcement.text).width;
    const padding = 32;
    const pillWidth = textWidth + padding * 2;
    const pillHeight = 72;

    // Draw rounded pill background
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(
      centerX - pillWidth / 2,
      centerY - pillHeight / 2,
      pillWidth,
      pillHeight,
      pillHeight / 2
    );
    ctx.fill();

    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw text
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(announcement.text, centerX, centerY);

    ctx.globalAlpha = 1;
  }

  private drawToast(toast: { q: number; r: number; text: string; progress: number }, zoom: number): void {
    const ctx = this.ctx;
    const world = HexUtil.axialToPixel(toast.q, toast.r, CONFIG.hexSize);
    const screen = this.viewport.worldToScreen(world.x, world.y);

    // Position above hex
    const toastY = screen.y - CONFIG.hexSize * zoom - 20;

    // Measure text
    ctx.font = `bold ${14 * zoom}px Arial`;
    const textWidth = ctx.measureText(toast.text).width;
    const padding = 8 * zoom;
    const pillWidth = textWidth + padding * 2;
    const pillHeight = 24 * zoom;

    // Fade in/out based on progress (peak at 0.5)
    const fadeProgress = toast.progress < 0.2
      ? toast.progress / 0.2
      : toast.progress > 0.8
        ? (1 - toast.progress) / 0.2
        : 1;
    const alpha = Math.max(0, Math.min(1, fadeProgress));

    // Draw rounded pill background
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(
      screen.x - pillWidth / 2,
      toastY - pillHeight / 2,
      pillWidth,
      pillHeight,
      pillHeight / 2
    );
    ctx.fill();

    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * zoom;
    ctx.stroke();

    // Draw text
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toast.text, screen.x, toastY);

    ctx.globalAlpha = 1;
  }

  render(): void {
    const ctx = this.ctx;
    const zoom = this.viewport.zoom;

    ctx.fillStyle = CONFIG.backgroundColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const padding = CONFIG.hexSize * 4; // Increased for tall textures
    const topLeft = this.viewport.screenToWorld(-padding, -padding);
    const bottomRight = this.viewport.screenToWorld(
      this.canvas.width + padding,
      this.canvas.height + padding
    );

    // Collect visible tiles and sort by r (top to bottom) for proper overlap
    const visibleTiles: Tile[] = [];
    for (const tile of this.map.getAllTiles()) {
      const world = HexUtil.axialToPixel(tile.q, tile.r, CONFIG.hexSize);

      if (world.x < topLeft.x - CONFIG.hexSize * 4 ||
          world.x > bottomRight.x + CONFIG.hexSize * 4 ||
          world.y < topLeft.y - CONFIG.hexSize * 4 ||
          world.y > bottomRight.y + CONFIG.hexSize * 4) {
        continue;
      }

      visibleTiles.push(tile);
    }

    // Sort by r ascending (top first), then by q for consistent ordering
    visibleTiles.sort((a, b) => a.r !== b.r ? a.r - b.r : a.q - b.q);

    for (const tile of visibleTiles) {
      const world = HexUtil.axialToPixel(tile.q, tile.r, CONFIG.hexSize);
      const screen = this.viewport.worldToScreen(world.x, world.y);
      const isHovered = this.hoveredHex !== null &&
                        this.hoveredHex.q === tile.q &&
                        this.hoveredHex.r === tile.r;

      this.drawHex(screen.x, screen.y, tile, isHovered, zoom);
    }

    // Draw path preview (player input)
    if (this.pathPreview && this.pathPreview.path.length > 1) {
      this.drawPathPreview(this.pathPreview, zoom);
    }

    // Draw animation path (AI turn animations)
    if (this.animationPath && this.animationPath.path.length > 1) {
      this.drawPathPreview(this.animationPath, zoom);
    }

    // Draw units
    for (const unit of this.units) {
      const world = HexUtil.axialToPixel(unit.q, unit.r, CONFIG.hexSize);
      const screen = this.viewport.worldToScreen(world.x, world.y);
      this.drawUnit(screen.x, screen.y, unit, zoom);
    }

    // Draw active toast (for animations)
    if (this.activeToast) {
      this.drawToast(this.activeToast, zoom);
    }

    // Draw action menu
    if (this.actionMenu) {
      this.drawActionMenu(this.actionMenu, zoom);
    }

    // Draw production menu
    if (this.productionMenu) {
      this.drawProductionMenu(this.productionMenu, zoom);
    }

    // Draw turn announcement (on top of everything)
    if (this.turnAnnouncement) {
      this.drawTurnAnnouncement(this.turnAnnouncement);
    }

    this.updateInfoPanel(zoom);
  }

  // ============================================================================
  // Popup Menu System
  // ============================================================================

  private drawPopupMenu(config: PopupMenuConfig, zoom: number): void {
    const ctx = this.ctx;
    const buttonWidth = config.buttonWidth ?? 140;
    const buttonHeight = config.buttonHeight ?? 32;
    const padding = 8;
    const titleHeight = config.title ? 24 : 0;

    // Calculate menu dimensions
    const menuWidth = buttonWidth + padding * 2;
    const menuHeight = titleHeight + config.items.length * (buttonHeight + padding) + padding;

    // Position menu near the world position
    const world = HexUtil.axialToPixel(config.worldPos.q, config.worldPos.r, CONFIG.hexSize);
    const screen = this.viewport.worldToScreen(world.x, world.y);

    let menuX = screen.x + CONFIG.hexSize * zoom + 10;
    let menuY = screen.y - menuHeight / 2;

    // Clamp to screen bounds if requested
    if (config.clampToScreen) {
      const margin = 10;
      if (menuX + menuWidth > this.canvas.width - margin) {
        menuX = screen.x - CONFIG.hexSize * zoom - menuWidth - 10;
      }
      if (menuX < margin) menuX = margin;
      if (menuY < margin) menuY = margin;
      if (menuY + menuHeight > this.canvas.height - margin) {
        menuY = this.canvas.height - menuHeight - margin;
      }
    }

    this.menuButtons = [];

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 6);
    ctx.fill();
    ctx.stroke();

    // Draw title if present
    if (config.title) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.title, menuX + menuWidth / 2, menuY + padding + titleHeight / 2);
    }

    // Draw items
    for (let i = 0; i < config.items.length; i++) {
      const item = config.items[i]!;
      const enabled = item.enabled !== false;
      const btnX = menuX + padding;
      const btnY = menuY + padding + titleHeight + i * (buttonHeight + padding);

      // Check hover state
      const isMouseHovered = this.isPointInRect(
        this.lastMouseX, this.lastMouseY,
        btnX, btnY, buttonWidth, buttonHeight
      );
      const isKeyboardHighlighted = this.menuHighlightIndex === i;
      const isHighlighted = (isMouseHovered || isKeyboardHighlighted) && enabled;

      // Button background
      if (!enabled) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
      } else if (isHighlighted) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      }
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, buttonWidth, buttonHeight, 4);
      ctx.fill();

      if (isKeyboardHighlighted && enabled) {
        ctx.strokeStyle = item.color ?? '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Number prefix
      ctx.fillStyle = enabled ? '#888888' : '#555555';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, btnX + 8, btnY + buttonHeight / 2);

      // Label (with optional cost on second line)
      const hasSecondLine = item.cost !== undefined;
      const labelY = hasSecondLine ? btnY + buttonHeight / 2 - 6 : btnY + buttonHeight / 2;

      ctx.fillStyle = enabled ? (item.color ?? '#ffffff') : '#666666';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, btnX + 24, labelY);

      // Cost (second line, left side)
      if (item.cost !== undefined) {
        ctx.fillStyle = enabled ? '#4caf50' : '#f44336';
        ctx.font = '11px Arial';
        ctx.fillText(`$${item.cost}`, btnX + 24, btnY + buttonHeight / 2 + 8);
      }

      // Stats (right side)
      if (item.stats) {
        ctx.fillStyle = enabled ? '#aaaaaa' : '#555555';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(item.stats, btnX + buttonWidth - 8, btnY + buttonHeight / 2);
      }

      this.menuButtons.push({
        label: item.label,
        action: item.action,
        x: btnX,
        y: btnY,
        width: buttonWidth,
        height: buttonHeight
      });
    }
  }

  private drawProductionMenu(menu: ProductionMenu, zoom: number): void {
    const items: PopupMenuItem[] = menu.templates.map(t => ({
      label: t.name,
      action: `build_${t.id}`,
      cost: t.cost,
      stats: `ATK:${t.attack} SPD:${t.speed}`,
      enabled: this.resources.funds >= t.cost,
    }));

    items.push({
      label: 'Cancel',
      action: 'cancel',
      color: '#ff8888',
    });

    this.drawPopupMenu({
      title: 'Build Unit',
      items,
      worldPos: { q: menu.factory.q, r: menu.factory.r },
      clampToScreen: true,
      buttonWidth: 140,
      buttonHeight: 36,
    }, zoom);
  }

  private drawActionMenu(menu: ActionMenu, zoom: number): void {
    const items: PopupMenuItem[] = [];

    if (menu.canCapture) {
      items.push({ label: 'Capture', action: 'capture', color: '#4caf50' });
    }

    if (menu.canAttack) {
      items.push({ label: 'Attack', action: 'attack', color: '#ff9800' });
    }

    items.push({ label: 'Wait', action: 'wait' });
    items.push({ label: 'Cancel', action: 'cancel' });

    this.drawPopupMenu({
      items,
      worldPos: { q: menu.unit.q, r: menu.unit.r },
      buttonWidth: 80,
      buttonHeight: 28,
    }, zoom);
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
    const teamColor = TEAM_COLORS[u.team]?.primary ?? '#ffffff';
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

  private updateInfoPanel(_zoom: number): void {
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
          let buildingLine = `Building: ${building.type.toUpperCase()} (${ownerStr})`;
          if (building.captureResistance < CAPTURE_RESISTANCE) {
            buildingLine += ` | <span style="color: #ff9800">Capture: ${building.captureResistance}/${CAPTURE_RESISTANCE}</span>`;
          }
          lines.push(buildingLine);
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
      const hints: string[] = [];
      let num = 1;
      if (this.actionMenu.canCapture) {
        hints.push(`${num}=Capture`);
        num++;
      }
      if (this.actionMenu.canAttack) {
        hints.push(`${num}=Attack`);
        num++;
      }
      hints.push(`${num}=Wait`);
      num++;
      hints.push(`${num}=Cancel`);
      lines.push(hints.join(' ') + ' | Arrows+Space');
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
