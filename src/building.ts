// ============================================================================
// HEX DOMINION - Building Module
// ============================================================================

export type BuildingType = 'city' | 'factory' | 'lab';

export interface Building {
  q: number;
  r: number;
  type: BuildingType;
  owner: string | null; // team id or null for neutral
}

export const BUILDING_INCOME: Record<BuildingType, { funds: number; science: number }> = {
  city: { funds: 1000, science: 0 },
  factory: { funds: 0, science: 0 },
  lab: { funds: 0, science: 1 }
};

export const BUILDING_ICONS: Record<BuildingType, string> = {
  city: '🏙️',
  factory: '🏭',
  lab: '🔬'
};

export function createBuilding(q: number, r: number, type: BuildingType, owner: string | null = null): Building {
  return { q, r, type, owner };
}

export function getBuildingKey(q: number, r: number): string {
  return `${q},${r}`;
}
