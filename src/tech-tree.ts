// ============================================================================
// HEX DOMINION - Tech Tree System
// ============================================================================
// Business logic for the tech tree. Data is defined in tech-data.ts.

import { ResourceManager } from './resources.js';
import {
  unlockChassis,
  unlockWeapon,
  unlockSystem,
  isTechUnlocked as researchIsTechUnlocked,
  unlockTech,
  getUnlockedTechs as researchGetUnlockedTechs,
} from './research.js';
import { TECH_TREE, type TechDefinition } from './tech-data.js';

export { TECH_TREE, type TechDefinition } from './tech-data.js';

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
  column: number;  // position within tier (0-indexed from left)
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
  let maxTier = 0;
  for (const [techId, tier] of Object.entries(techTiers)) {
    if (!tierGroups[tier]) {
      tierGroups[tier] = [];
    }
    tierGroups[tier].push(techId);
    maxTier = Math.max(maxTier, tier);
  }

  // Barycenter method for ordering nodes to minimize edge crossings
  // Step 1: Assign initial positions for tier 0 (alphabetically for consistency)
  const columnPositions: Record<string, number> = {};
  tierGroups[0]!.sort();
  for (let i = 0; i < tierGroups[0]!.length; i++) {
    columnPositions[tierGroups[0]![i]!] = i;
  }

  // Step 2: For each subsequent tier, order by barycenter of prerequisites
  for (let tier = 1; tier <= maxTier; tier++) {
    const nodes = tierGroups[tier]!;

    // Compute barycenter for each node (average x of prerequisites)
    const withBarycenter = nodes.map(techId => {
      const tech = TECH_TREE[techId]!;
      const prereqColumns = tech.requires.map(p => columnPositions[p]!);
      const barycenter = prereqColumns.reduce((a, b) => a + b, 0) / prereqColumns.length;
      return { techId, barycenter };
    });

    // Sort by barycenter, then alphabetically for stability
    withBarycenter.sort((a, b) => {
      if (Math.abs(a.barycenter - b.barycenter) < 0.001) {
        return a.techId.localeCompare(b.techId);
      }
      return a.barycenter - b.barycenter;
    });

    // Assign sequential column positions
    for (let i = 0; i < withBarycenter.length; i++) {
      columnPositions[withBarycenter[i]!.techId] = i;
    }
  }

  // Build final positions
  for (const [techId, tier] of Object.entries(techTiers)) {
    positions.push({
      techId,
      tier,
      column: columnPositions[techId]!,
    });
  }

  return positions;
}
