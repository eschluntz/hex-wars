// ============================================================================
// HEX DOMINION - Unit Templates
// ============================================================================

import { DEFAULT_TERRAIN_COSTS, type TerrainCosts } from './core.js';

export interface UnitTemplate {
  id: string;
  name: string;
  cost: number;
  speed: number;
  attack: number;
  range: number;
  terrainCosts: TerrainCosts;
}

export const UNIT_TEMPLATES: Record<string, UnitTemplate> = {
  infantry: {
    id: 'infantry',
    name: 'Infantry',
    cost: 1000,
    speed: 3,
    attack: 4,
    range: 1,
    terrainCosts: DEFAULT_TERRAIN_COSTS
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    cost: 3000,
    speed: 5,
    attack: 7,
    range: 1,
    terrainCosts: {
      ...DEFAULT_TERRAIN_COSTS,
      woods: 2 // Tanks are slower in woods
    }
  }
};

export function getAvailableTemplates(): UnitTemplate[] {
  return Object.values(UNIT_TEMPLATES);
}

export function getTemplate(id: string): UnitTemplate {
  return UNIT_TEMPLATES[id]!;
}
