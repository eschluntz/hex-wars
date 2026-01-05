// ============================================================================
// HEX DOMINION - Combat System (Advance Wars Formula)
// ============================================================================
//
// Damage% = ((B × AV / 100) + L) × (HPA / 10) × ((200 - (DV + DTR × HPD)) / 100)
//
// B = Base damage from lookup table (attacker type → defender type)
// AV = Attack value (100 default, modified by CO powers in future)
// L = Luck (random 0-9)
// HPA = Attacker's HP (1-10)
// DV = Defense value (100 default, modified by CO powers in future)
// DTR = Terrain defense stars (0-4)
// HPD = Defender's HP (1-10)

import { HexUtil } from './core.js';
import { Unit } from './unit.js';
import { getBaseDamage, canAttack } from './damage-table.js';

export interface CombatResult {
  attackerDamage: number;
  defenderDamage: number;
  defenderDied: boolean;
  attackerDied: boolean;
  counterAttackAttempted: boolean; // True if defender was able to counter (in range + can target)
}

export class Combat {
  /**
   * Random luck value: 0-9 with uniform distribution
   */
  static randomLuck(): number {
    return Math.floor(Math.random() * 10);
  }

  /**
   * Calculate expected damage (no luck) for AI decision-making and UI preview.
   * Uses the Advance Wars damage formula with luck = 0.
   *
   * @param attacker - The attacking unit
   * @param defender - The defending unit
   * @param defenderTerrainStars - Terrain defense stars for defender (0-4)
   * @param attackerAV - Attacker's attack value (default 100)
   * @param defenderDV - Defender's defense value (default 100)
   */
  static calculateExpectedDamage(
    attacker: Unit,
    defender: Unit,
    defenderTerrainStars: number = 0,
    attackerAV: number = 100,
    defenderDV: number = 100
  ): number {
    return Combat.calculateDamageInternal(
      attacker,
      defender,
      0, // luck = 0 for expected damage
      defenderTerrainStars,
      attackerAV,
      defenderDV
    );
  }

  /**
   * Calculate actual damage with luck variance.
   *
   * @param attacker - The attacking unit
   * @param defender - The defending unit
   * @param luck - Luck value (0-9), or undefined for random
   * @param defenderTerrainStars - Terrain defense stars for defender (0-4)
   * @param attackerAV - Attacker's attack value (default 100)
   * @param defenderDV - Defender's defense value (default 100)
   */
  static calculateDamage(
    attacker: Unit,
    defender: Unit,
    luck?: number,
    defenderTerrainStars: number = 0,
    attackerAV: number = 100,
    defenderDV: number = 100
  ): number {
    const actualLuck = luck ?? Combat.randomLuck();
    return Combat.calculateDamageInternal(
      attacker,
      defender,
      actualLuck,
      defenderTerrainStars,
      attackerAV,
      defenderDV
    );
  }

  /**
   * Internal damage calculation using the Advance Wars formula.
   * Damage% = ((B × AV / 100) + L) × (HPA / 10) × ((200 - (DV + DTR × HPD)) / 100)
   *
   * The formula returns a percentage (0-100+). Since our units have 10 HP,
   * we divide by 10 to convert to actual HP damage.
   *
   * Flying units do NOT receive terrain defense.
   */
  private static calculateDamageInternal(
    attacker: Unit,
    defender: Unit,
    luck: number,
    defenderTerrainStars: number,
    attackerAV: number,
    defenderDV: number
  ): number {
    // Get base damage from lookup table
    const baseDamage = getBaseDamage(attacker.templateId!, defender.templateId!);
    if (baseDamage === 0) return 0;

    // Attacker component: (B × AV / 100 + L) × (HPA / 10)
    const attackerComponent = (baseDamage * attackerAV / 100 + luck) * (attacker.health / 10);

    // Defender component: (200 - (DV + DTR × HPD)) / 100
    // Flying units don't get terrain defense
    const terrainDefense = defender.flying ? 0 : defenderTerrainStars * defender.health;
    const defenderComponent = (200 - (defenderDV + terrainDefense)) / 100;

    // Calculate damage percentage and convert to HP damage (divide by 10)
    const damagePercent = attackerComponent * defenderComponent;
    return Math.max(0, Math.floor(damagePercent / 10));
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
   * Check if attacker can target the defender based on damage table.
   * Returns true if the attacker can deal damage to the defender.
   */
  static canTarget(attacker: Unit, defender: Unit): boolean {
    return canAttack(attacker.templateId!, defender.templateId!);
  }

  /**
   * Get all valid attack targets for a unit
   */
  static getTargetsInRange(attacker: Unit, enemies: Unit[]): Unit[] {
    return enemies.filter(
      (e) => e.isAlive() && Combat.isInRange(attacker, e) && Combat.canTarget(attacker, e)
    );
  }

  /**
   * Execute combat between attacker and defender.
   * Attacker strikes first, then defender counter-attacks if alive and in range.
   * Luck parameters are optional and used for deterministic testing.
   * Terrain star parameters apply terrain defense bonuses (defaults to 0).
   * AV/DV parameters are for CO powers (defaults to 100).
   */
  static execute(
    attacker: Unit,
    defender: Unit,
    attackerLuck?: number,
    defenderLuck?: number,
    defenderTerrainStars: number = 0,
    attackerTerrainStars: number = 0,
    attackerAV: number = 100,
    defenderDV: number = 100,
    defenderAV: number = 100,
    attackerDV: number = 100
  ): CombatResult {
    // Attacker hits defender (defender gets terrain bonus)
    const attackerDamage = Combat.calculateDamage(
      attacker,
      defender,
      attackerLuck,
      defenderTerrainStars,
      attackerAV,
      defenderDV
    );
    defender.health = Math.max(0, defender.health - attackerDamage);
    const defenderDied = !defender.isAlive();

    // Counter-attack if defender survives, attacker is in range, and defender can target attacker
    let defenderDamage = 0;
    let attackerDied = false;
    const counterAttackAttempted =
      !defenderDied && Combat.isInRange(defender, attacker) && Combat.canTarget(defender, attacker);

    if (counterAttackAttempted) {
      defenderDamage = Combat.calculateDamage(
        defender,
        attacker,
        defenderLuck,
        attackerTerrainStars,
        defenderAV,
        attackerDV
      );
      attacker.health = Math.max(0, attacker.health - defenderDamage);
      attackerDied = !attacker.isAlive();
    }

    return { attackerDamage, defenderDamage, defenderDied, attackerDied, counterAttackAttempted };
  }
}
