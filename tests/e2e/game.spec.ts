import { test, expect } from '@playwright/test';
import { clickHex, waitForGameState, getUnitAt, getFunds, startSmallMap } from './fixtures';

test.describe('Game E2E Tests', () => {
  test('can move infantry unit', async ({ page }) => {
    await startSmallMap(page);

    // Player infantry starts at (3, 5)
    await clickHex(page, 3, 5); // Select infantry
    await waitForGameState(page, 'selected');

    // Move to adjacent hex (4, 5)
    await clickHex(page, 4, 5);
    await waitForGameState(page, 'moved');

    // Click "Wait" in action menu (press 1 for first option)
    await page.keyboard.press('1');
    await waitForGameState(page, 'idle');

    // Verify unit moved
    const unit = await getUnitAt(page, 4, 5);
    expect(unit).not.toBeNull();
    expect(unit.hasActed).toBe(true);

    // Verify no unit at original position
    const originalPos = await getUnitAt(page, 3, 5);
    expect(originalPos).toBeNull();
  });

  test('can build infantry at factory', async ({ page }) => {
    await startSmallMap(page);

    const initialFunds = await getFunds(page, 'player');

    // Player factory is at (1, 6) - centerR + 1 = 5 + 1 = 6
    await clickHex(page, 1, 6); // Open factory menu
    await waitForGameState(page, 'factory');

    // Wait for menu to render (menuButtons populated during render cycle)
    await page.waitForTimeout(100);

    // Select Infantry (first option, $1000)
    await page.keyboard.press('1');
    await waitForGameState(page, 'idle');

    // Verify unit was built
    const unit = await getUnitAt(page, 1, 6);
    expect(unit).not.toBeNull();
    expect(unit.templateId).toBe('infantry');

    // Verify funds decreased
    const newFunds = await getFunds(page, 'player');
    expect(newFunds).toBe(initialFunds - 1000);
  });
});
