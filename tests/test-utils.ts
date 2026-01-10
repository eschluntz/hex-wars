// ============================================================================
// HEX DOMINION - Shared Test Utilities
// ============================================================================
// Common helpers for tests to avoid duplication and ensure tests use real game logic.

import { TERRAIN_DEFENSE_STARS } from '../src/core.js';
import { type Building, createBuilding, type BuildingType } from '../src/building.js';
import { Unit } from '../src/unit.js';
import { Combat } from '../src/combat.js';
import { Pathfinder } from '../src/pathfinder.js';
import { ResourceManager } from '../src/resources.js';
import { type AIAction } from '../src/ai/actions.js';
import { type AIController, type AIContext } from '../src/ai/controller.js';
import {
  initTeamUnits,
  getTeamTemplates,
  getTeamTemplate,
} from '../src/unit-templates.js';

// ============================================================================
// Test Map - Simple map for testing (no procedural generation)
// ============================================================================

import { type TileType, type Tile } from '../src/core.js';
import { type GameMap } from '../src/game-map.js';

export class TestMap {
  private width: number;
  private height: number;
  private buildings: Building[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getTile(q: number, r: number): Tile | undefined {
    if (q >= 0 && q < this.width && r >= 0 && r < this.height) {
      return { q, r, type: 'grass' as TileType };
    }
    return undefined;
  }

  getTerrainDefenseStars(q: number, r: number): number {
    const tile = this.getTile(q, r);
    return tile ? TERRAIN_DEFENSE_STARS[tile.type] : 0;
  }

  getAllTiles(): Tile[] {
    const tiles: Tile[] = [];
    for (let r = 0; r < this.height; r++) {
      for (let q = 0; q < this.width; q++) {
        tiles.push({ q, r, type: 'grass' as TileType });
      }
    }
    return tiles;
  }

  addBuilding(building: Building): void {
    this.buildings.push(building);
  }

  getBuilding(q: number, r: number): Building | undefined {
    return this.buildings.find(b => b.q === q && b.r === r);
  }

  getAllBuildings(): Building[] {
    return this.buildings;
  }

  getBuildingsByOwner(owner: string): Building[] {
    return this.buildings.filter(b => b.owner === owner);
  }

  getBuildingsByType(type: string): Building[] {
    return this.buildings.filter(b => b.type === type);
  }

  setBuildingOwner(q: number, r: number, owner: string): void {
    const building = this.getBuilding(q, r);
    if (building) {
      building.owner = owner;
    }
  }
}

// ============================================================================
// Test Game - Full game simulation using REAL game objects
// ============================================================================

export class TestGame {
  map: TestMap;
  units: Unit[] = [];
  resources: ResourceManager;
  pathfinder: Pathfinder;
  teams: string[];
  currentTeamIndex: number = 0;
  turn: number = 1;
  private nextUnitId: number = 1;

  constructor(teams: string[], mapWidth: number = 12, mapHeight: number = 12) {
    this.teams = teams;
    this.map = new TestMap(mapWidth, mapHeight);
    this.pathfinder = new Pathfinder(this.map);
    this.resources = new ResourceManager(teams);

    for (const team of teams) {
      initTeamUnits(team);
    }
  }

  get currentTeam(): string {
    return this.teams[this.currentTeamIndex]!;
  }

  addUnit(team: string, q: number, r: number, templateId: string = 'infantry'): Unit {
    const unit = new Unit(`${templateId}_${this.nextUnitId++}`, team, q, r, templateId);
    this.units.push(unit);
    return unit;
  }

  addBuilding(q: number, r: number, type: BuildingType, owner: string | null): void {
    this.map.addBuilding(createBuilding(q, r, type, owner));
  }

  /** Create an AIContext that executes actions and records them */
  createAIContext(): { ctx: AIContext; actions: AIAction[] } {
    const team = this.currentTeam;
    const actions: AIAction[] = [];

    const ctx: AIContext = {
      team,
      getUnits: () => this.units,
      getBuildings: () => this.map.getAllBuildings(),
      getFunds: () => this.resources.getResources(team).funds,
      getTemplates: () => getTeamTemplates(team),
      getPathfinder: () => this.pathfinder,
      doAction: async (action: AIAction) => {
        actions.push(action);
        this.executeAction(action);
      },
    };

    return { ctx, actions };
  }

  executeAction(action: AIAction): void {
    switch (action.type) {
      case 'move': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        if (unit) {
          unit.q = action.targetQ;
          unit.r = action.targetR;
        }
        break;
      }

      case 'attack': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        const target = this.units.find(u => u.q === action.targetQ && u.r === action.targetR && u.isAlive());
        if (unit && target) {
          Combat.execute(unit, target);
          unit.hasActed = true;
        }
        break;
      }

      case 'capture': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        if (unit) {
          this.map.setBuildingOwner(unit.q, unit.r, unit.team);
          unit.hasActed = true;
        }
        break;
      }

      case 'wait': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        if (unit) {
          unit.hasActed = true;
        }
        break;
      }

      case 'build': {
        const template = getTeamTemplate(this.currentTeam, action.templateId);
        if (template && this.resources.canAfford(this.currentTeam, template.cost)) {
          this.resources.spendFunds(this.currentTeam, template.cost);
          const unit = this.addUnit(this.currentTeam, action.factoryQ, action.factoryR, action.templateId);
          unit.hasActed = true;
        }
        break;
      }

      case 'endTurn':
        break;
    }
  }

  checkGameOver(): string | null {
    for (const team of this.teams) {
      const hasUnits = this.units.some(u => u.team === team && u.isAlive());
      const hasBuildings = this.map.getBuildingsByOwner(team).length > 0;
      if (!hasUnits && !hasBuildings) {
        return team;
      }
    }
    return null;
  }

  endTurn(): void {
    for (const unit of this.units) {
      if (unit.team === this.currentTeam && unit.isAlive()) {
        unit.hasActed = false;
      }
    }

    this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
    if (this.currentTeamIndex === 0) {
      this.turn++;
    }
  }
}

// ============================================================================
// Scenario Helpers - Common game setups
// ============================================================================

export interface DuelScenario {
  game: TestGame;
  attacker: Unit;
  defender: Unit;
}

/**
 * Creates a simple 1v1 duel scenario with units adjacent to each other.
 */
export function createDuelScenario(
  attackerTemplate: string = 'infantry',
  defenderTemplate: string = 'infantry'
): DuelScenario {
  const game = new TestGame(['attacker', 'defender'], 5, 5);
  const attacker = game.addUnit('attacker', 1, 2, attackerTemplate);
  const defender = game.addUnit('defender', 2, 2, defenderTemplate);
  return { game, attacker, defender };
}

export interface EconomyScenario {
  game: TestGame;
}

/**
 * Creates a standard economy scenario with buildings on opposite sides.
 */
export function createEconomyScenario(
  teams: [string, string] = ['team1', 'team2'],
  startingFunds: number = 5000
): EconomyScenario {
  const game = new TestGame(teams, 12, 12);

  // Team 1 buildings (left side)
  game.addBuilding(2, 5, 'city', teams[0]);
  game.addBuilding(2, 6, 'factory', teams[0]);

  // Team 2 buildings (right side)
  game.addBuilding(9, 5, 'city', teams[1]);
  game.addBuilding(9, 6, 'factory', teams[1]);

  // Starting resources
  game.resources.addFunds(teams[0], startingFunds);
  game.resources.addFunds(teams[1], startingFunds);

  return { game };
}

// ============================================================================
// AI Simulation Helpers
// ============================================================================

/**
 * Runs a single AI turn: plan actions, execute them, end turn.
 */
export async function runAITurn(game: TestGame, ai: AIController): Promise<AIAction[]> {
  const { ctx, actions } = game.createAIContext();
  await ai.planTurn(ctx);
  game.endTurn();
  return actions;
}

/**
 * Runs the game until one side wins or max turns reached.
 * Returns the winner (or null if max turns reached).
 */
export async function runUntilGameOver(
  game: TestGame,
  ais: AIController[],
  maxTurns: number = 50
): Promise<string | null> {
  for (let halfTurn = 0; halfTurn < maxTurns * 2; halfTurn++) {
    const ai = ais[game.currentTeamIndex]!;
    await runAITurn(game, ai);

    const loser = game.checkGameOver();
    if (loser) {
      // Return the other team as winner
      return game.teams.find(t => t !== loser) ?? null;
    }
  }
  return null;
}

// ============================================================================
// Benchmark Game - Uses real GameMap for AI benchmarking
// ============================================================================

export class BenchmarkGame {
  map: GameMap;
  units: Unit[] = [];
  resources: ResourceManager;
  pathfinder: Pathfinder;
  teams: string[];
  currentTeamIndex: number = 0;
  turn: number = 1;
  private nextUnitId: number = 1;

  private constructor(teams: string[], map: GameMap) {
    this.teams = teams;
    this.map = map;
    this.pathfinder = new Pathfinder(map);
    this.resources = new ResourceManager(teams);

    for (const team of teams) {
      initTeamUnits(team);
    }
  }

  static fromGameMap(teams: string[], map: GameMap): BenchmarkGame {
    return new BenchmarkGame(teams, map);
  }

  get currentTeam(): string {
    return this.teams[this.currentTeamIndex]!;
  }

  addUnit(team: string, q: number, r: number, templateId: string = 'infantry'): Unit {
    const unit = new Unit(`${templateId}_${this.nextUnitId++}`, team, q, r, templateId);
    this.units.push(unit);
    return unit;
  }

  createAIContext(): { ctx: AIContext; actions: AIAction[] } {
    const team = this.currentTeam;
    const actions: AIAction[] = [];

    const ctx: AIContext = {
      team,
      getUnits: () => this.units,
      getBuildings: () => this.map.getAllBuildings(),
      getFunds: () => this.resources.getResources(team).funds,
      getTemplates: () => getTeamTemplates(team),
      getPathfinder: () => this.pathfinder,
      doAction: async (action: AIAction) => {
        actions.push(action);
        this.executeAction(action);
      },
    };

    return { ctx, actions };
  }

  executeAction(action: AIAction): void {
    switch (action.type) {
      case 'move': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        if (unit) {
          unit.q = action.targetQ;
          unit.r = action.targetR;
        }
        break;
      }

      case 'attack': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        const target = this.units.find(u => u.q === action.targetQ && u.r === action.targetR && u.isAlive());
        if (unit && target) {
          Combat.execute(unit, target);
          unit.hasActed = true;
        }
        break;
      }

      case 'capture': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        if (unit) {
          this.map.setBuildingOwner(unit.q, unit.r, unit.team);
          unit.hasActed = true;
        }
        break;
      }

      case 'wait': {
        const unit = this.units.find(u => u.id === action.unitId && u.isAlive());
        if (unit) {
          unit.hasActed = true;
        }
        break;
      }

      case 'build': {
        const template = getTeamTemplate(this.currentTeam, action.templateId);
        if (template && this.resources.canAfford(this.currentTeam, template.cost)) {
          this.resources.spendFunds(this.currentTeam, template.cost);
          const unit = this.addUnit(this.currentTeam, action.factoryQ, action.factoryR, action.templateId);
          unit.hasActed = true;
        }
        break;
      }

      case 'endTurn':
        break;
    }
  }

  checkGameOver(): string | null {
    for (const team of this.teams) {
      const hasUnits = this.units.some(u => u.team === team && u.isAlive());
      const hasBuildings = this.map.getBuildingsByOwner(team).length > 0;
      if (!hasUnits && !hasBuildings) {
        return team;
      }
    }
    return null;
  }

  endTurn(): void {
    for (const unit of this.units) {
      if (unit.team === this.currentTeam && unit.isAlive()) {
        unit.hasActed = false;
      }
    }

    this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
    if (this.currentTeamIndex === 0) {
      this.turn++;
    }
  }
}
