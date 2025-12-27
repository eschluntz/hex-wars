// ============================================================================
// HEX DOMINION - Game Statistics Tests
// ============================================================================

import { TestRunner, assertEqual, assert } from './framework.js';
import { GameStats } from '../src/stats.js';

const runner = new TestRunner();

runner.describe('GameStats', () => {

  runner.describe('initialization', () => {

    runner.it('should initialize with empty stats for each team', () => {
      const stats = new GameStats(['player', 'enemy']);
      const playerStats = stats.getTeamStats('player');
      const enemyStats = stats.getTeamStats('enemy');

      assertEqual(playerStats.snapshots.length, 0);
      assertEqual(playerStats.totalUnitsKilled, 0);
      assertEqual(playerStats.totalUnitsLost, 0);
      assertEqual(playerStats.totalBuildingsCaptured, 0);

      assertEqual(enemyStats.snapshots.length, 0);
    });

  });

  runner.describe('recordUnitKilled', () => {

    runner.it('should increment kills for killer and losses for victim', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordUnitKilled('player', 'enemy');

      assertEqual(stats.getTeamStats('player').totalUnitsKilled, 1);
      assertEqual(stats.getTeamStats('enemy').totalUnitsLost, 1);
    });

    runner.it('should accumulate multiple kills', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordUnitKilled('player', 'enemy');
      stats.recordUnitKilled('player', 'enemy');
      stats.recordUnitKilled('enemy', 'player');

      assertEqual(stats.getTeamStats('player').totalUnitsKilled, 2);
      assertEqual(stats.getTeamStats('player').totalUnitsLost, 1);
      assertEqual(stats.getTeamStats('enemy').totalUnitsKilled, 1);
      assertEqual(stats.getTeamStats('enemy').totalUnitsLost, 2);
    });

  });

  runner.describe('recordBuildingCaptured', () => {

    runner.it('should increment captures for team', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordBuildingCaptured('player');
      stats.recordBuildingCaptured('player');

      assertEqual(stats.getTeamStats('player').totalBuildingsCaptured, 2);
      assertEqual(stats.getTeamStats('enemy').totalBuildingsCaptured, 0);
    });

  });

  runner.describe('recordIncome', () => {

    runner.it('should accumulate income totals', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordIncome('player', 1000, 2);
      stats.recordIncome('player', 500, 1);

      assertEqual(stats.getTeamStats('player').totalFundsCollected, 1500);
      assertEqual(stats.getTeamStats('player').totalScienceCollected, 3);
    });

  });

  runner.describe('endTurn', () => {

    runner.it('should create snapshot with turn data', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordUnitKilled('player', 'enemy'); // Player killed an enemy
      stats.recordIncome('player', 1000, 1);
      stats.endTurn(1, 'player', 5, 3, 2000, 2);

      const teamStats = stats.getTeamStats('player');
      assertEqual(teamStats.snapshots.length, 1);

      const snapshot = teamStats.snapshots[0]!;
      assertEqual(snapshot.turn, 1);
      assertEqual(snapshot.unitsKilled, 1);
      assertEqual(snapshot.fundsCollected, 1000);
      assertEqual(snapshot.scienceCollected, 1);
      assertEqual(snapshot.totalUnits, 5);
      assertEqual(snapshot.totalBuildings, 3);
      assertEqual(snapshot.totalFunds, 2000);
      assertEqual(snapshot.totalScience, 2);
    });

    runner.it('should reset per-turn tracking after snapshot', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordUnitKilled('player', 'enemy');
      stats.endTurn(1, 'player', 5, 3, 2000, 2);

      // Second turn - no kills
      stats.endTurn(2, 'player', 5, 3, 3000, 3);

      const teamStats = stats.getTeamStats('player');
      assertEqual(teamStats.snapshots.length, 2);
      assertEqual(teamStats.snapshots[0]!.unitsKilled, 1);
      assertEqual(teamStats.snapshots[1]!.unitsKilled, 0); // Reset for new turn
    });

    runner.it('should preserve cumulative totals across turns', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordUnitKilled('player', 'enemy');
      stats.endTurn(1, 'player', 5, 3, 1000, 1);

      stats.recordUnitKilled('player', 'enemy');
      stats.recordUnitKilled('player', 'enemy');
      stats.endTurn(2, 'player', 5, 3, 2000, 2);

      assertEqual(stats.getTeamStats('player').totalUnitsKilled, 3);
    });

  });

  runner.describe('getAllStats', () => {

    runner.it('should return map of all team stats', () => {
      const stats = new GameStats(['player', 'enemy']);

      stats.recordUnitKilled('player', 'enemy');
      stats.recordBuildingCaptured('enemy');

      const allStats = stats.getAllStats();

      assert(allStats.has('player'));
      assert(allStats.has('enemy'));
      assertEqual(allStats.get('player')!.totalUnitsKilled, 1);
      assertEqual(allStats.get('enemy')!.totalBuildingsCaptured, 1);
    });

  });

});

export default runner;
