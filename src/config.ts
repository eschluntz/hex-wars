// ============================================================================
// HEX DOMINION - Configuration
// ============================================================================

export const CONFIG = {
  hexSize: 40,
  panSpeed: 12,
  backgroundColor: '#1a1a2e'
} as const;

export interface MapConfig {
  name: string;
  description: string;
  width: number;
  height: number;
  seed: number;
  // Terrain generation (null = all grass)
  terrain: {
    altitudeScale: number;
    altitudeOctaves: number;
    waterThreshold: number;
    mountainThreshold: number;
    vegScale: number;
    vegOctaves: number;
    forestThreshold: number;
  } | null;
  // Roads
  roadCount: number;
  roadMinLength: number;
  roadMaxLength: number;
  roadCurviness: number;
  // Buildings (null = manual placement only)
  buildings: {
    density: number;
    roadAffinity: number;
  } | null;
}

export const MAP_CONFIGS: Record<string, MapConfig> = {
  small: {
    name: 'Small',
    description: 'Tiny test map - all grass',
    width: 12,
    height: 10,
    seed: 1,
    terrain: null, // All grass
    roadCount: 0,
    roadMinLength: 0,
    roadMaxLength: 0,
    roadCurviness: 0,
    buildings: null // Manual placement
  },
  normal: {
    name: 'Normal',
    description: 'Standard procedural map',
    width: 50,
    height: 40,
    seed: 12345,
    terrain: {
      altitudeScale: 0.08,
      altitudeOctaves: 4,
      waterThreshold: -0.16,
      mountainThreshold: 0.26,
      vegScale: 0.1,
      vegOctaves: 3,
      forestThreshold: 0.1
    },
    roadCount: 8,
    roadMinLength: 10,
    roadMaxLength: 40,
    roadCurviness: 0.15,
    buildings: {
      density: 0.02,
      roadAffinity: 0.7
    }
  }
};

// Mutable seed for re-rolling maps
let currentNormalSeed = 12345;

export function getNormalSeed(): number {
  return currentNormalSeed;
}

export function setNormalSeed(seed: number): void {
  currentNormalSeed = seed;
  MAP_CONFIGS.normal!.seed = seed;
}

export function rerollNormalSeed(): number {
  currentNormalSeed = Math.floor(Math.random() * 1000000);
  MAP_CONFIGS.normal!.seed = currentNormalSeed;
  return currentNormalSeed;
}

// Default config for backwards compatibility
export const GEN_PARAMS = {
  seed: 12345,
  mapWidth: 50,
  mapHeight: 40,
  altitudeScale: 0.08,
  altitudeOctaves: 4,
  waterThreshold: -0.16,
  mountainThreshold: 0.26,
  vegScale: 0.1,
  vegOctaves: 3,
  forestThreshold: 0.1,
  roadCount: 8,
  roadMinLength: 10,
  roadMaxLength: 40,
  roadCurviness: 0.15,
  buildingDensity: 0.02,
  buildingRoadAffinity: 0.7
} as const;
