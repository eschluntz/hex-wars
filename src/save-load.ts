// ============================================================================
// HEX DOMINION - Campaign Save/Load System
// ============================================================================

import { type CampaignState } from './campaign-state.js';

const SAVE_VERSION = 1;
const SAVE_KEY = 'hex_dominion_campaign_save';
const GLOBAL_STATS_KEY = 'hex_dominion_global_stats';

// ============================================================================
// GLOBAL STATS (persists across all campaigns)
// ============================================================================

export interface GlobalStats {
  highScore: number;
  furthestRow: number;
}

/**
 * Load global stats from localStorage
 */
export function loadGlobalStats(): GlobalStats {
  const raw = localStorage.getItem(GLOBAL_STATS_KEY);
  if (!raw) {
    return { highScore: 0, furthestRow: 0 };
  }
  const parsed = JSON.parse(raw);
  // Handle corrupted/missing data with defaults
  return {
    highScore: typeof parsed.highScore === 'number' && !isNaN(parsed.highScore) ? parsed.highScore : 0,
    furthestRow: typeof parsed.furthestRow === 'number' && !isNaN(parsed.furthestRow) ? parsed.furthestRow : 0,
  };
}

/**
 * Save global stats to localStorage
 */
export function saveGlobalStats(stats: GlobalStats): void {
  localStorage.setItem(GLOBAL_STATS_KEY, JSON.stringify(stats));
}

/**
 * Update global stats if new records are achieved
 * Returns true if any record was broken
 */
export function updateGlobalStats(score: number, furthestRow: number): boolean {
  const current = loadGlobalStats();
  let updated = false;

  if (score > current.highScore) {
    current.highScore = score;
    updated = true;
  }

  if (furthestRow > current.furthestRow) {
    current.furthestRow = furthestRow;
    updated = true;
  }

  if (updated) {
    saveGlobalStats(current);
  }

  return updated;
}

// ============================================================================
// CAMPAIGN SAVE/LOAD
// ============================================================================

interface SaveData {
  version: number;
  savedAt: number;
  state: SerializedCampaignState;
}

interface SerializedCampaignState {
  completedCells: string[];              // Set -> array
  unlockedUnits: string[];               // Set -> array
  reinforcements: number;
  campaignSeed: number;
  completionsPerRow: [number, number][]; // Map -> tuples
  acquiredUpgrades: string[];
  unlockedPowers: string[];
  activePowers: string[];
  powerSlots: number;
  bossesDefeated: number;
  totalScore: number;
}

/**
 * Serialize a CampaignState for storage
 */
function serializeCampaignState(state: CampaignState): SerializedCampaignState {
  return {
    completedCells: Array.from(state.completedCells),
    unlockedUnits: Array.from(state.unlockedUnits),
    reinforcements: state.reinforcements,
    campaignSeed: state.campaignSeed,
    completionsPerRow: Array.from(state.completionsPerRow.entries()),
    acquiredUpgrades: state.acquiredUpgrades,
    unlockedPowers: state.unlockedPowers,
    activePowers: state.activePowers,
    powerSlots: state.powerSlots,
    bossesDefeated: state.bossesDefeated,
    totalScore: state.totalScore,
  };
}

/**
 * Deserialize a CampaignState from storage
 */
function deserializeCampaignState(data: SerializedCampaignState): CampaignState {
  return {
    completedCells: new Set(data.completedCells),
    unlockedUnits: new Set(data.unlockedUnits),
    reinforcements: data.reinforcements,
    campaignSeed: data.campaignSeed,
    completionsPerRow: new Map(data.completionsPerRow),
    acquiredUpgrades: data.acquiredUpgrades,
    unlockedPowers: data.unlockedPowers,
    activePowers: data.activePowers,
    powerSlots: data.powerSlots,
    bossesDefeated: data.bossesDefeated,
    totalScore: data.totalScore,
  };
}

/**
 * Save campaign state to localStorage
 */
export function saveCampaign(state: CampaignState): void {
  const saveData: SaveData = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: serializeCampaignState(state),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  console.log('Campaign saved');
}

/**
 * Load campaign state from localStorage
 */
export function loadCampaign(): CampaignState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  const saveData: SaveData = JSON.parse(raw);

  // Version check - for now just require exact match
  if (saveData.version !== SAVE_VERSION) {
    console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${saveData.version}`);
    return null;
  }

  return deserializeCampaignState(saveData.state);
}

/**
 * Check if a saved campaign exists
 */
export function hasSavedCampaign(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Delete the saved campaign
 */
export function deleteSavedCampaign(): void {
  localStorage.removeItem(SAVE_KEY);
  console.log('Campaign save deleted');
}
