// ============================================================================
// HEX DOMINION - Game Map
// ============================================================================

import { TILE_TYPES, HexUtil, type Tile, type TileType } from './core.js';
import { PerlinNoise, SeededRandom } from './noise.js';
import { GEN_PARAMS, type MapConfig } from './config.js';
import { type Building, type BuildingType, createBuilding, getBuildingKey } from './building.js';

export class GameMap {
  private tiles = new Map<string, Tile>();
  private buildings = new Map<string, Building>();
  private config: MapConfig | null = null;

  constructor(config?: MapConfig) {
    this.config = config ?? null;
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

  getBuilding(q: number, r: number): Building | undefined {
    return this.buildings.get(getBuildingKey(q, r));
  }

  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  getBuildingsByOwner(owner: string): Building[] {
    return this.getAllBuildings().filter(b => b.owner === owner);
  }

  getBuildingsByType(type: BuildingType): Building[] {
    return this.getAllBuildings().filter(b => b.type === type);
  }

  setBuildingOwner(q: number, r: number, owner: string | null): void {
    const building = this.buildings.get(getBuildingKey(q, r));
    if (building) {
      building.owner = owner;
    }
  }

  addBuilding(building: Building): void {
    this.buildings.set(getBuildingKey(building.q, building.r), building);
  }

  isValidLandTile(q: number, r: number): boolean {
    const tile = this.getTile(q, r);
    return tile !== undefined && tile.type !== TILE_TYPES.WATER && tile.type !== TILE_TYPES.MOUNTAIN;
  }

  generate(): void {
    this.tiles.clear();
    this.buildings.clear();

    const cfg = this.config;
    const seed = cfg?.seed ?? GEN_PARAMS.seed;
    const width = cfg?.width ?? GEN_PARAMS.mapWidth;
    const height = cfg?.height ?? GEN_PARAMS.mapHeight;

    const rng = new SeededRandom(seed + 2000);

    // Step 1: Generate base terrain
    if (cfg?.terrain) {
      // Procedural terrain
      const altitudeNoise = new PerlinNoise(seed);
      const vegNoise = new PerlinNoise(seed + 1000);

      for (let r = 0; r < height; r++) {
        const rOffset = Math.floor(r / 2);
        for (let q = -rOffset; q < width - rOffset; q++) {
          const altitude = altitudeNoise.fbm(
            q * cfg.terrain.altitudeScale,
            r * cfg.terrain.altitudeScale,
            cfg.terrain.altitudeOctaves
          );

          let type: TileType;
          if (altitude <= cfg.terrain.waterThreshold) {
            type = TILE_TYPES.WATER;
          } else if (altitude >= cfg.terrain.mountainThreshold) {
            type = TILE_TYPES.MOUNTAIN;
          } else {
            const vegetation = vegNoise.fbm(
              q * cfg.terrain.vegScale,
              r * cfg.terrain.vegScale,
              cfg.terrain.vegOctaves
            );

            if (vegetation >= cfg.terrain.forestThreshold) {
              type = TILE_TYPES.WOODS;
            } else {
              type = TILE_TYPES.GRASS;
            }
          }

          this.setTile(q, r, type);
        }
      }
    } else {
      // All grass (simple test map)
      for (let r = 0; r < height; r++) {
        const rOffset = Math.floor(r / 2);
        for (let q = -rOffset; q < width - rOffset; q++) {
          this.setTile(q, r, TILE_TYPES.GRASS);
        }
      }
    }

    // Step 2: Generate roads
    const roadCount = cfg?.roadCount ?? GEN_PARAMS.roadCount;
    if (roadCount > 0) {
      this.generateRoads(rng, width, height, cfg);
    }

    // Step 3: Generate buildings
    if (cfg?.buildings) {
      this.generateBuildings(rng, width, height, cfg);
    }

    console.log(`Generated map: ${this.tiles.size} tiles, ${this.buildings.size} buildings`);
  }

  private generateRoads(rng: SeededRandom, width: number, height: number, cfg?: MapConfig | null): void {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];

    const roadCount = cfg?.roadCount ?? GEN_PARAMS.roadCount;
    const roadMinLength = cfg?.roadMinLength ?? GEN_PARAMS.roadMinLength;
    const roadMaxLength = cfg?.roadMaxLength ?? GEN_PARAMS.roadMaxLength;
    const roadCurviness = cfg?.roadCurviness ?? GEN_PARAMS.roadCurviness;

    for (let i = 0; i < roadCount; i++) {
      let startQ: number, startR: number;
      let attempts = 0;
      do {
        startR = rng.nextInt(0, height - 1);
        const rOffset = Math.floor(startR / 2);
        startQ = rng.nextInt(-rOffset, width - rOffset - 1);
        attempts++;
      } while (!this.isValidLandTile(startQ, startR) && attempts < 100);

      if (attempts >= 100) continue;

      const length = rng.nextInt(roadMinLength, roadMaxLength);
      let direction = rng.nextInt(0, 5);

      let q = startQ;
      let r = startR;

      for (let step = 0; step < length; step++) {
        if (this.isValidLandTile(q, r)) {
          this.setTile(q, r, TILE_TYPES.ROAD);
        }

        if (rng.next() < roadCurviness) {
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

  private generateBuildings(rng: SeededRandom, width: number, height: number, cfg?: MapConfig | null): void {
    const candidates: Array<{ q: number; r: number; nearRoad: boolean }> = [];

    const density = cfg?.buildings?.density ?? GEN_PARAMS.buildingDensity;
    const roadAffinity = cfg?.buildings?.roadAffinity ?? GEN_PARAMS.buildingRoadAffinity;

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

    const centerQ = Math.floor(width / 2);

    for (const c of candidates) {
      let chance = density;
      if (c.nearRoad) {
        chance += roadAffinity * density * 5;
      }

      if (rng.next() < chance) {
        // Set tile to grass (buildings are passable like grass)
        this.setTile(c.q, c.r, TILE_TYPES.GRASS);

        // Pick random building type with weighted distribution
        // 50% city, 30% factory, 20% lab
        const typeRoll = rng.next();
        let buildingType: BuildingType;
        if (typeRoll < 0.5) {
          buildingType = 'city';
        } else if (typeRoll < 0.8) {
          buildingType = 'factory';
        } else {
          buildingType = 'lab';
        }

        // Assign ownership based on horizontal position
        // Left third = player, right third = enemy, middle = neutral
        let owner: string | null;
        const relativeQ = c.q + Math.floor(c.r / 2); // Normalize for offset rows
        if (relativeQ < centerQ - 8) {
          owner = 'player';
        } else if (relativeQ > centerQ + 8) {
          owner = 'enemy';
        } else {
          owner = null; // Neutral
        }

        const building = createBuilding(c.q, c.r, buildingType, owner);
        this.buildings.set(getBuildingKey(c.q, c.r), building);
      }
    }
  }

  getAllTiles(): Tile[] {
    return Array.from(this.tiles.values());
  }
}
