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

| Unit | Type | Cost | Move | Attack | Range | Special |
|------|------|------|------|--------|-------|---------|
| Infantry | Foot | $1000 | 3 | 4 | 1 | Capture, climbs mountains (cost 2) |
| Mech | Foot | $3000 | 2 | 6 | 1 | Capture, AP, mountain specialist (cost 1) |
| Recon | Wheels | $4000 | 8 | 4 | 1 | Fast scout |
| Tank | Treads | $7000 | 6 | 7 | 1 | AP, Armored |
| Md. Tank | Treads | $16000 | 5 | 8 | 1 | AP, Armored |
| Mega Tank | Treads | $28000 | 4 | 10 | 1 | AP, Armored |
| Artillery | Treads | $6000 | 5 | 5 | 2-3 | Indirect, no move+attack |
| Rockets | Wheels | $15000 | 5 | 8 | 3-5 | Indirect, no move+attack |
| Anti-Air | Treads | $8000 | 6 | 6 | 1 | Targets all (anti-air) |
| Missiles | Wheels | $12000 | 4 | 9 | 3-5 | Anti-air only, indirect |
| APC | Treads | $5000 | 6 | 0 | 0 | Transport (1 foot unit) |
| Fighter | Air | $20000 | 9 | 8 | 1 | Air-to-air only |
| Bomber | Air | $22000 | 7 | 10 | 1 | Ground only |
| B-Copter | Air | $9000 | 6 | 6 | 1 | All targets |
| T-Copter | Air | $5000 | 6 | 0 | 0 | Transport (1 foot unit) |

### Terrain Movement Costs

| Terrain | Infantry | Mech | Treads | Wheels | Air |
|---------|----------|------|--------|--------|-----|
| Plains | 1 | 1 | 1 | 2 | 1 |
| Woods | 1 | 1 | 2 | 3 | 1 |
| Mountain | 2 | 1 | — | — | 1 |
| Road | 1 | 1 | 1 | 1 | 1 |
| Water | — | — | — | — | 1 |

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
- APC and T-Copter carry 1 foot unit
- Select transport, move, then "Unload" to adjacent passable tile
- Cargo destroyed if transport is destroyed

### AI Opponent
**GreedyAI** with priority-based decisions:
1. Build units at factories (prioritize closer to enemy)
2. Capture buildings if possible
3. Attack with maximum expected damage
4. Move toward nearest enemy/building

### Controls
- **Click** to select unit, click destination to move
- **Action menu**: Wait, Cancel, Attack, Capture, Unload
- **Tab** to end turn
- **Space** to cycle to next active unit
- **Escape** to cancel
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
│   └── main.ts           # Game loop and state machine
├── tests/                # Test suite (242 tests)
├── hex_assets/           # Terrain textures
├── unit_assets/          # Unit sprites
└── index.html
```

## Development

```bash
npm run watch      # Build + serve with auto-rebuild
npm run build      # One-time build
npm run typecheck  # Check types
npm test           # Run unit tests (242 tests)
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

### Upcoming
- [ ] balance actually attack values from AW
- [ ] make smaller maps
- [ ] metagame basics
- [ ] Saving and loading games
- [ ] AI improvements (smarter unit composition, factory blocking)
- [ ] Fog of war (maybe)
