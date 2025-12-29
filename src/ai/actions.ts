// ============================================================================
// HEX DOMINION - AI Actions
// ============================================================================

export type AIAction =
  | { type: 'move'; unitId: string; targetQ: number; targetR: number }
  | { type: 'attack'; unitId: string; targetQ: number; targetR: number }
  | { type: 'capture'; unitId: string }
  | { type: 'wait'; unitId: string }
  | { type: 'build'; factoryQ: number; factoryR: number; templateId: string }
  | { type: 'research'; techId: string }
  | { type: 'design'; name: string; chassisId: string; weaponId: string | null; systemIds: string[] }
  | { type: 'endTurn' };
