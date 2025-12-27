// ============================================================================
// HEX DOMINION - Combat System
// ============================================================================

import { HexUtil } from './core.js';
import { Unit } from './unit.js';

export interface CombatResult {
  attackerDamage: number;
  defenderDamage: number;
  defenderDied: boolean;
  attackerDied: boolean;
}

export class Combat {
  /**
   * Calculate damage dealt by an attacker.
   * Formula: attack * (health/10) + variance
   * Variance is -1, 0, or +1 randomly (can be injected for testing)
   */
  static calculateDamage(attacker: Unit, variance?: number): number {
    const actualVariance = variance ?? Combat.randomVariance();
    const healthRatio = attacker.health / 10;
    const baseDamage = attacker.attack * healthRatio;
    return Math.max(0, Math.floor(baseDamage) + actualVariance);
  }

  /**
   * Random variance: -1, 0, or +1 with equal probability
   */
  static randomVariance(): number {
    const roll = Math.random();
    if (roll < 1/3) return -1;
    if (roll < 2/3) return 0;
    return 1;
  }

  /**
   * Check if target is within attacker's range (hex distance)
   */
  static isInRange(attacker: Unit, target: Unit): boolean {
    const distance = HexUtil.distance(attacker.q, attacker.r, target.q, target.r);
    return distance <= attacker.range;
  }

  /**
   * Get all valid attack targets for a unit
   */
  static getTargetsInRange(attacker: Unit, enemies: Unit[]): Unit[] {
    return enemies.filter(e => e.isAlive() && Combat.isInRange(attacker, e));
  }

  /**
   * Execute combat between attacker and defender.
   * Attacker strikes first, then defender counter-attacks if alive and in range.
   * Variance parameters are optional and used for deterministic testing.
   */
  static execute(
    attacker: Unit,
    defender: Unit,
    attackerVariance?: number,
    defenderVariance?: number
  ): CombatResult {
    // Attacker hits defender
    const attackerDamage = Combat.calculateDamage(attacker, attackerVariance);
    defender.health = Math.max(0, defender.health - attackerDamage);
    const defenderDied = !defender.isAlive();

    // Counter-attack if defender survives and attacker is in defender's range
    let defenderDamage = 0;
    let attackerDied = false;

    if (!defenderDied && Combat.isInRange(defender, attacker)) {
      defenderDamage = Combat.calculateDamage(defender, defenderVariance);
      attacker.health = Math.max(0, attacker.health - defenderDamage);
      attackerDied = !attacker.isAlive();
    }

    return { attackerDamage, defenderDamage, defenderDied, attackerDied };
  }
}
