// ============================================================================
// HEX DOMINION - Main Entry Point
// ============================================================================

import { HexUtil, TEAM_COLORS, type AxialCoord } from './core.js';
import { GEN_PARAMS, CONFIG, MAP_CONFIGS } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';
import { Unit } from './unit.js';
import { Pathfinder } from './pathfinder.js';
import { Combat } from './combat.js';
import { type Building } from './building.js';
import {
  getAvailableTemplates,
  getTemplate,
  getTeamTemplates,
  getTeamTemplate,
  initTeamTemplates,
  registerTemplate,
  updateTemplate,
  unregisterTemplate,
  isNameTaken,
} from './unit-templates.js';
import {
  createEmptyDesign,
  createDesignFromTemplate,
  selectChassis,
  selectWeapon,
  toggleSystem,
  getDesignPreview,
  type DesignState,
} from './unit-designer.js';
import { ResourceManager } from './resources.js';
import { GameStats } from './stats.js';
import { MenuRenderer, type GamePhase, type GameOverData } from './menu.js';
import { InputHandler } from './input.js';
import { initTeamResearch } from './research.js';

const TEAMS = {
  PLAYER: 'player',
  ENEMY: 'enemy'
};

// Game state machine
type LabPhase = 'list' | 'designing';

type GameState =
  | { type: 'idle' }
  | { type: 'selected'; unit: Unit }
  | { type: 'moved'; unit: Unit; fromQ: number; fromR: number }
  | { type: 'attacking'; unit: Unit; fromQ: number; fromR: number }
  | { type: 'factory'; factory: Building }
  | { type: 'lab'; lab: Building; phase: LabPhase; design: DesignState; editingId?: string };

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
  private inputHandler!: InputHandler;
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

    // Create a dummy viewport for initial input handler setup
    this.viewport = new Viewport(this.canvas);
    this.setupInputHandler();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  private setupInputHandler(): void {
    this.inputHandler = new InputHandler(this.canvas, this.viewport, {
      onMainMenuAction: (action) => {
        if (action === 'click') {
          const menuAction = this.menuRenderer.getClickedAction();
          if (menuAction === 'new_game_small') this.startNewGame('small');
          else if (menuAction === 'new_game_normal') this.startNewGame('normal');
        } else if (action === 'small') {
          this.startNewGame('small');
        } else if (action === 'normal') {
          this.startNewGame('normal');
        }
      },
      onGameOverAction: (action) => {
        if (action === 'click') {
          const menuAction = this.menuRenderer.getClickedAction();
          if (menuAction === 'main_menu') this.gamePhase = 'main_menu';
        } else if (action === 'main_menu') {
          this.gamePhase = 'main_menu';
        }
      },
      onHexClick: (hex) => this.handleClick(hex),
      onCancel: () => this.handleCancel(),
      onEndTurn: () => this.endTurn(),
      onMenuNavigate: (direction) => {
        const buttonCount = this.renderer.getMenuButtonCount();
        if (buttonCount === 0) return;
        if (direction === 'up') {
          this.renderer.menuHighlightIndex = (this.renderer.menuHighlightIndex - 1 + buttonCount) % buttonCount;
        } else {
          this.renderer.menuHighlightIndex = (this.renderer.menuHighlightIndex + 1) % buttonCount;
        }
      },
      onMenuSelect: (index) => {
        // Special case: -2 means confirm/save in lab
        if (index === -2 && this.state.type === 'lab') {
          this.executeLabAction('confirm_name');
          return;
        }

        const action = index === -1
          ? this.renderer.getMenuAction(this.renderer.menuHighlightIndex)
          : this.renderer.getMenuAction(index);
        if (!action) return;

        if (this.state.type === 'moved') {
          this.executeMenuAction(action);
        } else if (this.state.type === 'factory') {
          this.executeProductionAction(action);
        } else if (this.state.type === 'lab') {
          this.executeLabAction(action);
        }
      },
      onMenuMouseMove: (x, y) => this.menuRenderer.updateMouse(x, y),
      getPhase: () => this.gamePhase,
      getMenuContext: () => {
        if (this.state.type === 'moved') return 'action';
        if (this.state.type === 'factory') return 'production';
        if (this.state.type === 'lab') return 'lab';
        return 'none';
      },
      onLabNameInput: (char: string) => {
        console.log('onLabNameInput callback:', char, 'state:', this.state.type, this.state.type === 'lab' ? (this.state as any).phase : 'N/A');
        if (this.state.type === 'lab' && this.state.phase === 'designing') {
          this.renderer.handleLabNameInput(char);
        }
      },
      onLabNameBackspace: () => {
        console.log('onLabNameBackspace callback, state:', this.state.type, this.state.type === 'lab' ? (this.state as any).phase : 'N/A');
        if (this.state.type === 'lab' && this.state.phase === 'designing') {
          this.renderer.handleLabNameBackspace();
        }
      },
      isDragging: () => this.viewport.isDragging
    });
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
    this.inputHandler.updateViewport(this.viewport);
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

    // Initialize per-team templates and research
    initTeamTemplates(TEAMS.PLAYER);
    initTeamTemplates(TEAMS.ENEMY);
    initTeamResearch(TEAMS.PLAYER);
    initTeamResearch(TEAMS.ENEMY);

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
    this.map.addBuilding({ q: 1, r: centerR - 1, type: 'lab', owner: TEAMS.PLAYER });

    // Enemy side (right) - q around 7-8
    this.map.addBuilding({ q: 8, r: centerR, type: 'city', owner: TEAMS.ENEMY });
    this.map.addBuilding({ q: 8, r: centerR + 1, type: 'factory', owner: TEAMS.ENEMY });
    this.map.addBuilding({ q: 8, r: centerR - 1, type: 'lab', owner: TEAMS.ENEMY });

    // Spawn one soldier each (using soldier template stats)
    const soldierTemplate = getTemplate('soldier');
    const playerUnit = new Unit('soldier', TEAMS.PLAYER, 3, centerR, {
      speed: soldierTemplate.speed,
      attack: soldierTemplate.attack,
      range: soldierTemplate.range,
      terrainCosts: soldierTemplate.terrainCosts,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
      canCapture: soldierTemplate.canCapture,
      canBuild: soldierTemplate.canBuild,
      armored: soldierTemplate.armored,
      armorPiercing: soldierTemplate.armorPiercing,
    });
    this.units.push(playerUnit);

    const enemyUnit = new Unit('soldier', TEAMS.ENEMY, 6, centerR, {
      speed: soldierTemplate.speed,
      attack: soldierTemplate.attack,
      range: soldierTemplate.range,
      terrainCosts: soldierTemplate.terrainCosts,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
      canCapture: soldierTemplate.canCapture,
      canBuild: soldierTemplate.canBuild,
      armored: soldierTemplate.armored,
      armorPiercing: soldierTemplate.armorPiercing,
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

    // Use templates for spawning units
    const soldierT = getTemplate('soldier');
    const tankT = getTemplate('tank');
    const reconT = getTemplate('recon');

    const unitConfigs = [
      // Player units on left side of center
      { template: reconT, team: TEAMS.PLAYER, offsetQ: -2, offsetR: 0 },
      { template: tankT, team: TEAMS.PLAYER, offsetQ: -2, offsetR: 1 },
      { template: soldierT, team: TEAMS.PLAYER, offsetQ: -2, offsetR: -1 },
      // Enemy units on right side of center
      { template: soldierT, team: TEAMS.ENEMY, offsetQ: 2, offsetR: 0 },
      { template: tankT, team: TEAMS.ENEMY, offsetQ: 2, offsetR: 1 },
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

      const teamColors = TEAM_COLORS[config.team]!;
      const unit = new Unit(`${config.template.id}_${this.nextUnitId++}`, config.team, q, r, {
        speed: config.template.speed,
        attack: config.template.attack,
        range: config.template.range,
        terrainCosts: config.template.terrainCosts,
        color: teamColors.unitColor,
        canCapture: config.template.canCapture,
        canBuild: config.template.canBuild,
        armored: config.template.armored,
        armorPiercing: config.template.armorPiercing,
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
      this.renderer.labMenu = null;
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
        templates: getTeamTemplates(this.currentTeam)
      };
      this.renderer.labMenu = null;
      this.renderer.menuHighlightIndex = 0;
    } else if (newState.type === 'lab') {
      this.renderer.selectedUnit = null;
      this.renderer.pathPreview = null;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      this.renderer.productionMenu = null;

      // Preserve nameInput when staying in designing phase
      const currentNameInput = this.renderer.labMenu?.nameInput ?? '';
      const isStayingInDesigning = this.renderer.labMenu?.phase === 'designing' && newState.phase === 'designing';

      let nameInput: string;
      if (isStayingInDesigning) {
        // Keep current name when just changing components
        nameInput = currentNameInput;
      } else if (newState.editingId) {
        // Load name from template when editing
        nameInput = getTeamTemplate(this.currentTeam, newState.editingId)?.name ?? '';
      } else {
        // Empty for new design
        nameInput = '';
      }

      this.renderer.labMenu = {
        lab: newState.lab,
        phase: newState.phase,
        design: newState.design,
        templates: getTeamTemplates(this.currentTeam),
        editingId: newState.editingId,
        nameInput,
        nameError: null,
        hoveredComponent: null,
      };
      this.renderer.menuHighlightIndex = 0;

      // Disable WASD panning when in designing phase (typing name)
      this.viewport.inputDisabled = newState.phase === 'designing';
    }

    // Re-enable viewport input when leaving lab
    if (newState.type !== 'lab') {
      this.viewport.inputDisabled = false;
    }
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
    // A team loses if they have no buildings AND no units
    for (const team of [TEAMS.PLAYER, TEAMS.ENEMY]) {
      const hasBuildings = this.map.getBuildingsByOwner(team).length > 0;
      const hasUnits = this.units.some(u => u.team === team && u.isAlive());

      if (!hasBuildings && !hasUnits) {
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
    // Handle modal menus first - they block all other clicks
    if (this.state.type === 'lab' || this.state.type === 'factory') {
      const action = this.renderer.getActionMenuClick();
      console.log('Modal menu click, action:', action, 'state:', this.state.type);
      if (action) {
        if (this.state.type === 'lab') {
          this.executeLabAction(action);
        } else {
          this.executeProductionAction(action);
        }
      }
      // Ignore clicks outside the menu
      return;
    }

    const clickedUnit = this.getUnitAt(hex.q, hex.r);

    switch (this.state.type) {
      case 'idle': {
        if (clickedUnit && clickedUnit.team === this.currentTeam && !clickedUnit.hasActed) {
          this.setState({ type: 'selected', unit: clickedUnit });
        } else if (!clickedUnit) {
          // Check if clicked on an owned factory or lab
          const building = this.map.getBuilding(hex.q, hex.r);
          if (building && building.owner === this.currentTeam) {
            if (building.type === 'factory') {
              this.setState({ type: 'factory', factory: building });
            } else if (building.type === 'lab') {
              this.setState({
                type: 'lab',
                lab: building,
                phase: 'list',
                design: createEmptyDesign(),
              });
            }
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
      const template = getTeamTemplate(this.currentTeam, templateId);
      if (!template) return;
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
          canCapture: template.canCapture,
          canBuild: template.canBuild,
          armored: template.armored,
          armorPiercing: template.armorPiercing,
        }
      );
      unit.hasActed = true; // New units can't act this turn
      this.units.push(unit);

      console.log(`Built ${template.name} at (${factory.q}, ${factory.r}) for $${template.cost}`);
      this.setState({ type: 'idle' });
    }
  }

  private executeLabAction(action: string): void {
    if (this.state.type !== 'lab') return;

    if (action === 'cancel') {
      this.handleCancel();
      return;
    }

    if (action === 'new') {
      this.setState({
        type: 'lab',
        lab: this.state.lab,
        phase: 'designing',
        design: createEmptyDesign(),
      });
      return;
    }

    if (action.startsWith('edit_')) {
      const templateId = action.slice(5);
      const template = getTeamTemplate(this.currentTeam, templateId);
      if (template) {
        this.setState({
          type: 'lab',
          lab: this.state.lab,
          phase: 'designing',
          design: createDesignFromTemplate(template),
          editingId: templateId,
        });
      }
      return;
    }

    if (action.startsWith('delete_')) {
      const templateId = action.slice(7);
      unregisterTemplate(this.currentTeam, templateId);
      // Refresh the template list by re-entering list state
      this.setState({
        type: 'lab',
        lab: this.state.lab,
        phase: 'list',
        design: createEmptyDesign(),
      });
      return;
    }

    if (action.startsWith('chassis_')) {
      const chassisId = action.slice(8);
      const newDesign = selectChassis(this.state.design, chassisId);
      this.setState({
        type: 'lab',
        lab: this.state.lab,
        phase: 'designing',
        design: newDesign,
        editingId: this.state.editingId,
      });
      return;
    }

    if (action.startsWith('weapon_')) {
      const weaponId = action.slice(7);
      const newDesign = selectWeapon(this.state.design, weaponId === 'none' ? null : weaponId);
      this.setState({
        type: 'lab',
        lab: this.state.lab,
        phase: 'designing',
        design: newDesign,
        editingId: this.state.editingId,
      });
      return;
    }

    if (action === 'system_none') {
      // Clear all systems
      this.setState({
        type: 'lab',
        lab: this.state.lab,
        phase: 'designing',
        design: { ...this.state.design, systemIds: [] },
        editingId: this.state.editingId,
      });
      return;
    }

    if (action.startsWith('system_')) {
      const systemId = action.slice(7);
      const newDesign = toggleSystem(this.state.design, systemId);
      this.setState({
        type: 'lab',
        lab: this.state.lab,
        phase: 'designing',
        design: newDesign,
        editingId: this.state.editingId,
      });
      return;
    }

    if (action === 'confirm_name') {
      const name = this.renderer.labMenu?.nameInput?.trim() ?? '';
      console.log('confirm_name action:', { name, team: this.currentTeam, editingId: this.state.editingId });

      if (!name) {
        this.renderer.setLabNameError('Name cannot be empty');
        return;
      }

      const nameTaken = isNameTaken(this.currentTeam, name, this.state.editingId);
      console.log('isNameTaken result:', nameTaken);

      if (nameTaken) {
        this.renderer.setLabNameError('Name already exists');
        return;
      }

      const design = this.state.design;
      if (!design.chassisId) return;

      if (this.state.editingId) {
        updateTemplate(
          this.currentTeam,
          this.state.editingId,
          name,
          design.chassisId,
          design.weaponId,
          design.systemIds
        );
        console.log(`Updated template: ${name}`);
      } else {
        registerTemplate(
          this.currentTeam,
          name,
          design.chassisId,
          design.weaponId,
          design.systemIds
        );
        console.log(`Created new template: ${name}`);
      }

      this.setState({ type: 'idle' });
      return;
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
      case 'lab':
        // Go back through phases or exit
        if (this.state.phase === 'designing') {
          this.setState({
            type: 'lab',
            lab: this.state.lab,
            phase: 'list',
            design: createEmptyDesign(),
          });
        } else {
          this.setState({ type: 'idle' });
        }
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
