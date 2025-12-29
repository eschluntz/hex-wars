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

import { HexUtil, type TerrainCosts } from '../core.js';
import { type Unit } from '../unit.js';
import { Combat } from '../combat.js';
import { type Pathfinder } from '../pathfinder.js';
import { type AIController } from './controller.js';
import { type AIAction } from './actions.js';
import { type AIGameState } from './game-state.js';

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
    const actions: AIAction[] = [];
    const templates = state.getTeamTemplates(team);
    const chassisList = state.getResearchedChassis(team);
    const weapons = state.getResearchedWeapons(team);
    const systems = state.getResearchedSystems(team);

    // Track what components are already used in templates
    const usedChassis = new Set(templates.map(t => t.chassisId));
    const usedWeapons = new Set(templates.map(t => t.weaponId).filter(Boolean));
    const usedSystems = new Set(templates.flatMap(t => t.systemIds));

    // 1. Create templates for new chassis
    for (const chassis of chassisList) {
      if (usedChassis.has(chassis.id)) continue;

      const design = this.designForChassis(chassis, weapons, systems);
      if (design) {
        actions.push(design);
        usedChassis.add(chassis.id);
        if (design.weaponId) usedWeapons.add(design.weaponId);
        design.systemIds.forEach(s => usedSystems.add(s));
      }
    }

    // 2. Create templates for new weapons
    for (const weapon of weapons) {
      if (usedWeapons.has(weapon.id)) continue;

      const design = this.designForWeapon(weapon, chassisList, systems);
      if (design) {
        actions.push(design);
        usedWeapons.add(weapon.id);
        usedChassis.add(design.chassisId);
        design.systemIds.forEach(s => usedSystems.add(s));
      }
    }

    // 3. Create templates for new systems
    for (const system of systems) {
      if (usedSystems.has(system.id)) continue;

      const design = this.designForSystem(system, chassisList, weapons);
      if (design) {
        actions.push(design);
        usedSystems.add(system.id);
        usedChassis.add(design.chassisId);
        if (design.weaponId) usedWeapons.add(design.weaponId);
      }
    }

    return actions;
  }

  private designForChassis(
    chassis: { id: string; maxWeight: number },
    weapons: Array<{ id: string; weight: number; requiresChassis?: string[] }>,
    systems: Array<{ id: string; weight: number; requiresChassis?: string[] }>
  ): { type: 'design'; name: string; chassisId: string; weaponId: string | null; systemIds: string[] } | null {
    const chassisId = chassis.id;
    const maxWeight = chassis.maxWeight;

    // Find best weapon that fits
    const validWeapons = weapons.filter(w => {
      if (w.weight > maxWeight) return false;
      if (w.requiresChassis && !w.requiresChassis.includes(chassisId)) return false;
      return true;
    });
    const weaponId = validWeapons.length > 0 ? validWeapons[0]!.id : null;
    const weaponWeight = validWeapons.length > 0 ? validWeapons[0]!.weight : 0;
    const remainingWeight = maxWeight - weaponWeight;

    // Find compatible system
    const validSystems = systems.filter(s => {
      if (s.weight > remainingWeight) return false;
      if (s.requiresChassis && !s.requiresChassis.includes(chassisId)) return false;
      return true;
    });
    const systemIds = validSystems.length > 0 ? [validSystems[0]!.id] : [];

    const name = `AI_${chassisId}_${Date.now() % 10000}`;
    return { type: 'design', name, chassisId, weaponId, systemIds };
  }

  private designForWeapon(
    weapon: { id: string; weight: number; requiresChassis?: string[] },
    chassisList: Array<{ id: string; maxWeight: number }>,
    systems: Array<{ id: string; weight: number; requiresChassis?: string[] }>
  ): { type: 'design'; name: string; chassisId: string; weaponId: string | null; systemIds: string[] } | null {
    // Find a chassis that can hold this weapon
    const validChassis = chassisList.filter(c => {
      if (weapon.weight > c.maxWeight) return false;
      if (weapon.requiresChassis && !weapon.requiresChassis.includes(c.id)) return false;
      return true;
    });

    if (validChassis.length === 0) return null;

    const chassis = validChassis[0]!;
    const remainingWeight = chassis.maxWeight - weapon.weight;

    // Find compatible system
    const validSystems = systems.filter(s => {
      if (s.weight > remainingWeight) return false;
      if (s.requiresChassis && !s.requiresChassis.includes(chassis.id)) return false;
      return true;
    });
    const systemIds = validSystems.length > 0 ? [validSystems[0]!.id] : [];

    const name = `AI_${weapon.id}_${Date.now() % 10000}`;
    return { type: 'design', name, chassisId: chassis.id, weaponId: weapon.id, systemIds };
  }

  private designForSystem(
    system: { id: string; weight: number; requiresChassis?: string[] },
    chassisList: Array<{ id: string; maxWeight: number }>,
    weapons: Array<{ id: string; weight: number; requiresChassis?: string[] }>
  ): { type: 'design'; name: string; chassisId: string; weaponId: string | null; systemIds: string[] } | null {
    // Find a chassis that can hold this system
    const validChassis = chassisList.filter(c => {
      if (system.weight > c.maxWeight) return false;
      if (system.requiresChassis && !system.requiresChassis.includes(c.id)) return false;
      return true;
    });

    if (validChassis.length === 0) return null;

    const chassis = validChassis[0]!;
    const remainingWeight = chassis.maxWeight - system.weight;

    // Find best weapon that fits
    const validWeapons = weapons.filter(w => {
      if (w.weight > remainingWeight) return false;
      if (w.requiresChassis && !w.requiresChassis.includes(chassis.id)) return false;
      return true;
    });
    const weaponId = validWeapons.length > 0 ? validWeapons[0]!.id : null;

    const name = `AI_${system.id}_${Date.now() % 10000}`;
    return { type: 'design', name, chassisId: chassis.id, weaponId, systemIds: [system.id] };
  }

  private planProduction(state: AIGameState, team: string): AIAction[] {
    const actions: AIAction[] = [];
    const resources = state.resources.getResources(team);
    const templates = state.getTeamTemplates(team);
    const factories = state.buildings.filter(b => b.type === 'factory' && b.owner === team);

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
      const unitAtFactory = state.units.find(u => u.q === factory.q && u.r === factory.r && u.isAlive());
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
    const blocked = this.getBlockedPositions(state, team);
    const occupied = this.getOccupiedPositions(state, unit.id);
    const reachable = state.pathfinder.getReachablePositions(
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
    state: AIGameState,
    team: string,
    _unit: Unit,
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
      if (this.isInRangeFrom(unit, enemy, unit.q, unit.r)) {
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
        if (this.isInRangeFrom(unit, enemy, pos.q, pos.r)) {
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
    const blocked = this.getBlockedPositions(state, team);

    for (const [_key, pos] of reachable) {
      const distToNearestTarget = this.minPathDistanceToPositions(
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

  private isInRangeFrom(unit: Unit, target: Unit, fromQ: number, fromR: number): boolean {
    const distance = HexUtil.distance(fromQ, fromR, target.q, target.r);
    return distance <= unit.range;
  }

  private getBlockedPositions(state: AIGameState, forTeam: string): Set<string> {
    const blocked = new Set<string>();
    for (const unit of state.units) {
      if (unit.team !== forTeam && unit.isAlive()) {
        blocked.add(`${unit.q},${unit.r}`);
      }
    }
    return blocked;
  }

  private getOccupiedPositions(state: AIGameState, excludeUnitId: string): Set<string> {
    const occupied = new Set<string>();
    for (const unit of state.units) {
      if (unit.id !== excludeUnitId && unit.isAlive()) {
        occupied.add(`${unit.q},${unit.r}`);
      }
    }
    return occupied;
  }

  private getEnemyPositions(state: AIGameState, team: string): Array<{ q: number; r: number }> {
    const positions: Array<{ q: number; r: number }> = [];

    // Enemy units
    for (const unit of state.units.filter(u => u.team !== team && u.isAlive())) {
      positions.push({ q: unit.q, r: unit.r });
    }

    // Enemy buildings
    for (const building of state.buildings.filter(b => b.owner !== null && b.owner !== team)) {
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

  private minPathDistanceToPositions(
    pathfinder: Pathfinder,
    q: number,
    r: number,
    positions: Array<{ q: number; r: number }>,
    terrainCosts: TerrainCosts,
    blocked: Set<string>
  ): number {
    if (positions.length === 0) return Infinity;
    let minDist = Infinity;
    for (const pos of positions) {
      // Remove the target from blocked set - we want to path TO it, not through it
      const targetKey = `${pos.q},${pos.r}`;
      let blockedForPath = blocked;
      if (blocked.has(targetKey)) {
        blockedForPath = new Set(blocked);
        blockedForPath.delete(targetKey);
      }
      const path = pathfinder.findPath(q, r, pos.q, pos.r, terrainCosts, blockedForPath);
      if (path && path.totalCost < minDist) {
        minDist = path.totalCost;
      }
    }
    return minDist;
  }

  private pickRandomTemplate(templates: Array<{ id: string; cost: number }>): { id: string; cost: number } {
    // Simple random pick - could be weighted in future
    const idx = Math.floor(Math.random() * templates.length);
    return templates[idx]!;
  }
}
