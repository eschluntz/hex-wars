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
   * Apply terrain defense reduction to damage.
   * Each terrain star = 10% reduction at full HP (10 HP), scales with defender HP.
   * Flying units do NOT receive terrain defense.
   * Formula: finalDamage = baseDamage × (1 - terrainStars × (defenderHP / 10) × 0.1)
   */
  static applyTerrainDefense(damage: number, defenderHP: number, terrainStars: number, isFlying: boolean): number {
    if (isFlying || terrainStars === 0) return damage;
    const defensePercent = terrainStars * (defenderHP / 10) * 0.1;
    return Math.floor(damage * (1 - defensePercent));
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
   * Optional terrainStars parameter applies terrain defense (defaults to 0 for backwards compatibility).
   */
  static calculateExpectedDamage(attacker: Unit, defender: Unit, defenderTerrainStars: number = 0): number {
    const baseDamage = Combat.calculateBaseExpectedDamage(attacker);
    const afterArmor = Combat.applyArmorReduction(baseDamage, attacker, defender);
    return Combat.applyTerrainDefense(afterArmor, defender.health, defenderTerrainStars, defender.flying);
  }

  /**
   * Calculate actual damage with variance.
   * Calls calculateExpectedDamage and adds variance.
   */
  static calculateDamage(attacker: Unit, defender: Unit, variance?: number, defenderTerrainStars: number = 0): number {
    const expectedDamage = Combat.calculateExpectedDamage(attacker, defender, defenderTerrainStars);
    const actualVariance = variance ?? Combat.randomVariance();
    return Math.max(0, expectedDamage + actualVariance);
  }

  /**
   * Check if target is within attacker's range (hex distance)
   * Respects both minimum and maximum range.
   */
  static isInRange(attacker: Unit, target: Unit): boolean {
    const distance = HexUtil.distance(attacker.q, attacker.r, target.q, target.r);
    return distance >= attacker.minRange && distance <= attacker.range;
  }

  /**
   * Check if attacker's weapon can target the defender's chassis.
   */
  static canTargetChassis(attacker: Unit, defender: Unit): boolean {
    return !attacker.cannotTarget.includes(defender.chassisId!);
  }

  /**
   * Get all valid attack targets for a unit
   */
  static getTargetsInRange(attacker: Unit, enemies: Unit[]): Unit[] {
    return enemies.filter(
      (e) => e.isAlive() && Combat.isInRange(attacker, e) && Combat.canTargetChassis(attacker, e)
    );
  }

  /**
   * Execute combat between attacker and defender.
   * Attacker strikes first, then defender counter-attacks if alive and in range.
   * Variance parameters are optional and used for deterministic testing.
   * Terrain star parameters apply terrain defense bonuses (defaults to 0).
   */
  static execute(
    attacker: Unit,
    defender: Unit,
    attackerVariance?: number,
    defenderVariance?: number,
    defenderTerrainStars: number = 0,
    attackerTerrainStars: number = 0
  ): CombatResult {
    // Attacker hits defender (defender gets terrain bonus)
    const attackerDamage = Combat.calculateDamage(attacker, defender, attackerVariance, defenderTerrainStars);
    defender.health = Math.max(0, defender.health - attackerDamage);
    const defenderDied = !defender.isAlive();

    // Counter-attack if defender survives, attacker is in range, and defender can target attacker's chassis
    let defenderDamage = 0;
    let attackerDied = false;

    if (!defenderDied && Combat.isInRange(defender, attacker) && Combat.canTargetChassis(defender, attacker)) {
      defenderDamage = Combat.calculateDamage(defender, attacker, defenderVariance, attackerTerrainStars);
      attacker.health = Math.max(0, attacker.health - defenderDamage);
      attackerDied = !attacker.isAlive();
    }

    return { attackerDamage, defenderDamage, defenderDied, attackerDied };
  }
}
