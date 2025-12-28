# Hex Dominion

A turn-based hex strategy game inspired by Advance Wars, Factorio, and roguelike elements. The goal is to create something with interesting depth but satisfying and not stressful to play — manageable cognitive load with meaningful decisions.

## Design Goals

**What we want:**
- Satisfying tactical/strategic decisions
- Base building with purpose
- Smart, adaptive AI opposition
- Creative expression through unit customization

**What we avoid:**
- APM stress / real-time pressure
- Exponential complexity
- Repetitive defense loops
- Long slogs or stalemates

## Planned Features

### Turn Structure
1. Collect resources from buildings
2. Build structures / expand to new hexes
3. Research tech (spend science)
4. Design & produce units (spend materials)
5. Move & fight

### Unit Component System

Units are built from modular components rather than predefined classes. Each template combines a chassis, an optional weapon, and optional system modules. Total component weight must not exceed chassis capacity. Unit cost = sum of all component costs.

**Chassis** (determines mobility):
| Chassis | Speed | Max Weight | Cost | Terrain |
|---------|-------|------------|------|---------|
| Foot    | 3     | 2          | $500 | All passable terrain costs 1 |
| Wheels  | 6     | 3          | $800 | Roads 0.5, Woods 2 |
| Treads  | 4     | 10         | $1500 | Roads 0.5, Woods 2 |

**Weapons** (determines offense):
| Weapon      | Attack | Range | Armor Piercing | Weight | Cost |
|-------------|--------|-------|----------------|--------|------|
| Machine Gun | 4      | 1     | No             | 1      | $500 |
| Heavy MG    | 6      | 1     | No             | 2      | $800 |
| Cannon      | 7      | 1     | Yes            | 4      | $1500 |
| Artillery   | 5      | 3     | Yes            | 5      | $2000 |

**System Modules** (special abilities):
| System | Weight | Cost | Chassis Restriction | Effect |
|--------|--------|------|---------------------|--------|
| Capture Kit | 1 | $0 | Foot only | Can capture buildings |
| Construction Kit | 1 | $500 | Any | Can build structures |
| Armor Plating | 2 | $1000 | Wheels or Treads | Takes 1/5 damage from non-AP |

**Starting Templates**:
- **Soldier** ($1000): Foot + MG + Capture — can capture buildings
- **Tank** ($4000): Treads + Cannon + Armor — armored with armor-piercing
- **Recon** ($1300): Wheels + MG — fast scout

**Example Custom Units**:
- **Combat Engineer**: Foot + MG + Build + Capture ($1500) — fights, builds, captures
- **Armored Recon**: Wheels + MG + Armor ($2300) — fast and protected
- **Heavy Artillery**: Treads + Artillery + Armor ($4500) — long range, armored

## What's Implemented

### Map System
- Hex grid with axial coordinates (pointy-top)
- Procedural generation using layered 2D Perlin noise (altitude + vegetation)
- Terrain: grass, woods, mountain, water, road, building
- Roads as contiguous paths, buildings clustered near roads

### Viewport
- WASD + mouse drag panning
- Mouse wheel zoom (25% - 300%)
- Hex hover detection

### Movement System
- A* pathfinding with terrain costs
- Per-unit terrain cost profiles (e.g., hover units cross water, climbers traverse mountains)
- Path preview while hovering (green = reachable, red = beyond movement range)
- Units cannot pass through enemies or stop on occupied tiles

| Terrain | Foot | Wheels/Treads |
|---------|------|---------------|
| Road | 1.0 | 0.5 |
| Grass / Building | 1.0 | 1.0 |
| Woods | 1.0 | 2.0 |
| Water / Mountain | ∞ | ∞ |

### Unit System
- Units have: speed, attack, range, health (max 10), terrain costs, armored, armorPiercing
- Click to select, click destination to move
- Path preview shows exact movement with arrow indicator
- Health bars displayed below units

### Combat System (Advance Wars style)
- Base damage formula: `attack × (health/10) + random(-1, 0, +1)`
- **Armor system**: Non-AP damage against armored units is divided by 5 (floored)
- Counter-attacks: defender strikes back if still alive AND attacker is within defender's range
- Range-based targeting (melee units can't counter ranged attacks from distance)
- Tactical example: Soldiers (4 ATK, no AP) deal 0 damage to Tanks (armored)

### Turn System
- Two teams: Player and Enemy (hotseat mode for testing)
- Each unit can move and optionally attack once per turn
- Units that have acted are greyed out
- Tab key ends turn and switches to other team
- Turn counter tracks game progress
- Resources collected at start of each turn

### Building System
Three building types with distinct roles:
- **Cities** (🏙️): Generate $1000 funds per turn
- **Factories** (🏭): Produce new units
- **Labs** (🔬): Generate 1 science per turn

Buildings have ownership displayed via colored backgrounds:
- Green = Player-owned
- Red = Enemy-owned
- Gray = Neutral (can be captured later)

### Resource System
- **Funds ($)**: Collected from cities, spent to build units
- **Science**: Collected from labs (future: research tech tree)
- Resources displayed in info panel
- Each team starts with $5000

### Unit Production
- Click on an owned factory (when no unit is on it) to open the production menu
- Three default unit templates available (built from components):
  - **Soldier** ($1000): Foot + MG + Capture — Speed 3, Attack 4, can capture buildings
  - **Tank** ($4000): Treads + Cannon + Armor — Speed 4, Attack 7, armored + AP
  - **Recon** ($1300): Wheels + MG — Speed 6, Attack 4, fast scout
- Newly built units appear on the factory, deactivated for the current turn
- Use number keys or arrow keys + Enter to select

### Unit Designer (Lab)
- Click on an owned lab to open the Unit Designer
- **Design new units** by combining chassis, weapons, and system modules
- Real-time validation shows weight limits and component compatibility
- **Edit existing templates** by clicking on them in the list
- Hover over components to see detailed stats in the tooltip area
- Unavailable components are grayed out with explanatory messages
- Each team has their own template library
- Research system ready for future tech tree (unresearched components will be hidden)

### Building Capture
- Units with `canCapture` ability (Soldier) can capture neutral or enemy buildings
- Move the unit onto a building, then select "Capture" from the action menu
- Captured buildings immediately switch to the capturing team's ownership
- Buildings are visible underneath units (ring + small icon in corner)

### Win/Lose Conditions
- A team loses when they have **no buildings AND no units**
- Game ends immediately when a team is eliminated
- Victory screen shows the winner and detailed statistics

### Main Menu & Game Over
- **Main Menu**: Click "New Game" or press Enter/Space to start
- **Game Over Screen**: Shows winner, turn count, and performance graphs
- **Statistics Tracked**:
  - Units over time (per team)
  - Buildings owned
  - Funds accumulated
  - Units killed (cumulative)
  - Buildings captured (cumulative)
  - Science collected

### UI & Controls
- **Click** unit to select
- **Click** tile to move (shows action menu after)
- **Action menu**: Wait (1), Cancel (2), Attack (3) - keyboard or click
- **Arrow keys + Enter** to navigate menu
- **Escape** to cancel/go back
- **Right-click** to deselect
- **Tab** to end turn
- Info panel shows: turn, team, active units, selected unit stats, terrain costs

### Default Map Parameters
- Water ≤ -0.16, Mountain ≥ 0.26
- 8 roads, length 10-40
- Map size: 50 × 40 hexes

## Project Structure

```
hex-dominion/
├── src/
│   ├── core.ts          # Types, HexUtil, tile constants, TerrainCosts, TeamColors
│   ├── components.ts    # Chassis, weapon, system component definitions
│   ├── pathfinder.ts    # A* pathfinding with blocked positions
│   ├── unit.ts          # Unit state, stats, movement
│   ├── combat.ts        # Combat calculations with armor/AP
│   ├── building.ts      # Building types, icons, income
│   ├── resources.ts     # Team resource tracking
│   ├── research.ts      # Tech tree unlock tracking (per-team)
│   ├── unit-templates.ts # Unit templates built from components
│   ├── unit-designer.ts # Design state, validation, component availability
│   ├── lab-modal.ts     # HTML/DOM-based unit designer UI
│   ├── noise.ts         # Perlin noise, seeded RNG
│   ├── config.ts        # Game configuration
│   ├── game-map.ts      # Map and building generation
│   ├── viewport.ts      # Camera and input
│   ├── input.ts         # Keyboard and mouse input handling
│   ├── renderer.ts      # Canvas drawing, popup menus, info panel
│   ├── stats.ts         # Game statistics tracking
│   ├── menu.ts          # Main menu and game over screen
│   └── main.ts          # Game state machine, turn management
├── tests/
│   ├── framework.ts     # Test runner
│   ├── helpers.ts       # createTestMap() utility
│   ├── pathfinding.test.ts
│   ├── unit.test.ts
│   ├── combat.test.ts   # Combat system tests (incl. armor/AP)
│   ├── components.test.ts # Component system tests
│   ├── building.test.ts # Building system tests
│   ├── resources.test.ts # Resource management tests
│   ├── production.test.ts # Unit template tests
│   ├── unit-designer.test.ts # Unit designer tests
│   └── stats.test.ts    # Statistics tracking tests
├── dist/                # Built output (git-ignored)
├── index.html           # Browser game + lab modal CSS
├── test.ts              # CLI test runner
└── package.json
```

## Development

```bash
npm run watch      # Build + serve with auto-rebuild
npm run build      # One-time build
npm run typecheck  # Check types without building
npm test           # Run tests (215 tests)
```

### Test Map Helper

`createTestMap(grid)` creates a mock map from ASCII for easy test setup:

```typescript
const map = createTestMap([
  'GGGGG',  // G=grass, W=water, M=mountain
  'GWWWG',  // R=road, F=forest, B=building
  'GGGGG'
]);
```

Combat tests use injectable variance parameters for deterministic results.

### Architecture Notes

**Rendering approach:**
- Game map, units, and in-game popups use **canvas** rendering
- Unit Designer uses **HTML/DOM** for better form handling and accessibility
- Popup menus (action menu, production menu) use a unified `PopupMenu` system

**PopupMenu system** (`renderer.ts`):
```typescript
this.drawPopupMenu({
  title: 'Build Unit',           // Optional header
  items: [
    { label: 'Soldier', action: 'build_soldier', cost: 1000, enabled: true },
    { label: 'Cancel', action: 'cancel', color: '#ff8888' },
  ],
  worldPos: { q: 5, r: 3 },      // Position near hex
  clampToScreen: true,           // Keep in viewport
}, zoom);
```

**Research system** (`research.ts`):
- Tracks unlocked components per team
- Unresearched components are hidden (not grayed out)
- Ready for tech tree integration


## Next Steps

### Completed
- [x] Visual units on map with selection and movement
- [x] Per-unit terrain costs (hover, climber, etc.)
- [x] Path preview with reachability indicator
- [x] Combat system with counter-attacks and range
- [x] Turn system with team switching
- [x] Action menu with keyboard shortcuts
- [x] Unit health bars and acted state
- [x] Building types (city, factory, lab) with ownership display
- [x] Resource system (funds, science)
- [x] Unit production from factories
- [x] Building capture by units with `canCapture` ability
- [x] Win/lose conditions (no buildings + no units = defeat)
- [x] Main menu and New Game functionality
- [x] Game over screen with statistics graphs
- [x] Unit component system (chassis, weapon, system slots)
- [x] Armor + armor-piercing combat mechanics
- [x] Three unit types: Soldier, Tank, Recon
- [x] Unit Designer interface (click lab to design custom units)
- [x] Per-team template libraries
- [x] Research system infrastructure (ready for tech tree)

### Upcoming
- [ ] Tech tree (spend science to unlock new components)
- [ ] AI opponent
- [ ] Upgrade Map visuals
- [ ] Building construction (using units with Build ability)
- [ ] More chassis types (hover, etc.)
- [ ] More weapon types (missiles, lasers, etc.)
- [ ] More system modules (stealth, repair, sensors)
- [ ] Satisfying battle animations
- [ ] Improving road generation
- [ ] fog of war?
- [ ] more building types? Resources?

