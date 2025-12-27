// ============================================================================
// HEX DOMINION - Core Module
// ============================================================================

// --- Types ---

export interface AxialCoord {
  q: number;
  r: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export type TileType = 'grass' | 'woods' | 'mountain' | 'water' | 'road' | 'building';

export interface Tile {
  q: number;
  r: number;
  type: TileType;
}

export interface TileColors {
  fill: string;
  stroke: string;
}

// --- Constants ---

export const TILE_TYPES = {
  GRASS: 'grass',
  WOODS: 'woods',
  MOUNTAIN: 'mountain',
  WATER: 'water',
  ROAD: 'road',
  BUILDING: 'building'
} as const;

export const TILE_COLORS: Record<TileType, TileColors> = {
  grass: { fill: '#7cb342', stroke: '#558b2f' },
  woods: { fill: '#2e7d32', stroke: '#1b5e20' },
  mountain: { fill: '#757575', stroke: '#616161' },
  water: { fill: '#1e88e5', stroke: '#1565c0' },
  road: { fill: '#a1887f', stroke: '#8d6e63' },
  building: { fill: '#8d6e63', stroke: '#5d4037' }
};

export const TILE_ICONS: Partial<Record<TileType, string>> = {
  woods: '🌲',
  mountain: '⛰️',
  building: '🏠'
};

export const MOVEMENT_COSTS: Record<TileType, number> = {
  grass: 1,
  woods: 1.5,
  road: 0.5,
  building: 1,
  water: Infinity,
  mountain: Infinity
};

// ============================================================================
// HEX UTILITIES (Axial Coordinates, Pointy-Top)
// ============================================================================

export const HexUtil = {
  axialToPixel(q: number, r: number, hexSize: number = 40): PixelCoord {
    const x = hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = hexSize * (3 / 2 * r);
    return { x, y };
  },

  pixelToAxial(x: number, y: number, hexSize: number = 40): AxialCoord {
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / hexSize;
    const r = (2 / 3 * y) / hexSize;
    return this.axialRound(q, r);
  },

  axialRound(q: number, r: number): AxialCoord {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  },

  getHexCorners(cx: number, cy: number, size: number = 40): PixelCoord[] {
    const corners: PixelCoord[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      corners.push({
        x: cx + size * Math.cos(angle),
        y: cy + size * Math.sin(angle)
      });
    }
    return corners;
  },

  getNeighbors(q: number, r: number): AxialCoord[] {
    return [
      { q: q + 1, r: r },
      { q: q + 1, r: r - 1 },
      { q: q, r: r - 1 },
      { q: q - 1, r: r },
      { q: q - 1, r: r + 1 },
      { q: q, r: r + 1 }
    ];
  },

  distance(q1: number, r1: number, q2: number, r2: number): number {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
  }
};
