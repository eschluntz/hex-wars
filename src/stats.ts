// ============================================================================
// HEX DOMINION - Game Statistics Tracking
// ============================================================================

export interface TurnSnapshot {
  turn: number;
  unitsKilled: number;      // Units this team killed this turn
  unitsLost: number;        // Units this team lost this turn
  buildingsCaptured: number; // Buildings captured this turn
  fundsCollected: number;   // Income collected this turn
  scienceCollected: number; // Science collected this turn
  totalUnits: number;       // Total units at end of turn
  totalBuildings: number;   // Total buildings owned at end of turn
  totalFunds: number;       // Current fund balance
  totalScience: number;     // Current science balance
}

export interface TeamStats {
  snapshots: TurnSnapshot[];
  // Cumulative totals
  totalUnitsKilled: number;
  totalUnitsLost: number;
  totalBuildingsCaptured: number;
  totalFundsCollected: number;
  totalScienceCollected: number;
}

export class GameStats {
  private stats: Map<string, TeamStats> = new Map();
  private currentTurnStats: Map<string, Partial<TurnSnapshot>> = new Map();

  constructor(teams: string[]) {
    for (const team of teams) {
      this.stats.set(team, {
        snapshots: [],
        totalUnitsKilled: 0,
        totalUnitsLost: 0,
        totalBuildingsCaptured: 0,
        totalFundsCollected: 0,
        totalScienceCollected: 0
      });
      this.currentTurnStats.set(team, {
        unitsKilled: 0,
        unitsLost: 0,
        buildingsCaptured: 0,
        fundsCollected: 0,
        scienceCollected: 0
      });
    }
  }

  recordUnitKilled(killerTeam: string, victimTeam: string): void {
    const killerCurrent = this.currentTurnStats.get(killerTeam)!;
    killerCurrent.unitsKilled = (killerCurrent.unitsKilled ?? 0) + 1;

    const victimCurrent = this.currentTurnStats.get(victimTeam)!;
    victimCurrent.unitsLost = (victimCurrent.unitsLost ?? 0) + 1;

    this.stats.get(killerTeam)!.totalUnitsKilled++;
    this.stats.get(victimTeam)!.totalUnitsLost++;
  }

  recordBuildingCaptured(team: string): void {
    const current = this.currentTurnStats.get(team)!;
    current.buildingsCaptured = (current.buildingsCaptured ?? 0) + 1;
    this.stats.get(team)!.totalBuildingsCaptured++;
  }

  recordIncome(team: string, funds: number, science: number): void {
    const current = this.currentTurnStats.get(team)!;
    current.fundsCollected = (current.fundsCollected ?? 0) + funds;
    current.scienceCollected = (current.scienceCollected ?? 0) + science;
    this.stats.get(team)!.totalFundsCollected += funds;
    this.stats.get(team)!.totalScienceCollected += science;
  }

  endTurn(
    turn: number,
    team: string,
    totalUnits: number,
    totalBuildings: number,
    totalFunds: number,
    totalScience: number
  ): void {
    const current = this.currentTurnStats.get(team)!;
    const snapshot: TurnSnapshot = {
      turn,
      unitsKilled: current.unitsKilled ?? 0,
      unitsLost: current.unitsLost ?? 0,
      buildingsCaptured: current.buildingsCaptured ?? 0,
      fundsCollected: current.fundsCollected ?? 0,
      scienceCollected: current.scienceCollected ?? 0,
      totalUnits,
      totalBuildings,
      totalFunds,
      totalScience
    };

    this.stats.get(team)!.snapshots.push(snapshot);

    // Reset current turn stats
    this.currentTurnStats.set(team, {
      unitsKilled: 0,
      unitsLost: 0,
      buildingsCaptured: 0,
      fundsCollected: 0,
      scienceCollected: 0
    });
  }

  getTeamStats(team: string): TeamStats {
    return this.stats.get(team)!;
  }

  getAllStats(): Map<string, TeamStats> {
    return this.stats;
  }
}
