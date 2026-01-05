// ============================================================================
// HEX DOMINION - Advance Wars Damage Table
// ============================================================================
// Base damage values from Advance Wars. Each value represents the base damage
// percentage dealt by the attacker (row) against the defender (column) at full
// health with no modifiers.
//
// Values are merged max(primary, secondary) weapon damage.
// A value of 0 or undefined means the attacker cannot target that unit type.

// Our unit template IDs
export type UnitTypeId =
  | 'infantry'
  | 'mech'
  | 'recon'
  | 'tank'
  | 'mediumTank'
  | 'heavyTank'
  | 'artillery'
  | 'rockets'
  | 'antiAir'
  | 'missiles'
  | 'apc'
  | 'fighter'
  | 'bomber'
  | 'copter'
  | 'transportCopter';

// Mapping from AW names to our IDs:
// Anti-Air -> antiAir
// APC -> apc
// Artillery -> artillery
// B-Copter -> copter
// Bomber -> bomber
// Fighter -> fighter
// Infantry -> infantry
// Md. Tank -> mediumTank
// Mech -> mech
// Mega Tank -> heavyTank
// Missile -> missiles
// Recon -> recon
// Rocket -> rockets
// T-Copter -> transportCopter
// Tank -> tank

// The damage table: DAMAGE_TABLE[attackerId][defenderId] = base damage
// 0 or undefined = cannot attack
export const DAMAGE_TABLE: Record<string, Record<string, number>> = {
  // ============================================================================
  // INFANTRY
  // ============================================================================
  infantry: {
    infantry: 55,
    mech: 45,
    recon: 12,
    tank: 5,
    mediumTank: 1,
    heavyTank: 1,
    artillery: 15,
    rockets: 25,
    antiAir: 5,
    missiles: 25,
    apc: 12,
    fighter: 0,
    bomber: 0,
    copter: 7,
    transportCopter: 30,
  },

  // ============================================================================
  // MECH
  // ============================================================================
  mech: {
    infantry: 65, // secondary MG
    mech: 55, // secondary MG
    recon: 85,
    tank: 55,
    mediumTank: 15,
    heavyTank: 5,
    artillery: 70,
    rockets: 85,
    antiAir: 65,
    missiles: 85,
    apc: 75,
    fighter: 0,
    bomber: 0,
    copter: 9, // secondary MG
    transportCopter: 35, // secondary MG
  },

  // ============================================================================
  // RECON
  // ============================================================================
  recon: {
    infantry: 70,
    mech: 65,
    recon: 35,
    tank: 6,
    mediumTank: 1,
    heavyTank: 1,
    artillery: 45,
    rockets: 55,
    antiAir: 4,
    missiles: 28,
    apc: 45,
    fighter: 0,
    bomber: 0,
    copter: 10,
    transportCopter: 35,
  },

  // ============================================================================
  // TANK
  // ============================================================================
  tank: {
    infantry: 75, // secondary MG
    mech: 70, // secondary MG
    recon: 85,
    tank: 55,
    mediumTank: 15,
    heavyTank: 10,
    artillery: 70,
    rockets: 85,
    antiAir: 65,
    missiles: 85,
    apc: 75,
    fighter: 0,
    bomber: 0,
    copter: 10, // secondary MG
    transportCopter: 40, // secondary MG
  },

  // ============================================================================
  // MEDIUM TANK
  // ============================================================================
  mediumTank: {
    infantry: 105, // secondary MG
    mech: 95, // secondary MG
    recon: 105,
    tank: 85,
    mediumTank: 55,
    heavyTank: 25,
    artillery: 105,
    rockets: 105,
    antiAir: 105,
    missiles: 105,
    apc: 105,
    fighter: 0,
    bomber: 0,
    copter: 12, // secondary MG
    transportCopter: 45, // secondary MG
  },

  // ============================================================================
  // HEAVY TANK (Mega Tank in AW)
  // ============================================================================
  heavyTank: {
    infantry: 135, // secondary MG
    mech: 125, // secondary MG
    recon: 195,
    tank: 180,
    mediumTank: 125,
    heavyTank: 65,
    artillery: 195,
    rockets: 195,
    antiAir: 195,
    missiles: 195,
    apc: 195,
    fighter: 0,
    bomber: 0,
    copter: 22, // secondary MG
    transportCopter: 55, // secondary MG
  },

  // ============================================================================
  // ARTILLERY
  // ============================================================================
  artillery: {
    infantry: 90,
    mech: 85,
    recon: 80,
    tank: 70,
    mediumTank: 45,
    heavyTank: 15,
    artillery: 75,
    rockets: 80,
    antiAir: 75,
    missiles: 80,
    apc: 70,
    fighter: 0,
    bomber: 0,
    copter: 0,
    transportCopter: 0,
  },

  // ============================================================================
  // ROCKETS
  // ============================================================================
  rockets: {
    infantry: 95,
    mech: 90,
    recon: 90,
    tank: 80,
    mediumTank: 55,
    heavyTank: 25,
    artillery: 80,
    rockets: 85,
    antiAir: 85,
    missiles: 90,
    apc: 80,
    fighter: 0,
    bomber: 0,
    copter: 0,
    transportCopter: 0,
  },

  // ============================================================================
  // ANTI-AIR
  // ============================================================================
  antiAir: {
    infantry: 105,
    mech: 105,
    recon: 60,
    tank: 25,
    mediumTank: 10,
    heavyTank: 1,
    artillery: 50,
    rockets: 55,
    antiAir: 45,
    missiles: 55,
    apc: 50,
    fighter: 65,
    bomber: 75,
    copter: 120,
    transportCopter: 120,
  },

  // ============================================================================
  // MISSILES
  // ============================================================================
  missiles: {
    infantry: 0,
    mech: 0,
    recon: 0,
    tank: 0,
    mediumTank: 0,
    heavyTank: 0,
    artillery: 0,
    rockets: 0,
    antiAir: 0,
    missiles: 0,
    apc: 0,
    fighter: 100,
    bomber: 100,
    copter: 120,
    transportCopter: 120,
  },

  // ============================================================================
  // APC (no weapons)
  // ============================================================================
  apc: {
    infantry: 0,
    mech: 0,
    recon: 0,
    tank: 0,
    mediumTank: 0,
    heavyTank: 0,
    artillery: 0,
    rockets: 0,
    antiAir: 0,
    missiles: 0,
    apc: 0,
    fighter: 0,
    bomber: 0,
    copter: 0,
    transportCopter: 0,
  },

  // ============================================================================
  // FIGHTER
  // ============================================================================
  fighter: {
    infantry: 0,
    mech: 0,
    recon: 0,
    tank: 0,
    mediumTank: 0,
    heavyTank: 0,
    artillery: 0,
    rockets: 0,
    antiAir: 0,
    missiles: 0,
    apc: 0,
    fighter: 55,
    bomber: 100,
    copter: 100,
    transportCopter: 100,
  },

  // ============================================================================
  // BOMBER
  // ============================================================================
  bomber: {
    infantry: 110,
    mech: 110,
    recon: 105,
    tank: 105,
    mediumTank: 95,
    heavyTank: 35,
    artillery: 105,
    rockets: 105,
    antiAir: 95,
    missiles: 105,
    apc: 105,
    fighter: 0,
    bomber: 0,
    copter: 0,
    transportCopter: 0,
  },

  // ============================================================================
  // COPTER (B-Copter in AW)
  // ============================================================================
  copter: {
    infantry: 75, // secondary MG
    mech: 75, // secondary MG
    recon: 55,
    tank: 55,
    mediumTank: 25,
    heavyTank: 10,
    artillery: 65,
    rockets: 65,
    antiAir: 25,
    missiles: 65,
    apc: 60,
    fighter: 0,
    bomber: 0,
    copter: 65, // secondary MG
    transportCopter: 95, // secondary MG
  },

  // ============================================================================
  // TRANSPORT COPTER (no weapons)
  // ============================================================================
  transportCopter: {
    infantry: 0,
    mech: 0,
    recon: 0,
    tank: 0,
    mediumTank: 0,
    heavyTank: 0,
    artillery: 0,
    rockets: 0,
    antiAir: 0,
    missiles: 0,
    apc: 0,
    fighter: 0,
    bomber: 0,
    copter: 0,
    transportCopter: 0,
  },
};

/**
 * Get the base damage from the damage table.
 * Returns 0 if the attacker cannot target the defender.
 */
export function getBaseDamage(attackerId: string, defenderId: string): number {
  return DAMAGE_TABLE[attackerId]?.[defenderId] ?? 0;
}

/**
 * Check if an attacker can target a defender (base damage > 0).
 */
export function canAttack(attackerId: string, defenderId: string): boolean {
  return getBaseDamage(attackerId, defenderId) > 0;
}
