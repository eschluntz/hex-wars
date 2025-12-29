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
    health?: number;
    armored?: boolean;
    armorPiercing?: boolean;
  } = {}
) {
  const unit = new Unit(id, team, q, r, {
    attack: stats.attack ?? 5,
    range: stats.range ?? 1,
    armored: stats.armored ?? false,
    armorPiercing: stats.armorPiercing ?? false,
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
});

export default runner;
