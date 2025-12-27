// ============================================================================
// HEX DOMINION - Main Entry Point
// ============================================================================

import { HexUtil, DEFAULT_TERRAIN_COSTS, TEAM_COLORS, type TerrainCosts, type AxialCoord } from './core.js';
import { GEN_PARAMS, CONFIG, MAP_CONFIGS, type MapConfig } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';
import { Unit } from './unit.js';
import { Pathfinder } from './pathfinder.js';
import { SeededRandom } from './noise.js';
import { Combat } from './combat.js';
import { type Building } from './building.js';
import { getAvailableTemplates, getTemplate } from './unit-templates.js';
import { ResourceManager } from './resources.js';
import { GameStats } from './stats.js';
import { MenuRenderer, type GamePhase, type GameOverData } from './menu.js';

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

// Game state machine
type GameState =
  | { type: 'idle' }
  | { type: 'selected'; unit: Unit }
  | { type: 'moved'; unit: Unit; fromQ: number; fromR: number }
  | { type: 'attacking'; unit: Unit; fromQ: number; fromR: number }
  | { type: 'factory'; factory: Building };

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map!: GameMap;
  private viewport!: Viewport;
  private renderer!: Renderer;
  private pathfinder!: Pathfinder;
  private resources!: ResourceManager;
  private gameStats!: GameStats;
  private menuRenderer: MenuRenderer;
  private units: Unit[] = [];
  private state: GameState = { type: 'idle' };
  private lastPreviewHex: AxialCoord | null = null;
  private currentTeam: string = TEAMS.PLAYER;
  private turnNumber: number = 1;
  private nextUnitId: number = 1;
  private gamePhase: GamePhase = 'main_menu';
  private gameOverData: GameOverData | null = null;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.menuRenderer = new MenuRenderer(this.ctx, this.canvas.width, this.canvas.height);

    this.setupInputHandlers();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.menuRenderer.updateSize(this.canvas.width, this.canvas.height);
  }

  private currentMapType: string = 'normal';

  private startNewGame(mapType: string = 'normal'): void {
    this.currentMapType = mapType;
    const mapConfig = MAP_CONFIGS[mapType];

    this.map = new GameMap(mapConfig);
    this.viewport = new Viewport(this.canvas);
    this.pathfinder = new Pathfinder(this.map);
    this.renderer = new Renderer(this.canvas, this.map, this.viewport);
    this.resources = new ResourceManager([TEAMS.PLAYER, TEAMS.ENEMY]);
    this.gameStats = new GameStats([TEAMS.PLAYER, TEAMS.ENEMY]);

    // Reset game state
    this.units = [];
    this.state = { type: 'idle' };
    this.lastPreviewHex = null;
    this.currentTeam = TEAMS.PLAYER;
    this.turnNumber = 1;
    this.nextUnitId = 1;
    this.gameOverData = null;

    // Give starting resources
    this.resources.addFunds(TEAMS.PLAYER, 5000);
    this.resources.addFunds(TEAMS.ENEMY, 5000);

    // Setup based on map type
    if (mapType === 'small') {
      this.setupSmallMap();
    } else {
      this.spawnUnits();
    }

    // Collect initial income for player (first turn)
    this.collectIncome(TEAMS.PLAYER);

    this.centerViewport();
    this.gamePhase = 'playing';

    // Show UI elements during game
    const infoEl = document.getElementById('coords');
    const hudEl = document.getElementById('hud');
    if (infoEl) infoEl.style.display = 'block';
    if (hudEl) hudEl.style.display = 'block';
  }

  private setupSmallMap(): void {
    const cfg = MAP_CONFIGS.small!;
    const centerR = Math.floor(cfg.height / 2);
    // For hex offset coords, use smaller offsets that stay in bounds
    // At row 5 (centerR), valid q range is roughly -2 to 9 for width=12

    // Player side (left) - q around 1-2
    this.map.addBuilding({ q: 1, r: centerR, type: 'city', owner: TEAMS.PLAYER });
    this.map.addBuilding({ q: 1, r: centerR + 1, type: 'factory', owner: TEAMS.PLAYER });

    // Enemy side (right) - q around 7-8
    this.map.addBuilding({ q: 8, r: centerR, type: 'city', owner: TEAMS.ENEMY });
    this.map.addBuilding({ q: 8, r: centerR + 1, type: 'factory', owner: TEAMS.ENEMY });

    // Spawn one infantry each
    const playerUnit = new Unit('infantry', TEAMS.PLAYER, 3, centerR, {
      speed: 3,
      attack: 4,
      range: 1,
      terrainCosts: DEFAULT_TERRAIN_COSTS,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
      canCapture: true
    });
    this.units.push(playerUnit);

    const enemyUnit = new Unit('infantry', TEAMS.ENEMY, 6, centerR, {
      speed: 3,
      attack: 4,
      range: 1,
      terrainCosts: DEFAULT_TERRAIN_COSTS,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
      canCapture: true
    });
    this.units.push(enemyUnit);

    console.log('Small map setup: 1 city, 1 factory, 1 infantry per team');
  }

  private collectIncome(team: string): void {
    const buildings = this.map.getAllBuildings();
    const income = this.resources.collectIncome(team, buildings);
    if (income.funds > 0 || income.science > 0) {
      console.log(`${team} collected: $${income.funds} funds, ${income.science} science`);
    }
    // Record income in stats
    this.gameStats.recordIncome(team, income.funds, income.science);
  }

  private spawnUnits(): void {
    const cfg = MAP_CONFIGS[this.currentMapType];
    const centerQ = Math.floor((cfg?.width ?? GEN_PARAMS.mapWidth) / 2);
    const centerR = Math.floor((cfg?.height ?? GEN_PARAMS.mapHeight) / 2);

    // Filter tiles near center that are passable
    const centerTiles = this.map.getAllTiles().filter(t => {
      if (t.type !== 'grass' && t.type !== 'road') return false;
      const dist = HexUtil.distance(t.q, t.r, centerQ, centerR);
      return dist <= 5;
    });

    const unitConfigs = [
      // Player units on left side of center
      { id: 'scout', team: TEAMS.PLAYER, speed: 6, attack: 4, range: 1, terrainCosts: DEFAULT_TERRAIN_COSTS, color: '#ffeb3b', offsetQ: -2, offsetR: 0, canCapture: true },
      { id: 'tank', team: TEAMS.PLAYER, speed: 3, attack: 7, range: 1, terrainCosts: DEFAULT_TERRAIN_COSTS, color: '#4caf50', offsetQ: -2, offsetR: 1, canCapture: false },
      { id: 'hover', team: TEAMS.PLAYER, speed: 4, attack: 5, range: 2, terrainCosts: HOVER_TERRAIN_COSTS, color: '#2196f3', offsetQ: -2, offsetR: -1, canCapture: false },
      // Enemy units on right side of center
      { id: 'enemy1', team: TEAMS.ENEMY, speed: 4, attack: 5, range: 1, terrainCosts: DEFAULT_TERRAIN_COSTS, color: '#f44336', offsetQ: 2, offsetR: 0, canCapture: true },
      { id: 'enemy2', team: TEAMS.ENEMY, speed: 4, attack: 6, range: 2, terrainCosts: DEFAULT_TERRAIN_COSTS, color: '#ff5722', offsetQ: 2, offsetR: 1, canCapture: false },
    ];

    for (const config of unitConfigs) {
      // Try to place at offset from center, fall back to nearest valid tile
      let q = centerQ + config.offsetQ;
      let r = centerR + config.offsetR;

      const tile = this.map.getTile(q, r);
      if (!tile || (tile.type !== 'grass' && tile.type !== 'road')) {
        // Find nearest valid tile from center tiles
        const fallback = centerTiles.find(t => !this.units.some(u => u.q === t.q && u.r === t.r));
        if (fallback) {
          q = fallback.q;
          r = fallback.r;
        }
      }

      const unit = new Unit(config.id, config.team, q, r, {
        speed: config.speed,
        attack: config.attack,
        range: config.range,
        terrainCosts: config.terrainCosts,
        color: config.color,
        canCapture: config.canCapture
      });
      this.units.push(unit);
    }

    console.log(`Spawned ${this.units.length} units near center`);
  }

  // --- Position helpers ---

  private getBlockedPositions(forTeam: string): Set<string> {
    const blocked = new Set<string>();
    for (const unit of this.units) {
      if (unit.team !== forTeam && unit.isAlive()) {
        blocked.add(`${unit.q},${unit.r}`);
      }
    }
    return blocked;
  }

  private getOccupiedPositions(excludeUnit: Unit): Set<string> {
    const occupied = new Set<string>();
    for (const unit of this.units) {
      if (unit !== excludeUnit && unit.isAlive()) {
        occupied.add(`${unit.q},${unit.r}`);
      }
    }
    return occupied;
  }

  private getUnitAt(q: number, r: number): Unit | undefined {
    return this.units.find(u => u.q === q && u.r === r && u.isAlive());
  }

  private getEnemiesOf(unit: Unit): Unit[] {
    return this.units.filter(u => u.team !== unit.team && u.isAlive());
  }

  // --- State transitions ---

  private setState(newState: GameState): void {
    this.state = newState;
    this.lastPreviewHex = null;

    // Update renderer based on state
    if (newState.type === 'idle') {
      this.renderer.selectedUnit = null;
      this.renderer.pathPreview = null;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      this.renderer.productionMenu = null;
    } else if (newState.type === 'selected') {
      this.renderer.selectedUnit = newState.unit;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      this.renderer.productionMenu = null;
    } else if (newState.type === 'moved') {
      this.renderer.selectedUnit = newState.unit;
      this.renderer.pathPreview = null;
      const enemies = this.getEnemiesOf(newState.unit);
      const targets = Combat.getTargetsInRange(newState.unit, enemies);

      // Check if unit can capture a building at current position
      const building = this.map.getBuilding(newState.unit.q, newState.unit.r);
      const canCapture = newState.unit.canCapture &&
        building !== undefined &&
        building.owner !== newState.unit.team;

      this.renderer.actionMenu = {
        unit: newState.unit,
        canAttack: targets.length > 0,
        canCapture
      };
      this.renderer.attackTargets = null;
      this.renderer.productionMenu = null;
      this.renderer.menuHighlightIndex = 0;
    } else if (newState.type === 'attacking') {
      this.renderer.selectedUnit = newState.unit;
      this.renderer.actionMenu = null;
      const enemies = this.getEnemiesOf(newState.unit);
      const targets = Combat.getTargetsInRange(newState.unit, enemies);
      this.renderer.attackTargets = {
        unit: newState.unit,
        validTargets: new Set(targets.map(t => `${t.q},${t.r}`))
      };
      this.renderer.productionMenu = null;
    } else if (newState.type === 'factory') {
      this.renderer.selectedUnit = null;
      this.renderer.pathPreview = null;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      this.renderer.productionMenu = {
        factory: newState.factory,
        templates: getAvailableTemplates()
      };
      this.renderer.menuHighlightIndex = 0;
    }
  }

  // --- Input handlers ---

  private setupInputHandlers(): void {
    this.canvas.addEventListener('mousemove', e => {
      this.menuRenderer.updateMouse(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('click', e => {
      // Handle menu clicks
      if (this.gamePhase === 'main_menu') {
        const action = this.menuRenderer.getClickedAction();
        if (action === 'new_game_small') {
          this.startNewGame('small');
        } else if (action === 'new_game_normal') {
          this.startNewGame('normal');
        }
        return;
      }
      if (this.gamePhase === 'game_over') {
        const action = this.menuRenderer.getClickedAction();
        if (action === 'main_menu') {
          this.gamePhase = 'main_menu';
        }
        return;
      }

      // Handle game clicks
      if (this.viewport.isDragging) return;

      const world = this.viewport.screenToWorld(e.clientX, e.clientY);
      const hex = HexUtil.pixelToAxial(world.x, world.y, CONFIG.hexSize);

      this.handleClick(hex);
    });

    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.gamePhase === 'playing') {
        this.handleCancel();
      }
    });

    window.addEventListener('keydown', e => {
      // Menu shortcuts
      if (this.gamePhase === 'main_menu') {
        if (e.key === '1') {
          this.startNewGame('small');
        } else if (e.key === '2' || e.key === 'Enter' || e.key === ' ') {
          this.startNewGame('normal');
        }
        return;
      }
      if (this.gamePhase === 'game_over') {
        if (e.key === 'Enter' || e.key === ' ') {
          this.gamePhase = 'main_menu';
        }
        return;
      }

      // Game shortcuts
      if (e.key === 'Escape') {
        this.handleCancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.endTurn();
      } else if (this.state.type === 'moved') {
        this.handleMenuKeyboard(e);
      } else if (this.state.type === 'factory') {
        this.handleProductionKeyboard(e);
      }
    });
  }

  private endTurn(): void {
    // Cancel any current action
    this.setState({ type: 'idle' });

    // Record turn stats for the team that just finished
    this.recordTurnStats(this.currentTeam);

    // Check for game over before switching
    const loser = this.checkGameOver();
    if (loser) {
      const winner = loser === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
      this.triggerGameOver(winner, loser);
      return;
    }

    // Reset hasActed for current team's units (un-grey them immediately)
    for (const unit of this.units) {
      if (unit.team === this.currentTeam && unit.isAlive()) {
        unit.hasActed = false;
      }
    }

    // Switch teams
    this.currentTeam = this.currentTeam === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;

    // Collect income for the new current team
    this.collectIncome(this.currentTeam);

    // Increment turn number when returning to player
    if (this.currentTeam === TEAMS.PLAYER) {
      this.turnNumber++;
    }

    console.log(`Turn ${this.turnNumber}: ${this.currentTeam}'s turn`);
  }

  private recordTurnStats(team: string): void {
    const teamUnits = this.units.filter(u => u.team === team && u.isAlive()).length;
    const teamBuildings = this.map.getBuildingsByOwner(team).length;
    const res = this.resources.getResources(team);

    this.gameStats.endTurn(
      this.turnNumber,
      team,
      teamUnits,
      teamBuildings,
      res.funds,
      res.science
    );
  }

  private checkGameOver(): string | null {
    // A team loses if they have no cities AND no units
    for (const team of [TEAMS.PLAYER, TEAMS.ENEMY]) {
      const hasCities = this.map.getBuildingsByOwner(team).some(b => b.type === 'city');
      const hasUnits = this.units.some(u => u.team === team && u.isAlive());

      if (!hasCities && !hasUnits) {
        return team; // This team lost
      }
    }
    return null;
  }

  private checkAndTriggerGameOver(): void {
    const loser = this.checkGameOver();
    if (loser) {
      const winner = loser === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
      this.triggerGameOver(winner, loser);
    }
  }

  private triggerGameOver(winner: string, loser: string): void {
    // Record final stats for both teams
    this.recordTurnStats(TEAMS.PLAYER);
    this.recordTurnStats(TEAMS.ENEMY);

    this.gameOverData = {
      winner,
      loser,
      turnCount: this.turnNumber,
      stats: this.gameStats.getAllStats()
    };

    this.gamePhase = 'game_over';

    // Hide UI elements
    const infoEl = document.getElementById('coords');
    const hudEl = document.getElementById('hud');
    if (infoEl) infoEl.style.display = 'none';
    if (hudEl) hudEl.style.display = 'none';

    console.log(`Game Over! ${winner.toUpperCase()} wins in ${this.turnNumber} turns!`);
  }

  private getActiveUnitsCount(): number {
    return this.units.filter(u => u.team === this.currentTeam && u.isAlive() && !u.hasActed).length;
  }

  private getTotalUnitsCount(): number {
    return this.units.filter(u => u.team === this.currentTeam && u.isAlive()).length;
  }

  private handleMenuKeyboard(e: KeyboardEvent): void {
    const buttonCount = this.renderer.getMenuButtonCount();
    if (buttonCount === 0) return;

    // Number keys 1-9
    if (e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      const action = this.renderer.getMenuAction(index);
      if (action) {
        this.executeMenuAction(action);
      }
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.renderer.menuHighlightIndex = (this.renderer.menuHighlightIndex - 1 + buttonCount) % buttonCount;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.renderer.menuHighlightIndex = (this.renderer.menuHighlightIndex + 1) % buttonCount;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = this.renderer.getMenuAction(this.renderer.menuHighlightIndex);
      if (action) {
        this.executeMenuAction(action);
      }
    }
  }

  private handleProductionKeyboard(e: KeyboardEvent): void {
    const buttonCount = this.renderer.getMenuButtonCount();
    if (buttonCount === 0) return;

    // Number keys 1-9
    if (e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      const action = this.renderer.getMenuAction(index);
      if (action) {
        this.executeProductionAction(action);
      }
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.renderer.menuHighlightIndex = (this.renderer.menuHighlightIndex - 1 + buttonCount) % buttonCount;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.renderer.menuHighlightIndex = (this.renderer.menuHighlightIndex + 1) % buttonCount;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = this.renderer.getMenuAction(this.renderer.menuHighlightIndex);
      if (action) {
        this.executeProductionAction(action);
      }
    }
  }

  private executeMenuAction(action: string): void {
    if (this.state.type !== 'moved') return;

    const unit = this.state.unit;
    if (action === 'wait') {
      unit.hasActed = true;
      this.setState({ type: 'idle' });
    } else if (action === 'cancel') {
      unit.q = this.state.fromQ;
      unit.r = this.state.fromR;
      this.setState({ type: 'selected', unit });
    } else if (action === 'attack') {
      this.setState({ type: 'attacking', unit, fromQ: this.state.fromQ, fromR: this.state.fromR });
    } else if (action === 'capture') {
      const building = this.map.getBuilding(unit.q, unit.r);
      if (building && building.owner !== unit.team) {
        const previousOwner = building.owner ?? 'neutral';
        this.map.setBuildingOwner(unit.q, unit.r, unit.team);
        this.gameStats.recordBuildingCaptured(unit.team);
        console.log(`${unit.id} captured ${building.type} from ${previousOwner}!`);
      }
      unit.hasActed = true;
      this.setState({ type: 'idle' });

      // Check for game over after capture (enemy may have lost last city)
      this.checkAndTriggerGameOver();
    }
  }

  private handleClick(hex: AxialCoord): void {
    const clickedUnit = this.getUnitAt(hex.q, hex.r);

    switch (this.state.type) {
      case 'idle': {
        if (clickedUnit && clickedUnit.team === this.currentTeam && !clickedUnit.hasActed) {
          this.setState({ type: 'selected', unit: clickedUnit });
        } else if (!clickedUnit) {
          // Check if clicked on an owned factory
          const building = this.map.getBuilding(hex.q, hex.r);
          if (building && building.type === 'factory' && building.owner === this.currentTeam) {
            this.setState({ type: 'factory', factory: building });
          }
        }
        break;
      }

      case 'selected': {
        const unit = this.state.unit;

        if (clickedUnit === unit) {
          // Clicked same unit - enter moved state without moving
          this.setState({ type: 'moved', unit, fromQ: unit.q, fromR: unit.r });
        } else if (clickedUnit && clickedUnit.team === this.currentTeam && !clickedUnit.hasActed) {
          // Clicked another friendly unmoved unit - select it instead
          this.setState({ type: 'selected', unit: clickedUnit });
        } else if (!clickedUnit) {
          // Clicked empty tile - try to move
          this.tryMove(unit, hex);
        }
        break;
      }

      case 'moved': {
        // Check if clicked on action menu buttons (handled by renderer hit detection)
        const action = this.renderer.getActionMenuClick();
        if (action) {
          this.executeMenuAction(action);
        }
        break;
      }

      case 'attacking': {
        const unit = this.state.unit;
        const targetKey = `${hex.q},${hex.r}`;
        const validTargets = this.renderer.attackTargets?.validTargets;

        if (validTargets?.has(targetKey)) {
          const target = this.getUnitAt(hex.q, hex.r)!;
          this.executeAttack(unit, target);
          unit.hasActed = true;
          this.setState({ type: 'idle' });

          // Check for game over after combat
          this.checkAndTriggerGameOver();
        }
        break;
      }

      case 'factory': {
        // Check if clicked on production menu buttons
        const action = this.renderer.getActionMenuClick();
        if (action) {
          this.executeProductionAction(action);
        }
        break;
      }
    }
  }

  private executeProductionAction(action: string): void {
    if (this.state.type !== 'factory') return;

    if (action === 'cancel') {
      this.setState({ type: 'idle' });
      return;
    }

    if (action.startsWith('build_')) {
      const templateId = action.slice(6); // Remove 'build_' prefix
      const template = getTemplate(templateId);
      const factory = this.state.factory;

      if (!this.resources.canAfford(this.currentTeam, template.cost)) {
        console.log(`Cannot afford ${template.name} ($${template.cost})`);
        return;
      }

      // Spend funds and create unit
      this.resources.spendFunds(this.currentTeam, template.cost);

      const teamColors = TEAM_COLORS[this.currentTeam]!;
      const unit = new Unit(
        `${template.id}_${this.nextUnitId++}`,
        this.currentTeam,
        factory.q,
        factory.r,
        {
          speed: template.speed,
          attack: template.attack,
          range: template.range,
          terrainCosts: template.terrainCosts,
          color: teamColors.unitColor,
          canCapture: template.canCapture
        }
      );
      unit.hasActed = true; // New units can't act this turn
      this.units.push(unit);

      console.log(`Built ${template.name} at (${factory.q}, ${factory.r}) for $${template.cost}`);
      this.setState({ type: 'idle' });
    }
  }

  private handleCancel(): void {
    switch (this.state.type) {
      case 'selected':
        this.setState({ type: 'idle' });
        break;
      case 'moved':
        // Cancel returns to selected (movement not undone yet)
        this.state.unit.q = this.state.fromQ;
        this.state.unit.r = this.state.fromR;
        this.setState({ type: 'selected', unit: this.state.unit });
        break;
      case 'attacking':
        // Go back to moved state
        this.setState({ type: 'moved', unit: this.state.unit, fromQ: this.state.fromQ, fromR: this.state.fromR });
        break;
      case 'factory':
        this.setState({ type: 'idle' });
        break;
    }
  }

  private tryMove(unit: Unit, destination: AxialCoord): void {
    const blocked = this.getBlockedPositions(unit.team);
    const occupied = this.getOccupiedPositions(unit);
    const fromQ = unit.q;
    const fromR = unit.r;

    const result = this.pathfinder.findPath(
      unit.q, unit.r,
      destination.q, destination.r,
      unit.terrainCosts,
      blocked
    );

    if (result) {
      const reachableIdx = unit.getReachableIndex(result.path, this.map, occupied);
      if (reachableIdx > 0) {
        const dest = result.path[reachableIdx]!;
        unit.q = dest.q;
        unit.r = dest.r;
        this.setState({ type: 'moved', unit, fromQ, fromR });
        return;
      }
    }

    console.log('No valid path to destination');
  }

  private executeAttack(attacker: Unit, defender: Unit): void {
    const result = Combat.execute(attacker, defender);

    console.log(`${attacker.id} attacks ${defender.id}!`);
    console.log(`  ${attacker.id} deals ${result.attackerDamage} damage`);
    if (result.defenderDied) {
      console.log(`  ${defender.id} destroyed!`);
      this.gameStats.recordUnitKilled(attacker.team, defender.team);
    } else if (result.defenderDamage > 0) {
      console.log(`  ${defender.id} counter-attacks for ${result.defenderDamage} damage`);
      if (result.attackerDied) {
        console.log(`  ${attacker.id} destroyed!`);
        this.gameStats.recordUnitKilled(defender.team, attacker.team);
      }
    }
  }

  // --- Path preview ---

  private updatePathPreview(): void {
    if (this.state.type !== 'selected') {
      this.renderer.pathPreview = null;
      return;
    }

    const unit = this.state.unit;
    const hoveredHex = this.renderer.hoveredHex;

    if (!hoveredHex) {
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
    if (hoveredHex.q === unit.q && hoveredHex.r === unit.r) {
      this.renderer.pathPreview = null;
      return;
    }

    // Compute path with enemy blocking
    const blocked = this.getBlockedPositions(unit.team);
    const result = this.pathfinder.findPath(
      unit.q, unit.r,
      hoveredHex.q, hoveredHex.r,
      unit.terrainCosts,
      blocked
    );

    if (!result) {
      this.renderer.pathPreview = null;
      return;
    }

    const occupied = this.getOccupiedPositions(unit);
    this.renderer.pathPreview = {
      path: result.path,
      reachableIndex: unit.getReachableIndex(result.path, this.map, occupied)
    };
  }

  // --- Game loop ---

  private centerViewport(): void {
    const cfg = MAP_CONFIGS[this.currentMapType];
    const centerQ = Math.floor((cfg?.width ?? GEN_PARAMS.mapWidth) / 2);
    const centerR = Math.floor((cfg?.height ?? GEN_PARAMS.mapHeight) / 2);
    this.viewport.centerOn(centerQ, centerR);
  }

  private loop = (): void => {
    if (this.gamePhase === 'main_menu') {
      this.menuRenderer.renderMainMenu();
    } else if (this.gamePhase === 'game_over' && this.gameOverData) {
      this.menuRenderer.renderGameOver(this.gameOverData);
    } else if (this.gamePhase === 'playing') {
      this.viewport.update();
      this.updatePathPreview();
      this.renderer.units = this.units.filter(u => u.isAlive());
      this.renderer.currentTeam = this.currentTeam;
      this.renderer.turnNumber = this.turnNumber;
      this.renderer.activeUnits = this.getActiveUnitsCount();
      this.renderer.totalUnits = this.getTotalUnitsCount();
      this.renderer.resources = this.resources.getResources(this.currentTeam);
      this.renderer.render();
    }
    requestAnimationFrame(this.loop);
  };
}

new Game();
