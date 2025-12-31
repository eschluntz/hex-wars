// ============================================================================
// HEX DOMINION - Viewport
// ============================================================================

import { HexUtil, type AxialCoord, type PixelCoord } from './core.js';
import { CONFIG } from './config.js';

export class Viewport {
  private canvas: HTMLCanvasElement;
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  zoom = 1;
  private targetZoom = 1;
  private minZoom = 0.25;
  private maxZoom = 3;
  private keys = { w: false, a: false, s: false, d: false };
  private isMouseDown = false;
  isDragging = false;  // True only if mouse actually moved during drag
  private dragStart = { x: 0, y: 0, viewX: 0, viewY: 0 };
  inputDisabled = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupInput();
  }

  private setupInput(): void {
    window.addEventListener('keydown', e => {
      if (this.inputDisabled) return;
      const k = e.key.toLowerCase() as keyof typeof this.keys;
      if (k in this.keys) {
        this.keys[k] = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase() as keyof typeof this.keys;
      if (k in this.keys) this.keys[k] = false;
    });

    this.canvas.addEventListener('mousedown', e => {
      this.isMouseDown = true;
      this.isDragging = false;  // Not dragging until mouse moves
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        viewX: this.x,
        viewY: this.y
      };
    });

    window.addEventListener('mousemove', e => {
      if (this.isMouseDown) {
        // Only count as dragging if mouse moved more than a few pixels
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (!this.isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          this.isDragging = true;
        }
        if (this.isDragging) {
          this.x = this.dragStart.viewX - dx / this.zoom;
          this.y = this.dragStart.viewY - dy / this.zoom;
          this.targetX = this.x;
          this.targetY = this.y;
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();

      const mouseWorld = this.screenToWorld(e.clientX, e.clientY);

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * zoomFactor));

      this.zoom = this.zoom + (this.targetZoom - this.zoom) * 0.3;

      const mouseWorldAfter = this.screenToWorld(e.clientX, e.clientY);
      this.x += mouseWorld.x - mouseWorldAfter.x;
      this.y += mouseWorld.y - mouseWorldAfter.y;
      this.targetX = this.x;
      this.targetY = this.y;
    }, { passive: false });
  }

  centerOn(q: number, r: number): void {
    const pos = HexUtil.axialToPixel(q, r, CONFIG.hexSize);
    this.x = this.targetX = pos.x;
    this.y = this.targetY = pos.y;
  }

  panTo(q: number, r: number): void {
    const pos = HexUtil.axialToPixel(q, r, CONFIG.hexSize);
    this.targetX = pos.x;
    this.targetY = pos.y;
  }

  setPosition(x: number, y: number, zoom: number): void {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
    this.zoom = this.targetZoom = zoom;
  }

  update(): void {
    const panSpeed = CONFIG.panSpeed / this.zoom;
    if (this.keys.w) this.targetY -= panSpeed;
    if (this.keys.s) this.targetY += panSpeed;
    if (this.keys.a) this.targetX -= panSpeed;
    if (this.keys.d) this.targetX += panSpeed;

    this.x += (this.targetX - this.x) * 0.15;
    this.y += (this.targetY - this.y) * 0.15;
    this.zoom += (this.targetZoom - this.zoom) * 0.15;
  }

  worldToScreen(wx: number, wy: number): PixelCoord {
    return {
      x: (wx - this.x) * this.zoom + this.canvas.width / 2,
      y: (wy - this.y) * this.zoom + this.canvas.height / 2
    };
  }

  screenToWorld(sx: number, sy: number): PixelCoord {
    return {
      x: (sx - this.canvas.width / 2) / this.zoom + this.x,
      y: (sy - this.canvas.height / 2) / this.zoom + this.y
    };
  }
}
