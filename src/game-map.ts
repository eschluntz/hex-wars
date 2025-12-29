// ============================================================================
// HEX DOMINION - Game Map
// ============================================================================

import { TILE_TYPES, HexUtil, type Tile, type TileType, type TerrainCosts } from './core.js';
import { PerlinNoise, SeededRandom } from './noise.js';
import { GEN_PARAMS, type MapConfig } from './config.js';
import { type Building, type BuildingType, createBuilding, getBuildingKey } from './building.js';
import { Pathfinder } from './pathfinder.js';

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

    // Step 2: Generate buildings (which also generates cluster-based roads)
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
    const numClusters = 4;
    const numSingletons = 8;
    const clusters: Array<{ centerQ: number; centerR: number; buildings: Array<{ q: number; r: number }> }> = [];

    // Step 1: Generate N building clusters (4 for now)
    for (let i = 0; i < numClusters; i++) {
      // Try to find a valid center location
      let attempts = 0;
      let centerQ: number = 0, centerR: number = 0;

      do {
        centerR = rng.nextInt(5, height - 5);
        const rOffset = Math.floor(centerR / 2);
        centerQ = rng.nextInt(-rOffset + 5, width - rOffset - 5);
        attempts++;
      } while (!this.isValidBuildingTile(centerQ, centerR) && attempts < 100);

      if (attempts >= 100) continue;

      // Generate 4-8 buildings in this cluster
      const numBuildings = rng.nextInt(4, 8);
      const clusterBuildings: Array<{ q: number; r: number }> = [];

      // Try to place buildings near the center
      const radius = 5;
      let placedCount = 0;
      let buildingAttempts = 0;

      while (placedCount < numBuildings && buildingAttempts < 200) {
        // Random position near center
        const offsetQ = rng.nextInt(-radius, radius);
        const offsetR = rng.nextInt(-radius, radius);
        const q = centerQ + offsetQ;
        const r = centerR + offsetR;

        // Check if valid and not too close to other buildings
        if (this.isValidBuildingTile(q, r) && !this.isTooCloseToBuilding(q, r, clusterBuildings, 2)) {
          clusterBuildings.push({ q, r });
          placedCount++;
        }
        buildingAttempts++;
      }

      clusters.push({ centerQ, centerR, buildings: clusterBuildings });
    }

    // Step 2: Place buildings in clusters
    const centerQ = Math.floor(width / 2);

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.buildings.length; i++) {
        const pos = cluster.buildings[i]!;

        // Set tile to grass (buildings are passable like grass)
        this.setTile(pos.q, pos.r, TILE_TYPES.GRASS);

        // Determine building type: mostly cities, some factories, 1 lab per cluster
        let buildingType: BuildingType;
        if (i === 0) {
          // First building in cluster is always a lab
          buildingType = 'lab';
        } else {
          // Rest are cities and factories
          const typeRoll = rng.next();
          if (typeRoll < 0.7) {
            buildingType = 'city';
          } else {
            buildingType = 'factory';
          }
        }

        // Assign ownership based on horizontal position
        // Left third = player, right third = enemy, middle = neutral
        let owner: string | null;
        const relativeQ = pos.q + Math.floor(pos.r / 2);
        if (relativeQ < centerQ - 8) {
          owner = 'player';
        } else if (relativeQ > centerQ + 8) {
          owner = 'enemy';
        } else {
          owner = null;
        }

        const building = createBuilding(pos.q, pos.r, buildingType, owner);
        this.buildings.set(getBuildingKey(pos.q, pos.r), building);
      }
    }

    // Step 3: Generate M random singleton buildings
    let singletonsPlaced = 0;
    let singletonAttempts = 0;
    const allClusterBuildings = clusters.flatMap(c => c.buildings);

    while (singletonsPlaced < numSingletons && singletonAttempts < 500) {
      const r = rng.nextInt(0, height - 1);
      const rOffset = Math.floor(r / 2);
      const q = rng.nextInt(-rOffset, width - rOffset - 1);

      if (this.isValidBuildingTile(q, r) && !this.isTooCloseToBuilding(q, r, allClusterBuildings, 3)) {
        // Set tile to grass
        this.setTile(q, r, TILE_TYPES.GRASS);

        // Random building type: 50% city, 30% factory, 20% lab
        const typeRoll = rng.next();
        let buildingType: BuildingType;
        if (typeRoll < 0.5) {
          buildingType = 'city';
        } else if (typeRoll < 0.8) {
          buildingType = 'factory';
        } else {
          buildingType = 'lab';
        }

        // Assign ownership
        let owner: string | null;
        const relativeQ = q + Math.floor(r / 2);
        if (relativeQ < centerQ - 8) {
          owner = 'player';
        } else if (relativeQ > centerQ + 8) {
          owner = 'enemy';
        } else {
          owner = null;
        }

        const building = createBuilding(q, r, buildingType, owner);
        this.buildings.set(getBuildingKey(q, r), building);
        allClusterBuildings.push({ q, r });
        singletonsPlaced++;
      }
      singletonAttempts++;
    }

    // Step 4: Generate roads to connect clusters
    this.generateClusterRoads(clusters);
  }

  private isValidBuildingTile(q: number, r: number): boolean {
    const tile = this.getTile(q, r);
    return tile !== undefined &&
           (tile.type === TILE_TYPES.GRASS ||
            tile.type === TILE_TYPES.WOODS ||
            tile.type === TILE_TYPES.ROAD);
  }

  private isTooCloseToBuilding(q: number, r: number, buildings: Array<{ q: number; r: number }>, minDist: number = 2): boolean {
    for (const building of buildings) {
      const dist = HexUtil.distance(q, r, building.q, building.r);
      if (dist < minDist) return true;
    }
    return false;
  }

  private generateClusterRoads(clusters: Array<{ centerQ: number; centerR: number; buildings: Array<{ q: number; r: number }> }>): void {
    // Custom terrain costs for road generation
    const terrainCosts: TerrainCosts = {
      grass: 1,
      woods: 1.5,
      mountain: 3,
      water: 4,
      road: 0.3,  // Low cost encourages reusing existing roads
      building: 1
    };

    const pathfinder = new Pathfinder(this);

    // Connect each cluster to its 2 nearest neighbors
    // Note: If A→B and B→A both happen, pathfinding will naturally
    // reuse the existing road (cost 0.3) instead of creating parallel roads
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]!;

      // Find 2 nearest neighbors
      const distances = clusters
        .map((c, idx) => ({ idx, dist: HexUtil.distance(cluster.centerQ, cluster.centerR, c.centerQ, c.centerR) }))
        .filter(d => d.idx !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);

      // Connect to each of the 2 nearest
      for (const { idx } of distances) {
        const target = clusters[idx]!;

        // Use A* pathfinding to create road
        const pathResult = pathfinder.findPath(
          cluster.centerQ, cluster.centerR,
          target.centerQ, target.centerR,
          terrainCosts
        );

        if (pathResult) {
          // Draw road along the path
          for (const { q, r } of pathResult.path) {
            const tile = this.getTile(q, r);
            if (tile && tile.type !== TILE_TYPES.BUILDING) {
              this.setTile(q, r, TILE_TYPES.ROAD);
            }
          }
        }
      }
    }
  }

  getAllTiles(): Tile[] {
    return Array.from(this.tiles.values());
  }
}
