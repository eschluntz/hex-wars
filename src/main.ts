// ============================================================================
// HEX DOMINION - Main Entry Point
// ============================================================================

import { HexUtil, DEFAULT_TERRAIN_COSTS, type TerrainCosts, type AxialCoord } from './core.js';
import { GEN_PARAMS, CONFIG } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Renderer, type PathPreview } from './renderer.js';
import { Unit } from './unit.js';
import { Pathfinder } from './pathfinder.js';
import { SeededRandom } from './noise.js';

const HOVER_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  water: 1.5
};

const MOUNTAIN_TERRAIN_COSTS: TerrainCosts = {
  ...DEFAULT_TERRAIN_COSTS,
  mountain: 2,
  woods: 1
};

const TEAMS = {
  PLAYER: 'player',
  ENEMY: 'enemy'
};

class Game {
  private canvas: HTMLCanvasElement;
  private map: GameMap;
  private viewport: Viewport;
  private renderer: Renderer;
  private pathfinder: Pathfinder;
  private units: Unit[] = [];
  private selectedUnit: Unit | null = null;
  private lastPreviewHex: AxialCoord | null = null;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.map = new GameMap();
    this.viewport = new Viewport(this.canvas);
    this.pathfinder = new Pathfinder(this.map);
    this.renderer = new Renderer(this.canvas, this.map, this.viewport);

    this.spawnUnits();
    this.setupClickHandler();
    this.centerViewport();
    this.loop();
  }

  private spawnUnits(): void {
    const rng = new SeededRandom(GEN_PARAMS.seed + 5000);
    const tiles = this.map.getAllTiles().filter(t =>
      t.type === 'grass' || t.type === 'road'
    );

    const unitConfigs = [
      { id: 'scout', team: TEAMS.PLAYER, speed: 6, costs: DEFAULT_TERRAIN_COSTS, color: '#ffeb3b' },
      { id: 'tank', team: TEAMS.PLAYER, speed: 3, costs: DEFAULT_TERRAIN_COSTS, color: '#4caf50' },
      { id: 'hover', team: TEAMS.PLAYER, speed: 4, costs: HOVER_TERRAIN_COSTS, color: '#2196f3' },
      { id: 'enemy1', team: TEAMS.ENEMY, speed: 4, costs: DEFAULT_TERRAIN_COSTS, color: '#f44336' },
      { id: 'enemy2', team: TEAMS.ENEMY, speed: 4, costs: DEFAULT_TERRAIN_COSTS, color: '#ff5722' },
    ];

    for (const config of unitConfigs) {
      const idx = rng.nextInt(0, tiles.length - 1);
      const tile = tiles[idx]!;
      const unit = new Unit(config.id, config.team, tile.q, tile.r, config.speed, config.costs);
      (unit as any).color = config.color;
      this.units.push(unit);
    }

    console.log(`Spawned ${this.units.length} units`);
  }

  private getBlockedPositions(forTeam: string): Set<string> {
    const blocked = new Set<string>();
    for (const unit of this.units) {
      if (unit.team !== forTeam) {
        blocked.add(`${unit.q},${unit.r}`);
      }
    }
    return blocked;
  }

  private getOccupiedPositions(excludeUnit: Unit): Set<string> {
    const occupied = new Set<string>();
    for (const unit of this.units) {
      if (unit !== excludeUnit) {
        occupied.add(`${unit.q},${unit.r}`);
      }
    }
    return occupied;
  }

  private setupClickHandler(): void {
    this.canvas.addEventListener('click', e => {
      if (this.viewport.isDragging) return;

      const world = this.viewport.screenToWorld(e.clientX, e.clientY);
      const hex = HexUtil.pixelToAxial(world.x, world.y, CONFIG.hexSize);

      const clickedUnit = this.units.find(u => u.q === hex.q && u.r === hex.r);

      if (clickedUnit) {
        this.selectUnit(clickedUnit);
      } else if (this.selectedUnit) {
        const blocked = this.getBlockedPositions(this.selectedUnit.team);
        const occupied = this.getOccupiedPositions(this.selectedUnit);

        const result = this.pathfinder.findPath(
          this.selectedUnit.q, this.selectedUnit.r,
          hex.q, hex.r,
          this.selectedUnit.terrainCosts,
          blocked
        );

        if (result) {
          const reachableIdx = this.selectedUnit.getReachableIndex(result.path, this.map, occupied);
          if (reachableIdx > 0) {
            const destination = result.path[reachableIdx]!;
            this.selectedUnit.q = destination.q;
            this.selectedUnit.r = destination.r;
            console.log(`${this.selectedUnit.id} moved to (${destination.q}, ${destination.r})`);
          } else {
            console.log('Cannot reach any tile along path');
          }
        } else {
          console.log('No valid path to destination');
        }
        this.deselectUnit();
      }
    });

    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.deselectUnit();
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.deselectUnit();
      }
    });
  }

  private selectUnit(unit: Unit): void {
    this.selectedUnit = unit;
    this.renderer.selectedUnit = unit;
    console.log(`Selected: ${unit.id} (speed: ${unit.speed})`);
  }

  private deselectUnit(): void {
    this.selectedUnit = null;
    this.renderer.selectedUnit = null;
    this.renderer.pathPreview = null;
    this.lastPreviewHex = null;
  }

  private updatePathPreview(): void {
    const hoveredHex = this.renderer.hoveredHex;

    // No unit selected or no hover - clear preview
    if (!this.selectedUnit || !hoveredHex) {
      this.renderer.pathPreview = null;
      this.lastPreviewHex = null;
      return;
    }

    // Same hex as last frame - skip recomputation
    if (this.lastPreviewHex &&
        this.lastPreviewHex.q === hoveredHex.q &&
        this.lastPreviewHex.r === hoveredHex.r) {
      return;
    }
    this.lastPreviewHex = { q: hoveredHex.q, r: hoveredHex.r };

    // Hovering over the unit itself - no preview
    if (hoveredHex.q === this.selectedUnit.q && hoveredHex.r === this.selectedUnit.r) {
      this.renderer.pathPreview = null;
      return;
    }

    // Compute path with enemy blocking
    const blocked = this.getBlockedPositions(this.selectedUnit.team);
    const result = this.pathfinder.findPath(
      this.selectedUnit.q, this.selectedUnit.r,
      hoveredHex.q, hoveredHex.r,
      this.selectedUnit.terrainCosts,
      blocked
    );

    if (!result) {
      this.renderer.pathPreview = null;
      return;
    }

    // Calculate reachable index, accounting for occupied tiles
    const occupied = this.getOccupiedPositions(this.selectedUnit);
    this.renderer.pathPreview = {
      path: result.path,
      reachableIndex: this.selectedUnit.getReachableIndex(result.path, this.map, occupied)
    };
  }

  private centerViewport(): void {
    const centerQ = Math.floor(GEN_PARAMS.mapWidth / 2);
    const centerR = Math.floor(GEN_PARAMS.mapHeight / 2);
    this.viewport.centerOn(centerQ, centerR);
  }

  private loop = (): void => {
    this.viewport.update();
    this.updatePathPreview();
    this.renderer.units = this.units;
    this.renderer.render();
    requestAnimationFrame(this.loop);
  };
}

new Game();
