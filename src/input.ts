// ============================================================================
// HEX DOMINION - Input Handler
// ============================================================================

import { HexUtil, type AxialCoord } from './core.js';
import { CONFIG } from './config.js';
import { type Viewport } from './viewport.js';

export interface InputCallbacks {
  // Menu phase handlers
  onMainMenuAction: (action: string) => void;
  onGameOverAction: (action: string) => void;

  // Game phase handlers
  onHexClick: (hex: AxialCoord) => void;
  onCancel: () => void;
  onEndTurn: () => void;
  onMenuNavigate: (direction: 'up' | 'down') => void;
  onMenuSelect: (index: number) => void;  // -1 for current highlight
  onMenuMouseMove: (x: number, y: number) => void;

  // State queries
  getPhase: () => 'main_menu' | 'playing' | 'game_over';
  getMenuContext: () => 'none' | 'action' | 'production';
  isDragging: () => boolean;
}

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private viewport: Viewport;
  private callbacks: InputCallbacks;

  constructor(canvas: HTMLCanvasElement, viewport: Viewport, callbacks: InputCallbacks) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.callbacks = callbacks;
    this.setup();
  }

  updateViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  private setup(): void {
    this.canvas.addEventListener('mousemove', e => {
      this.callbacks.onMenuMouseMove(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('click', e => {
      this.handleClick(e);
    });

    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.callbacks.getPhase() === 'playing') {
        this.callbacks.onCancel();
      }
    });

    window.addEventListener('keydown', e => {
      this.handleKeydown(e);
    });
  }

  private handleClick(e: MouseEvent): void {
    const phase = this.callbacks.getPhase();

    if (phase === 'main_menu') {
      this.callbacks.onMainMenuAction('click');
      return;
    }

    if (phase === 'game_over') {
      this.callbacks.onGameOverAction('click');
      return;
    }

    // Playing phase
    if (this.callbacks.isDragging()) return;

    const world = this.viewport.screenToWorld(e.clientX, e.clientY);
    const hex = HexUtil.pixelToAxial(world.x, world.y, CONFIG.hexSize);
    this.callbacks.onHexClick(hex);
  }

  private handleKeydown(e: KeyboardEvent): void {
    const phase = this.callbacks.getPhase();

    if (phase === 'main_menu') {
      if (e.key === '1') {
        document.getElementById('btn-small-map')?.click();
      } else if (e.key === '2' || e.key === 'Enter' || e.key === ' ') {
        document.getElementById('btn-normal-map')?.click();
      }
      return;
    }

    if (phase === 'game_over') {
      if (e.key === 'Enter' || e.key === ' ') {
        this.callbacks.onGameOverAction('main_menu');
      }
      return;
    }

    // Playing phase
    if (e.key === 'Escape') {
      this.callbacks.onCancel();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.repeat) {  // Ignore auto-repeat from holding the key
        this.callbacks.onEndTurn();
      }
      return;
    }


    // Menu navigation (when in action, production, or lab menu)
    const menuContext = this.callbacks.getMenuContext();
    if (menuContext !== 'none') {
      this.handleMenuKeyboard(e, menuContext);
    }
  }

  private handleMenuKeyboard(e: KeyboardEvent, _context: 'action' | 'production'): void {
    // Number keys 1-9
    if (e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      this.callbacks.onMenuSelect(index);
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.callbacks.onMenuNavigate('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.callbacks.onMenuNavigate('down');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.callbacks.onMenuSelect(-1); // -1 = use current highlight
    }
  }
}
