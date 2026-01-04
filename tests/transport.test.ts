// ============================================================================
// Transport Unit Tests
// ============================================================================

import { TestRunner, assert, assertEqual } from './framework.js';
import { Unit, CARRIED_COORD } from '../src/unit.js';
import { DEFAULT_TERRAIN_COSTS } from '../src/core.js';
import { GameStats } from '../src/stats.js';

const runner = new TestRunner();

function createUnit(id: string, team: string, q: number, r: number, overrides: Partial<{
  chassisId: string;
  transportCapacity: number;
  transportFilter: string[];
  health: number;
  attack: number;
  range: number;
}> = {}): Unit {
  return new Unit(id, team, q, r, {
    speed: 4,
    attack: overrides.attack ?? 5,
    range: overrides.range ?? 1,
    minRange: 0,
    canMoveAndAttack: true,
    terrainCosts: DEFAULT_TERRAIN_COSTS,
    color: '#ff0000',
    canCapture: false,
    canBuild: false,
    armored: false,
    armorPiercing: false,
    chassisId: overrides.chassisId ?? 'foot',
    transportCapacity: overrides.transportCapacity ?? 0,
    transportFilter: overrides.transportFilter ?? [],
  });
}

function createCarrier(id: string, team: string, capacity: number, filter: string[] = []): Unit {
  return createUnit(id, team, 0, 0, {
    chassisId: 'treads',
    transportCapacity: capacity,
    transportFilter: filter,
  });
}

runner.describe('canLoadUnit', () => {
  runner.it('should reject unit with wrong chassis type for filtered transport', () => {
    const carrier = createCarrier('carrier', 'player', 1, ['foot']);
    const treadsUnit = createUnit('tank', 'player', 0, 0, { chassisId: 'treads' });

    assertEqual(carrier.canLoadUnit(treadsUnit), false);
  });

  runner.it('should accept unit with matching chassis type for filtered transport', () => {
    const carrier = createCarrier('carrier', 'player', 1, ['foot']);
    const footUnit = createUnit('soldier', 'player', 0, 0, { chassisId: 'foot' });

    assertEqual(carrier.canLoadUnit(footUnit), true);
  });

  runner.it('should accept any chassis when filter is empty', () => {
    const carrier = createCarrier('carrier', 'player', 2, []);
    const treadsUnit = createUnit('tank', 'player', 0, 0, { chassisId: 'treads' });
    const footUnit = createUnit('soldier', 'player', 0, 0, { chassisId: 'foot' });

    assertEqual(carrier.canLoadUnit(treadsUnit), true);
    assertEqual(carrier.canLoadUnit(footUnit), true);
  });

  runner.it('should reject loading a transport onto another transport', () => {
    const carrier1 = createCarrier('carrier1', 'player', 2, []);
    const carrier2 = createCarrier('carrier2', 'player', 1, []);

    assertEqual(carrier1.canLoadUnit(carrier2), false);
  });

  runner.it('should reject unit already being carried', () => {
    const carrier1 = createCarrier('carrier1', 'player', 2, []);
    const carrier2 = createCarrier('carrier2', 'player', 2, []);
    const cargo = createUnit('cargo', 'player', 0, 0, { chassisId: 'foot' });

    carrier1.loadUnit(cargo);
    assertEqual(carrier2.canLoadUnit(cargo), false);
  });

  runner.it('should reject enemy units', () => {
    const carrier = createCarrier('carrier', 'player', 2, []);
    const enemy = createUnit('enemy', 'enemy', 0, 0, { chassisId: 'foot' });

    assertEqual(carrier.canLoadUnit(enemy), false);
  });

  runner.it('should reject when at capacity', () => {
    const carrier = createCarrier('carrier', 'player', 1, []);
    const unit1 = createUnit('unit1', 'player', 0, 0, { chassisId: 'foot' });
    const unit2 = createUnit('unit2', 'player', 0, 0, { chassisId: 'foot' });

    carrier.loadUnit(unit1);
    assertEqual(carrier.canLoadUnit(unit2), false);
  });
});

runner.describe('cargo death cascade', () => {
  runner.it('should kill all cargo when carrier dies', () => {
    const carrier = createCarrier('carrier', 'player', 2, []);
    const cargo1 = createUnit('cargo1', 'player', 0, 0, { chassisId: 'foot' });
    const cargo2 = createUnit('cargo2', 'player', 0, 0, { chassisId: 'foot' });

    carrier.loadUnit(cargo1);
    carrier.loadUnit(cargo2);

    // Simulate carrier death (what handleUnitDeath does)
    carrier.health = 0;
    for (const cargoUnit of carrier.cargo) {
      cargoUnit.health = 0;
      cargoUnit.carriedBy = null;
    }
    carrier.cargo = [];

    assertEqual(cargo1.health, 0);
    assertEqual(cargo2.health, 0);
    assertEqual(cargo1.carriedBy, null);
    assertEqual(cargo2.carriedBy, null);
  });

  runner.it('should credit kills for each cargo unit when carrier dies', () => {
    const stats = new GameStats(['player', 'enemy']);
    const carrier = createCarrier('carrier', 'player', 2, []);
    const cargo1 = createUnit('cargo1', 'player', 0, 0, { chassisId: 'foot' });
    const cargo2 = createUnit('cargo2', 'player', 0, 0, { chassisId: 'foot' });

    carrier.loadUnit(cargo1);
    carrier.loadUnit(cargo2);

    // Simulate what handleUnitDeath does
    const killerTeam = 'enemy';
    stats.recordUnitKilled(killerTeam, carrier.team); // carrier kill
    for (const cargoUnit of carrier.cargo) {
      stats.recordUnitKilled(killerTeam, cargoUnit.team); // cargo kills
    }

    const enemyStats = stats.getAllStats().get('enemy')!;
    assertEqual(enemyStats.totalUnitsKilled, 3); // 1 carrier + 2 cargo
  });
});

runner.describe('cargo visibility', () => {
  runner.it('cargo units should have carriedBy set after loading', () => {
    const carrier = createCarrier('carrier', 'player', 1, []);
    const cargo = createUnit('cargo', 'player', 0, 0, { chassisId: 'foot' });

    carrier.loadUnit(cargo);

    assertEqual(cargo.carriedBy, carrier);
  });

  runner.it('cargo units should have invalid coordinates after loading', () => {
    const carrier = createCarrier('carrier', 'player', 1, []);
    const cargo = createUnit('cargo', 'player', 5, 3, { chassisId: 'foot' });

    carrier.loadUnit(cargo);

    assertEqual(cargo.q, CARRIED_COORD);
    assertEqual(cargo.r, CARRIED_COORD);
  });

  runner.it('carriedBy should be null after unloading', () => {
    const carrier = createCarrier('carrier', 'player', 1, []);
    const cargo = createUnit('cargo', 'player', 0, 0, { chassisId: 'foot' });

    carrier.loadUnit(cargo);
    carrier.unloadUnit(cargo, 1, 1);

    assertEqual(cargo.carriedBy, null);
  });

  runner.it('filtering by carriedBy correctly excludes cargo', () => {
    const carrier = createCarrier('carrier', 'player', 2, []);
    const cargo1 = createUnit('cargo1', 'player', 0, 0, { chassisId: 'foot' });
    const cargo2 = createUnit('cargo2', 'player', 0, 0, { chassisId: 'foot' });
    const freeUnit = createUnit('free', 'player', 1, 1, { chassisId: 'foot' });

    carrier.loadUnit(cargo1);
    carrier.loadUnit(cargo2);

    const allUnits = [carrier, cargo1, cargo2, freeUnit];
    const visibleUnits = allUnits.filter(u => u.carriedBy === null);

    assertEqual(visibleUnits.length, 2);
    assert(visibleUnits.includes(carrier), 'carrier should be visible');
    assert(visibleUnits.includes(freeUnit), 'free unit should be visible');
    assert(!visibleUnits.includes(cargo1), 'cargo1 should not be visible');
    assert(!visibleUnits.includes(cargo2), 'cargo2 should not be visible');
  });
});

runner.describe('unload behavior', () => {
  runner.it('unloaded unit should have hasActed = true', () => {
    const carrier = createCarrier('carrier', 'player', 1, []);
    const cargo = createUnit('cargo', 'player', 0, 0, { chassisId: 'foot' });
    cargo.hasActed = false;

    carrier.loadUnit(cargo);
    carrier.unloadUnit(cargo, 1, 1);

    assertEqual(cargo.hasActed, true);
  });

  runner.it('unloaded unit should be at specified position', () => {
    const carrier = createCarrier('carrier', 'player', 1);
    const cargo = createUnit('cargo', 'player', 0, 0, { chassisId: 'foot' });

    carrier.loadUnit(cargo);
    carrier.unloadUnit(cargo, 5, 3);

    assertEqual(cargo.q, 5);
    assertEqual(cargo.r, 3);
  });
});

export default runner;
