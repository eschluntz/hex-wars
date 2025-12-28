// ============================================================================
// Test Fixture: Minimal Tech Tree
// ============================================================================
// A small, stable tech tree for unit testing. Isolated from game balance changes.
//
// Structure:
//   Tier 0: rootA, rootB (no prereqs)
//   Tier 1: childA (requires rootA), childB (requires rootB)
//   Tier 2: convergent (requires childA + childB)
//   Tier 3: ultimate (requires convergent)

import { type TechDefinition } from '../../src/tech-data.js';

export const TEST_TECH_TREE: Record<string, TechDefinition> = {
  rootA: {
    id: 'rootA',
    name: 'Root A',
    description: 'First root technology.',
    category: 'chassis',
    unlocks: 'hover',
    cost: 5,
    requires: [],
  },
  rootB: {
    id: 'rootB',
    name: 'Root B',
    description: 'Second root technology.',
    category: 'weapon',
    unlocks: 'laser',
    cost: 6,
    requires: [],
  },
  childA: {
    id: 'childA',
    name: 'Child A',
    description: 'Depends on Root A.',
    category: 'system',
    unlocks: 'stealth',
    cost: 10,
    requires: ['rootA'],
  },
  childB: {
    id: 'childB',
    name: 'Child B',
    description: 'Depends on Root B.',
    category: 'weapon',
    unlocks: 'plasma',
    cost: 10,
    requires: ['rootB'],
  },
  convergent: {
    id: 'convergent',
    name: 'Convergent',
    description: 'Requires both branches.',
    category: 'chassis',
    unlocks: 'titan',
    cost: 20,
    requires: ['childA', 'childB'],
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    description: 'Final technology.',
    category: 'system',
    unlocks: 'psychic',
    cost: 30,
    requires: ['convergent'],
  },
};
