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

### Map Presets

Maps are generated from presets that control size, terrain distribution, and building placement:

| Preset      | Size   | Description                              |
|-------------|--------|------------------------------------------|
| Tiny        | 10x8   | Blitz battles, very fast                 |
| Standard    | 20x16  | Balanced terrain, medium battle          |
| Archipelago | 20x16  | Island chains (40%+ water required)      |
| Highlands   | 20x16  | Scattered mountain peaks                 |
| Forest      | 20x16  | Dense woodland terrain                   |
| Corridor    | 30x10  | Long narrow battlefield                  |
| Tall        | 10x30  | Vertical battlefield                     |
| Fortress    | 40x40  | Large square map, many buildings         |
| Boss        | 50x40  | Full size epic battle                    |

Presets can specify **validation constraints** (e.g., minimum water percentage for Archipelago). Maps that fail validation are regenerated with a different seed.

**Map Lab**: Add `?maplab` to the URL to access the map testing interface for previewing presets and seeds.

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

- **6-column, 13-row grid** with normal cells, boss barriers, and 2x2 fortresses
- **3 reinforcements** (lives) - lose one per lost battle, campaign ends at zero
- **Start** with Infantry and Tank unlocked at the center of row 0
- **Randomized rewards** - upgrades and powers are randomly distributed each campaign

**Cell types:**
- ⬡ **Unit** - Unlock a new unit type for your factories
- ▲ **Upgrade** - Stacking stat bonuses (damage, defense, income, cost reduction)
- ★ **Power** - Equippable abilities (movement, range, bonus units, terrain modifiers)
- 👑 **Boss** - Spans full row, uses Boss map preset, grants +1 power slot
- 🏰 **Fortress** - 2x2 block, uses Fortress map preset, position randomized per campaign

**Unlock rules:**
- **Normal cells**: Unlock when any orthogonally adjacent cell is completed
- **Boss cells**: Unlock when any cell in the row below is completed (including fortresses that span into that row)
- **Fortress cells**: Unlock when any adjacent cell is completed (cells touching any part of the 2x2 block)
- Completing a cell unlocks all adjacent cells (bosses unlock the full row above, fortresses unlock all touching cells)

**Map selection:**
- Boss battles use the **Boss** preset (50x40)
- Fortress battles use the **Fortress** preset (40x40)
- The 4 cells bordering the starting cells always use **Tiny** maps
- Other cells randomly select from available presets (Tiny weighted 2x)
- Same cell always generates the same map (deterministic from campaign seed)

### Upgrade System

Campaign mode features a roguelike upgrade system with two types of rewards:

**Stacking Upgrades** - Small persistent bonuses that accumulate:
| Upgrade | Effect |
|---------|--------|
| +5% DMG (unit type) | +5% damage for infantry, vehicles, indirect, or air |
| +1% DMG All | +1% damage for all units |
| +5 DEF (unit type) | Specific units take 5% less damage |
| +1 DEF All | All units take 1% less damage |
| +5% Revenue | +5% funds from buildings |
| -10% Cost (unit type) | Specific unit types cost 10% less to build |

**Powers** - Larger abilities equipped into limited slots:
| Power | Effect |
|-------|--------|
| Infantry March | +1 movement for foot units (infantry, mech) |
| Adv. Wheels | +1 movement for wheeled units (recon, rockets, missiles) |
| Adv. Treads | +1 movement for tracked units (tanks, apc, artillery) |
| Jet Fuel | +1 movement for air units |
| Blitz | +1 movement for all units |
| Extended Range | +1 range for indirect fire units |
| Infantry Assault | +20% damage for infantry |
| Armored Assault | +20% damage for direct fire vehicles |
| Artillery Barrage | +20% damage for indirect fire |
| Air Strike | +20% damage for air units |
| Reserves | Start each battle with 3 infantry |
| Tank Reserve | Start each battle with 1 Md Tank |
| All-Terrain Tires | Wheeled units drive on grass/woods like roads |

**Power Slots:**
- Start with 1 power slot
- Gain +1 slot for each boss defeated
- Equip/unequip powers from the campaign UI
- Only equipped powers are active in battle

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
│   ├── campaign-config.ts# Campaign grid layout and reward distribution
│   ├── campaign-ui.ts    # Campaign HTML UI (grid, powers, upgrades panels)
│   ├── upgrades.ts       # Upgrade/power definitions and modifiers
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
- [x] Movement animations
- [x] Cities heal units
- [x] Balanced attack values from AW
- [x] Basic AI improvements (smarter unit composition, factory blocking)
- [x] Campaign mode (roguelike progression grid)
- [x] Map presets with varied terrain (9 presets from Tiny to Boss)
- [x] Campaign map selection (preset per cell type, deterministic seeds)
- [x] Upgrade system
  - [x] Stacking upgrades (damage, defense, income, cost reduction)
  - [x] Equippable powers with limited slots (+1 per boss)
  - [x] Powers UI panel with equip/unequip
  - [x] Upgrades panel showing acquired bonuses
  - [x] Combat integration (AV/DV modifiers)
  - [x] Income multiplier from upgrades
  - [x] Cost reduction in factory menu
  - [x] Movement/range bonuses from powers
  - [x] Bonus unit spawning at battle start
  - [x] Terrain modification power (All-Terrain Tires)
  - [x] Randomized reward distribution per campaign

### Upcoming
- [ ] campaign screen
  - [ ] Modal for info on available battles.
      - explanation of what the unlock is. All explanation text that is not ALL should list the units it applies to.
      - show what enemy units the enemy has available
      - show what enemy upgrades/powers are active (right now none, but this will change once i add difficulty scaling)
      - preview of the map (low res, mainly to give a sense of scale) [only if easy]
      - "attack" button and "cancel" button that closes the modal.
- [ ] Enemy difficulty progression (available units, bonuses, better AIs)
- [ ] Saving and loading games
- [ ] Better AI
    - [ ] Can use transports
    - [ ] Reactive unit composition
    - [ ] Something better than greedy algo?
- [ ] Fog of war (maybe)
- [ ] Story elements (end campaign screen, winning campaign screen)
