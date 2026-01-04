// ============================================================================
// HEX DOMINION - Combat Tests
// ============================================================================

import { TestRunner, assert, assertEqual } from './framework.js';
import { Unit } from '../src/unit.js';
import { Combat } from '../src/combat.js';

const runner = new TestRunner();

function createUnit(
  id: string,
  team: string,
  q: number,
  r: number,
  stats: {
    attack?: number;
    range?: number;
    minRange?: number;
    health?: number;
    armored?: boolean;
    armorPiercing?: boolean;
    flying?: boolean;
    chassisId?: string;
    cannotTarget?: string[];
  } = {}
) {
  const unit = new Unit(id, team, q, r, {
    attack: stats.attack ?? 5,
    range: stats.range ?? 1,
    minRange: stats.minRange ?? 0,
    armored: stats.armored ?? false,
    armorPiercing: stats.armorPiercing ?? false,
    flying: stats.flying ?? false,
    chassisId: stats.chassisId ?? 'foot',
    cannotTarget: stats.cannotTarget ?? [],
  });
  if (stats.health !== undefined) {
    unit.health = stats.health;
  }
  return unit;
}

runner.describe('Combat', () => {
  runner.describe('calculateBaseExpectedDamage', () => {
    runner.it('should calculate full damage at full health', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5 });
      const damage = Combat.calculateBaseExpectedDamage(attacker);
      assertEqual(damage, 5);
    });

    runner.it('should calculate half damage at half health', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 6, health: 5 });
      const damage = Combat.calculateBaseExpectedDamage(attacker);
      assertEqual(damage, 3); // 6 * 0.5 = 3
    });

    runner.it('should floor fractional damage', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5, health: 7 });
      // 5 * 0.7 = 3.5, floor = 3
      const damage = Combat.calculateBaseExpectedDamage(attacker);
      assertEqual(damage, 3);
    });
  });

  runner.describe('calculateDamage (variance)', () => {
    runner.it('should add positive variance', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5 });
      const defender = createUnit('d', 'enemy', 1, 0);
      const damage = Combat.calculateDamage(attacker, defender, 1);
      assertEqual(damage, 6);
    });

    runner.it('should subtract negative variance', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5 });
      const defender = createUnit('d', 'enemy', 1, 0);
      const damage = Combat.calculateDamage(attacker, defender, -1);
      assertEqual(damage, 4);
    });

    runner.it('should not go below 0 damage with negative variance', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 1, health: 1 });
      const defender = createUnit('d', 'enemy', 1, 0);
      // 1 * 0.1 = 0.1, floor = 0, + (-1) = -1, max(0, -1) = 0
      const damage = Combat.calculateDamage(attacker, defender, -1);
      assertEqual(damage, 0);
    });
  });

  runner.describe('calculateDamage (with armor)', () => {
    runner.it('should deal full damage when defender is not armored', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5 });
      const defender = createUnit('d', 'enemy', 1, 0);
      const damage = Combat.calculateDamage(attacker, defender, 0);
      assertEqual(damage, 5);
    });

    runner.it('should reduce non-AP damage by 5x against armored target', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5, armorPiercing: false });
      const defender = createUnit('d', 'enemy', 1, 0, { armored: true });
      const damage = Combat.calculateDamage(attacker, defender, 0);
      assertEqual(damage, 1); // 5 / 5 = 1
    });

    runner.it('should deal 0 damage when low attack vs armor', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 4, armorPiercing: false });
      const defender = createUnit('d', 'enemy', 1, 0, { armored: true });
      const damage = Combat.calculateDamage(attacker, defender, 0);
      assertEqual(damage, 0); // 4 / 5 = 0.8, floor = 0
    });

    runner.it('should deal full damage when attacker has armor piercing', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 7, armorPiercing: true });
      const defender = createUnit('d', 'enemy', 1, 0, { armored: true });
      const damage = Combat.calculateDamage(attacker, defender, 0);
      assertEqual(damage, 7); // AP bypasses armor
    });

    runner.it('should deal full AP damage even when defender is not armored', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 7, armorPiercing: true });
      const defender = createUnit('d', 'enemy', 1, 0, { armored: false });
      const damage = Combat.calculateDamage(attacker, defender, 0);
      assertEqual(damage, 7);
    });

    runner.it('should apply variance after armor reduction', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5, armorPiercing: false });
      const defender = createUnit('d', 'enemy', 1, 0, { armored: true });
      // Expected: 5 / 5 = 1, then +1 variance = 2
      const damage = Combat.calculateDamage(attacker, defender, 1);
      assertEqual(damage, 2);
    });
  });

  runner.describe('isInRange', () => {
    runner.it('should return true for adjacent units with range 1', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 1 });
      const target = createUnit('t', 'enemy', 1, 0);
      assert(Combat.isInRange(attacker, target));
    });

    runner.it('should return false for units beyond range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 1 });
      const target = createUnit('t', 'enemy', 2, 0);
      assert(!Combat.isInRange(attacker, target));
    });

    runner.it('should handle range 2', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 2 });
      const target1 = createUnit('t1', 'enemy', 2, 0);
      const target2 = createUnit('t2', 'enemy', 3, 0);
      assert(Combat.isInRange(attacker, target1), 'Distance 2 should be in range');
      assert(!Combat.isInRange(attacker, target2), 'Distance 3 should not be in range');
    });

    runner.it('should return true for same position', () => {
      const attacker = createUnit('a', 'player', 5, 5, { range: 1 });
      const target = createUnit('t', 'enemy', 5, 5);
      assert(Combat.isInRange(attacker, target));
    });

    runner.it('should return false when target is closer than minRange', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 3, minRange: 2 });
      const target = createUnit('t', 'enemy', 1, 0); // distance 1
      assert(!Combat.isInRange(attacker, target));
    });

    runner.it('should return true when target is at minRange', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 3, minRange: 2 });
      const target = createUnit('t', 'enemy', 2, 0); // distance 2
      assert(Combat.isInRange(attacker, target));
    });

    runner.it('should return true when target is between minRange and range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 4, minRange: 2 });
      const target = createUnit('t', 'enemy', 3, 0); // distance 3
      assert(Combat.isInRange(attacker, target));
    });

    runner.it('should handle minRange 0 (no minimum)', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 3, minRange: 0 });
      const samePos = createUnit('t', 'enemy', 0, 0); // distance 0
      assert(Combat.isInRange(attacker, samePos));
    });
  });

  runner.describe('getTargetsInRange', () => {
    runner.it('should return enemies within range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 1 });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0), // adjacent
        createUnit('e2', 'enemy', 2, 0), // too far
        createUnit('e3', 'enemy', 0, 1), // adjacent
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);
      assertEqual(targets.length, 2);
    });

    runner.it('should exclude dead enemies', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 1 });
      const deadEnemy = createUnit('e1', 'enemy', 1, 0, { health: 0 });
      const aliveEnemy = createUnit('e2', 'enemy', 0, 1);
      const targets = Combat.getTargetsInRange(attacker, [deadEnemy, aliveEnemy]);
      assertEqual(targets.length, 1);
      assertEqual(targets[0]!.id, 'e2');
    });

    runner.it('should return empty array when no enemies in range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 1 });
      const enemies = [createUnit('e1', 'enemy', 5, 5), createUnit('e2', 'enemy', 10, 10)];
      const targets = Combat.getTargetsInRange(attacker, enemies);
      assertEqual(targets.length, 0);
    });

    runner.it('should exclude targets closer than minRange', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 3, minRange: 2 });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0), // distance 1 - too close
        createUnit('e2', 'enemy', 2, 0), // distance 2 - in range
        createUnit('e3', 'enemy', 3, 0), // distance 3 - in range
        createUnit('e4', 'enemy', 4, 0), // distance 4 - too far
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);
      assertEqual(targets.length, 2);
      assertEqual(targets[0]!.id, 'e2');
      assertEqual(targets[1]!.id, 'e3');
    });
  });

  runner.describe('execute', () => {
    runner.it('should deal damage to defender', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5 });

      Combat.execute(attacker, defender, 0, 0);

      assertEqual(defender.health, 5); // 10 - 5 = 5
    });

    runner.it('should allow counter-attack when defender survives and in range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 3, range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 4, range: 1 });

      Combat.execute(attacker, defender, 0, 0);

      assertEqual(defender.health, 7); // 10 - 3 = 7
      // Counter-attack: defender at 70% health, damage = floor(4 * 0.7) = 2
      assertEqual(attacker.health, 8); // 10 - 2 = 8
    });

    runner.it('should correctly calculate counter-attack with reduced health', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 3, range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 4, range: 1 });

      const result = Combat.execute(attacker, defender, 0, 0);

      assertEqual(result.attackerDamage, 3);
      // After taking 3 damage, defender has 7 health (70%)
      // Counter damage = floor(4 * 0.7) + 0 = 2
      assertEqual(result.defenderDamage, 2);
      assertEqual(attacker.health, 8);
      assertEqual(defender.health, 7);
    });

    runner.it('should not counter-attack if defender dies', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10, range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5, range: 1 });

      const result = Combat.execute(attacker, defender, 0, 0);

      assertEqual(result.attackerDamage, 10);
      assertEqual(result.defenderDamage, 0);
      assertEqual(result.defenderDied, true);
      assertEqual(result.attackerDied, false);
      assertEqual(defender.health, 0);
      assertEqual(attacker.health, 10);
    });

    runner.it('should not counter-attack if attacker out of defender range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 3, range: 2 });
      const defender = createUnit('d', 'enemy', 2, 0, { attack: 5, range: 1 });

      const result = Combat.execute(attacker, defender, 0, 0);

      assertEqual(result.attackerDamage, 3);
      assertEqual(result.defenderDamage, 0); // Can't counter - out of range
      assertEqual(defender.health, 7);
      assertEqual(attacker.health, 10);
    });

    runner.it('should allow counter-attack if defender has longer range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 3, range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5, range: 2 });

      const result = Combat.execute(attacker, defender, 0, 0);

      assertEqual(result.attackerDamage, 3);
      // Defender at 7 HP, damage = floor(5 * 0.7) = 3
      assertEqual(result.defenderDamage, 3);
      assertEqual(defender.health, 7);
      assertEqual(attacker.health, 7);
    });

    runner.it('should handle mutual destruction', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10, range: 1, health: 3 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 10, range: 1, health: 10 });

      const result = Combat.execute(attacker, defender, 0, 1);

      // Attacker deals 10 * 0.3 = 3, defender survives with 7
      // Defender deals 10 * 0.7 + 1 = 8, attacker dies
      assertEqual(result.defenderDied, false);
      assertEqual(result.attackerDied, true);
      assertEqual(defender.health, 7);
      assertEqual(attacker.health, 0);
    });

    runner.it('should handle variance in combat', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5 });

      // With +1 variance for attacker
      const result = Combat.execute(attacker, defender, 1, 0);
      assertEqual(result.attackerDamage, 6); // 5 + 1
    });
  });

  runner.describe('execute (with armor)', () => {
    runner.it('should reduce damage when attacking armored unit without AP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 5, armorPiercing: false });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5, armored: true });

      const result = Combat.execute(attacker, defender, 0, 0);

      // 5 / 5 = 1 damage
      assertEqual(result.attackerDamage, 1);
      assertEqual(defender.health, 9);
    });

    runner.it('should deal full damage when attacking armored unit with AP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 7, armorPiercing: true });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5, armored: true });

      const result = Combat.execute(attacker, defender, 0, 0);

      assertEqual(result.attackerDamage, 7);
      assertEqual(defender.health, 3);
    });

    runner.it('should apply armor on counter-attack too', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 7, armorPiercing: true, armored: true });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5, armorPiercing: false });

      const result = Combat.execute(attacker, defender, 0, 0);

      // Attacker deals 7 damage (AP)
      assertEqual(result.attackerDamage, 7);
      assertEqual(defender.health, 3);

      // Counter: defender has 3 HP (30%), base damage = floor(5 * 0.3) = 1
      // Attacker is armored, defender has no AP: 1 / 5 = 0
      assertEqual(result.defenderDamage, 0);
      assertEqual(attacker.health, 10);
    });

    runner.it('should simulate soldier vs tank (MG vs armored)', () => {
      // Soldier: attack 4, no AP
      // Tank: armored
      const soldier = createUnit('soldier', 'player', 0, 0, { attack: 4, armorPiercing: false });
      const tank = createUnit('tank', 'enemy', 1, 0, { attack: 7, armored: true, armorPiercing: true });

      const result = Combat.execute(soldier, tank, 0, 0);

      // Soldier does 4 / 5 = 0 damage to tank
      assertEqual(result.attackerDamage, 0);
      assertEqual(tank.health, 10);

      // Tank counter-attacks with full AP damage: 7
      assertEqual(result.defenderDamage, 7);
      assertEqual(soldier.health, 3);
    });

    runner.it('should simulate tank vs tank (AP vs armored)', () => {
      const tank1 = createUnit('tank1', 'player', 0, 0, { attack: 7, armored: true, armorPiercing: true });
      const tank2 = createUnit('tank2', 'enemy', 1, 0, { attack: 7, armored: true, armorPiercing: true });

      const result = Combat.execute(tank1, tank2, 0, 0);

      // Both have AP, so armor doesn't help
      assertEqual(result.attackerDamage, 7);
      assertEqual(tank2.health, 3);

      // Counter: tank2 at 30% health, damage = floor(7 * 0.3) = 2
      assertEqual(result.defenderDamage, 2);
      assertEqual(tank1.health, 8);
    });
  });

  runner.describe('isAlive', () => {
    runner.it('should return true for unit with health > 0', () => {
      const unit = createUnit('u', 'player', 0, 0, { health: 1 });
      assert(unit.isAlive());
    });

    runner.it('should return false for unit with health = 0', () => {
      const unit = createUnit('u', 'player', 0, 0, { health: 0 });
      assert(!unit.isAlive());
    });
  });

  runner.describe('canTargetChassis', () => {
    runner.it('should return true when weapon has no restrictions', () => {
      const attacker = createUnit('a', 'player', 0, 0, { cannotTarget: [] });
      const defender = createUnit('d', 'enemy', 1, 0, { chassisId: 'airplane' });
      assert(Combat.canTargetChassis(attacker, defender));
    });

    runner.it('should return false when target chassis is in cannotTarget list', () => {
      const attacker = createUnit('a', 'player', 0, 0, { cannotTarget: ['airplane'] });
      const defender = createUnit('d', 'enemy', 1, 0, { chassisId: 'airplane' });
      assert(!Combat.canTargetChassis(attacker, defender));
    });

    runner.it('should return true when target chassis is not in cannotTarget list', () => {
      const attacker = createUnit('a', 'player', 0, 0, { cannotTarget: ['airplane'] });
      const defender = createUnit('d', 'enemy', 1, 0, { chassisId: 'foot' });
      assert(Combat.canTargetChassis(attacker, defender));
    });

    runner.it('should handle multiple chassis in cannotTarget list', () => {
      const attacker = createUnit('a', 'player', 0, 0, { cannotTarget: ['airplane', 'hover'] });
      const airplane = createUnit('d1', 'enemy', 1, 0, { chassisId: 'airplane' });
      const hover = createUnit('d2', 'enemy', 2, 0, { chassisId: 'hover' });
      const foot = createUnit('d3', 'enemy', 0, 1, { chassisId: 'foot' });

      assert(!Combat.canTargetChassis(attacker, airplane), 'Should not target airplane');
      assert(!Combat.canTargetChassis(attacker, hover), 'Should not target hover');
      assert(Combat.canTargetChassis(attacker, foot), 'Should target foot');
    });
  });

  runner.describe('getTargetsInRange (with chassis restrictions)', () => {
    runner.it('should exclude enemies with incompatible chassis', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 2, cannotTarget: ['airplane'] });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0, { chassisId: 'foot' }),
        createUnit('e2', 'enemy', 0, 1, { chassisId: 'airplane' }),
        createUnit('e3', 'enemy', 1, 1, { chassisId: 'treads' }),
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);

      assertEqual(targets.length, 2);
      assert(targets.some(t => t.id === 'e1'), 'Should include foot enemy');
      assert(!targets.some(t => t.id === 'e2'), 'Should exclude airplane enemy');
      assert(targets.some(t => t.id === 'e3'), 'Should include treads enemy');
    });

    runner.it('should include all enemies when no chassis restrictions', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 2, cannotTarget: [] });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0, { chassisId: 'foot' }),
        createUnit('e2', 'enemy', 0, 1, { chassisId: 'airplane' }),
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);

      assertEqual(targets.length, 2);
    });

    runner.it('should combine range and chassis restrictions', () => {
      const attacker = createUnit('a', 'player', 0, 0, { range: 1, cannotTarget: ['airplane'] });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0, { chassisId: 'foot' }),      // in range, targetable
        createUnit('e2', 'enemy', 0, 1, { chassisId: 'airplane' }), // in range, not targetable
        createUnit('e3', 'enemy', 2, 0, { chassisId: 'foot' }),      // out of range
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);

      assertEqual(targets.length, 1);
      assertEqual(targets[0]!.id, 'e1');
    });
  });

  runner.describe('applyTerrainDefense', () => {
    runner.it('should return full damage when terrain stars is 0', () => {
      const damage = Combat.applyTerrainDefense(10, 10, 0, false);
      assertEqual(damage, 10);
    });

    runner.it('should return full damage for flying units', () => {
      // Flying units don't get terrain defense
      const damage = Combat.applyTerrainDefense(10, 10, 4, true);
      assertEqual(damage, 10);
    });

    runner.it('should reduce damage by 10% for 1 star terrain at full HP', () => {
      // 1 star * (10/10) * 0.1 = 10% reduction
      // 10 * (1 - 0.1) = 9
      const damage = Combat.applyTerrainDefense(10, 10, 1, false);
      assertEqual(damage, 9);
    });

    runner.it('should reduce damage by 20% for 2 star terrain at full HP', () => {
      // 2 stars * (10/10) * 0.1 = 20% reduction
      // 10 * (1 - 0.2) = 8
      const damage = Combat.applyTerrainDefense(10, 10, 2, false);
      assertEqual(damage, 8);
    });

    runner.it('should reduce damage by 40% for 4 star terrain at full HP', () => {
      // 4 stars * (10/10) * 0.1 = 40% reduction
      // 10 * (1 - 0.4) = 6
      const damage = Combat.applyTerrainDefense(10, 10, 4, false);
      assertEqual(damage, 6);
    });

    runner.it('should scale defense with defender HP', () => {
      // 2 stars * (5/10) * 0.1 = 10% reduction (not 20%)
      // 10 * (1 - 0.1) = 9
      const damage = Combat.applyTerrainDefense(10, 5, 2, false);
      assertEqual(damage, 9);
    });

    runner.it('should floor the final damage', () => {
      // 7 damage, 2 stars, full HP: 7 * (1 - 0.2) = 5.6 -> 5
      const damage = Combat.applyTerrainDefense(7, 10, 2, false);
      assertEqual(damage, 5);
    });
  });

  runner.describe('calculateExpectedDamage (with terrain)', () => {
    runner.it('should apply terrain defense after armor reduction', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10 });
      const defender = createUnit('d', 'enemy', 1, 0);

      // No terrain: 10 damage
      const damageNoTerrain = Combat.calculateExpectedDamage(attacker, defender, 0);
      assertEqual(damageNoTerrain, 10);

      // With 2 stars terrain: 10 * (1 - 0.2) = 8
      const damageWithTerrain = Combat.calculateExpectedDamage(attacker, defender, 2);
      assertEqual(damageWithTerrain, 8);
    });

    runner.it('should not apply terrain defense to flying defenders', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10 });
      const flyingDefender = createUnit('d', 'enemy', 1, 0, { flying: true, chassisId: 'airplane' });

      // With 4 stars terrain but flying: still 10 damage
      const damage = Combat.calculateExpectedDamage(attacker, flyingDefender, 4);
      assertEqual(damage, 10);
    });

    runner.it('should apply both armor and terrain defense', () => {
      // Non-AP attacker vs armored defender on terrain
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10, armorPiercing: false });
      const defender = createUnit('d', 'enemy', 1, 0, { armored: true });

      // Armor first: 10 / 5 = 2
      // Then 2 stars terrain: 2 * (1 - 0.2) = 1.6 -> 1
      const damage = Combat.calculateExpectedDamage(attacker, defender, 2);
      assertEqual(damage, 1);
    });
  });

  runner.describe('execute (with terrain)', () => {
    runner.it('should apply terrain defense to defender', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10, range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 5, range: 1 });

      // Defender on 2-star terrain (woods)
      const result = Combat.execute(attacker, defender, 0, 0, 2, 0);

      // 10 * (1 - 0.2) = 8 damage to defender
      assertEqual(result.attackerDamage, 8);
      assertEqual(defender.health, 2);
    });

    runner.it('should apply terrain defense to attacker on counter-attack', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 3, range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { attack: 10, range: 1 });

      // Attacker on 2-star terrain (woods)
      const result = Combat.execute(attacker, defender, 0, 0, 0, 2);

      // Attacker deals 3 damage (no terrain defense for defender)
      assertEqual(result.attackerDamage, 3);
      assertEqual(defender.health, 7);

      // Defender counter-attacks: 10 * 0.7 = 7, then terrain: 7 * (1 - 0.2) = 5.6 -> 5
      assertEqual(result.defenderDamage, 5);
      assertEqual(attacker.health, 5);
    });

    runner.it('should not apply terrain defense to flying units', () => {
      const attacker = createUnit('a', 'player', 0, 0, { attack: 10, range: 1 });
      const flyingDefender = createUnit('d', 'enemy', 1, 0, { attack: 5, range: 1, flying: true, chassisId: 'airplane' });

      // Flying defender on 4-star terrain (mountain) - should get no defense
      const result = Combat.execute(attacker, flyingDefender, 0, 0, 4, 0);

      assertEqual(result.attackerDamage, 10);
      assertEqual(flyingDefender.health, 0);
      assertEqual(result.defenderDied, true);
    });
  });

  runner.describe('execute (with chassis restrictions)', () => {
    runner.it('should not allow counter-attack when defender cannot target attacker chassis', () => {
      // Airplane attacks soldier - soldier cannot counter (MG can't target airplane)
      const airplane = createUnit('airplane', 'player', 0, 0, {
        attack: 5,
        chassisId: 'airplane',
        cannotTarget: [],  // Heavy MG can target all
      });
      const soldier = createUnit('soldier', 'enemy', 1, 0, {
        attack: 4,
        chassisId: 'foot',
        cannotTarget: ['airplane'],  // MG cannot target airplane
      });

      const result = Combat.execute(airplane, soldier, 0, 0);

      assertEqual(result.attackerDamage, 5);
      assertEqual(result.defenderDamage, 0);  // No counter-attack!
      assertEqual(soldier.health, 5);
      assertEqual(airplane.health, 10);  // Airplane takes no damage
    });

    runner.it('should allow counter-attack when defender can target attacker chassis', () => {
      // Ground unit attacks ground unit - normal counter-attack
      const tank = createUnit('tank', 'player', 0, 0, {
        attack: 7,
        chassisId: 'treads',
        cannotTarget: ['airplane'],
      });
      const soldier = createUnit('soldier', 'enemy', 1, 0, {
        attack: 4,
        chassisId: 'foot',
        cannotTarget: ['airplane'],
      });

      const result = Combat.execute(tank, soldier, 0, 0);

      assertEqual(result.attackerDamage, 7);
      // Soldier at 3 HP (30%), counter damage = floor(4 * 0.3) = 1
      assertEqual(result.defenderDamage, 1);
      assertEqual(soldier.health, 3);
      assertEqual(tank.health, 9);
    });
  });
});

export default runner;
