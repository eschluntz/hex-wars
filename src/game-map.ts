// ============================================================================
// HEX DOMINION - Game Map
// ============================================================================

import { TILE_TYPES, TERRAIN_DEFENSE_STARS, HexUtil, type Tile, type TileType, type TerrainCosts } from './core.js';
import { PerlinNoise, SeededRandom } from './noise.js';
import { GEN_PARAMS, type MapConfig } from './config.js';
import { type Building, type BuildingType, createBuilding, getBuildingKey, CAPTURE_RESISTANCE } from './building.js';
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

  getTerrainDefenseStars(q: number, r: number): number {
    const tile = this.getTile(q, r);
    return tile ? TERRAIN_DEFENSE_STARS[tile.type] : 0;
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

  applyCaptureProgress(q: number, r: number, unitId: string, damage: number): boolean {
    const building = this.buildings.get(getBuildingKey(q, r));
    if (!building) return false;

    // If a different unit was capturing, reset resistance first
    if (building.capturingUnitId !== null && building.capturingUnitId !== unitId) {
      building.captureResistance = CAPTURE_RESISTANCE;
    }

    building.capturingUnitId = unitId;
    building.captureResistance -= damage;

    if (building.captureResistance <= 0) {
      // Capture complete - owner will be set by caller
      building.captureResistance = CAPTURE_RESISTANCE;
      building.capturingUnitId = null;
      return true;
    }

    return false;
  }

  resetCaptureByUnit(unitId: string): void {
    for (const building of this.buildings.values()) {
      if (building.capturingUnitId === unitId) {
        building.captureResistance = CAPTURE_RESISTANCE;
        building.capturingUnitId = null;
      }
    }
  }

  addBuilding(building: Building): void {
    this.setTile(building.q, building.r, TILE_TYPES.BUILDING);
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
    // Use dynamic margin based on map size (at least 1, at most 5)
    const margin = Math.max(1, Math.min(5, Math.floor(Math.min(width, height) * 0.15)));

    while (true) {
      const numCandidates = clusterCfg.candidatesPerCluster;
      let bestQ = 0, bestR = 0;
      let bestMinDist = 0;

      // Generate candidates and pick the one farthest from all existing clusters
      for (let i = 0; i < numCandidates; i++) {
        const r = rng.nextInt(margin, height - margin);
        const rOffset = Math.floor(r / 2);
        const q = rng.nextInt(-rOffset + margin, width - rOffset - margin);

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
      // But always try to get at least 2 clusters for home bases
      if (bestMinDist < clusterCfg.minDistance && clusters.length >= 2) break;
      if (bestMinDist === 0) break; // No valid candidates found at all

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

    // Get asymmetric cluster counts from config (defaults to 1 each)
    const playerClusterCount = cfg.playerClusters ?? 1;
    const enemyClusterCount = cfg.enemyClusters ?? 1;

    // Collect indices of non-home clusters for redistribution
    const remainingIndices: number[] = [];
    for (let i = 0; i < clusters.length; i++) {
      if (i !== playerClusterIdx && i !== enemyClusterIdx) {
        remainingIndices.push(i);
      }
    }

    // Shuffle remaining clusters randomly for fair distribution
    rng.shuffle(remainingIndices);

    // Assign extra clusters to player and enemy (beyond their home cluster)
    const playerBonusCount = Math.min(playerClusterCount - 1, remainingIndices.length);
    const playerBonusIndices = remainingIndices.splice(0, playerBonusCount);

    const enemyBonusCount = Math.min(enemyClusterCount - 1, remainingIndices.length);
    const enemyBonusIndices = remainingIndices.splice(0, enemyBonusCount);

    // Create sets for quick lookup
    const playerClusterIndices = new Set([playerClusterIdx, ...playerBonusIndices]);
    const enemyClusterIndices = new Set([enemyClusterIdx, ...enemyBonusIndices]);

    // Step 3: Place buildings in home clusters with identical composition
    const playerCluster = clusters[playerClusterIdx]!;
    const enemyCluster = clusters[enemyClusterIdx]!;

    // Use the same building count for both home clusters (minimum of the two)
    const homeClusterSize = Math.min(playerCluster.buildings.length, enemyCluster.buildings.length);

    // Trim both clusters to the same size
    playerCluster.buildings = playerCluster.buildings.slice(0, homeClusterSize);
    enemyCluster.buildings = enemyCluster.buildings.slice(0, homeClusterSize);

    // Place home cluster buildings with fixed pattern: capital, factory, then cities
    for (const { cluster, owner } of [
      { cluster: playerCluster, owner: 'player' },
      { cluster: enemyCluster, owner: 'enemy' }
    ]) {
      for (let i = 0; i < cluster.buildings.length; i++) {
        const pos = cluster.buildings[i]!;
        let buildingType: BuildingType;

        if (i === 0) {
          buildingType = 'capital';
        } else if (i === 1) {
          buildingType = 'factory';
        } else {
          buildingType = 'city';
        }

        const building = createBuilding(pos.q, pos.r, buildingType, owner);
        this.buildings.set(getBuildingKey(pos.q, pos.r), building);
      }
    }

    // Step 4: Place buildings in non-home clusters
    // Bonus clusters for player/enemy get ownership, others are neutral
    for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
      // Skip home clusters (already handled above)
      if (clusterIdx === playerClusterIdx || clusterIdx === enemyClusterIdx) continue;

      const cluster = clusters[clusterIdx]!;

      // Determine ownership for bonus clusters
      let owner: string | null = null;
      if (playerClusterIndices.has(clusterIdx)) {
        owner = 'player';
      } else if (enemyClusterIndices.has(clusterIdx)) {
        owner = 'enemy';
      }

      for (let i = 0; i < cluster.buildings.length; i++) {
        const pos = cluster.buildings[i]!;

        // Determine building type: mostly cities, some factories
        let buildingType: BuildingType;
        const typeRoll = rng.next();
        if (typeRoll < 0.7) {
          buildingType = 'city';
        } else {
          buildingType = 'factory';
        }

        const building = createBuilding(pos.q, pos.r, buildingType, owner);
        this.buildings.set(getBuildingKey(pos.q, pos.r), building);
      }
    }

    // Step 5: Generate random singleton buildings (all neutral)
    let singletonsPlaced = 0;
    let singletonAttempts = 0;
    const allClusterBuildings = clusters.flatMap(c => c.buildings);

    while (singletonsPlaced < clusterCfg.singletonCount && singletonAttempts < 500) {
      const r = rng.nextInt(0, height - 1);
      const rOffset = Math.floor(r / 2);
      const q = rng.nextInt(-rOffset, width - rOffset - 1);

      if (this.isValidBuildingTile(q, r) && !this.isTooCloseToBuilding(q, r, allClusterBuildings, clusterCfg.singletonMinDistance)) {
        // Random building type: 60% city, 40% factory
        const typeRoll = rng.next();
        let buildingType: BuildingType;
        if (typeRoll < 0.6) {
          buildingType = 'city';
        } else {
          buildingType = 'factory';
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

  getCapital(owner: string): Building | undefined {
    return this.getAllBuildings().find(b => b.type === 'capital' && b.owner === owner);
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
