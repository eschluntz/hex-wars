// ============================================================================
// HEX DOMINION - Resources Module
// ============================================================================

import { type Building, BUILDING_INCOME } from './building.js';

export interface TeamResources {
  funds: number;
  science: number;
}

export class ResourceManager {
  private resources: Map<string, TeamResources> = new Map();

  constructor(teams: string[]) {
    for (const team of teams) {
      this.resources.set(team, { funds: 0, science: 0 });
    }
  }

  getResources(team: string): TeamResources {
    return this.resources.get(team)!;
  }

  addFunds(team: string, amount: number): void {
    const res = this.resources.get(team)!;
    res.funds += amount;
  }

  addScience(team: string, amount: number): void {
    const res = this.resources.get(team)!;
    res.science += amount;
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

  collectIncome(team: string, buildings: Building[]): { funds: number; science: number } {
    let totalFunds = 0;
    let totalScience = 0;

    for (const building of buildings) {
      if (building.owner === team) {
        const income = BUILDING_INCOME[building.type];
        totalFunds += income.funds;
        totalScience += income.science;
      }
    }

    this.addFunds(team, totalFunds);
    this.addScience(team, totalScience);

    return { funds: totalFunds, science: totalScience };
  }
}
