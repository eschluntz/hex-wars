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
   * Calculate base expected damage before armor (no variance).
   * Formula: floor(attack * health/10)
   * This is the single source of truth for the damage formula.
   */
  static calculateBaseExpectedDamage(attacker: Unit): number {
    const healthRatio = attacker.health / 10;
    return Math.floor(attacker.attack * healthRatio);
  }

  /**
   * Apply armor reduction to damage.
   * Non-AP damage against armored targets is divided by 5 (floored).
   */
  static applyArmorReduction(damage: number, attacker: Unit, defender: Unit): number {
    if (defender.armored && !attacker.armorPiercing) {
      return Math.floor(damage / 5);
    }
    return damage;
  }

  /**
   * Random variance: -1, 0, or +1 with equal probability
   */
  static randomVariance(): number {
    const roll = Math.random();
    if (roll < 1 / 3) return -1;
    if (roll < 2 / 3) return 0;
    return 1;
  }

  /**
   * Calculate expected damage (no variance) for AI decision-making and UI preview.
   * This is THE canonical damage formula - calculateDamage calls this.
   */
  static calculateExpectedDamage(attacker: Unit, defender: Unit): number {
    const baseDamage = Combat.calculateBaseExpectedDamage(attacker);
    return Combat.applyArmorReduction(baseDamage, attacker, defender);
  }

  /**
   * Calculate actual damage with variance.
   * Calls calculateExpectedDamage and adds variance.
   */
  static calculateDamage(attacker: Unit, defender: Unit, variance?: number): number {
    const expectedDamage = Combat.calculateExpectedDamage(attacker, defender);
    const actualVariance = variance ?? Combat.randomVariance();
    return Math.max(0, expectedDamage + actualVariance);
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
    return enemies.filter((e) => e.isAlive() && Combat.isInRange(attacker, e));
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
    const attackerDamage = Combat.calculateDamage(attacker, defender, attackerVariance);
    defender.health = Math.max(0, defender.health - attackerDamage);
    const defenderDied = !defender.isAlive();

    // Counter-attack if defender survives and attacker is in defender's range
    let defenderDamage = 0;
    let attackerDied = false;

    if (!defenderDied && Combat.isInRange(defender, attacker)) {
      defenderDamage = Combat.calculateDamage(defender, attacker, defenderVariance);
      attacker.health = Math.max(0, attacker.health - defenderDamage);
      attackerDied = !attacker.isAlive();
    }

    return { attackerDamage, defenderDamage, defenderDied, attackerDied };
  }
}
