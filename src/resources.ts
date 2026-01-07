// ============================================================================
// HEX DOMINION - Resources Module
// ============================================================================

import { type Building, BUILDING_INCOME } from './building.js';

export interface TeamResources {
  funds: number;
}

export class ResourceManager {
  private resources: Map<string, TeamResources> = new Map();

  constructor(teams: string[]) {
    for (const team of teams) {
      this.resources.set(team, { funds: 0 });
    }
  }

  getResources(team: string): TeamResources {
    return this.resources.get(team)!;
  }

  addFunds(team: string, amount: number): void {
    const res = this.resources.get(team)!;
    res.funds += amount;
  }

  spendFunds(team: string, amount: number): boolean {
    const res = this.resources.get(team)!;
    if (res.funds >= amount) {
      res.funds -= amount;
      return true;
    }
    return false;
  }

  canAfford(team: string, amount: number): boolean {
    return this.resources.get(team)!.funds >= amount;
  }

  collectIncome(team: string, buildings: Building[], incomeMultiplier: number = 1.0): { funds: number } {
    let totalFunds = 0;

    for (const building of buildings) {
      if (building.owner === team) {
        const income = BUILDING_INCOME[building.type];
        totalFunds += income.funds;
      }
    }

    // Apply income multiplier (from campaign upgrades)
    totalFunds = Math.floor(totalFunds * incomeMultiplier);

    this.addFunds(team, totalFunds);

    return { funds: totalFunds };
  }
}
