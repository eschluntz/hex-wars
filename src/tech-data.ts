// ============================================================================
// HEX DOMINION - Tech Tree Data
// ============================================================================
// Defines all technologies and their relationships.
// Designed as a tall, narrow tree with 3-4 techs per tier.

export interface TechDefinition {
  id: string;
  name: string;
  description: string;
  category: 'chassis' | 'weapon' | 'system';
  unlocks: string;      // Component ID to unlock
  cost: number;         // Science cost
  requires: string[];   // Prerequisite tech IDs
}

export const TECH_TREE: Record<string, TechDefinition> = {
  // ============================================================================
  // TIER 0 - Foundation Technologies (3 roots)
  // ============================================================================
  advancedMobility: {
    id: 'advancedMobility',
    name: 'Adv. Mobility',
    description: 'Anti-gravity technology for hovering movement.',
    category: 'chassis',
    unlocks: 'hover',
    cost: 5,
    requires: [],
  },
  energyWeapons: {
    id: 'energyWeapons',
    name: 'Energy Weapons',
    description: 'Focused light amplification for directed energy attacks.',
    category: 'weapon',
    unlocks: 'laser',
    cost: 6,
    requires: [],
  },
  defenseTech: {
    id: 'defenseTech',
    name: 'Defense Tech',
    description: 'Explosive reactive plating that defeats projectiles.',
    category: 'system',
    unlocks: 'reactive',
    cost: 5,
    requires: [],
  },

  // ============================================================================
  // TIER 1 - Basic Specializations (3 techs)
  // ============================================================================
  amphibiousDrive: {
    id: 'amphibiousDrive',
    name: 'Amphibious Drive',
    description: 'Sealed hull design for water crossing capability.',
    category: 'chassis',
    unlocks: 'amphibious',
    cost: 8,
    requires: ['advancedMobility'],
  },
  plasmaTech: {
    id: 'plasmaTech',
    name: 'Plasma Tech',
    description: 'Superheated plasma projectiles that melt armor.',
    category: 'weapon',
    unlocks: 'plasma',
    cost: 10,
    requires: ['energyWeapons'],
  },
  shieldTech: {
    id: 'shieldTech',
    name: 'Shield Tech',
    description: 'Energy barriers that absorb incoming damage.',
    category: 'system',
    unlocks: 'shield',
    cost: 10,
    requires: ['defenseTech'],
  },

  // ============================================================================
  // TIER 2 - Advanced Systems (4 techs)
  // ============================================================================
  jumpJets: {
    id: 'jumpJets',
    name: 'Jump Jets',
    description: 'Vertical thrust for terrain jumping.',
    category: 'chassis',
    unlocks: 'jump',
    cost: 12,
    requires: ['amphibiousDrive'],
  },
  targeting: {
    id: 'targeting',
    name: 'Targeting',
    description: 'AI-assisted targeting for improved accuracy.',
    category: 'system',
    unlocks: 'targeting',
    cost: 8,
    requires: ['plasmaTech'],
  },
  stealthTech: {
    id: 'stealthTech',
    name: 'Stealth Tech',
    description: 'Advanced materials that reduce visibility.',
    category: 'system',
    unlocks: 'stealth',
    cost: 12,
    requires: ['shieldTech'],
  },
  repairSystems: {
    id: 'repairSystems',
    name: 'Repair Systems',
    description: 'Mobile repair bays for field maintenance.',
    category: 'system',
    unlocks: 'repair',
    cost: 8,
    requires: ['shieldTech'],
  },

  // ============================================================================
  // TIER 3 - Convergent Technologies (3 techs)
  // ============================================================================
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    description: 'Electromagnetic acceleration for hypersonic rounds.',
    category: 'weapon',
    unlocks: 'railgun',
    cost: 15,
    requires: ['plasmaTech', 'targeting'],
  },
  cloaking: {
    id: 'cloaking',
    name: 'Cloaking',
    description: 'Complete optical invisibility system.',
    category: 'system',
    unlocks: 'cloak',
    cost: 16,
    requires: ['stealthTech'],
  },
  nanoRepair: {
    id: 'nanoRepair',
    name: 'Nano Repair',
    description: 'Nanobots that continuously heal damage.',
    category: 'system',
    unlocks: 'nanorepair',
    cost: 14,
    requires: ['repairSystems'],
  },

  // ============================================================================
  // TIER 4 - Elite Technologies (3 techs)
  // ============================================================================
  ionCannon: {
    id: 'ionCannon',
    name: 'Ion Cannon',
    description: 'Disrupts electronics and disables systems.',
    category: 'weapon',
    unlocks: 'ion',
    cost: 18,
    requires: ['railgun'],
  },
  droneTech: {
    id: 'droneTech',
    name: 'Drone Tech',
    description: 'Autonomous combat drones for distributed attacks.',
    category: 'system',
    unlocks: 'drones',
    cost: 16,
    requires: ['cloaking', 'targeting'],
  },
  titanChassis: {
    id: 'titanChassis',
    name: 'Titan Chassis',
    description: 'Massive walker with unmatched capacity.',
    category: 'chassis',
    unlocks: 'titan',
    cost: 20,
    requires: ['jumpJets', 'nanoRepair'],
  },

  // ============================================================================
  // TIER 5 - Apex Technologies (2 techs)
  // ============================================================================
  antimatter: {
    id: 'antimatter',
    name: 'Antimatter',
    description: 'Matter-antimatter annihilation weaponry.',
    category: 'weapon',
    unlocks: 'antimatter',
    cost: 28,
    requires: ['ionCannon', 'droneTech'],
  },
  psychicTech: {
    id: 'psychicTech',
    name: 'Psychic Tech',
    description: 'Mind control for battlefield dominance.',
    category: 'system',
    unlocks: 'psychic',
    cost: 25,
    requires: ['cloaking', 'droneTech'],
  },

  // ============================================================================
  // TIER 6 - Ultimate Technology (1 tech)
  // ============================================================================
  fusionCore: {
    id: 'fusionCore',
    name: 'Fusion Core',
    description: 'Miniaturized fusion reactor for ultimate power.',
    category: 'chassis',
    unlocks: 'fusion',
    cost: 35,
    requires: ['antimatter', 'titanChassis'],
  },
};
