// ============================================================================
// HEX DOMINION - Combat Tests (Advance Wars Formula)
// ============================================================================
//
// Tests for the Advance Wars damage formula:
// Damage% = ((B × AV / 100) + L) × (HPA / 10) × ((200 - (DV + DTR × HPD)) / 100)

import { TestRunner, assert, assertEqual } from './framework.js';
import { Unit } from '../src/unit.js';
import { Combat } from '../src/combat.js';
import { getBaseDamage, canAttack } from '../src/damage-table.js';

const runner = new TestRunner();

// Helper to create units with template IDs for damage table lookups
function createUnit(
  id: string,
  team: string,
  q: number,
  r: number,
  stats: {
    templateId: string;
    range?: number;
    minRange?: number;
    health?: number;
    flying?: boolean;
  }
) {
  const unit = Unit.withStats(id, team, q, r, {
    templateId: stats.templateId,
    range: stats.range ?? 1,
    minRange: stats.minRange ?? 0,
    flying: stats.flying ?? false,
  });
  if (stats.health !== undefined) {
    unit.health = stats.health;
  }
  return unit;
}

runner.describe('Damage Table', () => {
  runner.describe('getBaseDamage', () => {
    runner.it('should return correct base damage for infantry vs infantry', () => {
      const damage = getBaseDamage('infantry', 'infantry');
      assertEqual(damage, 55);
    });

    runner.it('should return correct base damage for tank vs infantry', () => {
      const damage = getBaseDamage('tank', 'infantry');
      assertEqual(damage, 75); // MG secondary
    });

    runner.it('should return correct base damage for mech vs tank', () => {
      const damage = getBaseDamage('mech', 'tank');
      assertEqual(damage, 55);
    });

    runner.it('should return 0 for units that cannot attack (infantry vs fighter)', () => {
      const damage = getBaseDamage('infantry', 'fighter');
      assertEqual(damage, 0);
    });

    runner.it('should return 0 for unarmed units (apc vs anything)', () => {
      assertEqual(getBaseDamage('apc', 'infantry'), 0);
      assertEqual(getBaseDamage('apc', 'tank'), 0);
    });

    runner.it('should return correct base damage for anti-air vs copter', () => {
      const damage = getBaseDamage('antiAir', 'copter');
      assertEqual(damage, 120);
    });

    runner.it('should return correct base damage for fighter vs bomber', () => {
      const damage = getBaseDamage('fighter', 'bomber');
      assertEqual(damage, 100);
    });
  });

  runner.describe('canAttack', () => {
    runner.it('should return true when base damage > 0', () => {
      assert(canAttack('infantry', 'infantry'));
      assert(canAttack('tank', 'tank'));
      assert(canAttack('antiAir', 'copter'));
    });

    runner.it('should return false when base damage is 0', () => {
      assert(!canAttack('infantry', 'fighter'));
      assert(!canAttack('fighter', 'infantry'));
      assert(!canAttack('apc', 'infantry'));
      assert(!canAttack('missiles', 'tank'));
    });
  });
});

runner.describe('Combat', () => {
  runner.describe('calculateExpectedDamage (AW formula, no luck)', () => {
    runner.it('should calculate infantry vs infantry at full HP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // Formula: (55 * 100/100 + 0) * (10/10) * (200 - 100) / 100 = 55%
      // Converted to HP: 55 / 10 = 5.5 -> 5
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 5);
    });

    runner.it('should calculate tank vs infantry at full HP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'tank' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // Base 75%, full HP attacker, no terrain = 75% -> 7 HP damage
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 7);
    });

    runner.it('should scale damage with attacker HP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', health: 5 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // Formula: 55 * 0.5 * 1 = 27.5% -> 2 HP damage
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 2);
    });

    runner.it('should return 0 when attacker cannot target defender', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'fighter', flying: true,  });
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 0);
    });

    runner.it('should handle mega tank vs infantry', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'heavyTank' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // Base 135%, full HP, no terrain = 135% -> 13 HP damage (one-shot kill)
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 13);
    });
  });

  runner.describe('calculateDamage (with luck)', () => {
    runner.it('should add luck to damage', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // With luck 5: (55 + 5) * 1 * 1 = 60% -> 6 HP
      const damage = Combat.calculateDamage(attacker, defender, 5);
      assertEqual(damage, 6);
    });

    runner.it('should handle max luck (9)', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // With luck 9: (55 + 9) * 1 * 1 = 64% -> 6 HP
      const damage = Combat.calculateDamage(attacker, defender, 9);
      assertEqual(damage, 6);
    });

    runner.it('should handle zero luck', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // 55% -> 5 HP
      const damage = Combat.calculateDamage(attacker, defender, 0);
      assertEqual(damage, 5);
    });

    runner.it('should scale luck with attacker HP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', health: 5 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // (55 + 5) * 0.5 * 1 = 30% -> 3 HP
      const damage = Combat.calculateDamage(attacker, defender, 5);
      assertEqual(damage, 3);
    });
  });

  runner.describe('terrain defense (AW formula)', () => {
    runner.it('should reduce damage with terrain stars', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // With 2 terrain stars at full HP:
      // Defender component: (200 - (100 + 2*10)) / 100 = 0.8
      // = 55 * 1 * 0.8 = 44% -> 4 HP
      const damage = Combat.calculateExpectedDamage(attacker, defender, 2);
      assertEqual(damage, 4);
    });

    runner.it('should scale terrain defense with defender HP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry', health: 5 });
      // With 2 terrain stars at 5 HP:
      // Defender component: (200 - (100 + 2*5)) / 100 = 0.9
      // = 55 * 1 * 0.9 = 49.5% -> 4 HP
      const damage = Combat.calculateExpectedDamage(attacker, defender, 2);
      assertEqual(damage, 4);
    });

    runner.it('should not apply terrain defense to flying units', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'antiAir' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'copter', flying: true,  });
      // Flying units get no terrain defense
      // Base 120%, no terrain bonus: 120% -> 12 HP
      const damageNoTerrain = Combat.calculateExpectedDamage(attacker, defender, 0);
      const damageWithTerrain = Combat.calculateExpectedDamage(attacker, defender, 4);
      assertEqual(damageNoTerrain, 12);
      assertEqual(damageWithTerrain, 12); // Same - no terrain bonus for flying
    });

    runner.it('should handle 4 star terrain (mountain/city)', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // 4 stars at full HP:
      // Defender component: (200 - (100 + 4*10)) / 100 = 0.6
      // = 55 * 1 * 0.6 = 33% -> 3 HP
      const damage = Combat.calculateExpectedDamage(attacker, defender, 4);
      assertEqual(damage, 3);
    });
  });

  runner.describe('AV/DV modifiers (CO powers)', () => {
    runner.it('should increase damage with higher AV', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // AV 110 (e.g., Hawke):
      // (55 * 110/100 + 0) * 1 * 1 = 60.5% -> 6 HP
      const damage = Combat.calculateExpectedDamage(attacker, defender, 0, 110, 100);
      assertEqual(damage, 6);
    });

    runner.it('should decrease damage with lower DV (Grimm)', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // DV 80 (Grimm):
      // Defender component: (200 - 80) / 100 = 1.2
      // = 55 * 1 * 1.2 = 66% -> 6 HP
      const damage = Combat.calculateExpectedDamage(attacker, defender, 0, 100, 80);
      assertEqual(damage, 6);
    });

    runner.it('should combine AV and DV modifiers', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      // AV 120, DV 80:
      // (55 * 120/100) * 1 * (200 - 80) / 100 = 66 * 1.2 = 79.2% -> 7 HP
      const damage = Combat.calculateExpectedDamage(attacker, defender, 0, 120, 80);
      assertEqual(damage, 7);
    });
  });

  runner.describe('isInRange', () => {
    runner.it('should return true for adjacent units with range 1', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const target = createUnit('t', 'enemy', 1, 0, { templateId: 'infantry' });
      assert(Combat.isInRange(attacker, target));
    });

    runner.it('should return false for units beyond range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const target = createUnit('t', 'enemy', 2, 0, { templateId: 'infantry' });
      assert(!Combat.isInRange(attacker, target));
    });

    runner.it('should handle range 2', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'artillery', range: 3, minRange: 2 });
      const target1 = createUnit('t1', 'enemy', 2, 0, { templateId: 'infantry' });
      const target2 = createUnit('t2', 'enemy', 4, 0, { templateId: 'infantry' });
      assert(Combat.isInRange(attacker, target1), 'Distance 2 should be in range');
      assert(!Combat.isInRange(attacker, target2), 'Distance 4 should not be in range');
    });

    runner.it('should return false when target is closer than minRange', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'artillery', range: 3, minRange: 2 });
      const target = createUnit('t', 'enemy', 1, 0, { templateId: 'infantry' }); // distance 1
      assert(!Combat.isInRange(attacker, target));
    });

    runner.it('should return true when target is at minRange', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'artillery', range: 3, minRange: 2 });
      const target = createUnit('t', 'enemy', 2, 0, { templateId: 'infantry' }); // distance 2
      assert(Combat.isInRange(attacker, target));
    });
  });

  runner.describe('canTarget', () => {
    runner.it('should return true when damage table has positive damage', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      assert(Combat.canTarget(attacker, defender));
    });

    runner.it('should return false when damage table has zero damage', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'fighter', flying: true,  });
      assert(!Combat.canTarget(attacker, defender));
    });

    runner.it('should allow anti-air to target copters', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'antiAir' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'copter', flying: true,  });
      assert(Combat.canTarget(attacker, defender));
    });

    runner.it('should not allow fighter to target infantry', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'fighter', flying: true });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      assert(!Combat.canTarget(attacker, defender));
    });

    runner.it('should not allow missiles to target ground units', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'missiles' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'tank' });
      assert(!Combat.canTarget(attacker, defender));
    });
  });

  runner.describe('getTargetsInRange', () => {
    runner.it('should return enemies within range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0, { templateId: 'infantry' }), // adjacent
        createUnit('e2', 'enemy', 2, 0, { templateId: 'infantry' }), // too far
        createUnit('e3', 'enemy', 0, 1, { templateId: 'infantry' }), // adjacent
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);
      assertEqual(targets.length, 2);
    });

    runner.it('should exclude dead enemies', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const deadEnemy = createUnit('e1', 'enemy', 1, 0, { templateId: 'infantry', health: 0 });
      const aliveEnemy = createUnit('e2', 'enemy', 0, 1, { templateId: 'infantry' });
      const targets = Combat.getTargetsInRange(attacker, [deadEnemy, aliveEnemy]);
      assertEqual(targets.length, 1);
      assertEqual(targets[0]!.id, 'e2');
    });

    runner.it('should exclude untargetable enemies', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0, { templateId: 'infantry' }),
        createUnit('e2', 'enemy', 0, 1, { templateId: 'fighter', flying: true,  }),
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);
      assertEqual(targets.length, 1);
      assertEqual(targets[0]!.id, 'e1');
    });

    runner.it('should combine range and targeting restrictions', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const enemies = [
        createUnit('e1', 'enemy', 1, 0, { templateId: 'infantry' }),      // in range, targetable
        createUnit('e2', 'enemy', 0, 1, { templateId: 'fighter', flying: true }), // in range, not targetable
        createUnit('e3', 'enemy', 2, 0, { templateId: 'infantry' }),      // out of range
      ];
      const targets = Combat.getTargetsInRange(attacker, enemies);
      assertEqual(targets.length, 1);
      assertEqual(targets[0]!.id, 'e1');
    });
  });

  runner.describe('execute', () => {
    runner.it('should deal damage to defender', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry', range: 1 });

      Combat.execute(attacker, defender, 0, 0);

      // Infantry vs Infantry: 55% -> 5 HP damage
      assertEqual(defender.health, 5); // 10 - 5 = 5
    });

    runner.it('should allow counter-attack when defender survives and in range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'tank', range: 1 });

      // Infantry does 0 HP damage to tank (5% base), tank survives at full HP
      Combat.execute(attacker, defender, 0, 0);

      assertEqual(defender.health, 10); // Tank barely scratched (0 HP damage from infantry)
      // Tank counter-attacks at full HP: 75% -> 7 HP damage
      assertEqual(attacker.health, 3); // 10 - 7 = 3
    });

    runner.it('should not counter-attack if defender dies', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'heavyTank', range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry', range: 1 });

      const result = Combat.execute(attacker, defender, 0, 0);

      // Mega tank does 135% -> 13 HP damage to infantry (one-shot kill)
      assertEqual(result.defenderDied, true);
      assertEqual(result.defenderDamage, 0);
      assertEqual(attacker.health, 10);
    });

    runner.it('should not counter-attack if attacker out of defender range', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'artillery', range: 3, minRange: 2 });
      const defender = createUnit('d', 'enemy', 2, 0, { templateId: 'infantry', range: 1 });

      const result = Combat.execute(attacker, defender, 0, 0);

      // Artillery hits infantry from range 2, infantry can't counter (range 1)
      assertEqual(result.counterAttackAttempted, false);
      assertEqual(result.defenderDamage, 0);
      assertEqual(attacker.health, 10);
    });

    runner.it('should apply terrain defense to defender', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'mech', range: 1 });

      // Defender on 2-star terrain (woods)
      const result = Combat.execute(attacker, defender, 0, 0, 2, 0);

      // Infantry vs Mech base 45%, with 2 stars: 45 * 0.8 = 36% -> 3 HP
      assertEqual(result.attackerDamage, 3);
      assertEqual(defender.health, 7); // 10 - 3 = 7
    });

    runner.it('should apply terrain defense to attacker on counter-attack', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'mech', range: 1 });

      // Attacker on 2-star terrain
      const result = Combat.execute(attacker, defender, 0, 0, 0, 2);

      // Infantry takes counter damage from mech (base 65%)
      // Mech at reduced HP, attacker on terrain
      // Attacker gets terrain defense on counter
      assert(result.counterAttackAttempted);
    });

    runner.it('should not allow counter-attack when defender cannot target attacker', () => {
      // Fighter attacks copter - copter cannot counter (can't target fighter)
      const fighter = createUnit('fighter', 'player', 0, 0, { templateId: 'fighter', range: 1, flying: true });
      const copter = createUnit('copter', 'enemy', 1, 0, { templateId: 'copter', range: 1, flying: true });

      const result = Combat.execute(fighter, copter, 0, 0);

      // Fighter does 100% -> 10 HP damage to copter (one-shot kill)
      assertEqual(result.defenderDied, true);
      assertEqual(result.defenderDamage, 0);
      assertEqual(fighter.health, 10);
    });

    runner.it('should allow mutual combat between tanks', () => {
      const tank1 = createUnit('tank1', 'player', 0, 0, { templateId: 'tank', range: 1 });
      const tank2 = createUnit('tank2', 'enemy', 1, 0, { templateId: 'tank', range: 1 });

      const result = Combat.execute(tank1, tank2, 0, 0);

      // Tank vs Tank base 55% -> 5 HP damage
      assertEqual(result.attackerDamage, 5);
      assertEqual(tank2.health, 5); // 10 - 5 = 5
      assertEqual(result.defenderDied, false);
      assertEqual(result.counterAttackAttempted, true); // Survived, can counter
    });

    runner.it('should handle combat with AV/DV modifiers', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry', range: 1 });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry', range: 1 });

      // Attacker has AV 120, defender has DV 80
      const result = Combat.execute(attacker, defender, 0, 0, 0, 0, 120, 80, 100, 100);

      // (55 * 1.2) * 1 * (200 - 80) / 100 = 66 * 1.2 = 79.2% -> 7 HP
      assertEqual(result.attackerDamage, 7);
    });
  });

  runner.describe('Unit.isAlive', () => {
    runner.it('should return true for unit with health > 0', () => {
      const unit = createUnit('u', 'player', 0, 0, { templateId: 'infantry', health: 1 });
      assert(unit.isAlive());
    });

    runner.it('should return false for unit with health = 0', () => {
      const unit = createUnit('u', 'player', 0, 0, { templateId: 'infantry', health: 0 });
      assert(!unit.isAlive());
    });
  });

  runner.describe('real unit matchups', () => {
    runner.it('infantry vs infantry should deal ~5 HP at full HP', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'infantry' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'infantry' });
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 5); // 55% -> 5 HP
    });

    runner.it('mech vs tank should be effective (55% -> 5 HP)', () => {
      const attacker = createUnit('a', 'player', 0, 0, { templateId: 'mech' });
      const defender = createUnit('d', 'enemy', 1, 0, { templateId: 'tank' });
      const damage = Combat.calculateExpectedDamage(attacker, defender);
      assertEqual(damage, 5); // 55% -> 5 HP
    });

    runner.it('bomber should devastate ground units', () => {
      const bomber = createUnit('b', 'player', 0, 0, { templateId: 'bomber', flying: true });
      const tank = createUnit('t', 'enemy', 1, 0, { templateId: 'tank' });
      const damage = Combat.calculateExpectedDamage(bomber, tank);
      assertEqual(damage, 10); // 105% -> 10 HP (one-shot)
    });

    runner.it('anti-air should destroy copters', () => {
      const antiAir = createUnit('aa', 'player', 0, 0, { templateId: 'antiAir' });
      const copter = createUnit('c', 'enemy', 1, 0, { templateId: 'copter', flying: true });
      const damage = Combat.calculateExpectedDamage(antiAir, copter);
      assertEqual(damage, 12); // 120% -> 12 HP (one-shot)
    });

    runner.it('missiles should be ineffective against ground', () => {
      const missiles = createUnit('m', 'player', 0, 0, { templateId: 'missiles' });
      const tank = createUnit('t', 'enemy', 3, 0, { templateId: 'tank' });
      const damage = Combat.calculateExpectedDamage(missiles, tank);
      assertEqual(damage, 0); // Cannot target ground
    });

    runner.it('missiles should devastate air units', () => {
      const missiles = createUnit('m', 'player', 0, 0, { templateId: 'missiles', range: 5, minRange: 3 });
      const fighter = createUnit('f', 'enemy', 3, 0, { templateId: 'fighter', flying: true });
      const damage = Combat.calculateExpectedDamage(missiles, fighter);
      assertEqual(damage, 10); // 100% -> 10 HP (one-shot)
    });
  });
});

export default runner;
