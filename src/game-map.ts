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
    if (cfg?.clusters) {
      this.generateBuildings(rng, width, height, cfg);
    }

    console.log(`Generated map: ${this.tiles.size} tiles, ${this.buildings.size} buildings`);
  }

  private generateBuildings(rng: SeededRandom, width: number, height: number, cfg: MapConfig): void {
    const clusterCfg = cfg.clusters!;
    const clusters: Array<{ centerQ: number; centerR: number; buildings: Array<{ q: number; r: number }> }> = [];

    // Step 1: Generate clusters using Mitchell's Best-Candidate algorithm
    // This naturally fills corners and gaps by always picking the point farthest from existing clusters
    while (true) {
      const numCandidates = clusterCfg.candidatesPerCluster;
      let bestQ = 0, bestR = 0;
      let bestMinDist = 0;

      // Generate candidates and pick the one farthest from all existing clusters
      for (let i = 0; i < numCandidates; i++) {
        const r = rng.nextInt(5, height - 5);
        const rOffset = Math.floor(r / 2);
        const q = rng.nextInt(-rOffset + 5, width - rOffset - 5);

        if (!this.isValidBuildingTile(q, r)) continue;

        // Find distance to nearest existing cluster
        let minDist = Infinity;
        for (const existing of clusters) {
          const dist = HexUtil.distance(q, r, existing.centerQ, existing.centerR);
          minDist = Math.min(minDist, dist);
        }

        // First cluster has no existing clusters, so minDist stays Infinity
        if (clusters.length === 0) {
          minDist = 1000; // Arbitrary large value for first cluster
        }

        // Keep the candidate that's farthest from any existing cluster
        if (minDist > bestMinDist) {
          bestMinDist = minDist;
          bestQ = q;
          bestR = r;
        }
      }

      // Stop if best candidate doesn't meet minimum distance requirement
      if (bestMinDist < clusterCfg.minDistance) break;

      // Generate buildings in this cluster
      const numBuildings = rng.nextInt(clusterCfg.buildingsMin, clusterCfg.buildingsMax);
      const clusterBuildings: Array<{ q: number; r: number }> = [];

      // Try to place buildings near the center
      const radius = clusterCfg.radius;
      let placedCount = 0;
      let buildingAttempts = 0;

      while (placedCount < numBuildings && buildingAttempts < 200) {
        // Random position near center
        const offsetQ = rng.nextInt(-radius, radius);
        const offsetR = rng.nextInt(-radius, radius);
        const q = bestQ + offsetQ;
        const r = bestR + offsetR;

        // Check if valid tile and not already used
        const alreadyUsed = clusterBuildings.some(b => b.q === q && b.r === r);
        if (this.isValidBuildingTile(q, r) && !alreadyUsed) {
          clusterBuildings.push({ q, r });
          placedCount++;
        }
        buildingAttempts++;
      }

      clusters.push({ centerQ: bestQ, centerR: bestR, buildings: clusterBuildings });
    }

    // Step 2: Find the two furthest clusters for player home bases
    let maxDistance = 0;
    let playerClusterIdx = 0;
    let enemyClusterIdx = 1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = HexUtil.distance(
          clusters[i]!.centerQ, clusters[i]!.centerR,
          clusters[j]!.centerQ, clusters[j]!.centerR
        );
        if (dist > maxDistance) {
          maxDistance = dist;
          playerClusterIdx = i;
          enemyClusterIdx = j;
        }
      }
    }

    // Step 3: Place buildings in clusters (all neutral initially)
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

        // All buildings start neutral - ownership assigned after
        const building = createBuilding(pos.q, pos.r, buildingType, null);
        this.buildings.set(getBuildingKey(pos.q, pos.r), building);
      }
    }

    // Step 4: Assign home cluster buildings to players (2 cities + 1 factory each)
    this.assignHomeClusterBuildings(clusters[playerClusterIdx]!, 'player');
    this.assignHomeClusterBuildings(clusters[enemyClusterIdx]!, 'enemy');

    // Step 5: Generate random singleton buildings (all neutral)
    let singletonsPlaced = 0;
    let singletonAttempts = 0;
    const allClusterBuildings = clusters.flatMap(c => c.buildings);

    while (singletonsPlaced < clusterCfg.singletonCount && singletonAttempts < 500) {
      const r = rng.nextInt(0, height - 1);
      const rOffset = Math.floor(r / 2);
      const q = rng.nextInt(-rOffset, width - rOffset - 1);

      if (this.isValidBuildingTile(q, r) && !this.isTooCloseToBuilding(q, r, allClusterBuildings, clusterCfg.singletonMinDistance)) {
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

        // All singletons are neutral
        const building = createBuilding(q, r, buildingType, null);
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

  private assignHomeClusterBuildings(cluster: { centerQ: number; centerR: number; buildings: Array<{ q: number; r: number }> }, owner: string): void {
    // Find buildings in this cluster and assign 2 cities + 1 factory to owner
    let citiesAssigned = 0;
    let factoriesAssigned = 0;

    for (const pos of cluster.buildings) {
      const building = this.buildings.get(getBuildingKey(pos.q, pos.r));
      if (!building) continue;

      if (building.type === 'city' && citiesAssigned < 2) {
        building.owner = owner;
        citiesAssigned++;
      } else if (building.type === 'factory' && factoriesAssigned < 1) {
        building.owner = owner;
        factoriesAssigned++;
      }
    }

    // If we didn't find enough cities/factories, assign any remaining slots to whatever we have
    if (citiesAssigned < 2 || factoriesAssigned < 1) {
      for (const pos of cluster.buildings) {
        const building = this.buildings.get(getBuildingKey(pos.q, pos.r));
        if (!building || building.owner === owner) continue;

        // Fill remaining slots with any building type
        const needsMore = (citiesAssigned + factoriesAssigned) < 3;
        if (needsMore) {
          building.owner = owner;
          if (building.type === 'city') citiesAssigned++;
          else if (building.type === 'factory') factoriesAssigned++;
          else citiesAssigned++; // Count labs toward the 3 total
        }
      }
    }
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
