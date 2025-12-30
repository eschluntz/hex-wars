// ============================================================================
// HEX DOMINION - Base AI Utilities
// ============================================================================
// Shared utilities for AI implementations to avoid code duplication.

import { HexUtil, type TerrainCosts } from '../core.js';
import { type Unit } from '../unit.js';
import { type Pathfinder } from '../pathfinder.js';
import { type AIGameState } from './game-state.js';

/**
 * Get all positions blocked by enemy units (for pathfinding).
 */
export function getBlockedPositions(state: AIGameState, forTeam: string): Set<string> {
  const blocked = new Set<string>();
  for (const unit of state.units) {
    if (unit.team !== forTeam && unit.isAlive()) {
      blocked.add(`${unit.q},${unit.r}`);
    }
  }
  return blocked;
}

/**
 * Get all occupied positions (for movement - can't end turn on occupied tile).
 */
export function getOccupiedPositions(state: AIGameState, excludeUnitId: string): Set<string> {
  const occupied = new Set<string>();
  for (const unit of state.units) {
    if (unit.id !== excludeUnitId && unit.isAlive()) {
      occupied.add(`${unit.q},${unit.r}`);
    }
  }
  return occupied;
}

/**
 * Get all enemy and neutral positions (units and buildings).
 */
export function getEnemyPositions(state: AIGameState, team: string): Array<{ q: number; r: number }> {
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

/**
 * Calculate minimum hex distance to a set of positions.
 */
export function minDistanceToPositions(q: number, r: number, positions: Array<{ q: number; r: number }>): number {
  if (positions.length === 0) return Infinity;
  let minDist = Infinity;
  for (const pos of positions) {
    const dist = HexUtil.distance(q, r, pos.q, pos.r);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Calculate minimum pathfinding distance to a set of positions.
 */
export function minPathDistanceToPositions(
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

/**
 * Check if target is in range from a specific position.
 */
export function isInRangeFrom(unit: Unit, target: Unit, fromQ: number, fromR: number): boolean {
  const distance = HexUtil.distance(fromQ, fromR, target.q, target.r);
  return distance <= unit.range;
}

/**
 * Pick a random template from a list (for variety).
 */
export function pickRandomTemplate<T>(templates: T[]): T {
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx]!;
}
