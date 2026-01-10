// ============================================================================
// HEX DOMINION - Map Presets
// ============================================================================

import { MapConfig, MapConstraints } from './config.js';

export interface MapPreset {
  name: string;
  description: string;
  width: number;
  height: number;
  parTurns: number;  // Expected turns for speed scoring
  terrain: NonNullable<MapConfig['terrain']>;
  clusters: NonNullable<MapConfig['clusters']>;
  constraints?: MapConstraints;
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
    parTurns: 7,
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
    parTurns: 10,
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
    parTurns: 12,
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
    },
    constraints: {
      minWaterPercent: 0.4
    }
  },

  // Highlands (20x16) - Scattered mountains
  highlands: {
    name: 'Highlands',
    description: 'Scattered mountain peaks',
    width: 20,
    height: 16,
    parTurns: 11,
    terrain: {
      altitudeScale: 0.18,
      altitudeOctaves: 3,
      waterThreshold: -0.25,
      mountainThreshold: 0.08,
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
    parTurns: 9,
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
    parTurns: 13,
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
    parTurns: 13,
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
    parTurns: 23,
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
    parTurns: 27,
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

// Map names for battle info modal (deterministically selected per cell)
export const MAP_NAMES: Record<string, string[]> = {
  tiny: [
    "Outpost 7",
    "Hill 142",
    "Radar Station",
    "Checkpoint Bravo",
    "Forward Post",
    "Miller's Farm",
    "The Depot",
    "Fuel Station",
    "Border Crossing",
    "Watch Point",
  ],
  standard: [
    "Ashford Valley",
    "The Proving Grounds",
    "Sector 12",
    "Riverside",
    "Millbrook",
    "Central Plains",
    "Henderson Field",
    "Dustbowl",
    "The Crossroads",
    "Greystone",
  ],
  archipelago: [
    "Shattered Isles",
    "Broken Atoll",
    "The Reef",
    "Coral Bay",
    "Three Sisters",
    "Shoal Water",
    "The Scattered Keys",
    "Midway Point",
    "Saltwater Flats",
    "The Channel",
  ],
  highlands: [
    "Rocky Ridge",
    "The High Ground",
    "Cliffside",
    "Stone Valley",
    "The Switchbacks",
    "Crag Point",
    "Granite Pass",
    "The Escarpment",
    "Ridgeline",
    "Boulder Field",
  ],
  forest: [
    "The Pines",
    "Blackwood",
    "Lumber Mill",
    "The Thicket",
    "Old Growth",
    "Timber Creek",
    "Bramble Woods",
    "The Canopy",
    "Hunter's Trail",
    "Logging Road",
  ],
  corridor: [
    "The Gauntlet",
    "Supply Route",
    "The Narrows",
    "Convoy Road",
    "The Bottleneck",
    "Single Track",
    "The Long Road",
    "Pipeline",
    "Rail Corridor",
    "The Stretch",
  ],
  tall: [
    "The Long Push",
    "North-South Line",
    "The Front",
    "Advance Route",
    "The Column",
    "Main Street",
    "The Grind",
    "Mile Marker",
    "The Long Haul",
    "Supply Line",
  ],
  fortress: [
    "Industrial Sector",
    "Factory Town",
    "The Compound",
    "Steel Works",
    "The Refinery",
    "Depot Complex",
    "Manufacturing District",
    "The Railyard",
    "Heavy Industry",
    "The Foundry",
  ],
  boss: [
    "Command HQ",
    "The Stronghold",
    "Central Command",
    "Main Base",
    "The Capital",
    "Victory Point",
    "Supreme HQ",
    "The Headquarters",
    "Final Objective",
    "Operation Endgame",
  ],
};

// Flavor text for battle info modal (~5 variants per preset)
export const MAP_FLAVOR_TEXT: Record<string, string[]> = {
  tiny: [
    "A quick skirmish awaits. Strike fast before the enemy can dig in.",
    "This contested outpost changes hands frequently. Make it ours.",
    "Small battlefield, big stakes. Every unit counts here.",
    "Intelligence reports light resistance. A swift victory is within reach.",
    "The enemy's forward position. Take it before reinforcements arrive.",
  ],
  standard: [
    "A balanced battlefield with room to maneuver. Choose your approach wisely.",
    "Standard engagement zone. Expect a fair fight on open ground.",
    "Mixed terrain offers multiple paths to victory. Adapt your strategy.",
    "The enemy has established a defensive perimeter. Probe for weaknesses.",
    "Reconnaissance shows varied terrain. Combined arms will be essential.",
  ],
  archipelago: [
    "Island chains dot these waters. Air power will be crucial for rapid deployment.",
    "The seas divide this battlefield. Control the air or be stranded.",
    "Scattered islands limit ground movement. Helicopters can turn the tide.",
    "Naval chokepoints create natural defenses. Plan your island-hopping carefully.",
    "Water dominates this region. Infantry will need air transport to advance.",
  ],
  highlands: [
    "Mountain peaks offer strong defensive positions. Navigate around or push through.",
    "The high ground is everything here. Secure the peaks to control the battle.",
    "Rocky terrain will slow vehicles. Infantry and mechs excel in these mountains.",
    "The enemy holds fortified mountain passes. Expect a grueling assault.",
    "Elevation changes create natural bottlenecks. Use indirect fire to your advantage.",
  ],
  forest: [
    "Dense woodland provides excellent cover. Use it wisely, but watch your mobility.",
    "These forest reserves slow wheeled vehicles. Tread carefully through the trees.",
    "The canopy hides friend and foe alike. Close-quarters combat is inevitable.",
    "Woods offer defensive bonuses but limit sight lines. Plan your advances.",
    "Forest fighting favors infantry. Vehicles will struggle in this terrain.",
  ],
  corridor: [
    "A narrow front forces head-to-head combat. There's no room for flanking here.",
    "The long corridor creates a brutal meat grinder. Bring your heavy hitters.",
    "Limited width means every hex matters. Artillery dominates this battlefield.",
    "A stretched supply line awaits. Secure forward positions as you advance.",
    "No room to maneuver. This will be a war of attrition.",
  ],
  tall: [
    "The vertical battlefield stretches north to south. Control the center or be split.",
    "A long march awaits your forces. Pace your advance carefully.",
    "The enemy waits at the far end. Every hex forward is hard-won.",
    "Extended battle lines require coordination. Don't let your flanks collapse.",
    "Distance is your enemy here. Move fast or be picked apart.",
  ],
  fortress: [
    "A massive stronghold sprawls before you. This will be a war of attrition.",
    "The enemy has dug in deep. Expect fierce resistance at every turn.",
    "Urban warfare at its finest. Clear building by building if you must.",
    "Multiple factory districts mean endless reinforcements. Cut their production.",
    "A city-sized battlefield. Economy wins wars this large.",
  ],
  boss: [
    "The enemy commander awaits. Their full force stands between you and victory.",
    "This is it. The decisive battle that will turn the tide of war.",
    "Elite enemy forces guard this position. Bring everything you have.",
    "The enemy's main army masses here. Break them and the campaign is won.",
    "A legendary battlefield. Heroes are forged in battles like this.",
  ],
};

// Presets available for regular campaign cells (randomly selected)
// 'tiny' appears twice for 2x weighting since it's the only small size
export const REGULAR_PRESETS = [
  'tiny',
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
 * Optionally specify asymmetric cluster counts for campaign difficulty
 */
export function presetToMapConfig(
  preset: MapPreset,
  seed: number,
  playerClusters?: number,
  enemyClusters?: number
): MapConfig {
  return {
    name: preset.name,
    description: preset.description,
    width: preset.width,
    height: preset.height,
    seed,
    terrain: preset.terrain,
    clusters: preset.clusters,
    constraints: preset.constraints,
    playerClusters,
    enemyClusters,
  };
}

/**
 * Get all preset names
 */
export function getPresetNames(): string[] {
  return Object.keys(MAP_PRESETS);
}
