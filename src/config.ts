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
  // Building cluster generation (null = manual placement only)
  clusters: {
    minDistance: number;        // Min hex distance between cluster centers
    buildingsMin: number;       // Min buildings per cluster
    buildingsMax: number;       // Max buildings per cluster
    radius: number;             // Max offset from cluster center
    candidatesPerCluster: number; // Candidates for Mitchell's Best-Candidate
    singletonCount: number;     // Random standalone buildings
    singletonMinDistance: number; // Min distance from clusters for singletons
  } | null;
}

export const MAP_CONFIGS: Record<string, MapConfig> = {
  small: {
    name: 'Small',
    description: 'Tiny test map - all grass',
    width: 12,
    height: 10,
    seed: 1,
    terrain: null,
    clusters: null // Manual placement
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
    clusters: {
      minDistance: 13,
      buildingsMin: 5,
      buildingsMax: 8,
      radius: 2,
      candidatesPerCluster: 50,
      singletonCount: 8,
      singletonMinDistance: 3
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

// Default fallbacks (used when no config provided)
export const GEN_PARAMS = {
  seed: 12345,
  mapWidth: 50,
  mapHeight: 40
} as const;
