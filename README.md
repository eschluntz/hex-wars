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
- GUI for tweaking all generation parameters

### Viewport
- WASD + mouse drag panning
- Mouse wheel zoom (25% - 300%)
- Hex hover detection

### Movement System
- A* pathfinding with terrain costs
- Multi-turn pathing

| Terrain | Cost |
|---------|------|
| Road | 0.5 |
| Grass / Building | 1.0 |
| Woods | 1.5 |
| Water / Mountain | ∞ |

### Default Map Parameters
- Water ≤ -0.16, Mountain ≥ 0.26
- 8 roads, length 10-40
- Map size: 50 × 40 hexes

## Project Structure

```
hex-dominion/
├── src/
│   ├── core.js          # HexUtil, tile types, movement costs
│   ├── pathfinder.js    # A* pathfinding
│   └── unit.js          # Unit state and movement
├── tests/
│   ├── framework.js     # Test runner
│   ├── helpers.js       # createTestMap() utility
│   ├── pathfinding.test.js
│   └── unit.test.js
├── index.html           # Browser game (standalone)
├── test.js              # CLI test runner
└── package.json
```

## Development

### Running Tests

```bash
npm test
```

### Test Map Helper

`createTestMap(grid)` creates a mock map from ASCII:

```javascript
const map = createTestMap([
  'GGGGG',  // G=grass, W=water, M=mountain
  'GWWWG',  // R=road, F=forest, B=building
  'GGGGG'
]);
```

## Next Steps

- [ ] Visual units on map (click to select, right-click to move)
- [ ] Turn system with end turn button
- [ ] Constructible buildings
- [ ] Resource system (materials, energy, science)
- [ ] Tech tree
- [ ] Unit production
- [ ] Combat system
- [ ] AI opponent
- [ ] Win/lose conditions