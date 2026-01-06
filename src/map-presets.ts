// ============================================================================
// HEX DOMINION - Map Presets
// ============================================================================

import { MapConfig } from './config.js';

export interface MapPreset {
  name: string;
  description: string;
  width: number;
  height: number;
  terrain: NonNullable<MapConfig['terrain']>;
  clusters: NonNullable<MapConfig['clusters']>;
}

// ============================================================================
// PRESET DEFINITIONS
// ============================================================================

export const MAP_PRESETS: Record<string, MapPreset> = {
  // Tiny (10x8) - Blitz battles, ~3-5 minutes
  tiny: {
    name: 'Tiny',
    description: 'Blitz battle - minimal map, very fast',
    width: 10,
    height: 8,
    terrain: {
      altitudeScale: 0.15,
      altitudeOctaves: 2,
      waterThreshold: -0.4,
      mountainThreshold: 0.45,
      vegScale: 0.15,
      vegOctaves: 2,
      forestThreshold: 0.3
    },
    clusters: {
      minDistance: 5,
      buildingsMin: 2,
      buildingsMax: 3,
      radius: 1,
      candidatesPerCluster: 20,
      singletonCount: 1,
      singletonMinDistance: 2
    }
  },

  // Standard (20x16) - Balanced terrain
  standard: {
    name: 'Standard',
    description: 'Balanced terrain, medium battle',
    width: 20,
    height: 16,
    terrain: {
      altitudeScale: 0.1,
      altitudeOctaves: 3,
      waterThreshold: -0.2,
      mountainThreshold: 0.3,
      vegScale: 0.1,
      vegOctaves: 3,
      forestThreshold: 0.15
    },
    clusters: {
      minDistance: 7,
      buildingsMin: 3,
      buildingsMax: 5,
      radius: 2,
      candidatesPerCluster: 30,
      singletonCount: 3,
      singletonMinDistance: 2
    }
  },

  // Archipelago (20x16) - Island battles, high water
  archipelago: {
    name: 'Archipelago',
    description: 'Island chains separated by water',
    width: 20,
    height: 16,
    terrain: {
      altitudeScale: 0.1,
      altitudeOctaves: 4,
      waterThreshold: -0.05,
      mountainThreshold: 0.45,
      vegScale: 0.1,
      vegOctaves: 3,
      forestThreshold: 0.2
    },
    clusters: {
      minDistance: 6,
      buildingsMin: 3,
      buildingsMax: 5,
      radius: 2,
      candidatesPerCluster: 50,
      singletonCount: 3,
      singletonMinDistance: 2
    }
  },

  // Highlands (20x16) - Mountain ridges
  highlands: {
    name: 'Highlands',
    description: 'Many mountains with ridge valleys',
    width: 20,
    height: 16,
    terrain: {
      altitudeScale: 0.08,
      altitudeOctaves: 4,
      waterThreshold: -0.25,
      mountainThreshold: 0.15,
      vegScale: 0.1,
      vegOctaves: 3,
      forestThreshold: 0.2
    },
    clusters: {
      minDistance: 7,
      buildingsMin: 3,
      buildingsMax: 5,
      radius: 2,
      candidatesPerCluster: 30,
      singletonCount: 3,
      singletonMinDistance: 2
    }
  },

  // Forest (20x16) - Dense woods
  forest: {
    name: 'Forest',
    description: 'Dense woodland terrain',
    width: 20,
    height: 16,
    terrain: {
      altitudeScale: 0.1,
      altitudeOctaves: 3,
      waterThreshold: -0.3,
      mountainThreshold: 0.4,
      vegScale: 0.08,
      vegOctaves: 4,
      forestThreshold: -0.1
    },
    clusters: {
      minDistance: 7,
      buildingsMin: 3,
      buildingsMax: 5,
      radius: 2,
      candidatesPerCluster: 30,
      singletonCount: 3,
      singletonMinDistance: 2
    }
  },

  // Corridor (30x10) - Long narrow map
  corridor: {
    name: 'Corridor',
    description: 'Long narrow battlefield',
    width: 30,
    height: 10,
    terrain: {
      altitudeScale: 0.1,
      altitudeOctaves: 3,
      waterThreshold: -0.2,
      mountainThreshold: 0.3,
      vegScale: 0.1,
      vegOctaves: 3,
      forestThreshold: 0.15
    },
    clusters: {
      minDistance: 8,
      buildingsMin: 3,
      buildingsMax: 5,
      radius: 1,
      candidatesPerCluster: 30,
      singletonCount: 4,
      singletonMinDistance: 2
    }
  },

  // Tall (10x30) - Vertical map
  tall: {
    name: 'Tall',
    description: 'Vertical battlefield',
    width: 10,
    height: 30,
    terrain: {
      altitudeScale: 0.1,
      altitudeOctaves: 3,
      waterThreshold: -0.2,
      mountainThreshold: 0.3,
      vegScale: 0.1,
      vegOctaves: 3,
      forestThreshold: 0.15
    },
    clusters: {
      minDistance: 8,
      buildingsMin: 3,
      buildingsMax: 5,
      radius: 1,
      candidatesPerCluster: 30,
      singletonCount: 4,
      singletonMinDistance: 2
    }
  },

  // Fortress (40x40) - Large square map
  fortress: {
    name: 'Fortress',
    description: 'Large square map, many buildings',
    width: 40,
    height: 40,
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
      minDistance: 11,
      buildingsMin: 5,
      buildingsMax: 7,
      radius: 2,
      candidatesPerCluster: 50,
      singletonCount: 6,
      singletonMinDistance: 3
    }
  },

  // Boss (50x40) - Full size epic battles
  boss: {
    name: 'Boss',
    description: 'Full size epic battle',
    width: 50,
    height: 40,
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

// Presets available for regular campaign cells (randomly selected)
export const REGULAR_PRESETS = [
  'tiny',
  'standard',
  'archipelago',
  'highlands',
  'forest',
  'corridor',
  'tall'
] as const;

// ============================================================================
// PRESET HELPERS
// ============================================================================

/**
 * Convert a MapPreset + seed into a full MapConfig
 */
export function presetToMapConfig(preset: MapPreset, seed: number): MapConfig {
  return {
    name: preset.name,
    description: preset.description,
    width: preset.width,
    height: preset.height,
    seed,
    terrain: preset.terrain,
    clusters: preset.clusters
  };
}

/**
 * Get all preset names
 */
export function getPresetNames(): string[] {
  return Object.keys(MAP_PRESETS);
}
