// ============================================================================
// HEX DOMINION - Main Entry Point
// ============================================================================

import { HexUtil, TEAM_COLORS, type AxialCoord } from './core.js';
import { GEN_PARAMS, CONFIG, MAP_CONFIGS, rerollNormalSeed, getNormalSeed } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';
import { Unit } from './unit.js';
import { Pathfinder } from './pathfinder.js';
import { Combat } from './combat.js';
import { type Building, createBuilding } from './building.js';
import {
  getTemplate,
  getTeamTemplates,
  getTeamTemplate,
  getTemplateStats,
  initTeamTemplates,
} from './unit-templates.js';
import { ResourceManager } from './resources.js';
import { GameStats } from './stats.js';
import { MenuRenderer, HTMLMenuController, type GamePhase, type GameOverData } from './menu.js';
import { InputHandler } from './input.js';
import { AnimationController } from './animation.js';
import { type Player, type PlayerConfig } from './player.js';
import { type AIAction } from './ai/actions.js';
import { type AIGameState } from './ai/game-state.js';
import { createAI } from './ai/registry.js';
import { loadTextures } from './textures.js';
import { CombatAnimator, COUNTER_ATTACK_HEALTH_DELAY, COMBAT_ANIMATION_DURATION } from './combat-animator.js';

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
  | { type: 'unloading'; unit: Unit; fromQ: number; fromR: number }
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
  private htmlMenuController: HTMLMenuController;
  private inputHandler!: InputHandler;
  private animationController!: AnimationController;
  private combatAnimator!: CombatAnimator;
  private units: Unit[] = [];
  private state: GameState = { type: 'idle' };
  private lastPreviewHex: AxialCoord | null = null;
  private lastHoveredUnitId: string | null = null;
  private currentTeam: string = TEAMS.PLAYER;
  private turnNumber: number = 1;
  private nextUnitId: number = 1;
  private gamePhase: GamePhase = 'main_menu';
  private gameOverData: GameOverData | null = null;
  private players: Player[] = [];
  private isAITurnInProgress: boolean = false;
  private isAnimating: boolean = false;  // Block input during player move animations

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.menuRenderer = new MenuRenderer(this.ctx, this.canvas.width, this.canvas.height);
    this.htmlMenuController = new HTMLMenuController({
      onStartGame: (mapType, playerConfigs) => this.startNewGame(mapType, playerConfigs),
      onRerollSeed: () => rerollNormalSeed(),
    });

    // Start loading textures (async, will render fallback until loaded)
    loadTextures();

    // In-game reroll button
    const rerollBtn = document.getElementById('btn-reroll-ingame');
    rerollBtn?.addEventListener('click', () => this.rerollAndRegenerate());

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
      onEndTurn: () => {
        // Only allow manual turn ending during human player's turn and not during animation
        if (!this.isCurrentPlayerAI() && !this.isAnimating) {
          this.endTurn();
        }
      },
      onCycleNext: () => {
        // Only during human player's turn and not during animation
        if (!this.isCurrentPlayerAI() && !this.isAnimating) {
          this.cycleToNextActive();
        }
      },
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
        const action = index === -1
          ? this.renderer.getMenuAction(this.renderer.menuHighlightIndex)
          : this.renderer.getMenuAction(index);
        if (!action) return;

        if (this.state.type === 'moved') {
          this.executeMenuAction(action);
        } else if (this.state.type === 'factory') {
          this.executeProductionAction(action);
        }
      },
      onMenuMouseMove: (x, y) => this.menuRenderer.updateMouse(x, y),
      getPhase: () => this.gamePhase,
      getMenuContext: () => {
        if (this.state.type === 'moved') return 'action';
        if (this.state.type === 'factory') return 'production';
        return 'none';
      },
      getSelectionState: () => {
        if (this.state.type === 'idle') return 'idle';
        if (this.state.type === 'selected') return 'selected';
        return 'other';
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
  private currentPlayerConfigs: PlayerConfig[] = [];

  private rerollAndRegenerate(): void {
    if (this.gamePhase !== 'playing') return;
    // Save viewport state
    const savedViewport = { x: this.viewport.x, y: this.viewport.y, zoom: this.viewport.zoom };
    rerollNormalSeed();
    this.startNewGame(this.currentMapType, this.currentPlayerConfigs, true);
    // Restore viewport state
    this.viewport.setPosition(savedViewport.x, savedViewport.y, savedViewport.zoom);
  }

  private startNewGame(mapType: string = 'normal', playerConfigs?: PlayerConfig[], skipCenterViewport: boolean = false): void {
    this.currentMapType = mapType;
    this.currentPlayerConfigs = playerConfigs ?? [
      { id: TEAMS.PLAYER, name: 'Player', type: 'human' },
      { id: TEAMS.ENEMY, name: 'Enemy AI', type: 'ai', aiType: 'greedy' }
    ];
    const mapConfig = MAP_CONFIGS[mapType];

    this.map = new GameMap(mapConfig);
    this.viewport = new Viewport(this.canvas);
    this.inputHandler.updateViewport(this.viewport);
    this.pathfinder = new Pathfinder(this.map);
    this.renderer = new Renderer(this.canvas, this.map, this.viewport);
    this.resources = new ResourceManager([TEAMS.PLAYER, TEAMS.ENEMY]);
    this.gameStats = new GameStats([TEAMS.PLAYER, TEAMS.ENEMY]);
    this.animationController = new AnimationController(
      this.renderer,
      this.viewport,
      () => this.inputHandler.isSpacebarHeld()
    );
    this.combatAnimator = new CombatAnimator();
    this.renderer.setCombatAnimator(this.combatAnimator);

    // Reset game state
    this.units = [];
    this.state = { type: 'idle' };
    this.lastPreviewHex = null;
    this.currentTeam = TEAMS.PLAYER;
    this.turnNumber = 1;
    this.nextUnitId = 1;
    this.gameOverData = null;
    this.isAITurnInProgress = false;

    // Initialize players
    this.players = this.initializePlayers(this.currentPlayerConfigs);

    // Give starting resources
    this.resources.addFunds(TEAMS.PLAYER, 5000);
    this.resources.addFunds(TEAMS.ENEMY, 5000);

    // Initialize per-team unit templates (with default unlocked units)
    initTeamTemplates(TEAMS.PLAYER);
    initTeamTemplates(TEAMS.ENEMY);

    // Setup based on map type
    // Small map gets manual setup with test units; normal map starts with just home bases
    if (mapType === 'small') {
      this.setupSmallMap();
    }
    // Normal map: no starting units, just owned buildings from map generation

    // Determine team facing direction based on building positions
    this.computeTeamFacing();

    // Collect initial income for player (first turn)
    this.collectIncome(TEAMS.PLAYER);

    if (!skipCenterViewport) {
      this.centerViewport();
    }
    this.gamePhase = 'playing';

    // Show UI elements during game
    const infoEl = document.getElementById('coords');
    const hudEl = document.getElementById('hud');
    if (infoEl) infoEl.style.display = 'block';
    if (hudEl) hudEl.style.display = 'block';

    // Show turn announcement and trigger AI if needed
    this.startTurn();
  }

  private initializePlayers(configs: PlayerConfig[]): Player[] {
    return configs.map(config => {
      const player: Player = {
        id: config.id,
        name: config.name,
        type: config.type
      };

      if (config.type === 'ai' && config.aiType) {
        player.aiController = createAI(config.aiType);
      }

      return player;
    });
  }

  private getPlayer(teamId: string): Player | undefined {
    return this.players.find(p => p.id === teamId);
  }

  private isCurrentPlayerAI(): boolean {
    const player = this.getPlayer(this.currentTeam);
    return player?.type === 'ai';
  }

  private setupSmallMap(): void {
    const cfg = MAP_CONFIGS.small!;
    const centerR = Math.floor(cfg.height / 2);
    // For hex offset coords, use smaller offsets that stay in bounds
    // At row 5 (centerR), valid q range is roughly -2 to 9 for width=12

    // Player side (left) - q around 1-2
    this.map.addBuilding(createBuilding(1, centerR, 'capital', TEAMS.PLAYER));
    this.map.addBuilding(createBuilding(1, centerR + 1, 'factory', TEAMS.PLAYER));
    this.map.addBuilding(createBuilding(1, centerR - 1, 'city', TEAMS.PLAYER));

    // Enemy side (right) - q around 7-8
    this.map.addBuilding(createBuilding(8, centerR, 'capital', TEAMS.ENEMY));
    this.map.addBuilding(createBuilding(8, centerR + 1, 'factory', TEAMS.ENEMY));
    this.map.addBuilding(createBuilding(8, centerR - 1, 'city', TEAMS.ENEMY));

    // Spawn one infantry each
    const infantryTemplate = getTemplate('infantry');
    const infantryStats = getTemplateStats(infantryTemplate);

    this.units.push(new Unit(`infantry_${this.nextUnitId++}`, TEAMS.PLAYER, 3, centerR, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));

    this.units.push(new Unit(`infantry_${this.nextUnitId++}`, TEAMS.ENEMY, 6, centerR, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
    }));

    // Add copter for enemy (air unit that infantry can't target)
    const copterTemplate = getTemplate('copter');
    const copterStats = getTemplateStats(copterTemplate);
    this.units.push(new Unit(`copter_${this.nextUnitId++}`, TEAMS.ENEMY, 6, centerR - 1, {
      ...copterStats,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
    }));

    // Add vehicles for player
    const apcTemplate = getTemplate('apc');
    const apcStats = getTemplateStats(apcTemplate);
    this.units.push(new Unit(`apc_${this.nextUnitId++}`, TEAMS.PLAYER, 2, centerR + 1, {
      ...apcStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));

    const tankTemplate = getTemplate('tank');
    const tankStats = getTemplateStats(tankTemplate);
    this.units.push(new Unit(`tank_${this.nextUnitId++}`, TEAMS.PLAYER, 2, centerR - 1, {
      ...tankStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));

    // Terrain defense test setup along top row (row 1)
    // Set up specific terrain types for testing
    this.map.addBuilding(createBuilding(3, 1, 'city', null));  // 3 stars defense (addBuilding sets tile type)
    this.map.setTile(5, 1, 'woods');     // 2 stars defense
    this.map.setTile(7, 1, 'mountain');  // 4 stars defense

    // Enemy infantry on defensive terrain
    this.units.push(new Unit(`infantry_city_${this.nextUnitId++}`, TEAMS.ENEMY, 3, 1, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
    }));
    this.units.push(new Unit(`infantry_woods_${this.nextUnitId++}`, TEAMS.ENEMY, 5, 1, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
    }));
    this.units.push(new Unit(`infantry_mountain_${this.nextUnitId++}`, TEAMS.ENEMY, 7, 1, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
    }));

    // Player infantry adjacent (on grass - 1 star defense)
    this.units.push(new Unit(`infantry_vs_city_${this.nextUnitId++}`, TEAMS.PLAYER, 2, 1, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));
    this.units.push(new Unit(`infantry_vs_woods_${this.nextUnitId++}`, TEAMS.PLAYER, 4, 1, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));
    this.units.push(new Unit(`infantry_vs_mountain_${this.nextUnitId++}`, TEAMS.PLAYER, 6, 1, {
      ...infantryStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));

    console.log('Small map setup: capitals, factories, cities + units for testing (enemy has airplane, terrain defense test units at top)');
  }

  private collectIncome(team: string): void {
    const buildings = this.map.getAllBuildings();
    const income = this.resources.collectIncome(team, buildings);
    if (income.funds > 0) {
      console.log(`${team} collected: $${income.funds} funds`);
    }
    // Record income in stats
    this.gameStats.recordIncome(team, income.funds, 0);
  }

  // --- Position helpers ---

  private getBlockedPositions(forTeam: string): Set<string> {
    const blocked = new Set<string>();
    for (const unit of this.units) {
      if (unit.team !== forTeam && unit.isAlive() && unit.carriedBy === null) {
        blocked.add(`${unit.q},${unit.r}`);
      }
    }
    return blocked;
  }

  private getOccupiedPositions(excludeUnit: Unit): Set<string> {
    const occupied = new Set<string>();
    for (const unit of this.units) {
      if (unit !== excludeUnit && unit.isAlive() && unit.carriedBy === null) {
        occupied.add(`${unit.q},${unit.r}`);
      }
    }
    return occupied;
  }

  private getUnitAt(q: number, r: number): Unit | undefined {
    return this.units.find(u => u.q === q && u.r === r && u.isAlive() && u.carriedBy === null);
  }

  private getEnemiesOf(unit: Unit): Unit[] {
    return this.units.filter(u => u.team !== unit.team && u.isAlive() && u.carriedBy === null);
  }

  private getUnitById(id: string): Unit | undefined {
    return this.units.find(u => u.id === id && u.isAlive());
  }

  private getPathCost(path: AxialCoord[], terrainCosts: import('./core.js').TerrainCosts): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      const pos = path[i]!;
      const tile = this.map.getTile(pos.q, pos.r)!;
      cost += terrainCosts[tile.type];
    }
    return cost;
  }

  private getValidUnloadHexes(carrier: Unit): Set<string> {
    const validHexes = new Set<string>();
    const neighbors = HexUtil.getNeighbors(carrier.q, carrier.r);
    const cargoUnit = carrier.cargo[0];
    if (!cargoUnit) return validHexes;

    for (const neighbor of neighbors) {
      // Check if tile exists
      const tile = this.map.getTile(neighbor.q, neighbor.r);
      if (!tile) continue;

      // Check if cargo unit can traverse this terrain
      const terrainCost = cargoUnit.terrainCosts[tile.type];
      if (terrainCost === Infinity) continue;

      // Check if hex is unoccupied
      const unitAtHex = this.getUnitAt(neighbor.q, neighbor.r);
      if (unitAtHex) continue;

      validHexes.add(`${neighbor.q},${neighbor.r}`);
    }

    return validHexes;
  }

  // --- AI Support ---

  private createAIState(): AIGameState {
    return {
      currentTeam: this.currentTeam,
      turnNumber: this.turnNumber,
      units: this.units,
      map: this.map,
      buildings: this.map.getAllBuildings(),
      resources: this.resources,
      pathfinder: this.pathfinder,
      getTeamTemplates,
    };
  }

  private async executeAITurn(): Promise<void> {
    const player = this.getPlayer(this.currentTeam);
    if (!player || player.type !== 'ai' || !player.aiController) {
      return;
    }

    this.isAITurnInProgress = true;
    console.log(`AI (${player.name}) is taking its turn...`);

    const aiState = this.createAIState();
    const actions = player.aiController.planTurn(aiState, this.currentTeam);

    for (const action of actions) {
      // Check for game over between actions
      if (this.gamePhase !== 'playing') break;

      await this.executeAIAction(action);

      // Small delay between actions for visual feedback
      await this.delay(50);
    }

    this.isAITurnInProgress = false;
  }

  private async executeAIAction(action: AIAction): Promise<void> {
    switch (action.type) {
      case 'move': {
        const unit = this.getUnitById(action.unitId);
        if (!unit || unit.hasActed) return;

        // Compute path for animation
        const blocked = this.getBlockedPositions(unit.team);
        const pathResult = this.pathfinder.findPath(
          unit.q, unit.r,
          action.targetQ, action.targetR,
          unit.terrainCosts,
          blocked
        );

        if (pathResult) {
          // Play move animation
          await this.animationController.play({
            type: 'move',
            hexQ: unit.q,
            hexR: unit.r,
            path: pathResult.path,
            unitId: unit.id
          });
        }

        // Reset any capture progress when unit moves
        this.map.resetCaptureByUnit(unit.id);

        unit.q = action.targetQ;
        unit.r = action.targetR;
        console.log(`AI moves ${unit.id} to (${action.targetQ}, ${action.targetR})`);
        break;
      }

      case 'attack': {
        const unit = this.getUnitById(action.unitId);
        const target = this.getUnitAt(action.targetQ, action.targetR);
        if (!unit || !target) return;

        this.executeCombatWithAnimations(unit, target);

        // Wait for combat animation to complete
        await this.delay(COMBAT_ANIMATION_DURATION);

        unit.hasActed = true;
        this.checkAndTriggerGameOver();
        break;
      }

      case 'capture': {
        const unit = this.getUnitById(action.unitId);
        if (!unit) return;

        if (unit.canCapture) {
          const building = this.map.getBuilding(unit.q, unit.r);
          if (building && building.owner !== unit.team) {
            // Determine toast message before capture
            const willCapture = building.captureResistance <= unit.health;
            const buildingName = building.type.charAt(0).toUpperCase() + building.type.slice(1);
            const toastText = willCapture
              ? `${buildingName} Captured!`
              : `-${unit.health} resistance`;

            await this.animationController.play({
              type: 'combat',  // reuse combat type for capture toasts
              hexQ: unit.q,
              hexR: unit.r,
              toastText
            });
          }
          this.executeCapture(unit, 'AI ');
        }
        unit.hasActed = true;
        this.checkAndTriggerGameOver();
        break;
      }

      case 'wait': {
        const unit = this.getUnitById(action.unitId);
        if (unit) {
          unit.hasActed = true;
        }
        break;
      }

      case 'build': {
        const template = getTeamTemplate(this.currentTeam, action.templateId);
        if (!template) {
          console.log(`AI: Unknown template ${action.templateId}`);
          return;
        }

        if (!this.resources.canAfford(this.currentTeam, template.cost)) {
          console.log(`AI: Cannot afford ${template.name}`);
          return;
        }

        // Check if factory position is occupied
        const existingUnit = this.getUnitAt(action.factoryQ, action.factoryR);
        if (existingUnit) {
          console.log(`AI: Factory at (${action.factoryQ}, ${action.factoryR}) is occupied`);
          return;
        }

        // Play build animation before creating unit
        await this.animationController.play({
          type: 'build',
          hexQ: action.factoryQ,
          hexR: action.factoryR,
          toastText: `Built ${template.name}`
        });

        this.resources.spendFunds(this.currentTeam, template.cost);

        const unit = new Unit(
          `${template.id}_${this.nextUnitId++}`,
          this.currentTeam,
          action.factoryQ,
          action.factoryR,
          { ...getTemplateStats(template), color: TEAM_COLORS[this.currentTeam]!.unitColor }
        );
        unit.hasActed = true;
        this.units.push(unit);
        console.log(`AI built ${template.name} at (${action.factoryQ}, ${action.factoryR})`);
        break;
      }

      case 'endTurn': {
        // This triggers the actual end of turn
        this.endTurn();
        break;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      this.renderer.unloadTargets = null;
      this.renderer.productionMenu = null;
    } else if (newState.type === 'selected') {
      this.renderer.selectedUnit = newState.unit;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      this.renderer.unloadTargets = null;
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

      // Check if unit can attack (respecting canMoveAndAttack restriction)
      const didMove = newState.fromQ !== newState.unit.q || newState.fromR !== newState.unit.r;
      const canAttackNow = newState.unit.canMoveAndAttack || !didMove;

      // Check if unit has cargo to unload
      const canUnload = newState.unit.cargo.length > 0;

      this.renderer.actionMenu = {
        unit: newState.unit,
        canAttack: canAttackNow && targets.length > 0,
        canCapture,
        canUnload
      };
      this.renderer.attackTargets = null;
      this.renderer.unloadTargets = null;
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
      this.renderer.unloadTargets = null;
      this.renderer.productionMenu = null;
    } else if (newState.type === 'unloading') {
      this.renderer.selectedUnit = newState.unit;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      // Calculate valid unload hexes (adjacent empty hexes)
      const validHexes = this.getValidUnloadHexes(newState.unit);
      this.renderer.unloadTargets = {
        carrier: newState.unit,
        validTiles: validHexes,
        cargoToUnload: newState.unit.cargo[0]!  // Next unit to unload
      };
      this.renderer.productionMenu = null;
    } else if (newState.type === 'factory') {
      this.renderer.selectedUnit = null;
      this.renderer.pathPreview = null;
      this.renderer.actionMenu = null;
      this.renderer.attackTargets = null;
      this.renderer.unloadTargets = null;
      this.renderer.productionMenu = {
        factory: newState.factory,
        templates: getTeamTemplates(this.currentTeam)
      };
      this.renderer.menuHighlightIndex = 0;
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

    // Show turn announcement and then trigger AI if needed
    this.startTurn();
  }

  private async startTurn(): Promise<void> {
    const teamName = this.currentTeam === TEAMS.PLAYER ? 'Player' : 'Enemy';
    await this.animationController.playTurnAnnouncement(teamName);

    if (this.isCurrentPlayerAI()) {
      this.executeAITurn();
    } else {
      // Player turn: automatically cycle to first unit
      this.cycleToNextActive();
    }
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
      0  // No science anymore
    );
  }

  private checkGameOver(): string | null {
    for (const team of [TEAMS.PLAYER, TEAMS.ENEMY]) {
      // Check if capital was captured (team no longer owns a capital)
      if (!this.map.getCapital(team)) {
        return team; // Lost - capital captured
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
    return this.units.filter(u => u.team === this.currentTeam && u.isAlive() && !u.hasActed && u.carriedBy === null).length;
  }

  private getTotalUnitsCount(): number {
    return this.units.filter(u => u.team === this.currentTeam && u.isAlive() && u.carriedBy === null).length;
  }

  private cycleToNextActive(): void {
    // If a unit is selected, move to current tile (show action menu)
    if (this.state.type === 'selected') {
      const unit = this.state.unit;
      this.setState({ type: 'moved', unit, fromQ: unit.q, fromR: unit.r });
      return;
    }

    // Find next active unit (hasn't acted yet, not cargo)
    const activeUnits = this.units.filter(
      u => u.team === this.currentTeam && u.isAlive() && !u.hasActed && u.carriedBy === null
    );

    if (activeUnits.length > 0) {
      // Sort by distance from own capital (furthest first)
      const capital = this.map.getCapital(this.currentTeam);
      if (capital) {
        activeUnits.sort((a, b) => {
          const distA = HexUtil.distance(a.q, a.r, capital.q, capital.r);
          const distB = HexUtil.distance(b.q, b.r, capital.q, capital.r);
          return distB - distA; // Furthest first
        });
      }

      const unit = activeUnits[0]!;
      this.viewport.panTo(unit.q, unit.r);
      this.setState({ type: 'selected', unit });
      return;
    }

    // No active units - find available factory (no unit blocking it)
    const factories = this.map.getAllBuildings().filter(
      b => b.type === 'factory' && b.owner === this.currentTeam
    );

    for (const factory of factories) {
      const unitOnFactory = this.getUnitAt(factory.q, factory.r);
      if (!unitOnFactory) {
        this.viewport.panTo(factory.q, factory.r);
        this.setState({ type: 'factory', factory });
        return;
      }
    }

    // No active units or available factories - end turn
    this.endTurn();
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
      const enemies = this.getEnemiesOf(unit);
      const targets = Combat.getTargetsInRange(unit, enemies);

      if (targets.length === 1) {
        // Auto-attack the only target
        this.executeCombatWithAnimations(unit, targets[0]!);
        unit.hasActed = true;
        this.setState({ type: 'idle' });
        this.checkAndTriggerGameOver();
      } else {
        // Multiple targets - enter targeting mode as before
        this.setState({ type: 'attacking', unit, fromQ: this.state.fromQ, fromR: this.state.fromR });
      }
    } else if (action === 'capture') {
      // Show capture toast
      const building = this.map.getBuilding(unit.q, unit.r);
      if (building && building.owner !== unit.team) {
        const willCapture = building.captureResistance <= unit.health;
        const buildingName = building.type.charAt(0).toUpperCase() + building.type.slice(1);
        const toastText = willCapture
          ? `${buildingName} Captured!`
          : `-${unit.health} resistance`;
        this.showToast(unit.q, unit.r, toastText);
      }

      this.executeCapture(unit);
      unit.hasActed = true;
      this.setState({ type: 'idle' });

      // Check for game over after capture (enemy may have lost last city)
      this.checkAndTriggerGameOver();
    } else if (action === 'unload') {
      // Enter unloading state
      this.setState({ type: 'unloading', unit, fromQ: this.state.fromQ, fromR: this.state.fromR });
    }
  }

  private async handleClick(hex: AxialCoord): Promise<void> {
    // Block input during animations
    if (this.isAnimating) return;

    // Handle factory menu - it blocks other clicks
    if (this.state.type === 'factory') {
      const action = this.renderer.getActionMenuClick();
      console.log('Modal menu click, action:', action, 'state:', this.state.type);
      if (action) {
        this.executeProductionAction(action);
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
          // Check if clicked on a factory
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
        } else if (clickedUnit && clickedUnit.team === this.currentTeam && clickedUnit.canLoadUnit(unit)) {
          // Clicked a carrier that can load this unit - try to load
          await this.tryMove(unit, hex);
        } else if (clickedUnit && clickedUnit.team === this.currentTeam && !clickedUnit.hasActed) {
          // Clicked another friendly unmoved unit - select it instead
          this.setState({ type: 'selected', unit: clickedUnit });
        } else if (!clickedUnit) {
          // Clicked empty tile - try to move
          await this.tryMove(unit, hex);
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
          this.executeCombatWithAnimations(unit, target);
          unit.hasActed = true;
          this.setState({ type: 'idle' });

          // Check for game over after combat
          this.checkAndTriggerGameOver();
        }
        break;
      }

      case 'unloading': {
        const carrier = this.state.unit;
        const targetKey = `${hex.q},${hex.r}`;
        const validTiles = this.renderer.unloadTargets?.validTiles;

        if (validTiles?.has(targetKey) && carrier.cargo.length > 0) {
          const cargoUnit = carrier.cargo[0]!;
          carrier.unloadUnit(cargoUnit, hex.q, hex.r);
          // Carrier commits to this position once any unload happens
          carrier.hasActed = true;
          console.log(`Unloaded ${cargoUnit.id} from ${carrier.id} at (${hex.q}, ${hex.r})`);

          // If more cargo, stay in unloading state (refresh valid tiles)
          if (carrier.cargo.length > 0) {
            this.setState({ type: 'unloading', unit: carrier, fromQ: this.state.fromQ, fromR: this.state.fromR });
          } else {
            // No more cargo - done
            this.setState({ type: 'idle' });
          }
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

      const unit = new Unit(
        `${template.id}_${this.nextUnitId++}`,
        this.currentTeam,
        factory.q,
        factory.r,
        { ...getTemplateStats(template), color: TEAM_COLORS[this.currentTeam]!.unitColor }
      );
      unit.hasActed = true; // New units can't act this turn
      this.units.push(unit);

      console.log(`Built ${template.name} at (${factory.q}, ${factory.r}) for $${template.cost}`);
      this.setState({ type: 'idle' });
    }
  }

  private handleCancel(): void {
    // Block input during animations
    if (this.isAnimating) return;

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
      case 'unloading':
        // If carrier already unloaded something, it's committed - go to idle
        if (this.state.unit.hasActed) {
          this.setState({ type: 'idle' });
        } else {
          // No unloads yet - go back to moved state
          this.setState({ type: 'moved', unit: this.state.unit, fromQ: this.state.fromQ, fromR: this.state.fromR });
        }
        break;
      case 'factory':
        this.setState({ type: 'idle' });
        break;
    }
  }

  private async tryMove(unit: Unit, destination: AxialCoord): Promise<void> {
    const blocked = this.getBlockedPositions(unit.team);
    const occupied = this.getOccupiedPositions(unit);
    const fromQ = unit.q;
    const fromR = unit.r;

    // Reset any capture progress when unit moves
    this.map.resetCaptureByUnit(unit.id);

    const result = this.pathfinder.findPath(
      unit.q, unit.r,
      destination.q, destination.r,
      unit.terrainCosts,
      blocked
    );

    if (result) {
      // Check if destination is a friendly carrier that can load us (check FIRST)
      const unitAtDest = this.getUnitAt(destination.q, destination.r);
      if (unitAtDest && unitAtDest.team === unit.team && unitAtDest.canLoadUnit(unit)) {
        // Allow loading if within movement range
        if (this.getPathCost(result.path, unit.terrainCosts) <= unit.speed) {
          // Animate movement to carrier
          this.renderer.pathPreview = null;
          this.isAnimating = true;
          await this.animationController.play({
            type: 'move',
            hexQ: unit.q,
            hexR: unit.r,
            path: result.path,
            unitId: unit.id,
            skipCameraPan: true
          });
          this.isAnimating = false;

          // Load the unit onto the carrier
          unitAtDest.loadUnit(unit);
          unit.hasActed = true;
          console.log(`${unit.id} loaded onto ${unitAtDest.id}`);
          this.setState({ type: 'idle' });
          return;
        }
      }

      // Normal movement
      const reachableIdx = unit.getReachableIndex(result.path, this.map, occupied);
      if (reachableIdx > 0) {
        const dest = result.path[reachableIdx]!;
        const animPath = result.path.slice(0, reachableIdx + 1);

        // Animate movement along path
        this.renderer.pathPreview = null;
        this.isAnimating = true;
        await this.animationController.play({
          type: 'move',
          hexQ: unit.q,
          hexR: unit.r,
          path: animPath,
          unitId: unit.id,
          skipCameraPan: true
        });
        this.isAnimating = false;

        unit.q = dest.q;
        unit.r = dest.r;
        this.setState({ type: 'moved', unit, fromQ, fromR });
        return;
      }
    }

    console.log('No valid path to destination');
  }

  private handleUnitDeath(deadUnit: Unit, killerTeam: string): void {
    // Record kill
    this.gameStats.recordUnitKilled(killerTeam, deadUnit.team);
    this.map.resetCaptureByUnit(deadUnit.id);

    // Destroy all cargo (each counts as a kill)
    for (const cargoUnit of deadUnit.cargo) {
      cargoUnit.health = 0;
      cargoUnit.carriedBy = null;
      console.log(`  ${cargoUnit.id} destroyed with carrier!`);
      this.gameStats.recordUnitKilled(killerTeam, cargoUnit.team);
      this.map.resetCaptureByUnit(cargoUnit.id);
    }
    deadUnit.cargo = [];
  }

  /**
   * Execute combat between two units with animations and death handling.
   * This is the single source of truth for combat execution - used by both AI and player.
   */
  private executeCombatWithAnimations(attacker: Unit, defender: Unit): import('./combat.js').CombatResult {
    // Store positions and health before combat
    const attackerQ = attacker.q;
    const attackerR = attacker.r;
    const defenderQ = defender.q;
    const defenderR = defender.r;
    const attackerHealthBefore = attacker.health;
    const defenderHealthBefore = defender.health;

    // Execute combat with terrain defense
    const result = Combat.execute(
      attacker, defender, undefined, undefined,
      this.map.getTerrainDefenseStars(defender.q, defender.r),
      this.map.getTerrainDefenseStars(attacker.q, attacker.r)
    );

    // Trigger attack animation
    this.combatAnimator.triggerAttack(
      attacker.id, attackerQ, attackerR,
      defender.id, defenderQ, defenderR,
      result.attackerDamage,
      result.defenderDied,
      CONFIG.hexSize
    );

    // Update defender health display
    this.combatAnimator.setUnitHealth(defender.id, defenderHealthBefore, defender.health);

    // Trigger counter-attack animation if defender was able to counter
    if (result.counterAttackAttempted) {
      this.combatAnimator.triggerCounterAttack(
        defender.id, defenderQ, defenderR,
        attacker.id, attackerQ, attackerR,
        result.defenderDamage,
        result.attackerDied,
        CONFIG.hexSize
      );
      if (result.defenderDamage > 0) {
        this.combatAnimator.setUnitHealth(attacker.id, attackerHealthBefore, attacker.health, COUNTER_ATTACK_HEALTH_DELAY);
      }
    }

    // Log combat results
    console.log(`${attacker.id} attacks ${defender.id}!`);
    console.log(`  ${attacker.id} deals ${result.attackerDamage} damage`);

    // Handle deaths and log counter-attack
    if (result.defenderDied) {
      console.log(`  ${defender.id} destroyed!`);
      this.handleUnitDeath(defender, attacker.team);
    } else if (result.counterAttackAttempted) {
      console.log(`  ${defender.id} counter-attacks for ${result.defenderDamage} damage`);
      if (result.attackerDied) {
        console.log(`  ${attacker.id} destroyed!`);
        this.handleUnitDeath(attacker, defender.team);
      }
    }

    return result;
  }

  private showToast(hexQ: number, hexR: number, text: string): void {
    // Set toast directly on renderer with progress animation
    this.renderer.activeToast = {
      q: hexQ,
      r: hexR,
      text,
      progress: 0
    };

    const startTime = performance.now();
    const duration = 1000;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (this.renderer.activeToast) {
        this.renderer.activeToast.progress = progress;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.activeToast = null;
      }
    };
    requestAnimationFrame(animate);
  }

  private executeCapture(unit: Unit, logPrefix: string = ''): void {
    const building = this.map.getBuilding(unit.q, unit.r);
    if (!building || building.owner === unit.team) return;

    const captured = this.map.applyCaptureProgress(unit.q, unit.r, unit.id, unit.health);
    if (captured) {
      const previousOwner = building.owner ?? 'neutral';
      this.map.setBuildingOwner(unit.q, unit.r, unit.team);
      this.gameStats.recordBuildingCaptured(unit.team);
      console.log(`${logPrefix}${unit.id} captured ${building.type} from ${previousOwner}!`);
    } else {
      console.log(`${logPrefix}${unit.id} capturing ${building.type}... (${building.captureResistance} resistance remaining)`);
    }
  }

  // --- Path preview ---

  private updatePathPreview(): void {
    if (this.state.type !== 'selected' || this.isAnimating) {
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
    let reachableIndex = unit.getReachableIndex(result.path, this.map, occupied);

    // Check if destination is a carrier that can load this unit
    const destUnit = this.getUnitAt(hoveredHex.q, hoveredHex.r);
    if (destUnit && destUnit.canLoadUnit(unit)) {
      // If within movement range, show full path as reachable
      if (this.getPathCost(result.path, unit.terrainCosts) <= unit.speed) {
        reachableIndex = result.path.length - 1;
      }
    }

    this.renderer.pathPreview = {
      path: result.path,
      reachableIndex
    };
  }

  // --- Attack range overlay ---

  private updateAttackRangeOverlay(): void {
    // Don't update during animation
    if (this.isAnimating) {
      this.renderer.attackRangeOverlay = null;
      return;
    }

    // Case 1: We're in attacking state - show range from current position
    if (this.state.type === 'attacking') {
      const unit = this.state.unit;
      const overlay = this.computeAttackRangeFromPosition(unit, unit.q, unit.r);
      this.renderer.attackRangeOverlay = overlay;
      return;
    }

    // Case 2: Hovering over a unit - show their damageable range
    const hoveredHex = this.renderer.hoveredHex;
    if (!hoveredHex) {
      this.renderer.attackRangeOverlay = null;
      this.lastHoveredUnitId = null;
      return;
    }

    const hoveredUnit = this.units.find(u =>
      u.q === hoveredHex.q && u.r === hoveredHex.r && u.isAlive() && u.carriedBy === null
    );

    if (!hoveredUnit) {
      this.renderer.attackRangeOverlay = null;
      this.lastHoveredUnitId = null;
      return;
    }

    // Skip recomputation if same unit as last frame
    if (this.lastHoveredUnitId === hoveredUnit.id) {
      return;
    }
    this.lastHoveredUnitId = hoveredUnit.id;

    // Compute the full damageable range (reachable tiles + attack range from each)
    const overlay = this.computeFullDamageableRange(hoveredUnit);
    this.renderer.attackRangeOverlay = overlay;
  }

  private computeAttackRangeFromPosition(unit: Unit, fromQ: number, fromR: number): {
    attackableTiles: Set<string>;
    minRangeTiles: Set<string>;
  } {
    const attackableTiles = new Set<string>();
    const minRangeTiles = new Set<string>();

    // Get all tiles within max range
    for (const tile of this.map.getAllTiles()) {
      const distance = HexUtil.distance(fromQ, fromR, tile.q, tile.r);

      if (distance <= unit.range) {
        if (distance >= unit.minRange && distance > 0) {
          attackableTiles.add(`${tile.q},${tile.r}`);
        } else if (distance > 0 && distance < unit.minRange) {
          minRangeTiles.add(`${tile.q},${tile.r}`);
        }
      }
    }

    return { attackableTiles, minRangeTiles };
  }

  private computeFullDamageableRange(unit: Unit): {
    attackableTiles: Set<string>;
    minRangeTiles: Set<string>;
  } {
    const attackableTiles = new Set<string>();
    const minRangeTiles = new Set<string>();

    // Get reachable positions for this unit
    const blocked = this.getBlockedPositions(unit.team);
    const occupied = this.getOccupiedPositions(unit);
    const reachable = this.pathfinder.getReachablePositions(
      unit.q, unit.r,
      unit.speed,
      unit.terrainCosts,
      blocked,
      occupied
    );

    // Include current position
    reachable.set(`${unit.q},${unit.r}`, { q: unit.q, r: unit.r, cost: 0 });

    // For each reachable position (if unit can move and attack) or just current position
    const positionsToCheck = unit.canMoveAndAttack
      ? Array.from(reachable.values())
      : [{ q: unit.q, r: unit.r, cost: 0 }];

    for (const pos of positionsToCheck) {
      // Get all tiles within attack range from this position
      for (const tile of this.map.getAllTiles()) {
        const distance = HexUtil.distance(pos.q, pos.r, tile.q, tile.r);

        if (distance <= unit.range && distance > 0) {
          if (distance >= unit.minRange) {
            attackableTiles.add(`${tile.q},${tile.r}`);
          }
        }
      }
    }

    // Compute minRange tiles from current position only (for visual feedback)
    for (const tile of this.map.getAllTiles()) {
      const distance = HexUtil.distance(unit.q, unit.r, tile.q, tile.r);
      if (distance > 0 && distance < unit.minRange) {
        // Only mark as minRange if it's not already in attackable (from another position)
        if (!attackableTiles.has(`${tile.q},${tile.r}`)) {
          minRangeTiles.add(`${tile.q},${tile.r}`);
        }
      }
    }

    return { attackableTiles, minRangeTiles };
  }

  // --- Game loop ---

  private computeTeamFacing(): void {
    // Calculate average X position of each team's buildings
    const teamAvgX: Record<string, number> = {};

    for (const teamId of [TEAMS.PLAYER, TEAMS.ENEMY]) {
      const buildings = this.map.getBuildingsByOwner(teamId);
      if (buildings.length === 0) continue;

      let totalX = 0;
      for (const b of buildings) {
        const pos = HexUtil.axialToPixel(b.q, b.r, CONFIG.hexSize);
        totalX += pos.x;
      }
      teamAvgX[teamId] = totalX / buildings.length;
    }

    // Team further right faces left
    this.renderer.teamsFacingLeft.clear();
    const teams = Object.keys(teamAvgX);
    if (teams.length >= 2) {
      const maxX = Math.max(...Object.values(teamAvgX));
      for (const [team, avgX] of Object.entries(teamAvgX)) {
        if (avgX === maxX) {
          this.renderer.teamsFacingLeft.add(team);
        }
      }
    }
  }

  private centerViewport(): void {
    const cfg = MAP_CONFIGS[this.currentMapType];
    const centerQ = Math.floor((cfg?.width ?? GEN_PARAMS.mapWidth) / 2);
    const centerR = Math.floor((cfg?.height ?? GEN_PARAMS.mapHeight) / 2);
    this.viewport.centerOn(centerQ, centerR);
  }

  private loop = (): void => {
    if (this.gamePhase === 'main_menu') {
      this.htmlMenuController.show();
      // Clear canvas behind menu
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else if (this.gamePhase === 'game_over' && this.gameOverData) {
      this.htmlMenuController.hide();
      this.menuRenderer.renderGameOver(this.gameOverData);
    } else if (this.gamePhase === 'playing') {
      this.htmlMenuController.hide();
      this.viewport.update();
      this.combatAnimator.update(performance.now());
      this.updatePathPreview();
      this.updateAttackRangeOverlay();
      this.renderer.units = this.units.filter(u =>
        (u.isAlive() || this.combatAnimator.hasDeathAnimation(u.id)) && u.carriedBy === null
      );
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
