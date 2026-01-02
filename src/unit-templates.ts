// ============================================================================
// HEX DOMINION - Unit Templates
// ============================================================================

import { type TerrainCosts } from './core.js';
import {
  getChassis,
  getWeapon,
  getSystem,
  validateTemplate,
  computeTemplateCost,
  type ChassisComponent,
  type WeaponComponent,
  type SystemComponent,
} from './components.js';

// ============================================================================
// UNIT TEMPLATE INTERFACE
// ============================================================================

export interface UnitTemplate {
  id: string;
  name: string;
  chassisId: string;
  weaponId: string | null;
  systemIds: string[];

  // Derived stats (computed from components)
  cost: number;
  speed: number;
  attack: number;
  range: number;
  terrainCosts: TerrainCosts;
  armored: boolean;
  armorPiercing: boolean;
  canCapture: boolean;
  canBuild: boolean;
}

// ============================================================================
// TEMPLATE CREATION
// ============================================================================

export function createTemplate(
  id: string,
  name: string,
  chassisId: string,
  weaponId: string | null,
  systemIds: string[] = []
): UnitTemplate {
  const validation = validateTemplate(chassisId, weaponId, systemIds);
  if (!validation.valid) {
    throw new Error(`Template "${id}": ${validation.error}`);
  }

  const chassis = getChassis(chassisId);
  const weapon = weaponId ? getWeapon(weaponId) : null;
  const systems = systemIds.map(id => getSystem(id));

  // Derive abilities from systems
  const canCapture = systems.some(s => s.grantsCapture === true);
  const canBuild = systems.some(s => s.grantsBuild === true);
  const armored = systems.some(s => s.grantsArmor === true);

  return {
    id,
    name,
    chassisId,
    weaponId,
    systemIds,
    cost: computeTemplateCost(chassisId, weaponId, systemIds),
    speed: chassis.speed,
    attack: weapon?.attack ?? 0,
    range: weapon?.range ?? 0,
    terrainCosts: chassis.terrainCosts,
    armored,
    armorPiercing: weapon?.armorPiercing ?? false,
    canCapture,
    canBuild,
  };
}

// ============================================================================
// DEFAULT TEMPLATES
// ============================================================================

const DEFAULT_TEMPLATES: Record<string, UnitTemplate> = {
  soldier: createTemplate('soldier', 'Soldier', 'foot', 'machineGun', ['capture']),
  tank: createTemplate('tank', 'Tank', 'treads', 'cannon', ['armor']),
  recon: createTemplate('recon', 'Recon', 'wheels', 'machineGun'),
};

// Legacy export for backwards compatibility
export const UNIT_TEMPLATES = DEFAULT_TEMPLATES;

// ============================================================================
// TEMPLATE UTILITIES
// ============================================================================

/** Extract stats from a template for creating a Unit (add color separately) */
export function getTemplateStats(template: UnitTemplate): {
  speed: number;
  attack: number;
  range: number;
  terrainCosts: import('./core.js').TerrainCosts;
  canCapture: boolean;
  canBuild: boolean;
  armored: boolean;
  armorPiercing: boolean;
  chassisId: string;
  weaponId: string | undefined;
  systemIds: string[];
} {
  return {
    speed: template.speed,
    attack: template.attack,
    range: template.range,
    terrainCosts: template.terrainCosts,
    canCapture: template.canCapture,
    canBuild: template.canBuild,
    armored: template.armored,
    armorPiercing: template.armorPiercing,
    chassisId: template.chassisId,
    weaponId: template.weaponId ?? undefined,
    systemIds: template.systemIds,
  };
}

// ============================================================================
// PER-TEAM TEMPLATE REGISTRY
// ============================================================================

// Each team has their own copy of templates (don't share designs)
const teamTemplates: Record<string, Record<string, UnitTemplate>> = {};

export function initTeamTemplates(team: string): void {
  // Each team gets copies of defaults
  teamTemplates[team] = {};
  for (const [id, template] of Object.entries(DEFAULT_TEMPLATES)) {
    teamTemplates[team][id] = { ...template };
  }
}

export function getTeamTemplates(team: string): UnitTemplate[] {
  return Object.values(teamTemplates[team] ?? {});
}

export function getTeamTemplate(team: string, id: string): UnitTemplate | undefined {
  return teamTemplates[team]?.[id];
}

function generateIdFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function registerTemplate(
  team: string,
  name: string,
  chassisId: string,
  weaponId: string | null,
  systemIds: string[]
): UnitTemplate {
  const id = generateIdFromName(name);

  if (teamTemplates[team]?.[id]) {
    throw new Error(`Template "${name}" already exists for ${team}`);
  }

  const template = createTemplate(id, name, chassisId, weaponId, systemIds);

  if (!teamTemplates[team]) {
    teamTemplates[team] = {};
  }
  teamTemplates[team][id] = template;

  return template;
}

export function updateTemplate(
  team: string,
  id: string,
  name: string,
  chassisId: string,
  weaponId: string | null,
  systemIds: string[]
): void {
  const newId = generateIdFromName(name);

  // If name changed, check for conflicts with other templates
  if (newId !== id && teamTemplates[team]?.[newId]) {
    throw new Error(`Template "${name}" already exists for ${team}`);
  }

  const template = createTemplate(newId, name, chassisId, weaponId, systemIds);

  // Remove old template if ID changed
  if (newId !== id && teamTemplates[team]) {
    delete teamTemplates[team][id];
  }

  if (!teamTemplates[team]) {
    teamTemplates[team] = {};
  }
  teamTemplates[team][newId] = template;
}

export function unregisterTemplate(team: string, id: string): boolean {
  if (teamTemplates[team]?.[id]) {
    delete teamTemplates[team][id];
    return true;
  }
  return false;
}

export function isNameTaken(team: string, name: string, excludeId?: string): boolean {
  const id = generateIdFromName(name);
  if (excludeId && id === excludeId) {
    return false;
  }
  return teamTemplates[team]?.[id] !== undefined;
}

// ============================================================================
// LEGACY ACCESSORS (for backwards compatibility)
// ============================================================================

export function getAvailableTemplates(): UnitTemplate[] {
  return Object.values(DEFAULT_TEMPLATES);
}

export function getTemplate(id: string): UnitTemplate {
  return DEFAULT_TEMPLATES[id]!;
}

// ============================================================================
// TEMPLATE INFO (for UI)
// ============================================================================

export function getTemplateComponents(template: UnitTemplate): {
  chassis: ChassisComponent;
  weapon: WeaponComponent | null;
  systems: SystemComponent[];
} {
  return {
    chassis: getChassis(template.chassisId),
    weapon: template.weaponId ? getWeapon(template.weaponId) : null,
    systems: template.systemIds.map(id => getSystem(id)),
  };
}
