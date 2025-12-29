// ============================================================================
// HEX DOMINION - AI Game State
// ============================================================================
// Simple read-only interface for AI to access game objects directly.

import { type Unit } from '../unit.js';
import { type GameMap } from '../game-map.js';
import { type Building } from '../building.js';
import { type Pathfinder } from '../pathfinder.js';
import { type ResourceManager } from '../resources.js';
import { type UnitTemplate } from '../unit-templates.js';
import { type Chassis, type Weapon, type SystemModule } from '../unit-designer.js';
import { type TechNodeState, getTechTreeState } from '../tech-tree.js';

// Read-only game state for AI decision making
export interface AIGameState {
  readonly currentTeam: string;
  readonly turnNumber: number;
  readonly units: readonly Unit[];
  readonly map: GameMap;
  readonly buildings: readonly Building[];
  readonly resources: ResourceManager;
  readonly pathfinder: Pathfinder;

  // Helpers that need game context
  getTeamTemplates(team: string): UnitTemplate[];
  getResearchedChassis(team: string): Chassis[];
  getResearchedWeapons(team: string): Weapon[];
  getResearchedSystems(team: string): SystemModule[];
  getAvailableTechs(team: string): TechNodeState[];
}
