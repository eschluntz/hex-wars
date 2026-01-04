// ============================================================================
// HEX DOMINION - AI Turn Executor
// ============================================================================
// Handles execution of AI actions during the AI's turn.

import { TEAM_COLORS } from './core.js';
import { CONFIG } from './config.js';
import { Unit } from './unit.js';
import { type AIAction } from './ai/actions.js';
import { type AIGameState } from './ai/game-state.js';
import { type Player } from './player.js';
import { type AnimationController } from './animation.js';
import { type Pathfinder } from './pathfinder.js';
import { type GameMap } from './game-map.js';
import { type ResourceManager } from './resources.js';
import { type Building } from './building.js';
import { getTeamTemplate, getTeamTemplates, getTemplateStats } from './unit-templates.js';
import { COMBAT_ANIMATION_DURATION } from './combat-animator.js';

/**
 * Interface for game operations the AI executor needs.
 * This decouples the executor from the main Game class.
 */
export interface AIGameOperations {
  // Queries
  getPlayer(teamId: string): Player | undefined;
  getUnitById(id: string): Unit | undefined;
  getUnitAt(q: number, r: number): Unit | undefined;
  getBlockedPositions(forTeam: string): Set<string>;
  isGameOver(): boolean;

  // Actions
  executeCombatWithAnimations(attacker: Unit, defender: Unit): void;
  executeCapture(unit: Unit, logPrefix: string): void;
  checkAndTriggerGameOver(): void;
  endTurn(): void;

  // Unit management
  addUnit(unit: Unit): void;
  getNextUnitId(): number;
}

export class AITurnExecutor {
  private animationController: AnimationController;
  private pathfinder: Pathfinder;
  private map: GameMap;
  private resources: ResourceManager;

  constructor(
    animationController: AnimationController,
    pathfinder: Pathfinder,
    map: GameMap,
    resources: ResourceManager
  ) {
    this.animationController = animationController;
    this.pathfinder = pathfinder;
    this.map = map;
    this.resources = resources;
  }

  /**
   * Execute a full AI turn for the given team.
   */
  async executeTurn(
    currentTeam: string,
    ops: AIGameOperations,
    units: Unit[]
  ): Promise<void> {
    const player = ops.getPlayer(currentTeam);
    if (!player || player.type !== 'ai' || !player.aiController) {
      return;
    }

    console.log(`AI (${player.name}) is taking its turn...`);

    const aiState = this.createAIState(currentTeam, units);
    const actions = player.aiController.planTurn(aiState, currentTeam);

    for (const action of actions) {
      if (ops.isGameOver()) break;

      await this.executeAction(action, currentTeam, ops);

      // Small delay between actions for visual feedback
      await this.delay(50);
    }
  }

  private createAIState(currentTeam: string, units: Unit[]): AIGameState {
    return {
      currentTeam,
      turnNumber: 1, // AI doesn't need exact turn number
      units,
      map: this.map,
      buildings: this.map.getAllBuildings(),
      resources: this.resources,
      pathfinder: this.pathfinder,
      getTeamTemplates,
    };
  }

  private async executeAction(
    action: AIAction,
    currentTeam: string,
    ops: AIGameOperations
  ): Promise<void> {
    switch (action.type) {
      case 'move': {
        const unit = ops.getUnitById(action.unitId);
        if (!unit || unit.hasActed) return;

        // Compute path for animation
        const blocked = ops.getBlockedPositions(unit.team);
        const pathResult = this.pathfinder.findPath(
          unit.q, unit.r,
          action.targetQ, action.targetR,
          unit.terrainCosts,
          blocked
        );

        if (pathResult) {
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
        const unit = ops.getUnitById(action.unitId);
        const target = ops.getUnitAt(action.targetQ, action.targetR);
        if (!unit || !target) return;

        ops.executeCombatWithAnimations(unit, target);

        await this.delay(COMBAT_ANIMATION_DURATION);

        unit.hasActed = true;
        ops.checkAndTriggerGameOver();
        break;
      }

      case 'capture': {
        const unit = ops.getUnitById(action.unitId);
        if (!unit) return;

        if (unit.canCapture) {
          const building = this.map.getBuilding(unit.q, unit.r);
          if (building && building.owner !== unit.team) {
            const willCapture = building.captureResistance <= unit.health;
            const buildingName = building.type.charAt(0).toUpperCase() + building.type.slice(1);
            const toastText = willCapture
              ? `${buildingName} Captured!`
              : `-${unit.health} resistance`;

            await this.animationController.play({
              type: 'combat',
              hexQ: unit.q,
              hexR: unit.r,
              toastText
            });
          }
          ops.executeCapture(unit, 'AI ');
        }
        unit.hasActed = true;
        ops.checkAndTriggerGameOver();
        break;
      }

      case 'wait': {
        const unit = ops.getUnitById(action.unitId);
        if (unit) {
          unit.hasActed = true;
        }
        break;
      }

      case 'build': {
        const template = getTeamTemplate(currentTeam, action.templateId);
        if (!template) {
          console.log(`AI: Unknown template ${action.templateId}`);
          return;
        }

        if (!this.resources.canAfford(currentTeam, template.cost)) {
          console.log(`AI: Cannot afford ${template.name}`);
          return;
        }

        const existingUnit = ops.getUnitAt(action.factoryQ, action.factoryR);
        if (existingUnit) {
          console.log(`AI: Factory at (${action.factoryQ}, ${action.factoryR}) is occupied`);
          return;
        }

        await this.animationController.play({
          type: 'build',
          hexQ: action.factoryQ,
          hexR: action.factoryR,
          toastText: `Built ${template.name}`
        });

        this.resources.spendFunds(currentTeam, template.cost);

        const unit = new Unit(
          `${template.id}_${ops.getNextUnitId()}`,
          currentTeam,
          action.factoryQ,
          action.factoryR,
          { ...getTemplateStats(template), color: TEAM_COLORS[currentTeam]!.unitColor }
        );
        unit.hasActed = true;
        ops.addUnit(unit);
        console.log(`AI built ${template.name} at (${action.factoryQ}, ${action.factoryR})`);
        break;
      }

      case 'endTurn': {
        ops.endTurn();
        break;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
