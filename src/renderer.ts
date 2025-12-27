// ============================================================================
// HEX DOMINION - Renderer
// ============================================================================

import { HexUtil, TILE_COLORS, TILE_ICONS, type AxialCoord, type Tile } from './core.js';
import { CONFIG } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: GameMap;
  private viewport: Viewport;
  hoveredHex: AxialCoord | null = null;

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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Zoom: ${(zoom * 100).toFixed(0)}%`, 10, this.canvas.height - 40);

    if (this.hoveredHex) {
      const tile = this.map.getTile(this.hoveredHex.q, this.hoveredHex.r);
      const coordsEl = document.getElementById('coords');
      if (coordsEl) {
        if (tile) {
          coordsEl.textContent = `Hex (${this.hoveredHex.q}, ${this.hoveredHex.r}) — ${tile.type}`;
        } else {
          coordsEl.textContent = `Hex (${this.hoveredHex.q}, ${this.hoveredHex.r}) — empty`;
        }
      }
    }
  }
}
