// ============================================================================
// HEX DOMINION - Tech Tree System
// ============================================================================
// Defines the tech tree structure and API for unlocking new components.
// Business logic layer - UI calls these functions to query and modify state.

import { ResourceManager } from './resources.js';
import {
  unlockChassis,
  unlockWeapon,
  unlockSystem,
  isTechUnlocked as researchIsTechUnlocked,
  unlockTech,
  getUnlockedTechs as researchGetUnlockedTechs,
} from './research.js';

// ============================================================================
// DATA STRUCTURES
// ============================================================================

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
  // TIER 0 - Root Technologies (no prerequisites)
  // ============================================================================
  advancedTreads: {
    id: 'advancedTreads',
    name: 'Advanced Treads',
    description: 'Hover technology for enhanced mobility over all terrain.',
    category: 'chassis',
    unlocks: 'hover',
    cost: 5,
    requires: [],
  },
  laserTechnology: {
    id: 'laserTechnology',
    name: 'Laser Technology',
    description: 'Focused energy weapons with perfect accuracy.',
    category: 'weapon',
    unlocks: 'laser',
    cost: 6,
    requires: [],
  },
  advancedSensors: {
    id: 'advancedSensors',
    name: 'Advanced Sensors',
    description: 'Enhanced detection and targeting systems.',
    category: 'system',
    unlocks: 'sensors',
    cost: 4,
    requires: [],
  },
  reactiveArmor: {
    id: 'reactiveArmor',
    name: 'Reactive Armor',
    description: 'Explosive reactive plating that defeats incoming projectiles.',
    category: 'system',
    unlocks: 'reactive',
    cost: 5,
    requires: [],
  },

  // ============================================================================
  // TIER 1 - Basic Specializations
  // ============================================================================
  rocketLauncher: {
    id: 'rocketLauncher',
    name: 'Rocket Launcher',
    description: 'Explosive projectile weapon with moderate range.',
    category: 'weapon',
    unlocks: 'rockets',
    cost: 8,
    requires: ['advancedTreads'],
  },
  stealthPlating: {
    id: 'stealthPlating',
    name: 'Stealth Plating',
    description: 'Advanced materials that reduce unit visibility.',
    category: 'system',
    unlocks: 'stealth',
    cost: 10,
    requires: ['advancedTreads'],
  },
  amphibiousHull: {
    id: 'amphibiousHull',
    name: 'Amphibious Hull',
    description: 'Sealed hull design for water crossing capability.',
    category: 'chassis',
    unlocks: 'amphibious',
    cost: 8,
    requires: ['advancedTreads'],
  },
  plasmaCannon: {
    id: 'plasmaCannon',
    name: 'Plasma Cannon',
    description: 'Superheated plasma projectiles that melt through armor.',
    category: 'weapon',
    unlocks: 'plasma',
    cost: 10,
    requires: ['laserTechnology'],
  },
  electronicWarfare: {
    id: 'electronicWarfare',
    name: 'Electronic Warfare',
    description: 'Jamming and countermeasure systems.',
    category: 'system',
    unlocks: 'ecm',
    cost: 7,
    requires: ['advancedSensors'],
  },
  targetingComputer: {
    id: 'targetingComputer',
    name: 'Targeting Computer',
    description: 'AI-assisted targeting for improved accuracy at range.',
    category: 'system',
    unlocks: 'targeting',
    cost: 6,
    requires: ['advancedSensors'],
  },
  shieldGenerator: {
    id: 'shieldGenerator',
    name: 'Shield Generator',
    description: 'Energy barrier that absorbs incoming damage.',
    category: 'system',
    unlocks: 'shield',
    cost: 12,
    requires: ['reactiveArmor'],
  },
  fieldRepair: {
    id: 'fieldRepair',
    name: 'Field Repair',
    description: 'Mobile repair systems for battlefield maintenance.',
    category: 'system',
    unlocks: 'repair',
    cost: 6,
    requires: ['reactiveArmor'],
  },

  // ============================================================================
  // TIER 2 - Advanced Technologies
  // ============================================================================
  advancedRockets: {
    id: 'advancedRockets',
    name: 'Advanced Rockets',
    description: 'Guided missile technology with extended range and accuracy.',
    category: 'weapon',
    unlocks: 'missiles',
    cost: 15,
    requires: ['rocketLauncher', 'stealthPlating'],
  },
  jumpJets: {
    id: 'jumpJets',
    name: 'Jump Jets',
    description: 'Vertical thrust systems for terrain jumping.',
    category: 'chassis',
    unlocks: 'jump',
    cost: 14,
    requires: ['amphibiousHull'],
  },
  ionCannon: {
    id: 'ionCannon',
    name: 'Ion Cannon',
    description: 'Disrupts electronics and disables enemy systems.',
    category: 'weapon',
    unlocks: 'ion',
    cost: 16,
    requires: ['plasmaCannon', 'electronicWarfare'],
  },
  droneSwarm: {
    id: 'droneSwarm',
    name: 'Drone Swarm',
    description: 'Autonomous combat drones for distributed attacks.',
    category: 'system',
    unlocks: 'drones',
    cost: 12,
    requires: ['electronicWarfare'],
  },
  cloakingDevice: {
    id: 'cloakingDevice',
    name: 'Cloaking Device',
    description: 'Complete optical invisibility system.',
    category: 'system',
    unlocks: 'cloak',
    cost: 18,
    requires: ['stealthPlating', 'shieldGenerator'],
  },
  nanoRepair: {
    id: 'nanoRepair',
    name: 'Nano Repair',
    description: 'Nanobots that continuously repair damage.',
    category: 'system',
    unlocks: 'nanorepair',
    cost: 14,
    requires: ['fieldRepair', 'shieldGenerator'],
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    description: 'Electromagnetic acceleration for hypersonic projectiles.',
    category: 'weapon',
    unlocks: 'railgun',
    cost: 14,
    requires: ['targetingComputer', 'plasmaCannon'],
  },
  siegeWeapons: {
    id: 'siegeWeapons',
    name: 'Siege Weapons',
    description: 'Heavy ordnance designed for destroying fortifications.',
    category: 'weapon',
    unlocks: 'siege',
    cost: 12,
    requires: ['rocketLauncher', 'targetingComputer'],
  },

  // ============================================================================
  // TIER 3 - Ultimate Technologies
  // ============================================================================
  fusionCore: {
    id: 'fusionCore',
    name: 'Fusion Core',
    description: 'Miniaturized fusion reactor for ultimate mobility.',
    category: 'chassis',
    unlocks: 'fusion',
    cost: 25,
    requires: ['jumpJets', 'ionCannon'],
  },
  antimatterWeapons: {
    id: 'antimatterWeapons',
    name: 'Antimatter Weapons',
    description: 'Matter-antimatter annihilation for devastating damage.',
    category: 'weapon',
    unlocks: 'antimatter',
    cost: 30,
    requires: ['railgun', 'ionCannon'],
  },
  psychicAmplifier: {
    id: 'psychicAmplifier',
    name: 'Psychic Amplifier',
    description: 'Mind control technology for battlefield dominance.',
    category: 'system',
    unlocks: 'psychic',
    cost: 28,
    requires: ['cloakingDevice', 'droneSwarm'],
  },
  titanClass: {
    id: 'titanClass',
    name: 'Titan Class',
    description: 'Massive walker chassis with unmatched firepower capacity.',
    category: 'chassis',
    unlocks: 'titan',
    cost: 22,
    requires: ['siegeWeapons', 'nanoRepair'],
  },
};

// ============================================================================
// PER-TEAM STATE (delegated to research.ts)
// ============================================================================

export function getUnlockedTechs(team: string): Set<string> {
  return researchGetUnlockedTechs(team);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

export function getAllTechs(): TechDefinition[] {
  return Object.values(TECH_TREE);
}

export function getTech(techId: string): TechDefinition {
  return TECH_TREE[techId]!;
}

export function isTechUnlocked(team: string, techId: string): boolean {
  return researchIsTechUnlocked(team, techId);
}

export function areTechPrereqsMet(team: string, techId: string): boolean {
  const tech = TECH_TREE[techId]!;

  for (const prereq of tech.requires) {
    if (!isTechUnlocked(team, prereq)) {
      return false;
    }
  }
  return true;
}

export interface TechAvailability {
  available: boolean;
  reason?: string;
}

export function getTechAvailability(team: string, techId: string, science: number): TechAvailability {
  const tech = TECH_TREE[techId]!;

  if (isTechUnlocked(team, techId)) {
    return { available: false, reason: 'Already unlocked' };
  }

  if (!areTechPrereqsMet(team, techId)) {
    const missing = tech.requires.filter(r => !isTechUnlocked(team, r));
    const missingNames = missing.map(id => TECH_TREE[id]!.name);
    return { available: false, reason: `Requires: ${missingNames.join(', ')}` };
  }

  if (science < tech.cost) {
    return { available: false, reason: `Need ${tech.cost} science (have ${science})` };
  }

  return { available: true };
}

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

export interface PurchaseResult {
  success: boolean;
  error?: string;
}

export function purchaseTech(team: string, techId: string, resources: ResourceManager): PurchaseResult {
  const tech = TECH_TREE[techId]!;
  const teamResources = resources.getResources(team);

  const availability = getTechAvailability(team, techId, teamResources.science);
  if (!availability.available) {
    return { success: false, error: availability.reason };
  }

  // Spend science
  resources.spendScience(team, tech.cost);

  // Mark tech as unlocked
  unlockTech(team, techId);

  // Unlock the component
  if (tech.category === 'chassis') {
    unlockChassis(team, tech.unlocks);
  } else if (tech.category === 'weapon') {
    unlockWeapon(team, tech.unlocks);
  } else {
    unlockSystem(team, tech.unlocks);
  }

  console.log(`${team} unlocked ${tech.name} -> ${tech.unlocks}`);

  return { success: true };
}

// ============================================================================
// VISUALIZATION FUNCTIONS
// ============================================================================

export interface TechNode {
  tech: TechDefinition;
  state: 'unlocked' | 'available' | 'locked';
  reason?: string;
}

export function getTechTreeState(team: string, science: number): TechNode[] {
  const nodes: TechNode[] = [];

  for (const tech of getAllTechs()) {
    if (isTechUnlocked(team, tech.id)) {
      nodes.push({ tech, state: 'unlocked' });
    } else {
      const availability = getTechAvailability(team, tech.id, science);
      if (availability.available) {
        nodes.push({ tech, state: 'available' });
      } else {
        nodes.push({ tech, state: 'locked', reason: availability.reason });
      }
    }
  }

  return nodes;
}

export interface TechPosition {
  techId: string;
  tier: number;
  row: number;
}

export function computeTechLayout(): TechPosition[] {
  const positions: TechPosition[] = [];
  const techTiers: Record<string, number> = {};

  // Compute tier for each tech (max depth of prerequisites + 1)
  function computeTier(techId: string): number {
    if (techTiers[techId] !== undefined) {
      return techTiers[techId];
    }

    const tech = TECH_TREE[techId]!;
    if (tech.requires.length === 0) {
      techTiers[techId] = 0;
      return 0;
    }

    let maxPrereqTier = -1;
    for (const prereq of tech.requires) {
      maxPrereqTier = Math.max(maxPrereqTier, computeTier(prereq));
    }

    techTiers[techId] = maxPrereqTier + 1;
    return techTiers[techId];
  }

  // Compute tiers for all techs
  for (const techId of Object.keys(TECH_TREE)) {
    computeTier(techId);
  }

  // Group techs by tier
  const tierGroups: Record<number, string[]> = {};
  for (const [techId, tier] of Object.entries(techTiers)) {
    if (!tierGroups[tier]) {
      tierGroups[tier] = [];
    }
    tierGroups[tier].push(techId);
  }

  // Assign row positions within each tier
  for (const [tier, techIds] of Object.entries(tierGroups)) {
    for (let row = 0; row < techIds.length; row++) {
      positions.push({
        techId: techIds[row]!,
        tier: parseInt(tier),
        row,
      });
    }
  }

  return positions;
}
