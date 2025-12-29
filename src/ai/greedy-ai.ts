// ============================================================================
// HEX DOMINION - Greedy AI Controller
// ============================================================================
// First playable AI with greedy decision-making:
// - Research: Pick cheapest affordable tech
// - Production: Order factories by distance to enemy, build random affordable unit
// - Unit control (per-unit greedy):
//   1. Capture building (if on one)
//   2. Move to capture building (if in range)
//   3. Attack with maximum expected damage
//   4. Move toward nearest enemy/neutral building
//   5. Wait

import { Combat } from '../combat.js';
import { type AIController } from './controller.js';
import { type AIAction } from './actions.js';
import { type AIGameState } from './game-state.js';
import { type Unit } from '../unit.js';
import {
  getBlockedPositions,
  getOccupiedPositions,
  getEnemyPositions,
  minDistanceToPositions,
  minPathDistanceToPositions,
  isInRangeFrom,
  pickRandomTemplate,
} from './base-utils.js';
import { planDesignPhase } from './design-utils.js';

export class GreedyAI implements AIController {
  readonly id = 'greedy';
  readonly name = 'Greedy AI';

  planTurn(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];

    // Phase 1: Research (pick cheapest affordable tech)
    const researchActions = this.planResearch(state, team);
    actions.push(...researchActions);

    // Phase 2: Design (create new unit templates with unlocked components)
    const designActions = this.planDesign(state, team);
    actions.push(...designActions);

    // Phase 3: Production (build units at factories)
    const productionActions = this.planProduction(state, team);
    actions.push(...productionActions);

    // Phase 4: Unit control (greedy per-unit decisions)
    const unitActions = this.planUnitActions(state, team);
    actions.push(...unitActions);

    // Always end with endTurn
    actions.push({ type: 'endTurn' });

    return actions;
  }

  private planResearch(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const techs = state.getAvailableTechs(team);
    const resources = state.resources.getResources(team);

    // Find available techs we can afford, sorted by cost (cheapest first)
    const affordable = techs
      .filter(t => t.state === 'available' && t.tech.cost <= resources.science)
      .sort((a, b) => a.tech.cost - b.tech.cost);

    // Research the cheapest one
    if (affordable.length > 0) {
      actions.push({ type: 'research', techId: affordable[0]!.tech.id });
    }

    return actions;
  }

  private planDesign(state: AIGameState, team: string): AIAction[] {
    // Use shared design phase implementation
    return planDesignPhase(state, team, 'AI');
  }

  private planProduction(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const resources = state.resources.getResources(team);
    const templates = state.getTeamTemplates(team);
    const factories = state.buildings.filter(b => b.type === 'factory' && b.owner === team);

    // Sort factories by distance to nearest enemy unit/building
    const enemyPositions = getEnemyPositions(state, team);
    const sortedFactories = factories.sort((a, b) => {
      const distA = minDistanceToPositions(a.q, a.r, enemyPositions);
      const distB = minDistanceToPositions(b.q, b.r, enemyPositions);
      return distA - distB; // Closer factories first
    });

    let availableFunds = resources.funds;

    for (const factory of sortedFactories) {
      // Check if factory hex is occupied
      const unitAtFactory = state.units.find(u => u.q === factory.q && u.r === factory.r && u.isAlive());
      if (unitAtFactory) continue;

      // Find affordable templates, sorted by cost (cheapest first for greedy)
      const affordableTemplates = templates
        .filter(t => t.cost <= availableFunds)
        .sort((a, b) => a.cost - b.cost);

      if (affordableTemplates.length > 0) {
        // Pick a random affordable template (with bias toward variety)
        const template = pickRandomTemplate(affordableTemplates);
        actions.push({
          type: 'build',
          factoryQ: factory.q,
          factoryR: factory.r,
          templateId: template.id
        });
        availableFunds -= template.cost;
      }
    }

    return actions;
  }

  private planUnitActions(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const units = state.units.filter(u => u.team === team && u.isAlive() && !u.hasActed);

    for (const unit of units) {
      const unitActions = this.planSingleUnitAction(state, team, unit);
      actions.push(...unitActions);
    }

    return actions;
  }

  private planSingleUnitAction(state: AIGameState, team: string, unit: Unit): AIAction[] {
    const actions: AIAction[] = [];

    // Priority 1: Capture building if on one
    const building = state.map.getBuilding(unit.q, unit.r);
    if (building && building.owner !== team && unit.canCapture) {
      actions.push({ type: 'capture', unitId: unit.id });
      return actions;
    }

    // Get reachable positions for this unit
    const blocked = getBlockedPositions(state, team);
    const occupied = getOccupiedPositions(state, unit.id);
    const reachable = state.pathfinder.getReachablePositions(
      unit.q, unit.r,
      unit.speed,
      unit.terrainCosts,
      blocked,
      occupied
    );

    // Priority 2: Move to capture a building if in range
    if (unit.canCapture) {
      const captureTarget = this.findBestCaptureTarget(state, team, reachable);
      if (captureTarget) {
        if (captureTarget.q !== unit.q || captureTarget.r !== unit.r) {
          actions.push({
            type: 'move',
            unitId: unit.id,
            targetQ: captureTarget.q,
            targetR: captureTarget.r
          });
        }
        actions.push({ type: 'capture', unitId: unit.id });
        return actions;
      }
    }

    // Priority 3: Attack with maximum expected damage
    const attackResult = this.findBestAttack(state, team, unit, reachable);
    if (attackResult) {
      if (attackResult.moveFirst) {
        actions.push({
          type: 'move',
          unitId: unit.id,
          targetQ: attackResult.moveQ,
          targetR: attackResult.moveR
        });
      }
      actions.push({
        type: 'attack',
        unitId: unit.id,
        targetQ: attackResult.targetQ,
        targetR: attackResult.targetR
      });
      return actions;
    }

    // Priority 4: Move toward nearest enemy/neutral building
    const moveTarget = this.findMoveTarget(state, team, unit, reachable);
    if (moveTarget && (moveTarget.q !== unit.q || moveTarget.r !== unit.r)) {
      actions.push({
        type: 'move',
        unitId: unit.id,
        targetQ: moveTarget.q,
        targetR: moveTarget.r
      });
    }

    // Priority 5: Wait
    actions.push({ type: 'wait', unitId: unit.id });
    return actions;
  }

  private findBestCaptureTarget(
    state: AIGameState,
    team: string,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { q: number; r: number } | null {
    const buildings = state.buildings.filter(b => b.owner !== team);
    let bestBuilding: { q: number; r: number } | null = null;
    let bestCost = Infinity;

    for (const building of buildings) {
      const key = `${building.q},${building.r}`;
      const reachablePos = reachable.get(key);
      if (reachablePos && reachablePos.cost < bestCost) {
        bestCost = reachablePos.cost;
        bestBuilding = { q: building.q, r: building.r };
      }
    }

    return bestBuilding;
  }

  private findBestAttack(
    state: AIGameState,
    team: string,
    unit: Unit,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { moveFirst: boolean; moveQ: number; moveR: number; targetQ: number; targetR: number } | null {
    const enemies = state.units.filter(u => u.team !== team && u.isAlive());
    let bestResult: { moveFirst: boolean; moveQ: number; moveR: number; targetQ: number; targetR: number } | null = null;
    let bestDamage = 0;

    // Check attacks from current position
    for (const enemy of enemies) {
      if (isInRangeFrom(unit, enemy, unit.q, unit.r)) {
        const damage = Combat.calculateExpectedDamage(unit, enemy);
        if (damage > bestDamage) {
          bestDamage = damage;
          bestResult = {
            moveFirst: false,
            moveQ: unit.q,
            moveR: unit.r,
            targetQ: enemy.q,
            targetR: enemy.r
          };
        }
      }
    }

    // Check attacks from reachable positions
    for (const [_key, pos] of reachable) {
      for (const enemy of enemies) {
        if (isInRangeFrom(unit, enemy, pos.q, pos.r)) {
          const damage = Combat.calculateExpectedDamage(unit, enemy);
          if (damage > bestDamage) {
            bestDamage = damage;
            bestResult = {
              moveFirst: pos.q !== unit.q || pos.r !== unit.r,
              moveQ: pos.q,
              moveR: pos.r,
              targetQ: enemy.q,
              targetR: enemy.r
            };
          }
        }
      }
    }

    return bestResult;
  }

  private findMoveTarget(
    state: AIGameState,
    team: string,
    unit: Unit,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { q: number; r: number } | null {
    // Find all target positions
    const targets: Array<{ q: number; r: number }> = [];

    // Enemy units - all units should pursue enemies
    for (const enemy of state.units.filter(u => u.team !== team && u.isAlive())) {
      targets.push({ q: enemy.q, r: enemy.r });
    }

    // Only units that can capture should move toward buildings
    if (unit.canCapture) {
      for (const building of state.buildings.filter(b => b.owner !== team)) {
        targets.push({ q: building.q, r: building.r });
      }
    }

    if (targets.length === 0) return null;

    // Find the reachable position that minimizes pathfinding distance to nearest target
    // This accounts for terrain and impassable tiles, unlike hex distance
    let bestPos: { q: number; r: number } | null = null;
    let bestDistance = Infinity;

    // Get blocked positions for pathfinding (enemies can't be pathed through)
    const blocked = getBlockedPositions(state, team);

    for (const [_key, pos] of reachable) {
      const distToNearestTarget = minPathDistanceToPositions(
        state.pathfinder,
        pos.q, pos.r,
        targets,
        unit.terrainCosts,
        blocked
      );
      if (distToNearestTarget < bestDistance) {
        bestDistance = distToNearestTarget;
        bestPos = { q: pos.q, r: pos.r };
      }
    }

    return bestPos;
  }
}
