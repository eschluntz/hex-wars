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

import { HexUtil } from '../core.js';
import { type AIController } from './controller.js';
import { type AIAction } from './actions.js';
import { type GameStateView, type UnitView } from './game-state.js';

export class GreedyAI implements AIController {
  readonly id = 'greedy';
  readonly name = 'Greedy AI';

  planTurn(state: GameStateView, team: string): AIAction[] {
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

  private planResearch(state: GameStateView, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const techs = state.getAvailableTechs(team);
    const resources = state.getResources(team);

    // Find available techs we can afford, sorted by cost (cheapest first)
    const affordable = techs
      .filter(t => t.state === 'available' && t.cost <= resources.science)
      .sort((a, b) => a.cost - b.cost);

    // Research the cheapest one
    if (affordable.length > 0) {
      actions.push({ type: 'research', techId: affordable[0]!.id });
    }

    return actions;
  }

  private planDesign(state: GameStateView, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const templates = state.getTeamTemplates(team);
    const chassisList = state.getUnlockedChassis(team);
    const weapons = state.getUnlockedWeapons(team);
    const systems = state.getUnlockedSystems(team);

    // Find chassis not yet used in any template
    const usedChassis = new Set(templates.map(t => t.chassisId));
    const newChassis = chassisList.filter(c => !usedChassis.has(c.id));

    if (newChassis.length === 0) return actions;

    const chassis = newChassis[0]!;
    const chassisId = chassis.id;
    const maxWeight = chassis.maxWeight;

    // Find a weapon that fits within weight capacity
    const validWeapons = weapons.filter(w => w.weight <= maxWeight);
    const weaponId = validWeapons.length > 0 ? validWeapons[0]!.id : null;
    const weaponWeight = validWeapons.length > 0 ? validWeapons[0]!.weight : 0;
    const remainingWeight = maxWeight - weaponWeight;

    // Find systems that:
    // 1. Fit within remaining weight
    // 2. Are compatible with this chassis (check requiresChassis)
    const validSystems = systems.filter(s => {
      if (s.weight > remainingWeight) return false;
      if (s.requiresChassis && !s.requiresChassis.includes(chassisId)) return false;
      return true;
    });

    // Pick the first valid system (could be smarter in future)
    const systemIds = validSystems.length > 0 ? [validSystems[0]!.id] : [];

    const name = `AI_${chassisId}_${Date.now() % 10000}`;
    actions.push({ type: 'design', name, chassisId, weaponId, systemIds });

    return actions;
  }

  private planProduction(state: GameStateView, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const resources = state.getResources(team);
    const templates = state.getTeamTemplates(team);
    const factories = state.getBuildingsByOwner(team).filter(b => b.type === 'factory');

    // Sort factories by distance to nearest enemy unit/building
    const enemyPositions = this.getEnemyPositions(state, team);
    const sortedFactories = factories.sort((a, b) => {
      const distA = this.minDistanceToPositions(a.q, a.r, enemyPositions);
      const distB = this.minDistanceToPositions(b.q, b.r, enemyPositions);
      return distA - distB; // Closer factories first
    });

    let availableFunds = resources.funds;

    for (const factory of sortedFactories) {
      // Check if factory hex is occupied
      const unitAtFactory = state.getUnitAt(factory.q, factory.r);
      if (unitAtFactory) continue;

      // Find affordable templates, sorted by cost (cheapest first for greedy)
      const affordableTemplates = templates
        .filter(t => t.cost <= availableFunds)
        .sort((a, b) => a.cost - b.cost);

      if (affordableTemplates.length > 0) {
        // Pick a random affordable template (with bias toward variety)
        const template = this.pickRandomTemplate(affordableTemplates);
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

  private planUnitActions(state: GameStateView, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const units = state.getActiveUnits(team);

    for (const unit of units) {
      const unitActions = this.planSingleUnitAction(state, team, unit);
      actions.push(...unitActions);
    }

    return actions;
  }

  private planSingleUnitAction(state: GameStateView, team: string, unit: UnitView): AIAction[] {
    const actions: AIAction[] = [];

    // Priority 1: Capture building if on one
    const building = state.getBuilding(unit.q, unit.r);
    if (building && building.owner !== team && unit.canCapture) {
      actions.push({ type: 'capture', unitId: unit.id });
      return actions;
    }

    // Get reachable positions for this unit
    const blocked = this.getBlockedPositions(state, team);
    const occupied = this.getOccupiedPositions(state, unit.id);
    const reachable = state.getReachablePositions(
      unit.q, unit.r,
      unit.speed,
      unit.terrainCosts,
      blocked,
      occupied
    );

    // Priority 2: Move to capture a building if in range
    if (unit.canCapture) {
      const captureTarget = this.findBestCaptureTarget(state, team, unit, reachable);
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
    state: GameStateView,
    team: string,
    unit: UnitView,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { q: number; r: number } | null {
    const buildings = state.getAllBuildings().filter(b => b.owner !== team);
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
    state: GameStateView,
    team: string,
    unit: UnitView,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { moveFirst: boolean; moveQ: number; moveR: number; targetQ: number; targetR: number } | null {
    const enemies = state.getAllUnits().filter(u => u.team !== team);
    let bestResult: { moveFirst: boolean; moveQ: number; moveR: number; targetQ: number; targetR: number } | null = null;
    let bestDamage = 0;

    // Check attacks from current position
    for (const enemy of enemies) {
      if (this.isInRangeFrom(unit, enemy, unit.q, unit.r)) {
        const damage = state.calculateExpectedDamage(unit, enemy);
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
        if (this.isInRangeFrom(unit, enemy, pos.q, pos.r)) {
          const damage = state.calculateExpectedDamage(unit, enemy);
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
    state: GameStateView,
    team: string,
    unit: UnitView,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { q: number; r: number } | null {
    // Find all target positions
    const targets: Array<{ q: number; r: number }> = [];

    // Enemy units - all units should pursue enemies
    for (const enemy of state.getAllUnits().filter(u => u.team !== team)) {
      targets.push({ q: enemy.q, r: enemy.r });
    }

    // Only units that can capture should move toward buildings
    if (unit.canCapture) {
      for (const building of state.getAllBuildings().filter(b => b.owner !== team)) {
        targets.push({ q: building.q, r: building.r });
      }
    }

    if (targets.length === 0) return null;

    // Find the reachable position that minimizes distance to nearest target
    let bestPos: { q: number; r: number } | null = null;
    let bestDistance = Infinity;

    for (const [_key, pos] of reachable) {
      const distToNearestTarget = this.minDistanceToPositions(pos.q, pos.r, targets);
      if (distToNearestTarget < bestDistance) {
        bestDistance = distToNearestTarget;
        bestPos = { q: pos.q, r: pos.r };
      }
    }

    return bestPos;
  }

  private isInRangeFrom(unit: UnitView, target: UnitView, fromQ: number, fromR: number): boolean {
    const distance = HexUtil.distance(fromQ, fromR, target.q, target.r);
    return distance <= unit.range;
  }

  private getBlockedPositions(state: GameStateView, forTeam: string): Set<string> {
    const blocked = new Set<string>();
    for (const unit of state.getAllUnits()) {
      if (unit.team !== forTeam) {
        blocked.add(`${unit.q},${unit.r}`);
      }
    }
    return blocked;
  }

  private getOccupiedPositions(state: GameStateView, excludeUnitId: string): Set<string> {
    const occupied = new Set<string>();
    for (const unit of state.getAllUnits()) {
      if (unit.id !== excludeUnitId) {
        occupied.add(`${unit.q},${unit.r}`);
      }
    }
    return occupied;
  }

  private getEnemyPositions(state: GameStateView, team: string): Array<{ q: number; r: number }> {
    const positions: Array<{ q: number; r: number }> = [];

    // Enemy units
    for (const unit of state.getAllUnits().filter(u => u.team !== team)) {
      positions.push({ q: unit.q, r: unit.r });
    }

    // Enemy buildings
    for (const building of state.getBuildingsByOwner(team === 'player' ? 'enemy' : 'player')) {
      positions.push({ q: building.q, r: building.r });
    }

    return positions;
  }

  private minDistanceToPositions(q: number, r: number, positions: Array<{ q: number; r: number }>): number {
    if (positions.length === 0) return Infinity;
    let minDist = Infinity;
    for (const pos of positions) {
      const dist = HexUtil.distance(q, r, pos.q, pos.r);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }

  private pickRandomTemplate(templates: Array<{ id: string; cost: number }>): { id: string; cost: number } {
    // Simple random pick - could be weighted in future
    const idx = Math.floor(Math.random() * templates.length);
    return templates[idx]!;
  }
}
