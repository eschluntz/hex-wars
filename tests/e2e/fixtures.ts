import { Page, expect } from '@playwright/test';

const HEX_SIZE = 40;

/**
 * Convert axial hex coordinates to world coordinates
 */
function hexToWorld(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = HEX_SIZE * (3 / 2 * r);
  return { x, y };
}

/**
 * Click on a hex tile at the given axial coordinates
 */
export async function clickHex(page: Page, q: number, r: number): Promise<void> {
  // Get viewport state from game
  const screenPos = await page.evaluate(({ q, r }) => {
    const game = (window as any).game;
    const viewport = game.getViewport();
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

    // Convert hex to world coords
    const hexSize = 40;
    const worldX = hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const worldY = hexSize * (3 / 2 * r);

    // Convert world to screen using viewport
    const screenX = (worldX - viewport.x) * viewport.zoom + canvas.width / 2;
    const screenY = (worldY - viewport.y) * viewport.zoom + canvas.height / 2;

    return { x: screenX, y: screenY };
  }, { q, r });

  await page.mouse.click(screenPos.x, screenPos.y);
}

/**
 * Wait for game state to reach a specific type
 */
export async function waitForGameState(
  page: Page,
  stateType: string,
  timeout: number = 5000
): Promise<void> {
  await expect(async () => {
    const currentState = await page.evaluate(() => {
      const game = (window as any).game;
      return game.getState().type;
    });
    expect(currentState).toBe(stateType);
  }).toPass({ timeout });
}

/**
 * Get unit at a specific position
 */
export async function getUnitAt(page: Page, q: number, r: number): Promise<any> {
  return await page.evaluate(({ q, r }) => {
    const game = (window as any).game;
    const unit = game.testGetUnitAt(q, r);
    if (!unit) return null;
    return {
      id: unit.id,
      team: unit.team,
      templateId: unit.templateId,
      health: unit.health,
      hasActed: unit.hasActed,
      q: unit.q,
      r: unit.r,
    };
  }, { q, r });
}

/**
 * Get funds for a team
 */
export async function getFunds(page: Page, team: string): Promise<number> {
  return await page.evaluate((team) => {
    const game = (window as any).game;
    return game.getFunds(team);
  }, team);
}

/**
 * Start a game with the small map
 */
export async function startSmallMap(page: Page): Promise<void> {
  await page.goto('/');

  // Wait for the game to load and show main menu
  await page.waitForSelector('#main-menu', { state: 'visible' });

  // Click "Small Map" button
  await page.click('#btn-small-map');

  // Wait for game to enter playing state (turn announcement finishes)
  await expect(async () => {
    const phase = await page.evaluate(() => {
      const game = (window as any).game;
      // Access gamePhase via a getter or check if we're in 'playing'
      // Since gamePhase is private, we check state instead
      return game.getState() !== undefined;
    });
    expect(phase).toBe(true);
  }).toPass({ timeout: 5000 });

  // Wait a bit for turn announcement to complete
  await page.waitForTimeout(1500);

  // Wait for idle state (after auto-select)
  await waitForGameState(page, 'selected', 3000);

  // Press Escape to deselect so we start in idle state
  await page.keyboard.press('Escape');
  await waitForGameState(page, 'idle');
}
