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
import { type Building } from './building.js';
import {
  getAvailableTemplates,
  getTemplate,
  getTeamTemplates,
  getTeamTemplate,
  getTemplateStats,
  initTeamTemplates,
  registerTemplate,
  updateTemplate,
  unregisterTemplate,
  isNameTaken,
} from './unit-templates.js';
import {
  type DesignState,
  getResearchedChassis,
  getResearchedWeapons,
  getResearchedSystems,
} from './unit-designer.js';
import { ResourceManager } from './resources.js';
import { GameStats } from './stats.js';
import { MenuRenderer, HTMLMenuController, type GamePhase, type GameOverData } from './menu.js';
import { InputHandler } from './input.js';
import { initTeamResearch } from './research.js';
import { getTechTreeState, purchaseTech } from './tech-tree.js';
import { LabModal } from './lab-modal.js';
import { type Player, type PlayerConfig } from './player.js';
import { type AIAction } from './ai/actions.js';
import { type AIGameState } from './ai/game-state.js';
import { createAI } from './ai/registry.js';

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
  private htmlMenuController: HTMLMenuController;
  private inputHandler!: InputHandler;
  private labModal: LabModal;
  private units: Unit[] = [];
  private state: GameState = { type: 'idle' };
  private lastPreviewHex: AxialCoord | null = null;
  private currentTeam: string = TEAMS.PLAYER;
  private turnNumber: number = 1;
  private nextUnitId: number = 1;
  private gamePhase: GamePhase = 'main_menu';
  private gameOverData: GameOverData | null = null;
  private players: Player[] = [];
  private isAITurnInProgress: boolean = false;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.menuRenderer = new MenuRenderer(this.ctx, this.canvas.width, this.canvas.height);
    this.htmlMenuController = new HTMLMenuController({
      onStartGame: (mapType, playerConfigs) => this.startNewGame(mapType, playerConfigs),
      onRerollSeed: () => rerollNormalSeed(),
    });
    this.labModal = new LabModal();

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
        // Only allow manual turn ending during human player's turn
        if (!this.isCurrentPlayerAI()) {
          this.endTurn();
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

    // Initialize per-team templates and research
    initTeamTemplates(TEAMS.PLAYER);
    initTeamTemplates(TEAMS.ENEMY);
    initTeamResearch(TEAMS.PLAYER);
    initTeamResearch(TEAMS.ENEMY);

    // Setup based on map type
    // Small map gets manual setup with test units; normal map starts with just home bases
    if (mapType === 'small') {
      this.setupSmallMap();
    }
    // Normal map: no starting units, just owned buildings from map generation

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

    // If the starting player is AI, trigger their turn
    if (this.isCurrentPlayerAI()) {
      setTimeout(() => this.executeAITurn(), 100);
    }
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
    this.map.addBuilding({ q: 1, r: centerR, type: 'city', owner: TEAMS.PLAYER });
    this.map.addBuilding({ q: 1, r: centerR + 1, type: 'factory', owner: TEAMS.PLAYER });
    this.map.addBuilding({ q: 1, r: centerR - 1, type: 'lab', owner: TEAMS.PLAYER });

    // Enemy side (right) - q around 7-8
    this.map.addBuilding({ q: 8, r: centerR, type: 'city', owner: TEAMS.ENEMY });
    this.map.addBuilding({ q: 8, r: centerR + 1, type: 'factory', owner: TEAMS.ENEMY });
    this.map.addBuilding({ q: 8, r: centerR - 1, type: 'lab', owner: TEAMS.ENEMY });

    // Spawn one soldier each
    const soldierTemplate = getTemplate('soldier');
    const soldierStats = getTemplateStats(soldierTemplate);

    this.units.push(new Unit(`soldier_${this.nextUnitId++}`, TEAMS.PLAYER, 3, centerR, {
      ...soldierStats,
      color: TEAM_COLORS[TEAMS.PLAYER]!.unitColor,
    }));

    this.units.push(new Unit(`soldier_${this.nextUnitId++}`, TEAMS.ENEMY, 6, centerR, {
      ...soldierStats,
      color: TEAM_COLORS[TEAMS.ENEMY]!.unitColor,
    }));

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

  private getUnitById(id: string): Unit | undefined {
    return this.units.find(u => u.id === id && u.isAlive());
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
      getResearchedChassis,
      getResearchedWeapons,
      getResearchedSystems,
      getAvailableTechs: (team) => getTechTreeState(team, this.resources.getResources(team).science),
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

        unit.q = action.targetQ;
        unit.r = action.targetR;
        console.log(`AI moves ${unit.id} to (${action.targetQ}, ${action.targetR})`);
        break;
      }

      case 'attack': {
        const unit = this.getUnitById(action.unitId);
        const target = this.getUnitAt(action.targetQ, action.targetR);
        if (!unit || !target) return;

        this.executeAttack(unit, target);
        unit.hasActed = true;
        this.checkAndTriggerGameOver();
        break;
      }

      case 'capture': {
        const unit = this.getUnitById(action.unitId);
        if (!unit) return;

        const building = this.map.getBuilding(unit.q, unit.r);
        if (building && building.owner !== unit.team && unit.canCapture) {
          const previousOwner = building.owner ?? 'neutral';
          this.map.setBuildingOwner(unit.q, unit.r, unit.team);
          this.gameStats.recordBuildingCaptured(unit.team);
          console.log(`AI ${unit.id} captured ${building.type} from ${previousOwner}!`);
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

      case 'research': {
        const result = purchaseTech(this.currentTeam, action.techId, this.resources);
        if (result.success) {
          console.log(`AI researched: ${action.techId}`);
        } else {
          console.log(`AI failed to research ${action.techId}: ${result.error}`);
        }
        break;
      }

      case 'design': {
        registerTemplate(
          this.currentTeam,
          action.name,
          action.chassisId,
          action.weaponId,
          action.systemIds
        );
        console.log(`AI designed new unit: ${action.name}`);
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

    // If the new current player is AI, trigger their turn
    if (this.isCurrentPlayerAI()) {
      setTimeout(() => this.executeAITurn(), 100);
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
          // Check if clicked on a factory or lab
          const building = this.map.getBuilding(hex.q, hex.r);
          if (building) {
            if (building.type === 'factory' && building.owner === this.currentTeam) {
              // Can only use own factories
              this.setState({ type: 'factory', factory: building });
            } else if (building.type === 'lab' && building.owner) {
              // Can view any team's lab (read-only for other teams)
              this.openLabModal(building.owner);
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

  private openLabModal(labOwner: string = this.currentTeam): void {
    const readOnly = labOwner !== this.currentTeam;
    const templates = getTeamTemplates(labOwner);
    const teamResources = this.resources.getResources(labOwner);

    this.labModal.open(
      labOwner,
      templates,
      {
        onSave: (name, design) => {
          if (readOnly || !design.chassisId) return;
          // Check if this is editing an existing template by name
          const existingTemplate = templates.find(t => t.name.toLowerCase() === name.toLowerCase());
          if (existingTemplate) {
            updateTemplate(labOwner, existingTemplate.id, name, design.chassisId, design.weaponId, design.systemIds);
            console.log(`Updated template: ${name}`);
          } else {
            registerTemplate(labOwner, name, design.chassisId, design.weaponId, design.systemIds);
            console.log(`Created new template: ${name}`);
          }
        },
        onCancel: () => {
          // Modal handles its own closing
        },
        onPurchaseTech: (techId) => {
          if (!readOnly) {
            console.log(`Purchased tech: ${techId}`);
          }
        }
      },
      teamResources.science,
      readOnly ? undefined : this.resources,
      readOnly
    );
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
