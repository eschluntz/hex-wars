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
  'hexDirtCastle00.png',
  'castle_roofs.png',
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
  capital: { base: 'hexDirtCastle00.png', tintOverlay: 'castle_roofs.png', desaturation: 0.6 },
};

// Animated unit sprite sheets (path relative to unit_assets/sprites/)
// Each sprite sheet is a horizontal strip of frames (16x16 pixels each)
interface SpriteSheetConfig {
  file: string;
  frameCount: number;
  frameDuration: number;  // milliseconds per frame
}

const UNIT_SPRITE_SHEETS: Record<string, SpriteSheetConfig> = {
  infantry: { file: 'GEInfantry.png', frameCount: 4, frameDuration: 250 },
  mech: { file: 'GEMech.png', frameCount: 2, frameDuration: 250 },
  recon: { file: 'GERecon.png', frameCount: 4, frameDuration: 250 },
  tank: { file: 'GETank.png', frameCount: 4, frameDuration: 250 },
  mediumTank: { file: 'GEMd._Tank.png', frameCount: 4, frameDuration: 250 },
  heavyTank: { file: 'GEMega_Tank.png', frameCount: 4, frameDuration: 250 },
  artillery: { file: 'GEArtillery.png', frameCount: 4, frameDuration: 250 },
  rockets: { file: 'GERocket.png', frameCount: 2, frameDuration: 250 },
  antiAir: { file: 'GEAnti-Air.png', frameCount: 4, frameDuration: 250 },
  missiles: { file: 'GEMissile.png', frameCount: 2, frameDuration: 250 },
  apc: { file: 'GEAPC.png', frameCount: 4, frameDuration: 250 },
  fighter: { file: 'GEFighter.png', frameCount: 2, frameDuration: 250 },
  bomber: { file: 'GEBomber.png', frameCount: 2, frameDuration: 250 },
  copter: { file: 'GEB-Copter.png', frameCount: 4, frameDuration: 250 },
  transportCopter: { file: 'GET-Copter.png', frameCount: 4, frameDuration: 250 },
};

// Build list of all sprite files to load
const UNIT_SPRITE_FILES = [...new Set(Object.values(UNIT_SPRITE_SHEETS).map(s => s.file))];

// Preloaded unit sprite sheet images by filename
const unitTextures: Map<string, HTMLImageElement> = new Map();

// Cache for tinted unit sprite sheets (keyed by "spriteFile_team")
const tintedUnitCache: Map<string, HTMLCanvasElement> = new Map();

// Cache for darkened (acted) unit sprite sheets (keyed by "spriteFile_team_dark")
const darkenedUnitCache: Map<string, HTMLCanvasElement> = new Map();

// Animation state - global time for synchronized animations
let animationStartTime = 0;

export function initAnimationTime(): void {
  animationStartTime = performance.now();
}

// Get the current animation frame index for a unit type
export function getAnimationFrame(templateId: string): number {
  const config = UNIT_SPRITE_SHEETS[templateId];
  if (!config) return 0;

  const elapsed = performance.now() - animationStartTime;
  const totalDuration = config.frameCount * config.frameDuration;
  const cycleTime = elapsed % totalDuration;
  return Math.floor(cycleTime / config.frameDuration);
}

// Get sprite sheet config for a unit type
export function getSpriteConfig(templateId: string): SpriteSheetConfig | undefined {
  return UNIT_SPRITE_SHEETS[templateId];
}

// Get sprite sheet info for rendering (file + current frame)
function getUnitSpriteFile(templateId: string | undefined): string | undefined {
  if (!templateId) return undefined;
  const config = UNIT_SPRITE_SHEETS[templateId];
  return config?.file;
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

  // Load unit sprite sheets (from sprites/ subdirectory)
  const unitPromises = UNIT_SPRITE_FILES.map(filename => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        unitTextures.set(filename, img);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load unit texture: ${filename}`));
      img.src = `unit_assets/sprites/${filename}`;
    });
  });

  loadPromise = Promise.all([...hexPromises, ...unitPromises]).then(() => {
    console.log(`Loaded ${textures.size} hex textures, ${unitTextures.size} unit sprite sheets`);
    initAnimationTime();
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

// Get unit texture based on template ID and team
// Set darkened=true for acted units
export function getUnitTexture(
  templateId: string | undefined,
  team: string,
  darkened: boolean = false
): HTMLImageElement | HTMLCanvasElement | undefined {
  const spriteFile = getUnitSpriteFile(templateId);
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
