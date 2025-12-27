// ============================================================================
// HEX DOMINION - Game Map
// ============================================================================

import { TILE_TYPES, HexUtil, type Tile, type TileType } from './core.js';
import { PerlinNoise, SeededRandom } from './noise.js';
import { GEN_PARAMS } from './config.js';

export class GameMap {
  private tiles = new Map<string, Tile>();

  constructor() {
    this.generate();
  }

  private key(q: number, r: number): string {
    return `${q},${r}`;
  }

  getTile(q: number, r: number): Tile | undefined {
    return this.tiles.get(this.key(q, r));
  }

  setTile(q: number, r: number, type: TileType): void {
    this.tiles.set(this.key(q, r), { q, r, type });
  }

  isValidLandTile(q: number, r: number): boolean {
    const tile = this.getTile(q, r);
    return tile !== undefined && tile.type !== TILE_TYPES.WATER && tile.type !== TILE_TYPES.MOUNTAIN;
  }

  generate(): void {
    this.tiles.clear();

    const altitudeNoise = new PerlinNoise(GEN_PARAMS.seed);
    const vegNoise = new PerlinNoise(GEN_PARAMS.seed + 1000);
    const rng = new SeededRandom(GEN_PARAMS.seed + 2000);

    const width = GEN_PARAMS.mapWidth;
    const height = GEN_PARAMS.mapHeight;

    // Step 1: Generate base terrain from altitude
    for (let r = 0; r < height; r++) {
      const rOffset = Math.floor(r / 2);
      for (let q = -rOffset; q < width - rOffset; q++) {
        const altitude = altitudeNoise.fbm(
          q * GEN_PARAMS.altitudeScale,
          r * GEN_PARAMS.altitudeScale,
          GEN_PARAMS.altitudeOctaves
        );

        let type: TileType;
        if (altitude <= GEN_PARAMS.waterThreshold) {
          type = TILE_TYPES.WATER;
        } else if (altitude >= GEN_PARAMS.mountainThreshold) {
          type = TILE_TYPES.MOUNTAIN;
        } else {
          const vegetation = vegNoise.fbm(
            q * GEN_PARAMS.vegScale,
            r * GEN_PARAMS.vegScale,
            GEN_PARAMS.vegOctaves
          );

          if (vegetation >= GEN_PARAMS.forestThreshold) {
            type = TILE_TYPES.WOODS;
          } else {
            type = TILE_TYPES.GRASS;
          }
        }

        this.setTile(q, r, type);
      }
    }

    // Step 2: Generate roads
    this.generateRoads(rng, width, height);

    // Step 3: Generate buildings
    this.generateBuildings(rng);

    console.log(`Generated map: ${this.tiles.size} tiles, seed ${GEN_PARAMS.seed}`);
  }

  private generateRoads(rng: SeededRandom, width: number, height: number): void {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];

    for (let i = 0; i < GEN_PARAMS.roadCount; i++) {
      let startQ: number, startR: number;
      let attempts = 0;
      do {
        startR = rng.nextInt(0, height - 1);
        const rOffset = Math.floor(startR / 2);
        startQ = rng.nextInt(-rOffset, width - rOffset - 1);
        attempts++;
      } while (!this.isValidLandTile(startQ, startR) && attempts < 100);

      if (attempts >= 100) continue;

      const length = rng.nextInt(GEN_PARAMS.roadMinLength, GEN_PARAMS.roadMaxLength);
      let direction = rng.nextInt(0, 5);

      let q = startQ;
      let r = startR;

      for (let step = 0; step < length; step++) {
        if (this.isValidLandTile(q, r)) {
          this.setTile(q, r, TILE_TYPES.ROAD);
        }

        if (rng.next() < GEN_PARAMS.roadCurviness) {
          direction = (direction + (rng.next() < 0.5 ? 1 : 5)) % 6;
        }

        const dir = directions[direction]!;
        q += dir.q;
        r += dir.r;

        const tile = this.getTile(q, r);
        if (!tile || tile.type === TILE_TYPES.WATER || tile.type === TILE_TYPES.MOUNTAIN) {
          break;
        }
      }
    }
  }

  private generateBuildings(rng: SeededRandom): void {
    const candidates: Array<{ q: number; r: number; nearRoad: boolean }> = [];

    this.tiles.forEach(tile => {
      if (tile.type === TILE_TYPES.GRASS || tile.type === TILE_TYPES.WOODS) {
        let nearRoad = false;
        for (const n of HexUtil.getNeighbors(tile.q, tile.r)) {
          const neighbor = this.getTile(n.q, n.r);
          if (neighbor && neighbor.type === TILE_TYPES.ROAD) {
            nearRoad = true;
            break;
          }
        }
        candidates.push({ q: tile.q, r: tile.r, nearRoad });
      }
    });

    for (const c of candidates) {
      let chance = GEN_PARAMS.buildingDensity;
      if (c.nearRoad) {
        chance += GEN_PARAMS.buildingRoadAffinity * GEN_PARAMS.buildingDensity * 5;
      }

      if (rng.next() < chance) {
        this.setTile(c.q, c.r, TILE_TYPES.BUILDING);
      }
    }
  }

  getAllTiles(): Tile[] {
    return Array.from(this.tiles.values());
  }
}
