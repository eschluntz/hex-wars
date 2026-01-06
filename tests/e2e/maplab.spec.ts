import { test, expect } from '@playwright/test';

test.describe('Map Lab', () => {
  test('reroll changes terrain - verify tile types change', async ({ page }) => {
    // Navigate to map lab
    await page.goto('http://localhost:8000/?maplab');
    await page.waitForTimeout(2000);

    // Get initial tile distribution from the game's map
    const initialTiles = await page.evaluate(() => {
      const game = (window as any).game;
      const map = game.map;
      const tiles = map.getAllTiles();
      // Create a string representation of all tile types
      const typeStr = tiles.map((t: any) => `${t.q},${t.r}:${t.type}`).sort().join('|');
      return {
        count: tiles.length,
        typeStr,
        sample: tiles.slice(0, 10).map((t: any) => ({ q: t.q, r: t.r, type: t.type }))
      };
    });

    console.log('Initial tiles count:', initialTiles.count);
    console.log('Initial sample:', initialTiles.sample);

    // Click reroll button
    await page.click('#maplab-reroll');
    await page.waitForTimeout(1000);

    // Get new tile distribution
    const rerolledTiles = await page.evaluate(() => {
      const game = (window as any).game;
      const map = game.map;
      const tiles = map.getAllTiles();
      const typeStr = tiles.map((t: any) => `${t.q},${t.r}:${t.type}`).sort().join('|');
      return {
        count: tiles.length,
        typeStr,
        sample: tiles.slice(0, 10).map((t: any) => ({ q: t.q, r: t.r, type: t.type }))
      };
    });

    console.log('Rerolled tiles count:', rerolledTiles.count);
    console.log('Rerolled sample:', rerolledTiles.sample);

    // The tile types string should be DIFFERENT after reroll
    // (if terrain is truly regenerating)
    console.log('Tiles changed:', initialTiles.typeStr !== rerolledTiles.typeStr);

    expect(rerolledTiles.typeStr).not.toEqual(initialTiles.typeStr);
  });
});
