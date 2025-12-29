// ============================================================================
// HEX DOMINION - Shared Rendering Utilities
// ============================================================================
// This module contains rendering logic shared between the game renderer
// and the map rendering script, ensuring consistency.

import { HexUtil, TILE_COLORS, type Tile } from './core.js';
import { BUILDING_ICONS, type Building } from './building.js';

export interface CanvasContext {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

/**
 * Draw a hexagon tile at the given position
 */
export function drawHex(
  ctx: CanvasContext,
  cx: number,
  cy: number,
  tile: Tile,
  size: number,
  options: {
    zoom?: number;
    isHovered?: boolean;
  } = {}
): void {
  const zoom = options.zoom ?? 1;
  const isHovered = options.isHovered ?? false;

  const corners = HexUtil.getHexCorners(cx, cy, size);
  const colors = TILE_COLORS[tile.type];

  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(corners[i]!.x, corners[i]!.y);
  }
  ctx.closePath();

  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = Math.max(1, 2 * zoom);
  ctx.stroke();

  if (isHovered) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 3 * zoom);
    ctx.stroke();
  }
}

/**
 * Draw a building icon with ownership indicator
 */
export function drawBuildingIcon(
  ctx: CanvasContext,
  cx: number,
  cy: number,
  building: Building,
  size: number,
  options: {
    zoom?: number;
    hasUnit?: boolean;
    useTextFallback?: boolean; // For node-canvas which doesn't support emoji
  } = {}
): void {
  const zoom = options.zoom ?? 1;
  const hasUnit = options.hasUnit ?? false;
  const useTextFallback = options.useTextFallback ?? false;
  const iconSize = size * (hasUnit ? 0.6 : 1);

  // Draw ownership ring
  const ringSize = hasUnit ? size * 1.4 : size * 1.2;
  const ringWidth = hasUnit ? 4 * zoom : 2 * zoom;

  ctx.beginPath();
  ctx.arc(cx, cy, ringSize, 0, Math.PI * 2);

  if (building.owner === 'player') {
    if (!hasUnit) {
      ctx.fillStyle = '#4caf5060'; // Green with transparency
      ctx.fill();
    }
    ctx.strokeStyle = '#4caf50';
  } else if (building.owner === 'enemy') {
    if (!hasUnit) {
      ctx.fillStyle = '#f4433660'; // Red with transparency
      ctx.fill();
    }
    ctx.strokeStyle = '#f44336';
  } else {
    // Neutral
    if (!hasUnit) {
      ctx.fillStyle = 'rgba(128, 128, 128, 0.4)';
      ctx.fill();
    }
    ctx.strokeStyle = '#666666';
  }

  ctx.lineWidth = ringWidth;
  ctx.stroke();

  // Draw building icon or text fallback
  let icon: string;
  if (useTextFallback) {
    // Use text abbreviations for node-canvas (emoji not supported)
    const textIcons: Record<string, string> = {
      city: 'C',
      factory: 'F',
      lab: 'L'
    };
    icon = textIcons[building.type] || '?';
  } else {
    icon = BUILDING_ICONS[building.type];
  }

  if (hasUnit) {
    // Small icon in corner when unit is present
    const offsetX = size * 0.8;
    const offsetY = -size * 0.8;
    ctx.font = useTextFallback ? `bold ${iconSize * 1.2}px Arial` : `${iconSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icon, cx + offsetX, cy + offsetY);
  } else {
    // Centered icon when no unit
    ctx.font = useTextFallback ? `bold ${iconSize * 1.5}px Arial` : `${iconSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icon, cx, cy);
  }
}
