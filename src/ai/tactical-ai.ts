// ============================================================================
// HEX DOMINION - Tactical AI Controller
// ============================================================================
// Smarter AI designed to beat GreedyAI with these improvements:
// 1. Economic focus: Aggressively capture buildings
// 2. Focus fire: Prioritize finishing off damaged units
// 3. Smart production: Build stronger units when affordable
// 4. Better targeting: Consider counter-attack damage and unit value
// 5. Tech prioritization: Research impactful techs, not just cheapest

import { HexUtil } from '../core.js';
import { type Unit } from '../unit.js';
import { Combat } from '../combat.js';
import { type AIController } from './controller.js';
import { type AIAction } from './actions.js';
import { type AIGameState } from './game-state.js';
import {
  getBlockedPositions,
  getOccupiedPositions,
  getEnemyPositions,
  minDistanceToPositions,
  isInRangeFrom,
} from './base-utils.js';
import { planDesignPhase } from './design-utils.js';

export class TacticalAI implements AIController {
  readonly id = 'tactical';
  readonly name = 'Tactical AI';

  planTurn(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];

    // Phase 1: Research (prioritize impactful techs)
    const researchActions = this.planResearch(state, team);
    actions.push(...researchActions);

    // Phase 2: Design (similar to greedy for now)
    const designActions = this.planDesign(state, team);
    actions.push(...designActions);

    // Phase 3: Production (build stronger units)
    const productionActions = this.planProduction(state, team);
    actions.push(...productionActions);

    // Phase 4: Unit control (tactical decisions)
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

    // Find available techs we can afford
    const affordable = techs.filter(t => t.state === 'available' && t.tech.cost <= resources.science);

    if (affordable.length === 0) return actions;

    // Prioritize techs by impact:
    // 1. Chassis (more mobility/weight)
    // 2. Weapons (more damage)
    // 3. Systems (utility)
    const prioritized = affordable.sort((a, b) => {
      const scoreA = this.getTechScore(a.tech.id);
      const scoreB = this.getTechScore(b.tech.id);
      if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
      return a.tech.cost - b.tech.cost; // Cheaper first as tiebreaker
    });

    actions.push({ type: 'research', techId: prioritized[0]!.tech.id });
    return actions;
  }

  private getTechScore(techId: string): number {
    // Chassis are high priority (mobility and carry capacity)
    if (techId.includes('chassis') || techId.includes('treads') || techId.includes('wheels')) return 3;
    // Weapons are medium-high priority
    if (techId.includes('weapon') || techId.includes('cannon') || techId.includes('artillery')) return 2;
    // Systems are medium priority
    if (techId.includes('system') || techId.includes('armor') || techId.includes('capture')) return 1;
    return 0;
  }

  private planDesign(state: AIGameState, team: string): AIAction[] {
    // Use shared design phase implementation
    return planDesignPhase(state, team, 'TAC');
  }

  private planProduction(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const resources = state.resources.getResources(team);
    const templates = state.getTeamTemplates(team);
    const factories = state.buildings.filter(b => b.type === 'factory' && b.owner === team);

    // Sort factories by distance to nearest enemy
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

      // Find affordable templates, prioritize stronger units (higher cost often = better)
      const affordableTemplates = templates
        .filter(t => t.cost <= availableFunds)
        .sort((a, b) => b.cost - a.cost); // Most expensive first (stronger units)

      if (affordableTemplates.length > 0) {
        // Always build the strongest (most expensive) affordable unit
        const template = affordableTemplates[0]!;
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
    const claimedPositions = new Set<string>();

    for (const unit of units) {
      const unitActions = this.planSingleUnitAction(state, team, unit, claimedPositions);
      actions.push(...unitActions);
    }

    return actions;
  }

  private planSingleUnitAction(state: AIGameState, team: string, unit: Unit, claimedPositions: Set<string>): AIAction[] {
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

    // Priority 2/3: Balance between attacking and capturing
    // Check both options and choose the best
    const attackResult = this.findBestAttack(state, team, unit, reachable);
    let captureTarget: { q: number; r: number } | null = null;
    if (unit.canCapture) {
      captureTarget = this.findBestCaptureTarget(state, team, reachable, claimedPositions);
    }

    // If we have a great attack opportunity (high score), prioritize it over distant captures
    if (attackResult && captureTarget) {
      const captureDistance = HexUtil.distance(unit.q, unit.r, captureTarget.q, captureTarget.r);
      // If capture is more than 2 hexes away and we have a good attack, attack first
      if (captureDistance > 2) {
        if (attackResult.moveFirst) {
          actions.push({
            type: 'move',
            unitId: unit.id,
            targetQ: attackResult.moveQ,
            targetR: attackResult.moveR
          });
          claimedPositions.add(`${attackResult.moveQ},${attackResult.moveR}`);
        }
        actions.push({
          type: 'attack',
          unitId: unit.id,
          targetQ: attackResult.targetQ,
          targetR: attackResult.targetR
        });
        return actions;
      }
    }

    // Prioritize close captures
    if (captureTarget) {
      if (captureTarget.q !== unit.q || captureTarget.r !== unit.r) {
        actions.push({
          type: 'move',
          unitId: unit.id,
          targetQ: captureTarget.q,
          targetR: captureTarget.r
        });
      }
      // Claim the capture target
      claimedPositions.add(`${captureTarget.q},${captureTarget.r}`);
      actions.push({ type: 'capture', unitId: unit.id });
      return actions;
    }

    // Attack if no close capture available
    if (attackResult) {
      if (attackResult.moveFirst) {
        actions.push({
          type: 'move',
          unitId: unit.id,
          targetQ: attackResult.moveQ,
          targetR: attackResult.moveR
        });
        claimedPositions.add(`${attackResult.moveQ},${attackResult.moveR}`);
      }
      actions.push({
        type: 'attack',
        unitId: unit.id,
        targetQ: attackResult.targetQ,
        targetR: attackResult.targetR
      });
      return actions;
    }

    // Priority 4: Move toward best target (buildings > enemies)
    const moveTarget = this.findMoveTarget(state, team, unit, reachable, claimedPositions);
    if (moveTarget && (moveTarget.q !== unit.q || moveTarget.r !== unit.r)) {
      actions.push({
        type: 'move',
        unitId: unit.id,
        targetQ: moveTarget.q,
        targetR: moveTarget.r
      });
      claimedPositions.add(`${moveTarget.q},${moveTarget.r}`);
    }

    // Priority 5: Wait
    actions.push({ type: 'wait', unitId: unit.id });
    return actions;
  }

  private findBestCaptureTarget(
    state: AIGameState,
    team: string,
    reachable: Map<string, { q: number; r: number; cost: number }>,
    claimedPositions: Set<string>
  ): { q: number; r: number } | null {
    const buildings = state.buildings.filter(b => b.owner !== team);
    let bestBuilding: { q: number; r: number } | null = null;
    let bestScore = -Infinity;

    for (const building of buildings) {
      const key = `${building.q},${building.r}`;
      // Skip buildings already claimed by another unit
      if (claimedPositions.has(key)) continue;
      const reachablePos = reachable.get(key);
      if (reachablePos) {
        // Prioritize by: 1) building type value, 2) closer is better
        const typeValue = building.type === 'capital' ? 10 :
                          building.type === 'factory' ? 3 :
                          building.type === 'city' ? 2 : 1;
        const score = typeValue * 1000 - reachablePos.cost;
        if (score > bestScore) {
          bestScore = score;
          bestBuilding = { q: building.q, r: building.r };
        }
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
    let bestScore = -Infinity;

    // Check attacks from current position
    for (const enemy of enemies) {
      if (isInRangeFrom(unit, enemy, unit.q, unit.r)) {
        const score = this.calculateAttackScore(unit, enemy, unit.q, unit.r);
        if (score > bestScore) {
          bestScore = score;
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
          const score = this.calculateAttackScore(unit, enemy, pos.q, pos.r);
          if (score > bestScore) {
            bestScore = score;
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

  private calculateAttackScore(attacker: Unit, defender: Unit, fromQ: number, fromR: number): number {
    const damage = Combat.calculateExpectedDamage(attacker, defender);

    // Calculate counter-attack damage if defender survives
    let counterDamage = 0;
    if (defender.health > damage && isInRangeFrom(defender, attacker, fromQ, fromR)) {
      counterDamage = Combat.calculateExpectedDamage(defender, attacker);
    }

    // Score formula:
    // 1. High priority: Finish off weak units (damage >= health gives bonus)
    // 2. Damage dealt is good
    // 3. Counter-attack damage is bad (but not too bad - be aggressive)
    // 4. Damaging already-damaged units is better (finish them off)

    let score = damage * 10; // Base score from damage

    if (damage >= defender.health) {
      score += 150; // Big bonus for killing (increased from 100)
    }

    score -= counterDamage * 3; // Reduced penalty for counter-attack (was 5, now 3)

    // Bigger bonus for attacking already-damaged units (finish them off)
    if (defender.health < 10) {
      score += (10 - defender.health) * 8; // Increased from 5 to 8
    }

    return score;
  }

  private findMoveTarget(
    state: AIGameState,
    team: string,
    unit: Unit,
    reachable: Map<string, { q: number; r: number; cost: number }>,
    claimedPositions: Set<string>
  ): { q: number; r: number } | null {
    const targets: Array<{ q: number; r: number; priority: number }> = [];

    // High priority: Capturable buildings (if unit can capture)
    if (unit.canCapture) {
      for (const building of state.buildings.filter(b => b.owner !== team)) {
        // Much higher priority for buildings - economy is key! Capital = instant win
        const priority = building.type === 'capital' ? 500 :
                         building.type === 'factory' ? 200 :
                         building.type === 'city' ? 180 : 150;
        targets.push({ q: building.q, r: building.r, priority });
      }
    }

    // Lower priority: Enemy units (only if we have no buildings to capture)
    if (targets.length === 0 || !unit.canCapture) {
      for (const enemy of state.units.filter(u => u.team !== team && u.isAlive())) {
        targets.push({ q: enemy.q, r: enemy.r, priority: 50 });
      }
    }

    if (targets.length === 0) return null;

    // Find the reachable position that minimizes distance to highest priority targets
    let bestPos: { q: number; r: number } | null = null;
    let bestScore = -Infinity;

    for (const [key, pos] of reachable) {
      // Skip positions already claimed by another unit
      if (claimedPositions.has(key)) continue;
      // Calculate weighted score based on distance to targets
      let score = 0;
      for (const target of targets) {
        const dist = HexUtil.distance(pos.q, pos.r, target.q, target.r);
        // Closer is better, weighted by priority
        // Use squared priority for buildings to make them even more attractive
        const weight = target.priority > 100 ? target.priority * target.priority : target.priority;
        score += weight / (dist + 1);
      }

      if (score > bestScore) {
        bestScore = score;
        bestPos = { q: pos.q, r: pos.r };
      }
    }

    return bestPos;
  }
}
