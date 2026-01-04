// ============================================================================
// HEX DOMINION - Building Module
// ============================================================================

export type BuildingType = 'city' | 'factory' | 'capital';

export const CAPTURE_RESISTANCE = 20;

export interface Building {
  q: number;
  r: number;
  type: BuildingType;
  owner: string | null; // team id or null for neutral
  captureResistance: number;
  capturingUnitId: string | null;
}

export const BUILDING_INCOME: Record<BuildingType, { funds: number }> = {
  city: { funds: 1000 },
  factory: { funds: 0 },
  capital: { funds: 2000 }
};

export const BUILDING_ICONS: Record<BuildingType, string> = {
  city: '🏙️',
  factory: '🏭',
  capital: '🏰'
};

export function createBuilding(q: number, r: number, type: BuildingType, owner: string | null = null): Building {
  return { q, r, type, owner, captureResistance: CAPTURE_RESISTANCE, capturingUnitId: null };
}

export function getBuildingKey(q: number, r: number): string {
  return `${q},${r}`;
}
