// ============================================================================
// HEX DOMINION - Main Entry Point
// ============================================================================

import { HexUtil, type AxialCoord } from './core.js';
import { CONFIG, MAP_CONFIGS, rerollNormalSeed, type MapConfig } from './config.js';
import { GameMap } from './game-map.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';
import { Unit } from './unit.js';
import { Pathfinder } from './pathfinder.js';
import { Combat } from './combat.js';
import { type Building, createBuilding } from './building.js';
import {
  getTeamTemplates,
  getTeamTemplate,
  initTeamUnits,
} from './unit-templates.js';
import { ResourceManager } from './resources.js';
import { GameStats } from './stats.js';
import { MenuRenderer, HTMLMenuController, type GamePhase, type GameOverData } from './menu.js';
import { InputHandler } from './input.js';
import { AnimationController } from './animation.js';
import { type Player, type PlayerConfig } from './player.js';
import { createAI } from './ai/registry.js';
import { loadTextures, clearTileTextureCache } from './textures.js';
import { CombatAnimator, COUNTER_ATTACK_HEALTH_DELAY } from './combat-animator.js';
import { AITurnExecutor, type AIGameOperations } from './ai-turn-executor.js';
import { CampaignUI } from './campaign-ui.js';
import { createCampaignGrid } from './campaign-config.js';
import {
  type CampaignState,
  type CampaignCell,
  type CampaignGrid,
  createInitialCampaignState,
  completeCell,
  loseReinforcement,
  isCampaignOver,
  getCampaignBattleSeed,
  getCampaignCellPreset,
  getCampaignModifiers,
  equipPower,
  unequipPower,
} from './campaign-state.js';
import {
  type CampaignModifiers,
  getAttackerAV,
  getDefenderDV,
  getMoveBonus,
  getRangeBonus,
  getCostReduction,
  POWERS,
  WHEELS_UNITS,
} from './upgrades.js';
import { presetToMapConfig } from './map-presets.js';
import { MapLabController } from './map-lab.js';
import { validateMap } from './map-validation.js';

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
  private aiTurnExecutor!: AITurnExecutor;
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

  // Campaign state
  private campaignState: CampaignState | null = null;
  private campaignGrid: CampaignGrid | null = null;
  private campaignUI: CampaignUI;
  private activeCampaignCell: CampaignCell | null = null;
  private debugWinBtn: HTMLButtonElement | null = null;
  private debugLoseBtn: HTMLButtonElement | null = null;
  private campaignModifiers: CampaignModifiers | null = null;

  // Map Lab
  private mapLabController: MapLabController | null = null;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.menuRenderer = new MenuRenderer(this.ctx, this.canvas.width, this.canvas.height);
    this.campaignUI = new CampaignUI({
      onCellClick: (cell) => this.handleCampaignCellClick(cell),
      onBackClick: () => this.returnToMainMenu(),
      onEquipPower: (powerId) => this.handleEquipPower(powerId),
      onUnequipPower: (powerId) => this.handleUnequipPower(powerId),
    });
    this.htmlMenuController = new HTMLMenuController({
      onStartGame: (mapType, playerConfigs) => this.startNewGame(mapType, playerConfigs),
      onStartCampaign: () => this.startCampaign(),
      onRerollSeed: () => rerollNormalSeed(),
    });

    // Start loading textures (async, will render fallback until loaded)
    loadTextures();

    // In-game reroll button
    const rerollBtn = document.getElementById('btn-reroll-ingame');
    rerollBtn?.addEventListener('click', () => this.rerollAndRegenerate());

    // Debug buttons for campaign
    this.debugWinBtn = document.getElementById('btn-debug-win') as HTMLButtonElement;
    this.debugLoseBtn = document.getElementById('btn-debug-lose') as HTMLButtonElement;
    this.debugWinBtn?.addEventListener('click', () => this.handleDebugWin());
    this.debugLoseBtn?.addEventListener('click', () => this.handleDebugLose());

    // Create a dummy viewport for initial input handler setup
    this.viewport = new Viewport(this.canvas);
    this.setupInputHandler();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Initialize Map Lab if ?maplab query param is present
    if (MapLabController.isEnabled()) {
      this.initMapLab();
    }

    this.loop();
  }

  private initMapLab(): void {
    this.mapLabController = new MapLabController({
      onGenerateMap: (config) => this.startNewGameWithConfig(config)
    });
    this.mapLabController.init();
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
      onCampaignEscape: () => this.returnToMainMenu(),
      onGameOverAction: (action) => {
        if (action === 'click') {
          const menuAction = this.menuRenderer.getClickedAction();
          if (menuAction === 'main_menu') this.handleGameOverReturn();
        } else if (action === 'main_menu') {
          this.handleGameOverReturn();
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
      onMenuMouseMove: (x, y) => {
        this.menuRenderer.updateMouse(x, y);
      },
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
    const mapConfig = MAP_CONFIGS[mapType]!;
    this.currentMapType = mapType;

    this.initializeGame(mapConfig, playerConfigs);

    // Small map gets manual setup with test units
    if (mapType === 'small') {
      this.setupSmallMap();
    }

    this.finalizeGameStart(mapConfig, skipCenterViewport);
  }

  /**
   * Start a new game with a specific MapConfig (used by Map Lab and campaign)
   */
  private startNewGameWithConfig(config: MapConfig, playerConfigs?: PlayerConfig[], skipCenterViewport: boolean = false): void {
    this.currentMapType = 'custom';

    this.initializeGame(config, playerConfigs);
    this.finalizeGameStart(config, skipCenterViewport);
  }

  private initializeGame(config: MapConfig, playerConfigs?: PlayerConfig[]): void {
    clearTileTextureCache();
    this.currentPlayerConfigs = playerConfigs ?? [
      { id: TEAMS.PLAYER, name: 'Player', type: 'human' },
      { id: TEAMS.ENEMY, name: 'Enemy AI', type: 'ai', aiType: 'greedy' }
    ];

    this.map = new GameMap(config);
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
    this.aiTurnExecutor = new AITurnExecutor(
      this.animationController,
      this.pathfinder,
      this.map,
      this.resources
    );

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
    initTeamUnits(TEAMS.PLAYER);
    initTeamUnits(TEAMS.ENEMY);
  }

  private finalizeGameStart(config: MapConfig, skipCenterViewport: boolean): void {
    this.computeTeamFacing();
    this.collectIncome(TEAMS.PLAYER);

    if (!skipCenterViewport) {
      const centerQ = Math.floor(config.width / 2);
      const centerR = Math.floor(config.height / 2);
      this.viewport.centerOn(centerQ, centerR);
    }
    this.gamePhase = 'playing';

    // Show UI elements during game
    document.getElementById('coords')!.style.display = 'block';
    document.getElementById('hud')!.style.display = 'block';

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
    this.units.push(new Unit(`infantry_${this.nextUnitId++}`, TEAMS.PLAYER, 3, centerR, 'infantry'));
    this.units.push(new Unit(`infantry_${this.nextUnitId++}`, TEAMS.ENEMY, 6, centerR, 'infantry'));

    // Add copter for enemy (air unit that infantry can't target)
    this.units.push(new Unit(`copter_${this.nextUnitId++}`, TEAMS.ENEMY, 6, centerR - 1, 'copter'));

    // Add vehicles for player
    this.units.push(new Unit(`apc_${this.nextUnitId++}`, TEAMS.PLAYER, 2, centerR + 1, 'apc'));
    this.units.push(new Unit(`tank_${this.nextUnitId++}`, TEAMS.PLAYER, 2, centerR - 1, 'tank'));

    // Terrain defense test setup along top row (row 1)
    // Set up specific terrain types for testing
    this.map.addBuilding(createBuilding(3, 1, 'city', null));  // 3 stars defense (addBuilding sets tile type)
    this.map.setTile(5, 1, 'woods');     // 2 stars defense
    this.map.setTile(7, 1, 'mountain');  // 4 stars defense

    // Enemy infantry on defensive terrain
    this.units.push(new Unit(`infantry_city_${this.nextUnitId++}`, TEAMS.ENEMY, 3, 1, 'infantry'));
    this.units.push(new Unit(`infantry_woods_${this.nextUnitId++}`, TEAMS.ENEMY, 5, 1, 'infantry'));
    this.units.push(new Unit(`infantry_mountain_${this.nextUnitId++}`, TEAMS.ENEMY, 7, 1, 'infantry'));

    // Player infantry adjacent (on grass - 1 star defense)
    this.units.push(new Unit(`infantry_vs_city_${this.nextUnitId++}`, TEAMS.PLAYER, 2, 1, 'infantry'));
    this.units.push(new Unit(`infantry_vs_woods_${this.nextUnitId++}`, TEAMS.PLAYER, 4, 1, 'infantry'));
    this.units.push(new Unit(`infantry_vs_mountain_${this.nextUnitId++}`, TEAMS.PLAYER, 6, 1, 'infantry'));

    console.log('Small map setup: capitals, factories, cities + units for testing (enemy has airplane, terrain defense test units at top)');
  }

  private collectIncome(team: string): void {
    const buildings = this.map.getAllBuildings();
    // Apply income multiplier for player team if in campaign
    let incomeMultiplier = 1.0;
    if (team === TEAMS.PLAYER && this.campaignModifiers) {
      incomeMultiplier = this.campaignModifiers.incomeMultiplier;
    }
    const income = this.resources.collectIncome(team, buildings, incomeMultiplier);
    if (income.funds > 0) {
      console.log(`${team} collected: $${income.funds} funds${incomeMultiplier > 1 ? ` (x${incomeMultiplier.toFixed(2)})` : ''}`);
    }
    // Record income in stats
    this.gameStats.recordIncome(team, income.funds, 0);
  }

  private async healUnitsOnBuildings(team: string): Promise<void> {
    for (const unit of this.units) {
      if (unit.team !== team || !unit.isAlive() || unit.carriedBy !== null) continue;
      if (unit.health >= 10) continue;  // Already full health

      const building = this.map.getBuilding(unit.q, unit.r);
      if (building && building.owner === team) {
        const oldHealth = unit.health;
        unit.health = Math.min(10, unit.health + 2);
        const healAmount = unit.health - oldHealth;

        // Pan camera to the healing unit
        this.viewport.panTo(unit.q, unit.r);

        // Trigger heal animation with green floating number
        const duration = this.combatAnimator.triggerHeal(
          unit.id,
          unit.q,
          unit.r,
          healAmount,
          oldHealth,
          unit.health,
          CONFIG.hexSize
        );

        console.log(`${unit.id} healed +${healAmount} HP on ${building.type}`);

        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, duration));
      }
    }
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

  /**
   * Create a unit with campaign bonuses applied (if in campaign)
   */
  private createUnitWithBonuses(team: string, q: number, r: number, templateId: string): Unit {
    const unit = new Unit(
      `${templateId}_${this.nextUnitId++}`,
      team,
      q,
      r,
      templateId
    );

    // Apply campaign bonuses to player units
    if (team === TEAMS.PLAYER && this.campaignModifiers) {
      const moveBonus = getMoveBonus(templateId, this.campaignModifiers);
      const rangeBonus = getRangeBonus(templateId, this.campaignModifiers);
      unit.applyStatBonuses(moveBonus, rangeBonus);

      // Apply terrain_wheels power: wheeled units treat grass/woods like roads
      if (this.campaignModifiers.hasTerrainWheels && WHEELS_UNITS.includes(templateId)) {
        unit.terrainCosts = {
          ...unit.terrainCosts,
          grass: 1,
          woods: 1,
        };
      }
    }

    return unit;
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

  private getAIOperations(): AIGameOperations {
    return {
      getPlayer: (teamId) => this.getPlayer(teamId),
      getUnitById: (id) => this.getUnitById(id),
      getUnitAt: (q, r) => this.getUnitAt(q, r),
      getBlockedPositions: (forTeam) => this.getBlockedPositions(forTeam),
      isGameOver: () => this.gamePhase !== 'playing',
      executeCombatWithAnimations: (attacker, defender) => this.executeCombatWithAnimations(attacker, defender),
      executeCapture: (unit, logPrefix) => this.executeCapture(unit, logPrefix),
      checkAndTriggerGameOver: () => this.checkAndTriggerGameOver(),
      endTurn: () => this.endTurn(),
      addUnit: (unit) => this.units.push(unit),
      getNextUnitId: () => this.nextUnitId++,
    };
  }

  private async executeAITurn(): Promise<void> {
    this.isAITurnInProgress = true;
    await this.aiTurnExecutor.executeTurn(
      this.currentTeam,
      this.getAIOperations(),
      this.units
    );
    this.isAITurnInProgress = false;
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

      // Compute cost overrides for player in campaign
      const templates = getTeamTemplates(this.currentTeam);
      let costOverrides: Record<string, number> | undefined;
      if (this.currentTeam === TEAMS.PLAYER && this.campaignModifiers) {
        costOverrides = {};
        for (const t of templates) {
          const reduction = getCostReduction(t.id, this.campaignModifiers);
          if (reduction > 0) {
            costOverrides[t.id] = Math.floor(t.cost * (100 - reduction) / 100);
          }
        }
      }

      this.renderer.productionMenu = {
        factory: newState.factory,
        templates,
        costOverrides,
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
    // Heal units on controlled buildings
    await this.healUnitsOnBuildings(this.currentTeam);

    const teamName = this.currentTeam === TEAMS.PLAYER ? 'Player' : 'Enemy';
    await this.animationController.playTurnAnnouncement(teamName);

    if (this.isCurrentPlayerAI()) {
      this.executeAITurn();
    } else {
      // Player turn: automatically cycle to first unit
      this.cycleToNextActive(true);
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
    this.showDebugControls(false);

    console.log(`Game Over! ${winner.toUpperCase()} wins in ${this.turnNumber} turns!`);
  }

  // --- Campaign Methods ---

  private startCampaign(): void {
    const campaignSeed = Math.floor(Math.random() * 1000000);
    this.campaignGrid = createCampaignGrid(campaignSeed);
    this.campaignState = createInitialCampaignState(this.campaignGrid, campaignSeed);
    this.activeCampaignCell = null;
    this.gamePhase = 'campaign';

    // Hide menu, show campaign UI
    this.htmlMenuController.hide();
    this.campaignUI.show();
    this.campaignUI.render(this.campaignGrid, this.campaignState);
    this.showDebugControls(false);

    console.log('Campaign started!');
  }

  private handleCampaignCellClick(cell: CampaignCell): void {
    // Start battle for this cell (UI already checked availability)
    this.startCampaignBattle(cell);
  }

  private startCampaignBattle(cell: CampaignCell): void {
    this.activeCampaignCell = cell;
    console.log(`Starting battle for cell: ${cell.name}`);

    // Hide campaign UI
    this.campaignUI.hide();

    // Get the preset and seed for this cell
    const campaignSeed = this.campaignState!.campaignSeed;
    const preset = getCampaignCellPreset(cell, campaignSeed);
    const baseSeed = getCampaignBattleSeed(cell.id, campaignSeed);

    console.log(`Cell ${cell.id}: preset=${preset.name}, seed=${baseSeed}`);

    // Generate map with validation, retry with different salt if invalid
    let mapConfig: MapConfig;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const seed = baseSeed + attempts;
      mapConfig = presetToMapConfig(preset, seed);
      const testMap = new GameMap(mapConfig);
      const validation = validateMap(testMap, mapConfig.constraints);

      if (validation.valid) {
        console.log(`Map valid on attempt ${attempts + 1}`);
        break;
      }

      console.log(`Map invalid on attempt ${attempts + 1}: ${validation.critical.filter(c => !c.passed).map(c => c.name).join(', ')}`);
      attempts++;
    }

    // Use the last attempt even if invalid (better than no map)
    mapConfig = presetToMapConfig(preset, baseSeed + attempts);

    const playerConfigs: PlayerConfig[] = [
      { id: TEAMS.PLAYER, name: 'Player', type: 'human' },
      { id: TEAMS.ENEMY, name: 'Enemy AI', type: 'ai', aiType: 'greedy' }
    ];

    this.startNewGameWithConfig(mapConfig, playerConfigs);

    // Override player's available units with campaign unlocks
    if (this.campaignState) {
      initTeamUnits(TEAMS.PLAYER, Array.from(this.campaignState.unlockedUnits));
      // Compute campaign modifiers for combat bonuses
      this.campaignModifiers = getCampaignModifiers(this.campaignState);
      console.log('Campaign modifiers:', this.campaignModifiers);

      // Apply power effects at battle start
      this.applyBattleStartPowers();
    }

    // Show debug controls during battle
    this.showDebugControls(true);
  }

  /**
   * Apply power effects at the start of a campaign battle
   */
  private applyBattleStartPowers(): void {
    if (!this.campaignState) return;

    for (const powerId of this.campaignState.activePowers) {
      const power = POWERS[powerId];
      if (!power) continue;

      if (power.effect.type === 'bonus_unit') {
        this.spawnBonusUnits(power.effect.unitType, power.effect.count);
      }
      // Other power effects can be handled here or during gameplay
    }
  }

  /**
   * Spawn bonus units near the player's capital
   */
  private spawnBonusUnits(unitType: string, count: number): void {
    const capital = this.map.getCapital(TEAMS.PLAYER);
    if (!capital) return;

    // Get empty hexes around capital
    const neighbors = HexUtil.getNeighbors(capital.q, capital.r);
    const emptyHexes = neighbors.filter(hex => {
      const tile = this.map.getTile(hex.q, hex.r);
      if (!tile) return false;
      // Check if hex is empty
      return !this.getUnitAt(hex.q, hex.r);
    });

    // Spawn units
    let spawned = 0;
    for (const hex of emptyHexes) {
      if (spawned >= count) break;

      const unit = this.createUnitWithBonuses(TEAMS.PLAYER, hex.q, hex.r, unitType);
      this.units.push(unit);
      console.log(`Bonus ${unitType} spawned at (${hex.q}, ${hex.r})`);
      spawned++;
    }

    if (spawned < count) {
      console.log(`Could only spawn ${spawned}/${count} bonus units (not enough space)`);
    }
  }

  private handleDebugWin(): void {
    if (this.gamePhase !== 'playing' || !this.activeCampaignCell) return;

    console.log('Debug: Player wins!');
    // Trigger game over screen with player as winner
    this.triggerGameOver(TEAMS.PLAYER, TEAMS.ENEMY);
  }

  private handleDebugLose(): void {
    if (this.gamePhase !== 'playing' || !this.activeCampaignCell) return;

    console.log('Debug: Player loses!');
    // Trigger game over screen with enemy as winner
    this.triggerGameOver(TEAMS.ENEMY, TEAMS.PLAYER);
  }

  private handleBattleResult(playerWon: boolean): void {
    if (!this.campaignState || !this.campaignGrid || !this.activeCampaignCell) return;

    if (playerWon) {
      // Mark cell as completed
      this.campaignState = completeCell(
        this.activeCampaignCell.id,
        this.campaignState,
        this.campaignGrid
      );
      console.log(`Cell ${this.activeCampaignCell.name} completed!`);
    } else {
      // Lose a reinforcement
      this.campaignState = loseReinforcement(this.campaignState);
      console.log(`Lost a reinforcement. Remaining: ${this.campaignState.reinforcements}`);
    }

    // Check if campaign is over
    if (isCampaignOver(this.campaignState)) {
      console.log('Campaign over - no reinforcements left!');
      this.returnToMainMenu();
      return;
    }

    // Return to campaign view
    this.activeCampaignCell = null;
    this.gamePhase = 'campaign';
    this.showDebugControls(false);

    // Hide game UI
    const infoEl = document.getElementById('coords');
    const hudEl = document.getElementById('hud');
    if (infoEl) infoEl.style.display = 'none';
    if (hudEl) hudEl.style.display = 'none';

    // Show campaign UI and re-render
    this.campaignUI.show();
    this.campaignUI.render(this.campaignGrid, this.campaignState);
  }

  private handleGameOverReturn(): void {
    // If in campaign, handle as battle result
    if (this.activeCampaignCell && this.campaignState && this.campaignGrid) {
      const playerWon = this.gameOverData?.winner === TEAMS.PLAYER;
      this.handleBattleResult(playerWon);
    } else {
      // Normal game over - return to main menu
      this.returnToMainMenu();
    }
  }

  private returnToMainMenu(): void {
    this.gamePhase = 'main_menu';
    this.campaignState = null;
    this.campaignGrid = null;
    this.activeCampaignCell = null;
    this.campaignModifiers = null;
    this.campaignUI.hide();
    this.showDebugControls(false);
  }

  private handleEquipPower(powerId: string): void {
    if (!this.campaignState || !this.campaignGrid) return;

    this.campaignState = equipPower(powerId, this.campaignState);
    this.campaignUI.render(this.campaignGrid, this.campaignState);
    console.log(`Equipped power: ${powerId}`);
  }

  private handleUnequipPower(powerId: string): void {
    if (!this.campaignState || !this.campaignGrid) return;

    this.campaignState = unequipPower(powerId, this.campaignState);
    this.campaignUI.render(this.campaignGrid, this.campaignState);
    console.log(`Unequipped power: ${powerId}`);
  }

  private showDebugControls(visible: boolean): void {
    const debugControls = document.getElementById('debug-controls');
    if (debugControls) {
      if (visible && this.activeCampaignCell) {
        debugControls.classList.add('visible');
      } else {
        debugControls.classList.remove('visible');
      }
    }
  }

  private getActiveUnitsCount(): number {
    return this.units.filter(u => u.team === this.currentTeam && u.isAlive() && !u.hasActed && u.carriedBy === null).length;
  }

  private getTotalUnitsCount(): number {
    return this.units.filter(u => u.team === this.currentTeam && u.isAlive() && u.carriedBy === null).length;
  }

  private cycleToNextActive(autoTriggered: boolean = false): void {
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
    // Skip auto-opening factory on turn 1 so player can orient themselves first
    if (autoTriggered && this.turnNumber === 1) {
      return;
    }

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

      // Apply cost reduction for player in campaign
      let cost = template.cost;
      if (this.currentTeam === TEAMS.PLAYER && this.campaignModifiers) {
        const reduction = getCostReduction(templateId, this.campaignModifiers);
        if (reduction > 0) {
          cost = Math.floor(cost * (100 - reduction) / 100);
        }
      }

      if (!this.resources.canAfford(this.currentTeam, cost)) {
        console.log(`Cannot afford ${template.name} ($${cost})`);
        return;
      }

      // Spend funds and create unit
      this.resources.spendFunds(this.currentTeam, cost);

      const unit = this.createUnitWithBonuses(this.currentTeam, factory.q, factory.r, template.id);
      unit.hasActed = true; // New units can't act this turn
      this.units.push(unit);

      console.log(`Built ${template.name} at (${factory.q}, ${factory.r}) for $${cost}`);
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

    // Compute AV/DV based on campaign modifiers (if in campaign) and team
    let attackerAV = 100;
    let defenderDV = 100;
    let defenderAV = 100;
    let attackerDV = 100;

    if (this.campaignModifiers) {
      // Player attacking enemy
      if (attacker.team === TEAMS.PLAYER) {
        attackerAV = getAttackerAV(attacker.templateId!, this.campaignModifiers);
      }
      // Player defending against enemy
      if (defender.team === TEAMS.PLAYER) {
        defenderDV = getDefenderDV(defender.templateId!, this.campaignModifiers);
      }
      // Defender counter-attacking player
      if (defender.team === TEAMS.PLAYER) {
        defenderAV = getAttackerAV(defender.templateId!, this.campaignModifiers);
      }
      // Attacker defending against counter-attack
      if (attacker.team === TEAMS.PLAYER) {
        attackerDV = getDefenderDV(attacker.templateId!, this.campaignModifiers);
      }
    }

    // Execute combat with terrain defense and campaign modifiers
    const result = Combat.execute(
      attacker, defender, undefined, undefined,
      this.map.getTerrainDefenseStars(defender.q, defender.r),
      this.map.getTerrainDefenseStars(attacker.q, attacker.r),
      attackerAV,
      defenderDV,
      defenderAV,
      attackerDV
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

  // --- Testing API ---

  /** Get current game state for testing */
  getState(): GameState {
    return this.state;
  }

  /** Get viewport for coordinate conversion */
  getViewport(): Viewport {
    return this.viewport;
  }

  /** Get unit at position for testing */
  testGetUnitAt(q: number, r: number): Unit | undefined {
    return this.getUnitAt(q, r);
  }

  /** Get funds for a team */
  getFunds(team: string): number {
    return this.resources.getResources(team).funds;
  }

  /** Get player's available unit templates (for testing) */
  getPlayerTemplates(): { id: string; name: string; cost: number }[] {
    return getTeamTemplates(TEAMS.PLAYER).map(t => ({
      id: t.id,
      name: t.name,
      cost: t.cost
    }));
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

  private loop = (): void => {
    if (this.gamePhase === 'main_menu') {
      this.htmlMenuController.show();
      // Clear canvas behind menu
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else if (this.gamePhase === 'campaign') {
      this.htmlMenuController.hide();
      // Campaign UI is HTML-based, just clear canvas
      this.ctx.fillStyle = '#0a0c10';
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

const game = new Game();

// Expose game instance for testing
if (typeof window !== 'undefined') {
  (window as any).game = game;
}
