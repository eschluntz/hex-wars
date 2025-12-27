// ============================================================================
// HEX DOMINION - Main Entry Point
// ============================================================================

import { GEN_PARAMS } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';

class Game {
  private canvas: HTMLCanvasElement;
  private map: GameMap;
  private viewport: Viewport;
  private renderer: Renderer;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.map = new GameMap();
    this.viewport = new Viewport(this.canvas);
    this.renderer = new Renderer(this.canvas, this.map, this.viewport);

    this.centerViewport();
    this.loop();
  }

  private centerViewport(): void {
    const centerQ = Math.floor(GEN_PARAMS.mapWidth / 2);
    const centerR = Math.floor(GEN_PARAMS.mapHeight / 2);
    this.viewport.centerOn(centerQ, centerR);
  }

  private loop = (): void => {
    this.viewport.update();
    this.renderer.render();
    requestAnimationFrame(this.loop);
  };
}

new Game();
