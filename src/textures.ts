// ============================================================================
// HEX DOMINION - Texture Loading
// ============================================================================

import { type TileType, TEAM_COLORS } from './core.js';

// All texture files to load (path relative to hex_assets/)
const ALL_TEXTURES = [
  'hexPlains00.png',
  'hexScrublands00.png',
  'hexForestBroadleaf00.png',
  'hexMountain00.png',
  'hexMountainSnow00.png',
  'hexOcean00.png',
  'hexOceanCalm00.png',
  'hexDirt00.png',
  'hexDirtVillage00.png',
  'village_roofs.png',
  'wip/good_factory.png',
  'wip/good_factory_roofs.png',
  'wip/good_lab.png',
  'wip/good_lab_roofs2.png',
];

// Building type textures (overrides tile texture when present)
// base: the full texture drawn untinted
// tintOverlay: optional layer drawn on top with team color tinting
// desaturation: how much to desaturate the tintOverlay before tinting
interface BuildingTextureConfig {
  base: string;
  tintOverlay?: string;
  desaturation: number;
}

const BUILDING_TEXTURES: Record<string, BuildingTextureConfig> = {
  city: { base: 'hexDirtVillage00.png', tintOverlay: 'village_roofs.png', desaturation: 0.6 },
  factory: { base: 'wip/good_factory.png', tintOverlay: 'wip/good_factory_roofs.png', desaturation: 0.6 },
  lab: { base: 'wip/good_lab.png', tintOverlay: 'wip/good_lab_roofs2.png', desaturation: 0.6 },
};

// All unit sprite files (path relative to unit_assets/)
const UNIT_SPRITE_FILES = [
  'GEInfantry.webp',
  'GEMech.webp',
  'GERecon.webp',
  'GEArtillery.webp',
  'GETank.webp',
  'GEMd._Tank.webp',
  'GEAnti-Air.webp',
  'GEMissile.webp',
  'GERocket.webp',
];

// Preloaded unit images by filename
const unitTextures: Map<string, HTMLImageElement> = new Map();

// Cache for tinted unit textures (keyed by "spriteKey_team")
const tintedUnitCache: Map<string, HTMLCanvasElement> = new Map();

// Cache for darkened (acted) unit textures (keyed by "spriteKey_team_dark")
const darkenedUnitCache: Map<string, HTMLCanvasElement> = new Map();

// Determine which sprite to use based on unit loadout
function getUnitSpriteFile(
  chassisId: string | undefined,
  weaponId: string | undefined,
  systemIds: string[]
): string | undefined {
  const hasArmor = systemIds.includes('armor');

  // Artillery takes priority
  if (weaponId === 'artillery') {
    return 'GEArtillery.webp';
  }

  // Treads chassis
  if (chassisId === 'treads') {
    if (weaponId === 'cannon') {
      return hasArmor ? 'GEMd._Tank.webp' : 'GETank.webp';
    }
    if (weaponId === 'machineGun' || weaponId === 'heavyMG') {
      return 'GEAnti-Air.webp';
    }
  }

  // Wheels chassis
  if (chassisId === 'wheels') {
    if (weaponId === 'machineGun' || weaponId === 'heavyMG') {
      return 'GERecon.webp';
    }
  }

  // Foot chassis
  if (chassisId === 'foot') {
    if (weaponId === 'heavyMG') {
      return 'GEMech.webp';
    }
    if (weaponId === 'machineGun') {
      return 'GEInfantry.webp';
    }
  }

  return undefined; // Fall back to circle
}

// Texture variants with weights: [filename, weight]
// Higher weight = more likely to be chosen
type TextureVariant = { file: string; weight: number };
const TILE_VARIANTS: Record<TileType, TextureVariant[]> = {
  grass: [
    { file: 'hexPlains00.png', weight: 80 },
    { file: 'hexScrublands00.png', weight: 20 },
  ],
  woods: [
    { file: 'hexForestBroadleaf00.png', weight: 100 },
  ],
  mountain: [
    { file: 'hexMountain00.png', weight: 80 },
    { file: 'hexMountainSnow00.png', weight: 20 },
  ],
  water: [
    { file: 'hexOceanCalm00.png', weight: 80 },
    { file: 'hexOcean00.png', weight: 20 },
  ],
  road: [
    { file: 'hexDirt00.png', weight: 100 },
  ],
  building: [
    { file: 'hexPlains00.png', weight: 100 },
  ],
};

// Preloaded images by filename
const textures: Map<string, HTMLImageElement> = new Map();

// Cache for which texture variant each tile uses (keyed by "q,r")
const tileTextureCache: Map<string, string> = new Map();

// Promise that resolves when all textures are loaded
let loadPromise: Promise<void> | null = null;

export function loadTextures(): Promise<void> {
  if (loadPromise) return loadPromise;

  // Load hex/building textures
  const hexPromises = ALL_TEXTURES.map(filename => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        textures.set(filename, img);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load texture: ${filename}`));
      img.src = `hex_assets/${filename}`;
    });
  });

  // Load unit sprites
  const unitPromises = UNIT_SPRITE_FILES.map(filename => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        unitTextures.set(filename, img);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load unit texture: ${filename}`));
      img.src = `unit_assets/${filename}`;
    });
  });

  loadPromise = Promise.all([...hexPromises, ...unitPromises]).then(() => {
    console.log(`Loaded ${textures.size} hex textures, ${unitTextures.size} unit sprites`);
  });

  return loadPromise;
}

// Pick a random variant based on weights
function pickVariant(variants: TextureVariant[]): string {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant.file;
    }
  }
  return variants[0]!.file;
}

// Get texture for a tile, caching the random choice per tile
export function getTexture(type: TileType, q?: number, r?: number): HTMLImageElement | undefined {
  // If no coordinates provided, return the first variant
  if (q === undefined || r === undefined) {
    const variants = TILE_VARIANTS[type];
    return textures.get(variants[0]!.file);
  }

  const tileKey = `${q},${r}`;
  let filename = tileTextureCache.get(tileKey);

  if (!filename) {
    const variants = TILE_VARIANTS[type];
    filename = pickVariant(variants);
    tileTextureCache.set(tileKey, filename);
  }

  return textures.get(filename);
}

export function areTexturesLoaded(): boolean {
  return textures.size === ALL_TEXTURES.length &&
         unitTextures.size === UNIT_SPRITE_FILES.length;
}

// Cache for tinted building textures (keyed by "buildingType_team")
const tintedBuildingCache: Map<string, HTMLCanvasElement> = new Map();

// ============================================================================
// SHARED TINTING UTILITIES
// ============================================================================

/**
 * Apply desaturation and/or color tint to an image.
 * @param source - Source image to tint
 * @param options.desaturation - 0-1, how much to desaturate (0 = none, 1 = full grayscale)
 * @param options.tintColor - Color to apply via overlay blend (optional)
 * @returns Canvas with the tinted image
 */
function applyTint(
  source: HTMLImageElement | HTMLCanvasElement,
  options: { desaturation?: number; tintColor?: string }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;

  // Draw source
  ctx.drawImage(source, 0, 0);

  // Partial desaturation
  if (options.desaturation && options.desaturation > 0) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = options.desaturation;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  // Apply tint using 'overlay' blend
  if (options.tintColor) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = options.tintColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Restore original alpha channel
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(source, 0, 0);

  return canvas;
}

// Create composite: base (untinted) + overlay (tinted)
function createBuildingTexture(
  base: HTMLImageElement,
  overlay: HTMLImageElement | undefined,
  tintColor: string | undefined,
  desaturation: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d')!;

  // Draw base untinted
  ctx.drawImage(base, 0, 0);

  // Draw tinted overlay on top if present
  if (overlay && tintColor) {
    const tintedOverlay = applyTint(overlay, { desaturation, tintColor });
    ctx.drawImage(tintedOverlay, 0, 0);
  }

  return canvas;
}

// Create neutral version: base + desaturated overlay
function createNeutralBuildingTexture(
  base: HTMLImageElement,
  overlay: HTMLImageElement | undefined,
  desaturation: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d')!;

  // Draw base
  ctx.drawImage(base, 0, 0);

  // Draw desaturated overlay on top if present
  if (overlay) {
    const desatOverlay = desaturation > 0
      ? applyTint(overlay, { desaturation })
      : overlay;
    ctx.drawImage(desatOverlay, 0, 0);
  }

  return canvas;
}

// Get texture for a building type, optionally tinted by team color
export function getBuildingTexture(
  buildingType: string,
  team?: string | null
): HTMLImageElement | HTMLCanvasElement | undefined {
  const config = BUILDING_TEXTURES[buildingType];
  if (!config) return undefined;

  const base = textures.get(config.base);
  if (!base) return undefined;

  const overlay = config.tintOverlay ? textures.get(config.tintOverlay) : undefined;

  // No overlay = return base as-is
  if (!overlay) return base;

  // Neutral or no team
  if (!team || team === 'neutral') {
    const cacheKey = `${buildingType}_neutral`;
    let cached = tintedBuildingCache.get(cacheKey);
    if (!cached) {
      cached = createNeutralBuildingTexture(base, overlay, config.desaturation);
      tintedBuildingCache.set(cacheKey, cached);
    }
    return cached;
  }

  // Check cache for tinted version
  const cacheKey = `${buildingType}_${team}`;
  let tinted = tintedBuildingCache.get(cacheKey);

  if (!tinted) {
    const teamColor = TEAM_COLORS[team]?.primary;
    if (teamColor) {
      tinted = createBuildingTexture(base, overlay, teamColor, config.desaturation);
      tintedBuildingCache.set(cacheKey, tinted);
    }
  }

  return tinted ?? base;
}

// Texture dimensions (all assets are 256x384)
export const TEXTURE_WIDTH = 256;
export const TEXTURE_HEIGHT = 384;

// The hex center is in the bottom portion of the image
// For a 256-wide pointy-top hex: size = 256/sqrt(3) ≈ 148, height = 2*148 ≈ 296
// The hex base is at the bottom of the image, so center is at 384 - 148 = 236
export const TEXTURE_HEX_CENTER_Y = 236;

// Create a tinted unit texture (full desaturation + team color)
function createTintedUnitTexture(
  original: HTMLImageElement,
  tintColor: string
): HTMLCanvasElement {
  return applyTint(original, { desaturation: 1, tintColor });
}

// Create a darkened version of a texture (for acted units)
function createDarkenedTexture(
  source: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(source, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

// Get unit texture based on loadout and team
// Set darkened=true for acted units
export function getUnitTexture(
  chassisId: string | undefined,
  weaponId: string | undefined,
  systemIds: string[],
  team: string,
  darkened: boolean = false
): HTMLImageElement | HTMLCanvasElement | undefined {
  const spriteFile = getUnitSpriteFile(chassisId, weaponId, systemIds);
  if (!spriteFile) return undefined;

  const original = unitTextures.get(spriteFile);
  if (!original) return undefined;

  // Get or create tinted version
  const tintCacheKey = `${spriteFile}_${team}`;
  let tinted = tintedUnitCache.get(tintCacheKey);

  if (!tinted) {
    const teamColor = TEAM_COLORS[team]?.primary;
    if (teamColor) {
      tinted = createTintedUnitTexture(original, teamColor);
      tintedUnitCache.set(tintCacheKey, tinted);
    }
  }

  const baseTexture = tinted ?? original;

  // Return darkened version if requested
  if (darkened) {
    const darkCacheKey = `${spriteFile}_${team}_dark`;
    let dark = darkenedUnitCache.get(darkCacheKey);
    if (!dark) {
      dark = createDarkenedTexture(baseTexture, original.width, original.height);
      darkenedUnitCache.set(darkCacheKey, dark);
    }
    return dark;
  }

  return baseTexture;
}
