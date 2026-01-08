// ============================================================================
// HEX DOMINION - Battle Score Calculation
// ============================================================================

export interface BattleScoreBreakdown {
  power: number;      // % of enemy units destroyed × 5000
  defense: number;    // % of my units survived × 5000
  control: number;    // % of contestable buildings owned × 5000
  speed: number;      // min(1, parTurns / actualTurns) × 5000
  totalScore: number; // sum of all components (max 20000)
  isVictory: boolean;
}

const MAX_COMPONENT_SCORE = 5000;

/**
 * Calculate battle score based on 4 components:
 * - Power: % of enemy units destroyed
 * - Defense: % of my units that survived
 * - Control: % of non-neutral buildings owned at end
 * - Speed: par turns / actual turns (capped at 100%)
 *
 * Each component is worth up to 5000 points, for a max of 20000.
 * Defeat always returns 0.
 */
export function calculateBattleScore(
  enemyUnitsKilled: number,
  enemyUnitsDeployed: number,
  myUnitsSurviving: number,
  myUnitsDeployed: number,
  myBuildingsEnd: number,
  enemyBuildingsEnd: number,
  turnsTaken: number,
  parTurns: number,
  isVictory: boolean
): BattleScoreBreakdown {
  if (!isVictory) {
    return { power: 0, defense: 0, control: 0, speed: 0, totalScore: 0, isVictory: false };
  }

  // Power: % of enemy units destroyed (if no enemies deployed, 100%)
  const powerRatio = enemyUnitsDeployed > 0 ? enemyUnitsKilled / enemyUnitsDeployed : 1;
  const power = Math.round(Math.min(1, powerRatio) * MAX_COMPONENT_SCORE);

  // Defense: % of my units that survived (if none deployed, 100%)
  const defenseRatio = myUnitsDeployed > 0 ? myUnitsSurviving / myUnitsDeployed : 1;
  const defense = Math.round(Math.min(1, defenseRatio) * MAX_COMPONENT_SCORE);

  // Control: % of non-neutral buildings owned (if all neutral, 100%)
  const totalContestable = myBuildingsEnd + enemyBuildingsEnd;
  const controlRatio = totalContestable > 0 ? myBuildingsEnd / totalContestable : 1;
  const control = Math.round(Math.min(1, controlRatio) * MAX_COMPONENT_SCORE);

  // Speed: par / actual, capped at 100%
  const speedRatio = parTurns / Math.max(1, turnsTaken);
  const speed = Math.round(Math.min(1, speedRatio) * MAX_COMPONENT_SCORE);

  return {
    power,
    defense,
    control,
    speed,
    totalScore: power + defense + control + speed,
    isVictory: true,
  };
}
