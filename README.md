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

### Unit Design System

Unit blueprints will be customized from components, rather than predefined, so you can have lots of different units each game.

Potential way this could be implemented:

| Slot | Options | Tradeoffs |
|------|---------|-----------|
| **Chassis** | Scout / Standard / Heavy / Hover | Speed vs. HP vs. terrain access |
| **Weapon** | MG, Cannon, Laser, Missiles, Flamer | Range, damage pattern, ammo |
| **System** | Armor, Shield, Repair, Stealth, Sensor | Survivability vs. utility |

Weapon types include line-piercing lasers, arc-over-obstacles missiles, and area-denial flamers.

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

| Terrain | Default Cost |
|---------|--------------|
| Road | 0.5 |
| Grass / Building | 1.0 |
| Woods | 1.5 |
| Water / Mountain | ∞ (unless unit has special terrain costs) |

### Unit System
- Units have: speed, attack, range, health (max 10), and custom terrain costs
- Click to select, click destination to move
- Path preview shows exact movement with arrow indicator
- Health bars displayed below units

### Combat System (Advance Wars style)
- Damage formula: `attack × (health/10) + random(-1, 0, +1)`
- Counter-attacks: defender strikes back if still alive AND attacker is within defender's range
- Range-based targeting (melee units can't counter ranged attacks from distance)

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
- Two unit templates available:
  - **Infantry** ($1000): Speed 3, Attack 4, Range 1
  - **Tank** ($3000): Speed 5, Attack 7, Range 1 (slower in woods)
- Newly built units appear on the factory, deactivated for the current turn
- Use number keys or arrow keys + Enter to select

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
│   ├── pathfinder.ts    # A* pathfinding with blocked positions
│   ├── unit.ts          # Unit state, stats, movement
│   ├── combat.ts        # Combat calculations and execution
│   ├── building.ts      # Building types, icons, income
│   ├── resources.ts     # Team resource tracking
│   ├── unit-templates.ts # Unit blueprints for production
│   ├── noise.ts         # Perlin noise, seeded RNG
│   ├── config.ts        # Game configuration
│   ├── game-map.ts      # Map and building generation
│   ├── viewport.ts      # Camera and input
│   ├── renderer.ts      # Drawing, UI, action/production menus
│   └── main.ts          # Game state machine, turn management, production
├── tests/
│   ├── framework.ts     # Test runner
│   ├── helpers.ts       # createTestMap() utility
│   ├── pathfinding.test.ts
│   ├── unit.test.ts
│   ├── combat.test.ts   # Combat system tests
│   ├── building.test.ts # Building system tests
│   ├── resources.test.ts # Resource management tests
│   └── production.test.ts # Unit template tests
├── dist/                # Built output (git-ignored)
├── index.html           # Browser game
├── test.ts              # CLI test runner
└── package.json
```

## Development

```bash
npm run watch      # Build + serve with auto-rebuild
npm run build      # One-time build
npm run typecheck  # Check types without building
npm test           # Run tests (95 tests)
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
- [x] Unit production from factories (Infantry, Tank templates)

### Upcoming
- [ ] Building capture by units
- [ ] Win/lose conditions
- [ ] AI opponent
- [ ] Tech tree (spend science)
- [ ] Unit component system (chassis, weapon, system slots)
- [ ] More unit types