// ============================================================================
// HEX DOMINION - Configuration
// ============================================================================

export const CONFIG = {
  hexSize: 40,
  panSpeed: 12,
  backgroundColor: '#1a1a2e'
} as const;

export const GEN_PARAMS = {
  seed: 12345,
  mapWidth: 50,
  mapHeight: 40,

  // Altitude noise
  altitudeScale: 0.08,
  altitudeOctaves: 4,
  waterThreshold: -0.16,
  mountainThreshold: 0.26,

  // Vegetation noise
  vegScale: 0.1,
  vegOctaves: 3,
  forestThreshold: 0.1,

  // Roads
  roadCount: 8,
  roadMinLength: 10,
  roadMaxLength: 40,
  roadCurviness: 0.15,

  // Buildings
  buildingDensity: 0.02,
  buildingRoadAffinity: 0.7
} as const;
