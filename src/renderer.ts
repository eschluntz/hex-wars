// ============================================================================
// HEX DOMINION - Renderer
// ============================================================================

import { HexUtil, TILE_COLORS, TILE_ICONS, type AxialCoord, type Tile } from './core.js';
import { CONFIG } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Unit } from './unit.js';

export interface PathPreview {
  path: AxialCoord[];
  reachableIndex: number;  // last index the unit can reach this turn
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: GameMap;
  private viewport: Viewport;
  hoveredHex: AxialCoord | null = null;
  units: Unit[] = [];
  selectedUnit: Unit | null = null;
  pathPreview: PathPreview | null = null;

  constructor(canvas: HTMLCanvasElement, map: GameMap, viewport: Viewport) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.map = map;
    this.viewport = viewport;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousemove', e => {
      if (!this.viewport.isDragging) {
        const world = this.viewport.screenToWorld(e.clientX, e.clientY);
        this.hoveredHex = HexUtil.pixelToAxial(world.x, world.y, CONFIG.hexSize);
      }
    });
  }

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
    const color = (unit as any).color || '#ffffff';

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

    if (isHovered) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 3 * zoom);
      ctx.stroke();
    }

    const icon = TILE_ICONS[tile.type];
    if (icon && zoom > 0.4) {
      ctx.font = `${size * 0.5}px Arial`;
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

    this.updateInfoPanel(zoom);
  }

  private updateInfoPanel(zoom: number): void {
    const infoEl = document.getElementById('coords');
    if (!infoEl) return;

    const lines: string[] = [];

    // Zoom
    lines.push(`Zoom: ${(zoom * 100).toFixed(0)}%`);

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
      lines.push(`Unit: ${u.id.toUpperCase()} | Speed: ${u.speed}`);
      lines.push(`Costs: grass=${fmt(costs.grass)} road=${fmt(costs.road)} woods=${fmt(costs.woods)} water=${fmt(costs.water)} mountain=${fmt(costs.mountain)}`);
    }

    infoEl.innerHTML = lines.join('<br>');
  }
}
