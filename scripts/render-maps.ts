#!/usr/bin/env node
// ============================================================================
// Map Renderer - Generates PNG images of game maps
// ============================================================================

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { GameMap } from '../src/game-map.js';
import { HexUtil, TILE_COLORS } from '../src/core.js';
import { CONFIG, MAP_CONFIGS } from '../src/config.js';
import { drawHex, drawBuildingIcon } from '../src/rendering-utils.js';

const HEX_SIZE = 20; // Smaller for overview
const OUTPUT_DIR = './map-renders';

function renderMap(map: GameMap, seed: number): Buffer {
  const tiles = map.getAllTiles();
  const buildings = map.getAllBuildings();

  // Calculate canvas size
  let minQ = Infinity, maxQ = -Infinity;
  let minR = Infinity, maxR = -Infinity;

  for (const tile of tiles) {
    minQ = Math.min(minQ, tile.q);
    maxQ = Math.max(maxQ, tile.q);
    minR = Math.min(minR, tile.r);
    maxR = Math.max(maxR, tile.r);
  }

  // Convert to pixel coordinates
  const positions = tiles.map(t => HexUtil.axialToPixel(t.q, t.r, HEX_SIZE));
  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  const padding = HEX_SIZE * 3;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = CONFIG.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Helper to translate world coords to canvas coords
  const toCanvasX = (worldX: number) => worldX - minX + padding;
  const toCanvasY = (worldY: number) => worldY - minY + padding;

  // Draw all hexes
  for (const tile of tiles) {
    const world = HexUtil.axialToPixel(tile.q, tile.r, HEX_SIZE);
    const cx = toCanvasX(world.x);
    const cy = toCanvasY(world.y);

    drawHex(ctx as any, cx, cy, tile, HEX_SIZE);
  }

  // Draw buildings using shared utility (with text fallback for node-canvas)
  for (const building of buildings) {
    const world = HexUtil.axialToPixel(building.q, building.r, HEX_SIZE);
    const cx = toCanvasX(world.x);
    const cy = toCanvasY(world.y);

    drawBuildingIcon(ctx as any, cx, cy, building, HEX_SIZE * 0.6, { useTextFallback: true });
  }

  // Add title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Map - Seed: ${seed}`, 10, 25);
  ctx.font = '12px Arial';
  ctx.fillText(`${buildings.length} buildings, ${tiles.length} tiles`, 10, 45);

  // Add legend
  const legendY = height - 60;
  ctx.font = '10px Arial';
  ctx.fillText('Terrain:', 10, legendY);

  const terrainTypes = [
    { type: 'grass', label: 'Grass' },
    { type: 'woods', label: 'Woods' },
    { type: 'mountain', label: 'Mountain' },
    { type: 'water', label: 'Water' },
    { type: 'road', label: 'Road' }
  ] as const;

  let legendX = 10;
  for (const { type, label } of terrainTypes) {
    const colors = TILE_COLORS[type];
    ctx.fillStyle = colors.fill;
    ctx.fillRect(legendX, legendY + 5, 12, 12);
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY + 5, 12, 12);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, legendX + 15, legendY + 14);
    legendX += 80;
  }

  return canvas.toBuffer('image/png');
}

// Generate multiple maps with different seeds
async function main() {
  console.log('Generating map images...');

  // Create output directory
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    // Directory may already exist
  }

  const seeds = [12345, 42, 7777, 99999];

  for (const seed of seeds) {
    console.log(`\nGenerating map with seed ${seed}...`);

    const config = {
      ...MAP_CONFIGS.normal,
      seed
    };

    const map = new GameMap(config);
    const buffer = renderMap(map, seed);
    const filename = `${OUTPUT_DIR}/map-seed-${seed}.png`;

    writeFileSync(filename, buffer);
    console.log(`  ✓ Saved to ${filename}`);
    console.log(`  - ${map.getAllBuildings().length} buildings`);
    console.log(`  - ${map.getAllTiles().length} tiles`);
  }

  console.log('\n✓ All maps generated!');
}

main().catch(console.error);
