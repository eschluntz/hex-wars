// ============================================================================
// HEX DOMINION - AI Benchmark Script
// ============================================================================
// Runs AI vs AI battles and prints per-turn stats.
// Usage: npx tsx tests/ai/benchmark.ts

import { GameMap } from '../../src/game-map.js';
import { MAP_PRESETS, presetToMapConfig } from '../../src/map-presets.js';
import { GreedyAI } from '../../src/ai/greedy-ai.js';
import { NoOpAI } from '../../src/ai/noop-ai.js';
import { getUnitType } from '../../src/unit-templates.js';
import { BenchmarkGame } from '../test-utils.js';

const TEAMS = ['player', 'enemy'] as const;
const MAX_TURNS = 100;
const STARTING_FUNDS = 10000;

function printTurnStats(turn: number, game: BenchmarkGame): void {
  for (const team of TEAMS) {
    const buildings = game.map.getBuildingsByOwner(team).length;
    const unitValue = game.units
      .filter(u => u.team === team && u.isAlive())
      .reduce((sum, u) => sum + getUnitType(u.templateId).cost, 0);
    const funds = game.resources.getResources(team).funds;
    console.log(`Turn ${turn.toString().padStart(3)} | ${team.padEnd(6)}: ${buildings} buildings, ${unitValue.toString().padStart(6)} unit value, ${funds.toString().padStart(6)} funds`);
  }
}

async function runBenchmark(): Promise<void> {
  console.log('=== AI Benchmark: GreedyAI vs NoOpAI ===\n');

  // Create map using 'standard' preset
  const preset = MAP_PRESETS['standard']!;
  const seed = Date.now();
  const mapConfig = presetToMapConfig(preset, seed);
  const map = new GameMap(mapConfig);

  // Create game
  const game = BenchmarkGame.fromGameMap([...TEAMS], map);

  // Set starting funds
  for (const team of TEAMS) {
    game.resources.addFunds(team, STARTING_FUNDS);
  }

  // Create AIs
  const ais = [new GreedyAI(), new NoOpAI()];

  console.log(`Map: ${preset.name} (${preset.width}x${preset.height}), seed: ${seed}`);
  console.log(`Starting funds: ${STARTING_FUNDS}\n`);

  // Print initial state
  console.log('--- Initial State ---');
  printTurnStats(0, game);
  console.log('');

  // Run game loop
  let winner: string | null = null;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // Each turn consists of both teams taking their turns
    for (let teamIdx = 0; teamIdx < TEAMS.length; teamIdx++) {
      const ai = ais[teamIdx]!;
      const { ctx } = game.createAIContext();
      await ai.planTurn(ctx);

      // Collect income at end of each team's turn
      game.resources.collectIncome(game.currentTeam, game.map.getAllBuildings());

      game.endTurn();

      // Check for game over
      const loser = game.checkGameOver();
      if (loser) {
        winner = TEAMS.find(t => t !== loser) ?? null;
        break;
      }
    }

    if (winner) break;

    // Print stats after each full turn (both teams)
    printTurnStats(turn, game);
  }

  console.log('\n--- Final Result ---');
  if (winner) {
    console.log(`Winner: ${winner} (Turn ${game.turn})`);
  } else {
    console.log(`Draw: Max turns (${MAX_TURNS}) reached`);
  }

  // Final stats
  printTurnStats(game.turn, game);
}

runBenchmark().catch(console.error);
