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

  const promises = ALL_TEXTURES.map(filename => {
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

  loadPromise = Promise.all(promises).then(() => {
    console.log(`Loaded ${textures.size} hex textures`);
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
  return textures.size === ALL_TEXTURES.length;
}

// Cache for tinted building textures (keyed by "buildingType_team")
const tintedBuildingCache: Map<string, HTMLCanvasElement> = new Map();

// Tint an overlay image (desaturate then apply team color)
function tintOverlay(
  overlay: HTMLImageElement,
  tintColor: string,
  desaturation: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = overlay.width;
  canvas.height = overlay.height;
  const ctx = canvas.getContext('2d')!;

  // Draw overlay
  ctx.drawImage(overlay, 0, 0);

  // Partial desaturation
  if (desaturation > 0) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = desaturation;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  // Apply tint using 'overlay' blend
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = tintColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Restore original alpha channel
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(overlay, 0, 0);

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
    const tintedOverlay = tintOverlay(overlay, tintColor, desaturation);
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
  if (overlay && desaturation > 0) {
    const desatCanvas = document.createElement('canvas');
    desatCanvas.width = overlay.width;
    desatCanvas.height = overlay.height;
    const desatCtx = desatCanvas.getContext('2d')!;

    desatCtx.drawImage(overlay, 0, 0);
    desatCtx.globalCompositeOperation = 'saturation';
    desatCtx.globalAlpha = desaturation;
    desatCtx.fillStyle = '#808080';
    desatCtx.fillRect(0, 0, overlay.width, overlay.height);
    desatCtx.globalAlpha = 1;
    desatCtx.globalCompositeOperation = 'destination-in';
    desatCtx.drawImage(overlay, 0, 0);

    ctx.drawImage(desatCanvas, 0, 0);
  } else if (overlay) {
    ctx.drawImage(overlay, 0, 0);
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
