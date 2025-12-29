// ============================================================================
// HEX DOMINION - Shared Test Utilities
// ============================================================================
// Common helpers for tests to avoid duplication and ensure tests use real game logic.

import { HexUtil, TEAM_COLORS, type Tile } from '../src/core.js';
import { type Building } from '../src/building.js';
import { Unit } from '../src/unit.js';
import { Combat } from '../src/combat.js';
import { Pathfinder } from '../src/pathfinder.js';
import { ResourceManager } from '../src/resources.js';
import { type AIAction } from '../src/ai/actions.js';
import { type AIController } from '../src/ai/controller.js';
import { type GameStateView, type UnitView } from '../src/ai/game-state.js';
import {
  initTeamTemplates,
  getTeamTemplates,
  getTeamTemplate,
  getTemplate,
  registerTemplate,
} from '../src/unit-templates.js';
import { initTeamResearch, getUnlockedTechs } from '../src/research.js';
import { getTechTreeState, purchaseTech } from '../src/tech-tree.js';
import {
  getResearchedChassis,
  getResearchedWeapons,
  getResearchedSystems,
} from '../src/unit-designer.js';

// ============================================================================
// Test Map - Simple map for testing (no procedural generation)
// ============================================================================

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
      return { q, r, type: 'grass' };
    }
    return undefined;
  }

  getAllTiles(): Tile[] {
    const tiles: Tile[] = [];
    for (let r = 0; r < this.height; r++) {
      for (let q = 0; q < this.width; q++) {
        tiles.push({ q, r, type: 'grass' });
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
      initTeamTemplates(team);
      initTeamResearch(team);
    }
  }

  get currentTeam(): string {
    return this.teams[this.currentTeamIndex]!;
  }

  addUnit(team: string, q: number, r: number, templateId: string = 'soldier'): Unit {
    const template = getTemplate(templateId);
    const unit = new Unit(
      `${templateId}_${this.nextUnitId++}`,
      team,
      q,
      r,
      {
        speed: template.speed,
        attack: template.attack,
        range: template.range,
        terrainCosts: template.terrainCosts,
        color: TEAM_COLORS[team]?.unitColor ?? '#ffffff',
        canCapture: template.canCapture,
        canBuild: template.canBuild,
        armored: template.armored,
        armorPiercing: template.armorPiercing,
      }
    );
    this.units.push(unit);
    return unit;
  }

  addBuilding(q: number, r: number, type: 'city' | 'factory' | 'lab', owner: string | null): void {
    this.map.addBuilding({ q, r, type, owner });
  }

  private unitToView(unit: Unit): UnitView {
    return {
      id: unit.id,
      team: unit.team,
      q: unit.q,
      r: unit.r,
      speed: unit.speed,
      attack: unit.attack,
      range: unit.range,
      health: unit.health,
      terrainCosts: unit.terrainCosts,
      canCapture: unit.canCapture,
      canBuild: unit.canBuild,
      armored: unit.armored,
      armorPiercing: unit.armorPiercing,
      hasActed: unit.hasActed,
    };
  }

  createGameStateView(): GameStateView {
    const self = this;
    const aliveUnits = this.units.filter(u => u.isAlive());

    return {
      currentTeam: this.currentTeam,
      turnNumber: this.turn,

      getTile: (q, r) => self.map.getTile(q, r),
      getAllTiles: () => self.map.getAllTiles(),
      getBuilding: (q, r) => self.map.getBuilding(q, r),
      getAllBuildings: () => self.map.getAllBuildings(),
      getBuildingsByOwner: (owner) => self.map.getBuildingsByOwner(owner),
      getBuildingsByType: (type) => self.map.getBuildingsByType(type),

      getUnit: (id) => {
        const unit = aliveUnits.find(u => u.id === id);
        return unit ? self.unitToView(unit) : undefined;
      },
      getUnitAt: (q, r) => {
        const unit = aliveUnits.find(u => u.q === q && u.r === r);
        return unit ? self.unitToView(unit) : undefined;
      },
      getAllUnits: () => aliveUnits.map(u => self.unitToView(u)),
      getTeamUnits: (team) => aliveUnits.filter(u => u.team === team).map(u => self.unitToView(u)),
      getActiveUnits: (team) => aliveUnits.filter(u => u.team === team && !u.hasActed).map(u => self.unitToView(u)),

      getResources: (team) => self.resources.getResources(team),
      getTeamTemplates: (team) => getTeamTemplates(team),
      getUnlockedTechs: (team) => getUnlockedTechs(team),

      getAvailableTechs: (team) => {
        const teamResources = self.resources.getResources(team);
        const nodes = getTechTreeState(team, teamResources.science);
        return nodes.map(n => ({
          id: n.tech.id,
          name: n.tech.name,
          cost: n.tech.cost,
          state: n.state,
        }));
      },

      getUnlockedChassis: (team) => getResearchedChassis(team).map(c => ({
        id: c.id,
        name: c.name,
        maxWeight: c.maxWeight,
      })),
      getUnlockedWeapons: (team) => getResearchedWeapons(team).map(w => ({
        id: w.id,
        name: w.name,
        weight: w.weight,
      })),
      getUnlockedSystems: (team) => getResearchedSystems(team).map(s => ({
        id: s.id,
        name: s.name,
        weight: s.weight,
        requiresChassis: s.requiresChassis,
      })),

      getReachablePositions: (startQ, startR, speed, terrainCosts, blocked, occupied) => {
        return self.pathfinder.getReachablePositions(startQ, startR, speed, terrainCosts, blocked, occupied);
      },

      findPath: (startQ, startR, goalQ, goalR, terrainCosts, blocked) => {
        return self.pathfinder.findPath(startQ, startR, goalQ, goalR, terrainCosts, blocked);
      },

      // Use REAL Combat functions
      calculateExpectedDamage: (attacker, defender) => {
        const attackerUnit = new Unit(attacker.id, attacker.team, attacker.q, attacker.r, {
          attack: attacker.attack,
          armored: attacker.armored,
          armorPiercing: attacker.armorPiercing,
        } as any);
        attackerUnit.health = attacker.health;

        const defenderUnit = new Unit(defender.id, defender.team, defender.q, defender.r, {
          armored: defender.armored,
        } as any);
        defenderUnit.health = defender.health;

        return Combat.calculateExpectedDamage(attackerUnit, defenderUnit);
      },

      // Use REAL HexUtil for distance
      isInRange: (attacker, target) => {
        const dist = HexUtil.distance(attacker.q, attacker.r, target.q, target.r);
        return dist <= attacker.range;
      },

      getTargetsInRange: (attacker) => {
        return aliveUnits
          .filter(u => u.team !== attacker.team)
          .filter(u => HexUtil.distance(attacker.q, attacker.r, u.q, u.r) <= attacker.range)
          .map(u => self.unitToView(u));
      },
    };
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

      case 'research': {
        purchaseTech(this.currentTeam, action.techId, this.resources);
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
  attackerTemplate: string = 'soldier',
  defenderTemplate: string = 'soldier'
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
  startingFunds: number = 5000,
  startingScience: number = 0
): EconomyScenario {
  const game = new TestGame(teams, 12, 12);

  // Team 1 buildings (left side)
  game.addBuilding(2, 5, 'city', teams[0]);
  game.addBuilding(2, 6, 'factory', teams[0]);
  game.addBuilding(2, 7, 'lab', teams[0]);

  // Team 2 buildings (right side)
  game.addBuilding(9, 5, 'city', teams[1]);
  game.addBuilding(9, 6, 'factory', teams[1]);
  game.addBuilding(9, 7, 'lab', teams[1]);

  // Starting resources
  game.resources.addFunds(teams[0], startingFunds);
  game.resources.addFunds(teams[1], startingFunds);
  game.resources.addScience(teams[0], startingScience);
  game.resources.addScience(teams[1], startingScience);

  return { game };
}

// ============================================================================
// AI Simulation Helpers
// ============================================================================

/**
 * Runs a single AI turn: plan actions, execute them, end turn.
 */
export function runAITurn(game: TestGame, ai: AIController): AIAction[] {
  const stateView = game.createGameStateView();
  const actions = ai.planTurn(stateView, game.currentTeam);

  for (const action of actions) {
    if (action.type === 'endTurn') break;
    game.executeAction(action);
  }

  game.endTurn();
  return actions;
}

/**
 * Runs the game until one side wins or max turns reached.
 * Returns the winner (or null if max turns reached).
 */
export function runUntilGameOver(
  game: TestGame,
  ais: AIController[],
  maxTurns: number = 50
): string | null {
  for (let halfTurn = 0; halfTurn < maxTurns * 2; halfTurn++) {
    const ai = ais[game.currentTeamIndex]!;
    runAITurn(game, ai);

    const loser = game.checkGameOver();
    if (loser) {
      // Return the other team as winner
      return game.teams.find(t => t !== loser) ?? null;
    }
  }
  return null;
}
