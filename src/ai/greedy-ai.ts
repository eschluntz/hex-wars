// ============================================================================
// HEX DOMINION - Greedy AI Controller
// ============================================================================
// Simple AI with greedy decision-making:
//
// Production (factories ordered by distance to own capital):
//   - If unclaimed building is closer: build infantry to capture
//   - If enemy unit is closer: build best counter unit
//
// Unit control (per-unit greedy, capturers processed closest-first):
//   1. Capture building (if on one)
//   2. Move to capture a building (if reachable)
//   3. Attack with maximum expected damage
//   4. Move toward nearest enemy/unclaimed building
//   5. Wait

import { Combat } from '../combat.js';
import { HexUtil } from '../core.js';
import { type AIController, type AIContext } from './controller.js';
import { type Unit } from '../unit.js';
import {
  getBlockedPositions,
  minDistanceToPositions,
  minPathDistanceToPositions,
  isInRangeFrom,
  isPositionOccupied,
  posKey,
} from './base-utils.js';
import { getBaseDamage } from '../damage-table.js';
import { type UnitTemplate } from '../unit-templates.js';

export class GreedyAI implements AIController {
  readonly id = 'greedy';
  readonly name = 'Greedy AI';

  async planTurn(ctx: AIContext): Promise<void> {
    // Track buildings already targeted by capturing units
    const claimedTargets = new Set<string>();

    // Pre-claim buildings where friendly capturers are actively capturing
    const uncapturedBuildings = ctx.getBuildings().filter(b => b.owner !== ctx.team);
    for (const unit of ctx.getUnits()) {
      if (unit.team !== ctx.team || !unit.isAlive() || !unit.canCapture || unit.carriedBy !== null) continue;

      const onBuilding = uncapturedBuildings.find(b => b.q === unit.q && b.r === unit.r);
      if (onBuilding) {
        claimedTargets.add(posKey(onBuilding.q, onBuilding.r));
      }
    }

    // Phase 1: Move units (clears factories, captures, attacks)
    await this.handleUnits(ctx, claimedTargets);

    // Phase 2: Build at factories (now cleared by unit moves)
    await this.handleProduction(ctx, claimedTargets);

    // End turn
    await ctx.doAction({ type: 'endTurn' });
  }

  private async handleUnits(ctx: AIContext, claimedTargets: Set<string>): Promise<void> {
    // Get units that haven't acted yet (exclude carried units)
    const units = ctx.getUnits().filter(u => u.team === ctx.team && u.isAlive() && !u.hasActed && u.carriedBy === null);

    // Sort capturing units by distance to nearest uncaptured building (closest first)
    // This way closer units claim buildings first, causing "trains" to peel off
    const uncapturedBuildings = ctx.getBuildings().filter(b => b.owner !== ctx.team);
    const sortedUnits = [...units].sort((a, b) => {
      if (a.canCapture && b.canCapture) {
        const distA = minDistanceToPositions(a.q, a.r, uncapturedBuildings);
        const distB = minDistanceToPositions(b.q, b.r, uncapturedBuildings);
        return distA - distB;
      }
      // Capturers first, then others
      if (a.canCapture) return -1;
      if (b.canCapture) return 1;
      return 0;
    });

    for (const unit of sortedUnits) {
      await this.handleUnit(ctx, unit, claimedTargets);
    }
  }

  private async handleUnit(ctx: AIContext, unit: Unit, claimedTargets: Set<string>): Promise<void> {
    const pathfinder = ctx.getPathfinder();
    const buildings = ctx.getBuildings();
    const allUnits = ctx.getUnits();

    // Priority 1: Capture building if on one
    const building = buildings.find(b => b.q === unit.q && b.r === unit.r);
    if (building && building.owner !== ctx.team && unit.canCapture) {
      await ctx.doAction({ type: 'capture', unitId: unit.id });
      return;
    }

    // Get reachable positions
    const blocked = getBlockedPositions({ units: allUnits, buildings }, ctx.team);
    const occupied = new Set<string>();
    for (const u of allUnits) {
      if (u.id !== unit.id && u.team === ctx.team && u.isAlive() && u.carriedBy === null) {
        occupied.add(posKey(u.q, u.r));
      }
    }

    const reachable = pathfinder.getReachablePositions(
      unit.q, unit.r,
      unit.speed,
      unit.terrainCosts,
      blocked,
      occupied
    );

    // Priority 1.5: Move off friendly factory
    if (building && building.type === 'factory' && building.owner === ctx.team) {
      const moveTarget = this.findMoveTarget(ctx, unit, reachable, claimedTargets);
      if (moveTarget && (moveTarget.q !== unit.q || moveTarget.r !== unit.r)) {
        // Claim the building we're heading toward (even if we can't reach it this turn)
        if (unit.canCapture && moveTarget.targetBuilding) {
          claimedTargets.add(posKey(moveTarget.targetBuilding.q, moveTarget.targetBuilding.r));
        }
        await ctx.doAction({
          type: 'move',
          unitId: unit.id,
          targetQ: moveTarget.q,
          targetR: moveTarget.r
        });
        // Check if we can capture at new position
        const newBuilding = ctx.getBuildings().find(b => b.q === moveTarget.q && b.r === moveTarget.r);
        if (newBuilding && newBuilding.owner !== ctx.team && unit.canCapture) {
          await ctx.doAction({ type: 'capture', unitId: unit.id });
        } else {
          await ctx.doAction({ type: 'wait', unitId: unit.id });
        }
        return;
      }
    }

    // Priority 2: Move to capture a building
    if (unit.canCapture) {
      const captureTarget = this.findBestCaptureTarget(ctx, reachable, claimedTargets);
      if (captureTarget) {
        claimedTargets.add(posKey(captureTarget.q, captureTarget.r));
        if (captureTarget.q !== unit.q || captureTarget.r !== unit.r) {
          await ctx.doAction({
            type: 'move',
            unitId: unit.id,
            targetQ: captureTarget.q,
            targetR: captureTarget.r
          });
        }
        await ctx.doAction({ type: 'capture', unitId: unit.id });
        return;
      }
    }

    // Priority 3: Attack with maximum damage
    const attackResult = this.findBestAttack(ctx, unit, reachable);
    if (attackResult) {
      if (attackResult.moveFirst) {
        await ctx.doAction({
          type: 'move',
          unitId: unit.id,
          targetQ: attackResult.moveQ,
          targetR: attackResult.moveR
        });
      }
      await ctx.doAction({
        type: 'attack',
        unitId: unit.id,
        targetQ: attackResult.targetQ,
        targetR: attackResult.targetR
      });
      return;
    }

    // Priority 4: Move toward objective
    const moveTarget = this.findMoveTarget(ctx, unit, reachable, claimedTargets);
    if (moveTarget && (moveTarget.q !== unit.q || moveTarget.r !== unit.r)) {
      // Claim the building we're heading toward (even if we can't reach it this turn)
      if (unit.canCapture && moveTarget.targetBuilding) {
        claimedTargets.add(posKey(moveTarget.targetBuilding.q, moveTarget.targetBuilding.r));
      }
      await ctx.doAction({
        type: 'move',
        unitId: unit.id,
        targetQ: moveTarget.q,
        targetR: moveTarget.r
      });
    }

    // Priority 5: Wait
    await ctx.doAction({ type: 'wait', unitId: unit.id });
  }

  private async handleProduction(ctx: AIContext, claimedTargets: Set<string>): Promise<void> {
    const templates = ctx.getTemplates();
    const factories = ctx.getBuildings().filter(b => b.type === 'factory' && b.owner === ctx.team);
    const allUnits = ctx.getUnits();
    const allBuildings = ctx.getBuildings();

    // Collect uncaptured buildings (not owned by AI, not already claimed)
    const uncapturedBuildings = allBuildings.filter(b =>
      b.owner !== ctx.team && !claimedTargets.has(posKey(b.q, b.r))
    );

    // Collect enemy units (exclude carried)
    const enemyUnits = allUnits.filter(u => u.team !== ctx.team && u.isAlive() && u.carriedBy === null);

    // Sort factories by distance to own capital (defend HQ first)
    const capital = allBuildings.find(b => b.type === 'capital' && b.owner === ctx.team);
    const sortedFactories = capital
      ? factories.sort((a, b) => {
          const distA = HexUtil.distance(a.q, a.r, capital.q, capital.r);
          const distB = HexUtil.distance(b.q, b.r, capital.q, capital.r);
          return distA - distB;
        })
      : factories;

    for (const factory of sortedFactories) {
      // Check if factory is occupied (query fresh state, exclude carried units)
      const unitAtFactory = ctx.getUnits().find(u => u.q === factory.q && u.r === factory.r && u.isAlive() && u.carriedBy === null);
      if (unitAtFactory) continue;

      const funds = ctx.getFunds();
      const affordableTemplates = templates.filter(t => t.cost <= funds);
      if (affordableTemplates.length === 0) continue;

      // Find closest enemy unit and its type
      let closestEnemyDist = Infinity;
      let closestEnemyType: string | null = null;
      for (const enemy of enemyUnits) {
        const dist = HexUtil.distance(factory.q, factory.r, enemy.q, enemy.r);
        if (dist < closestEnemyDist) {
          closestEnemyDist = dist;
          closestEnemyType = enemy.templateId;
        }
      }

      // Decide what to build: 30% random, 70% strategic
      let template: UnitTemplate;
      if (Math.random() < 0.3) {
        // Random unit for variety
        template = affordableTemplates[Math.floor(Math.random() * affordableTemplates.length)]!;
      } else if (uncapturedBuildings.length > 0) {
        // There are unclaimed buildings - check if we should capture or defend
        const closestBuildingDist = minDistanceToPositions(factory.q, factory.r, uncapturedBuildings);
        if (closestBuildingDist <= closestEnemyDist) {
          // Building is closer (or equal) - build infantry to capture
          template = affordableTemplates.find(t => t.id === 'infantry') ?? affordableTemplates[0]!;
        } else {
          // Enemy is closer - build counter unit
          template = this.findBestCounter(affordableTemplates, closestEnemyType!);
        }
      } else if (closestEnemyType) {
        // No unclaimed buildings, but enemies exist - build counter unit
        template = this.findBestCounter(affordableTemplates, closestEnemyType);
      } else {
        // No unclaimed buildings, no enemies - build default combat unit
        template = affordableTemplates.find(t => t.id === 'tank') ?? affordableTemplates[0]!;
      }

      await ctx.doAction({
        type: 'build',
        factoryQ: factory.q,
        factoryR: factory.r,
        templateId: template.id
      });
    }
  }

  /**
   * Find the affordable unit that deals the most damage to the target type.
   */
  private findBestCounter(affordableTemplates: UnitTemplate[], targetType: string): UnitTemplate {
    let bestTemplate = affordableTemplates[0]!;
    let bestDamage = 0;

    for (const template of affordableTemplates) {
      const damage = getBaseDamage(template.id, targetType);
      if (damage > bestDamage) {
        bestDamage = damage;
        bestTemplate = template;
      }
    }

    return bestTemplate;
  }

  private findBestCaptureTarget(
    ctx: AIContext,
    reachable: Map<string, { q: number; r: number; cost: number }>,
    claimedTargets: Set<string>
  ): { q: number; r: number } | null {
    const buildings = ctx.getBuildings().filter(b => b.owner !== ctx.team);
    const units = ctx.getUnits();
    let bestBuilding: { q: number; r: number } | null = null;
    let bestScore = -Infinity;

    for (const building of buildings) {
      if (isPositionOccupied(units, building.q, building.r)) continue;
      if (claimedTargets.has(posKey(building.q, building.r))) continue;

      const reachablePos = reachable.get(posKey(building.q, building.r));
      if (reachablePos) {
        const priority = building.type === 'capital' ? 1000 : 0;
        const score = priority - reachablePos.cost;
        if (score > bestScore) {
          bestScore = score;
          bestBuilding = { q: building.q, r: building.r };
        }
      }
    }

    return bestBuilding;
  }

  private findBestAttack(
    ctx: AIContext,
    unit: Unit,
    reachable: Map<string, { q: number; r: number; cost: number }>
  ): { moveFirst: boolean; moveQ: number; moveR: number; targetQ: number; targetR: number } | null {
    const enemies = ctx.getUnits().filter(u => u.team !== ctx.team && u.isAlive() && u.carriedBy === null);
    const buildings = ctx.getBuildings();
    let bestResult: { moveFirst: boolean; moveQ: number; moveR: number; targetQ: number; targetR: number } | null = null;
    let bestDamage = 0;

    // Helper to get defense stars
    const getDefenseStars = (q: number, r: number): number => {
      const building = buildings.find(b => b.q === q && b.r === r);
      if (building) return 3; // Cities give 3 stars
      return 0; // Simplified - could check terrain
    };

    // Check attacks from current position
    for (const enemy of enemies) {
      if (!Combat.canTarget(unit, enemy)) continue;
      if (isInRangeFrom(unit, enemy, unit.q, unit.r)) {
        const damage = Combat.calculateExpectedDamage(unit, enemy, getDefenseStars(enemy.q, enemy.r));
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
    if (unit.canMoveAndAttack) {
      const allUnits = ctx.getUnits();
      for (const [, pos] of reachable) {
        if (isPositionOccupied(allUnits, pos.q, pos.r, unit.id)) continue;

        for (const enemy of enemies) {
          if (!Combat.canTarget(unit, enemy)) continue;
          if (isInRangeFrom(unit, enemy, pos.q, pos.r)) {
            const damage = Combat.calculateExpectedDamage(unit, enemy, getDefenseStars(enemy.q, enemy.r));
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
    }

    return bestResult;
  }

  private findMoveTarget(
    ctx: AIContext,
    unit: Unit,
    reachable: Map<string, { q: number; r: number; cost: number }>,
    claimedTargets: Set<string>
  ): { q: number; r: number; targetBuilding?: { q: number; r: number } } | null {
    const pathfinder = ctx.getPathfinder();
    const units = ctx.getUnits();
    const buildings = ctx.getBuildings();

    // Collect enemy targets (only those we can attack, exclude carried)
    const enemyTargets: Array<{ q: number; r: number }> = [];
    for (const enemy of units.filter(u => u.team !== ctx.team && u.isAlive() && u.carriedBy === null)) {
      if (Combat.canTarget(unit, enemy)) {
        enemyTargets.push({ q: enemy.q, r: enemy.r });
      }
    }

    // Collect building targets (only if unit can capture, exclude claimed)
    const buildingTargets: Array<{ q: number; r: number }> = [];
    if (unit.canCapture) {
      for (const building of buildings.filter(b => b.owner !== ctx.team)) {
        if (!claimedTargets.has(posKey(building.q, building.r))) {
          buildingTargets.push({ q: building.q, r: building.r });
        }
      }
    }

    const allTargets = [...enemyTargets, ...buildingTargets];
    if (allTargets.length === 0) return null;

    // For indirect fire units (minRange > 0), find optimal attack position
    if (unit.minRange > 0 && enemyTargets.length > 0) {
      // First: find a reachable position already in attack range
      for (const [, pos] of reachable) {
        if (isPositionOccupied(units, pos.q, pos.r, unit.id)) continue;

        for (const target of enemyTargets) {
          const dist = HexUtil.distance(pos.q, pos.r, target.q, target.r);
          if (dist >= unit.minRange && dist <= unit.range) {
            return pos; // Found a position in attack range
          }
        }
      }

      // No position in attack range - move toward optimal distance
      // Find position closest to max range (safest attack position)
      let bestPos: { q: number; r: number } | null = null;
      let bestScore = -Infinity;

      for (const [, pos] of reachable) {
        if (isPositionOccupied(units, pos.q, pos.r, unit.id)) continue;

        for (const target of enemyTargets) {
          const dist = HexUtil.distance(pos.q, pos.r, target.q, target.r);

          // Never move closer than minRange
          if (dist < unit.minRange) continue;

          // Score: prefer positions closer to our max range
          // Higher score = better position
          const score = -Math.abs(dist - unit.range);
          if (score > bestScore) {
            bestScore = score;
            bestPos = pos;
          }
        }
      }

      if (bestPos) return bestPos;
      // Fall through to building targets if no good enemy position
    }

    // Standard pathfinding for direct-fire units and building captures
    const blocked = getBlockedPositions({ units, buildings }, ctx.team);
    let bestPos: { q: number; r: number } | null = null;
    let bestDistance = Infinity;
    let bestTargetBuilding: { q: number; r: number } | undefined = undefined;

    for (const [, pos] of reachable) {
      if (isPositionOccupied(units, pos.q, pos.r, unit.id)) continue;

      // Check each target individually to track which building we're heading toward
      for (const target of allTargets) {
        // Remove target from blocked set for pathfinding (we want to path TO it)
        const targetKey = posKey(target.q, target.r);
        const blockedForPath = blocked.has(targetKey)
          ? new Set([...blocked].filter(k => k !== targetKey))
          : blocked;

        const pathResult = pathfinder.findPath(
          pos.q, pos.r,
          target.q, target.r,
          unit.terrainCosts,
          blockedForPath
        );
        const dist = pathResult?.totalCost ?? Infinity;
        if (dist < bestDistance) {
          bestDistance = dist;
          bestPos = { q: pos.q, r: pos.r };
          // Check if this target is a building
          const isBuilding = buildingTargets.some(b => b.q === target.q && b.r === target.r);
          bestTargetBuilding = isBuilding ? { q: target.q, r: target.r } : undefined;
        }
      }
    }

    return bestPos ? { ...bestPos, targetBuilding: bestTargetBuilding } : null;
  }
}
