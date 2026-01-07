// ============================================================================
// HEX DOMINION - Campaign Upgrades and Powers
// ============================================================================

// ============================================================================
// STACKING UPGRADES - Small persistent bonuses that accumulate
// ============================================================================

export type UpgradeType =
  | 'attack'
  | 'defense'
  | 'income'
  | 'cost';

export interface StackingUpgrade {
  id: string;
  name: string;
  description: string;
  type: UpgradeType;
  value: number;
  unitFilter?: string[];  // If specified, only applies to these unit types
}

// Unit type groups for filters (exported for use elsewhere)
export const INFANTRY_UNITS = ['infantry', 'mech'];
export const VEHICLE_UNITS = ['recon', 'tank', 'mediumTank', 'heavyTank', 'apc'];
export const INDIRECT_UNITS = ['artillery', 'rockets', 'missiles'];
export const AIR_UNITS = ['fighter', 'bomber', 'copter', 'transportCopter'];
export const WHEELS_UNITS = ['recon', 'rockets', 'missiles'];

// Registry of all stacking upgrades
export const STACKING_UPGRADES: Record<string, StackingUpgrade> = {
  // +5% damage for specific unit types
  'atk_5_infantry': {
    id: 'atk_5_infantry',
    name: '+5% Infantry',
    description: '+5% damage for infantry units',
    type: 'attack',
    value: 5,
    unitFilter: INFANTRY_UNITS,
  },
  'atk_5_vehicle': {
    id: 'atk_5_vehicle',
    name: '+5% Vehicles',
    description: '+5% damage for vehicles',
    type: 'attack',
    value: 5,
    unitFilter: VEHICLE_UNITS,
  },
  'atk_5_indirect': {
    id: 'atk_5_indirect',
    name: '+5% Indirect',
    description: '+5% damage for indirect fire',
    type: 'attack',
    value: 5,
    unitFilter: INDIRECT_UNITS,
  },
  'atk_5_air': {
    id: 'atk_5_air',
    name: '+5% Air',
    description: '+5% damage for air units',
    type: 'attack',
    value: 5,
    unitFilter: AIR_UNITS,
  },

  // +1% damage for all units
  'atk_1_all': {
    id: 'atk_1_all',
    name: '+1% All',
    description: '+1% damage for all units',
    type: 'attack',
    value: 1,
  },

  // -5% damage taken for specific unit types (defense)
  'def_5_infantry': {
    id: 'def_5_infantry',
    name: '-5% Dmg Infantry',
    description: 'Infantry take 5% less damage',
    type: 'defense',
    value: 5,
    unitFilter: INFANTRY_UNITS,
  },
  'def_5_vehicle': {
    id: 'def_5_vehicle',
    name: '-5% Dmg Vehicles',
    description: 'Vehicles take 5% less damage',
    type: 'defense',
    value: 5,
    unitFilter: VEHICLE_UNITS,
  },
  'def_5_indirect': {
    id: 'def_5_indirect',
    name: '-5% Dmg Indirect',
    description: 'Indirect units take 5% less damage',
    type: 'defense',
    value: 5,
    unitFilter: INDIRECT_UNITS,
  },
  'def_5_air': {
    id: 'def_5_air',
    name: '-5% Dmg Air',
    description: 'Air units take 5% less damage',
    type: 'defense',
    value: 5,
    unitFilter: AIR_UNITS,
  },

  // -1% damage taken for all units
  'def_1_all': {
    id: 'def_1_all',
    name: '-1% Dmg All',
    description: 'All units take 1% less damage',
    type: 'defense',
    value: 1,
  },

  // +5% revenue from cities
  'income_5': {
    id: 'income_5',
    name: '+5% Revenue',
    description: '+5% funds from buildings',
    type: 'income',
    value: 5,
  },

  // -10% cost reduction for specific unit types
  'cost_10_infantry': {
    id: 'cost_10_infantry',
    name: '-10% Infantry Cost',
    description: 'Infantry cost 10% less',
    type: 'cost',
    value: 10,
    unitFilter: INFANTRY_UNITS,
  },
  'cost_10_vehicle': {
    id: 'cost_10_vehicle',
    name: '-10% Vehicle Cost',
    description: 'Vehicles cost 10% less',
    type: 'cost',
    value: 10,
    unitFilter: VEHICLE_UNITS,
  },
  'cost_10_indirect': {
    id: 'cost_10_indirect',
    name: '-10% Indirect Cost',
    description: 'Indirect units cost 10% less',
    type: 'cost',
    value: 10,
    unitFilter: INDIRECT_UNITS,
  },
  'cost_10_air': {
    id: 'cost_10_air',
    name: '-10% Air Cost',
    description: 'Air units cost 10% less',
    type: 'cost',
    value: 10,
    unitFilter: AIR_UNITS,
  },
};

// ============================================================================
// POWERS - Larger abilities player unlocks and equips into limited slots
// ============================================================================

export type PowerEffectType =
  | 'bonus_unit'      // Spawn bonus units at battle start
  | 'move_bonus'      // +movement for unit types
  | 'range_bonus'     // +range for ranged units
  | 'attack_bonus'    // +damage for unit types
  | 'terrain_wheels'; // Wheels drive on grass/woods like roads

export interface BonusUnitEffect {
  type: 'bonus_unit';
  unitType: string;
  count: number;
}

export interface MoveBonusEffect {
  type: 'move_bonus';
  value: number;
  unitFilter?: string[];  // If specified, only applies to these unit types
}

export interface RangeBonusEffect {
  type: 'range_bonus';
  value: number;
  unitFilter?: string[];
}

export interface AttackBonusEffect {
  type: 'attack_bonus';
  value: number;
  unitFilter?: string[];
}

export interface TerrainWheelsEffect {
  type: 'terrain_wheels';
}

export type PowerEffect =
  | BonusUnitEffect
  | MoveBonusEffect
  | RangeBonusEffect
  | AttackBonusEffect
  | TerrainWheelsEffect;

export interface Power {
  id: string;
  name: string;
  description: string;
  effect: PowerEffect;
}

// Registry of all powers
export const POWERS: Record<string, Power> = {
  // Movement powers
  'move_1_infantry': {
    id: 'move_1_infantry',
    name: 'Infantry March',
    description: '+1 movement for infantry',
    effect: { type: 'move_bonus', value: 1, unitFilter: INFANTRY_UNITS },
  },
  'move_1_vehicle': {
    id: 'move_1_vehicle',
    name: 'Motor Pool',
    description: '+1 movement for vehicles',
    effect: { type: 'move_bonus', value: 1, unitFilter: VEHICLE_UNITS },
  },
  'move_1_air': {
    id: 'move_1_air',
    name: 'Air Superiority',
    description: '+1 movement for air units',
    effect: { type: 'move_bonus', value: 1, unitFilter: AIR_UNITS },
  },
  'move_1_all': {
    id: 'move_1_all',
    name: 'Blitz',
    description: '+1 movement for all units',
    effect: { type: 'move_bonus', value: 1 },
  },

  // Range power
  'range_1_indirect': {
    id: 'range_1_indirect',
    name: 'Extended Range',
    description: '+1 range for indirect fire units',
    effect: { type: 'range_bonus', value: 1, unitFilter: INDIRECT_UNITS },
  },

  // Attack powers (+20% damage)
  'atk_20_infantry': {
    id: 'atk_20_infantry',
    name: 'Infantry Assault',
    description: '+20% damage for infantry',
    effect: { type: 'attack_bonus', value: 20, unitFilter: INFANTRY_UNITS },
  },
  'atk_20_vehicle': {
    id: 'atk_20_vehicle',
    name: 'Armored Assault',
    description: '+20% damage for vehicles',
    effect: { type: 'attack_bonus', value: 20, unitFilter: VEHICLE_UNITS },
  },
  'atk_20_indirect': {
    id: 'atk_20_indirect',
    name: 'Artillery Barrage',
    description: '+20% damage for indirect fire',
    effect: { type: 'attack_bonus', value: 20, unitFilter: INDIRECT_UNITS },
  },
  'atk_20_air': {
    id: 'atk_20_air',
    name: 'Air Strike',
    description: '+20% damage for air units',
    effect: { type: 'attack_bonus', value: 20, unitFilter: AIR_UNITS },
  },

  // Bonus unit powers
  'bonus_infantry_3': {
    id: 'bonus_infantry_3',
    name: 'Reinforcements',
    description: 'Start each battle with 3 infantry',
    effect: { type: 'bonus_unit', unitType: 'infantry', count: 3 },
  },
  'bonus_mdtank_1': {
    id: 'bonus_mdtank_1',
    name: 'Tank Reserve',
    description: 'Start each battle with 1 Md Tank',
    effect: { type: 'bonus_unit', unitType: 'mediumTank', count: 1 },
  },

  // Terrain power
  'terrain_wheels': {
    id: 'terrain_wheels',
    name: 'All-Terrain Tires',
    description: 'Wheeled units drive on grass and woods like roads',
    effect: { type: 'terrain_wheels' },
  },
};

// ============================================================================
// CAMPAIGN MODIFIERS - Computed from acquired upgrades and active powers
// ============================================================================

export interface CampaignModifiers {
  // Combat modifiers from upgrades (100 = base, 110 = +10%)
  attackAV: number;
  defenseAV: number;

  // Per-unit-type bonuses from upgrades
  attackBonusByUnit: Record<string, number>;
  defenseBonusByUnit: Record<string, number>;

  // Income multiplier (1.0 = 100%)
  incomeMultiplier: number;

  // Cost reduction by unit type (percentage)
  costReductionByUnit: Record<string, number>;

  // From powers (computed separately)
  moveBonus: number;
  moveBonusByUnit: Record<string, number>;
  rangeBonus: number;
  rangeBonusByUnit: Record<string, number>;
  powerAttackBonusByUnit: Record<string, number>;
  hasTerrainWheels: boolean;
}

/**
 * Compute campaign modifiers from acquired upgrades and active powers
 */
export function computeCampaignModifiers(
  acquiredUpgrades: string[],
  activePowers: string[] = []
): CampaignModifiers {
  const modifiers: CampaignModifiers = {
    attackAV: 100,
    defenseAV: 100,
    attackBonusByUnit: {},
    defenseBonusByUnit: {},
    incomeMultiplier: 1.0,
    costReductionByUnit: {},
    moveBonus: 0,
    moveBonusByUnit: {},
    rangeBonus: 0,
    rangeBonusByUnit: {},
    powerAttackBonusByUnit: {},
    hasTerrainWheels: false,
  };

  // Process stacking upgrades
  for (const upgradeId of acquiredUpgrades) {
    const upgrade = STACKING_UPGRADES[upgradeId];
    if (!upgrade) continue;

    if (upgrade.unitFilter) {
      // Per-unit-type bonus
      for (const unitType of upgrade.unitFilter) {
        switch (upgrade.type) {
          case 'attack':
            modifiers.attackBonusByUnit[unitType] =
              (modifiers.attackBonusByUnit[unitType] ?? 0) + upgrade.value;
            break;
          case 'defense':
            modifiers.defenseBonusByUnit[unitType] =
              (modifiers.defenseBonusByUnit[unitType] ?? 0) + upgrade.value;
            break;
          case 'cost':
            modifiers.costReductionByUnit[unitType] =
              (modifiers.costReductionByUnit[unitType] ?? 0) + upgrade.value;
            break;
        }
      }
    } else {
      // Global bonus
      switch (upgrade.type) {
        case 'attack':
          modifiers.attackAV += upgrade.value;
          break;
        case 'defense':
          modifiers.defenseAV += upgrade.value;
          break;
        case 'income':
          modifiers.incomeMultiplier += upgrade.value / 100;
          break;
      }
    }
  }

  // Process active powers
  for (const powerId of activePowers) {
    const power = POWERS[powerId];
    if (!power) continue;

    switch (power.effect.type) {
      case 'move_bonus': {
        const effect = power.effect;
        if (effect.unitFilter) {
          for (const unitType of effect.unitFilter) {
            modifiers.moveBonusByUnit[unitType] =
              (modifiers.moveBonusByUnit[unitType] ?? 0) + effect.value;
          }
        } else {
          modifiers.moveBonus += effect.value;
        }
        break;
      }
      case 'range_bonus': {
        const effect = power.effect;
        if (effect.unitFilter) {
          for (const unitType of effect.unitFilter) {
            modifiers.rangeBonusByUnit[unitType] =
              (modifiers.rangeBonusByUnit[unitType] ?? 0) + effect.value;
          }
        } else {
          modifiers.rangeBonus += effect.value;
        }
        break;
      }
      case 'attack_bonus': {
        const effect = power.effect;
        if (effect.unitFilter) {
          for (const unitType of effect.unitFilter) {
            modifiers.powerAttackBonusByUnit[unitType] =
              (modifiers.powerAttackBonusByUnit[unitType] ?? 0) + effect.value;
          }
        }
        break;
      }
      case 'terrain_wheels':
        modifiers.hasTerrainWheels = true;
        break;
    }
  }

  return modifiers;
}

/**
 * Get the attack AV for a specific unit, including per-unit-type bonuses from upgrades and powers
 */
export function getAttackerAV(
  unitTemplateId: string,
  modifiers: CampaignModifiers
): number {
  const upgradeBonus = modifiers.attackBonusByUnit[unitTemplateId] ?? 0;
  const powerBonus = modifiers.powerAttackBonusByUnit[unitTemplateId] ?? 0;
  return modifiers.attackAV + upgradeBonus + powerBonus;
}

/**
 * Get the defense DV for a specific unit, including per-unit-type bonuses
 * Higher defense bonus = lower DV = less damage taken
 */
export function getDefenderDV(
  unitTemplateId: string,
  modifiers: CampaignModifiers
): number {
  const unitBonus = modifiers.defenseBonusByUnit[unitTemplateId] ?? 0;
  return 100 - (modifiers.defenseAV - 100) - unitBonus;
}

/**
 * Get the movement bonus for a specific unit
 */
export function getMoveBonus(
  unitTemplateId: string,
  modifiers: CampaignModifiers
): number {
  const unitBonus = modifiers.moveBonusByUnit[unitTemplateId] ?? 0;
  return modifiers.moveBonus + unitBonus;
}

/**
 * Get the range bonus for a specific unit
 */
export function getRangeBonus(
  unitTemplateId: string,
  modifiers: CampaignModifiers
): number {
  const unitBonus = modifiers.rangeBonusByUnit[unitTemplateId] ?? 0;
  return modifiers.rangeBonus + unitBonus;
}

/**
 * Get the cost reduction percentage for a specific unit
 */
export function getCostReduction(
  unitTemplateId: string,
  modifiers: CampaignModifiers
): number {
  return modifiers.costReductionByUnit[unitTemplateId] ?? 0;
}

// ============================================================================
// REWARD PARSING - Map cell rewards to upgrade/power IDs
// ============================================================================

// Build reverse mappings from registries (upgrade/power name -> ID)
export const REWARD_TO_UPGRADE: Record<string, string> = Object.fromEntries(
  Object.values(STACKING_UPGRADES).map(u => [u.name, u.id])
);

export const REWARD_TO_POWER: Record<string, string> = Object.fromEntries(
  Object.values(POWERS).map(p => [p.name, p.id])
);
