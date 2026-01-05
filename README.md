# Hex Dominion

A turn-based hex strategy game inspired by Advance Wars. Clean, satisfying tactical gameplay with manageable cognitive load and meaningful decisions.

## Design Goals

**What we want:**
- Satisfying tactical/strategic decisions
- Clear unit roles and counter-play
- Smart, adaptive AI opposition
- Quick to learn, deep to master

**What we avoid:**
- APM stress / real-time pressure
- Exponential complexity
- Repetitive defense loops
- Long slogs or stalemates

## Unit Roster (Advance Wars style)

All 15 unit types available at factories:
| Unit      | Cost    | Move | Attack | Range | Special                        |
|-----------|---------|------|--------|-------|--------------------------------|
| Infantry  | $1000   | 3    | 4      | 1     | Capture, climbs mountains      |
| Mech      | $3000   | 2    | 6      | 1     | Capture, AP, mountain climber  |
| Recon     | $4000   | 8    | 4      | 1     | Fast scout                     |
| Tank      | $7000   | 6    | 7      | 1     | AP, Armored                    |
| Md. Tank  | $16000  | 5    | 8      | 1     | AP, Armored                    |
| Mega Tank | $28000  | 4    | 10     | 1     | AP, Armored                    |
| Artillery | $6000   | 5    | 5      | 2-3   | Indirect, no move+attack       |
| Rockets   | $15000  | 5    | 8      | 3-5   | Indirect, no move+attack       |
| Anti-Air  | $8000   | 6    | 6      | 1     | Targets all (anti-air)         |
| Missiles  | $12000  | 4    | 9      | 3-5   | Anti-air only, indirect        |
| APC       | $5000   | 6    | 0      | 0     | Transport (Infantry/Mech)      |
| Fighter   | $20000  | 9    | 8      | 1     | Air-to-air only, flying        |
| Bomber    | $22000  | 7    | 10     | 1     | Ground only, flying            |
| B-Copter  | $9000   | 6    | 6      | 1     | All targets, flying            |
| T-Copter  | $5000   | 6    | 0      | 0     | Transport (Infantry/Mech)      |

### Terrain Movement Costs

| Terrain  | Infantry | Mech | Treads | Wheels | Air |
|----------|----------|------|--------|--------|-----|
| Plains   | 1        | 1    | 1      | 2      | 1   |
| Woods    | 1        | 1    | 2      | 3      | 1   |
| Mountain | 2        | 1    | —      | —      | 1   |
| Road     | 1        | 1    | 1      | 1      | 1   |
| Water    | —        | —    | —      | —      | 1   |

### Combat System

- **Base damage**: `attack × (health/10) + random(-1, 0, +1)`
- **Armor**: Non-AP damage against armored units is divided by 5
- **Counter-attacks**: Defender strikes back if alive and in range
- **Terrain defense**: Each defense star = 10% damage reduction (scaled by HP)

## What's Implemented

### Map System
- Hex grid with axial coordinates (pointy-top)
- Procedural generation using layered 2D Perlin noise
- Terrain: grass, woods, mountain, water, road
- Building clusters connected by roads

### Buildings
- **Cities** (🏙️): Generate $1000 funds per turn
- **Factories** (🏭): Produce new units
- **Capital** (🏰): Generate $2000 funds; lose it = instant defeat

### Win Condition
Capture the enemy's capital to win instantly.

### Building Capture
- Units with capture ability (Infantry, Mech) can capture buildings
- Buildings have 20 resistance; each capture subtracts unit's HP
- Full health unit captures in 2 turns
- Resistance resets if capturing unit leaves or dies

### Transport Units
- APC and T-Copter carry 1 Infantry or Mech unit
- Select transport, move, then "Unload" to adjacent passable tile
- Cargo destroyed if transport is destroyed

### AI Opponent
**GreedyAI** with priority-based decisions:
1. Build units at factories (prioritize closer to enemy)
2. Capture buildings if possible
3. Attack with maximum expected damage
4. Move toward nearest enemy/building

### Campaign Mode
Roguelike progression through a grid of battles:

- **6-column grid** with normal cells, boss barriers, and 2x2 fortresses
- **3 reinforcements** (lives) - lose one per lost battle, campaign ends at zero
- **Cell types**:
  - 🔵 **Unit** - Unlock a new unit type
  - 🔴 **Upgrade** - Stat bonuses
  - 🟠 **Special** - Unique abilities
  - 🟣 **Boss** - Spans full row, unlocks when any cell below is completed
  - 🟡 **Fortress** - 2x2 block, unlocks when 50%+ of perimeter cells are completed
- **Adjacency unlocking** - Complete a cell to unlock orthogonally adjacent cells
- Win a battle → cell turns green, adjacent cells unlock
- Lose a battle → lose a reinforcement, cell stays available to retry

### Controls
- **Click** to select unit, click destination to move
- **Action menu**: Wait, Cancel, Attack, Capture, Unload
- **Tab** to end turn
- **Space** to cycle to next active unit
- **Escape** to cancel (or return to menu from campaign)
- **Arrow keys + Enter** for menu navigation

## Project Structure

```
hex-dominion/
├── src/
│   ├── core.ts           # Types, hex utilities, terrain
│   ├── unit-templates.ts # Static unit type definitions
│   ├── unit.ts           # Unit state and movement
│   ├── combat.ts         # Combat calculations
│   ├── building.ts       # Building types and capture
│   ├── resources.ts      # Funds tracking
│   ├── pathfinder.ts     # A* pathfinding
│   ├── game-map.ts       # Map generation
│   ├── ai/
│   │   ├── greedy-ai.ts  # Main AI implementation
│   │   ├── noop-ai.ts    # Testing baseline
│   │   └── ...
│   ├── renderer.ts       # Canvas rendering
│   ├── textures.ts       # Sprite loading and tinting
│   ├── viewport.ts       # Camera controls
│   ├── input.ts          # Input handling
│   ├── menu.ts           # Main menu / game over
│   ├── stats.ts          # Game statistics
│   ├── campaign-state.ts # Campaign state and cell availability
│   ├── campaign-config.ts# Campaign grid layout
│   ├── campaign-ui.ts    # Campaign HTML UI
│   └── main.ts           # Game loop and state machine
├── tests/                # Test suite (206 tests)
├── hex_assets/           # Terrain textures
├── unit_assets/          # Unit sprites
└── index.html
```

## Development

```bash
npm run watch      # Build + serve with auto-rebuild
npm run build      # One-time build
npm run typecheck  # Check types
npm test           # Run unit tests (206 tests)
npm run test:e2e   # Run Playwright e2e tests
```

### E2E Tests

End-to-end tests use Playwright to run the game in a real browser. Tests are in `tests/e2e/` and use custom fixtures (`fixtures.ts`) for game-specific helpers:

- `clickHex(page, q, r)` - Click on a hex at axial coordinates
- `waitForGameState(page, state)` - Wait for game state machine to reach a state
- `getUnitAt(page, q, r)` - Query unit at a position
- `getFunds(page, team)` - Get a team's current funds
- `startSmallMap(page)` - Navigate and start a new small map game

The tests automatically start the dev server (`npm run watch`) before running. Results are available as an HTML report.

## Assets
- Terrain: https://dgbaumgart.itch.io/hex-and-tile-terrain-sample-set
- Units: [Advance Wars sprite style](https://awbw.fandom.com/wiki/Units)
- Advance Wars damage calculation: https://awbw.fandom.com/wiki/Damage_Formula



## Roadmap

### Completed
- [x] Full Advance Wars unit roster (15 units)
- [x] Terrain movement costs matching AW
- [x] Combat with armor/AP, counter-attacks, terrain defense
- [x] Capital capture = instant win
- [x] Transport units (APC, T-Copter)
- [x] Weapon targeting restrictions (air vs ground)
- [x] Indirect fire units with min range
- [x] AI opponent (builds, captures, fights)
- [x] Unit sprites with team coloring
- [x] Battle animations
- [x] movement animations
- [x] cities heal
- [x] balance actually attack values from AW
- [x] basic AI improvements (smarter unit composition, factory blocking)
- [x] Campaign mode (roguelike progression grid)

### Upcoming
- [ ] make smaller maps
- [ ] Saving and loading games
- [ ] better AI
    - [ ] can use transports
    - [ ] will block opponent factories
    - [ ] reactive unit composition
- [ ] Fog of war (maybe)
