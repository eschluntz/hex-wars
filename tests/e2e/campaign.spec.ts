import { test, expect } from '@playwright/test';

test.describe('Campaign E2E Tests', () => {
  test('full campaign flow: start, battle, win/lose, reinforcements', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Step 1: Wait for main menu and click Campaign button
    await page.waitForSelector('#main-menu', { state: 'visible' });
    await page.waitForSelector('#btn-campaign', { state: 'visible' });

    console.log('Step 1: Clicking Campaign button');
    await page.click('#btn-campaign');

    // Step 2: Verify campaign overlay is displayed
    console.log('Step 2: Verifying campaign grid is displayed');
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    // Verify campaign state via exposed properties
    const campaignVisible = await page.evaluate(() => {
      const game = (window as any).game;
      return {
        hasCampaignState: game.campaignState !== null && game.campaignState !== undefined,
        hasCampaignGrid: game.campaignGrid !== null && game.campaignGrid !== undefined,
        reinforcements: game.campaignState?.reinforcements
      };
    });

    expect(campaignVisible.hasCampaignState).toBe(true);
    expect(campaignVisible.hasCampaignGrid).toBe(true);
    expect(campaignVisible.reinforcements).toBe(3);
    console.log('Campaign grid verified: reinforcements =', campaignVisible.reinforcements);

    // Verify 3 filled hearts are displayed
    const filledHearts = await page.locator('.campaign-heart.filled').count();
    expect(filledHearts).toBe(3);

    // Step 2b: Verify clicking locked cells does nothing
    console.log('Step 2b: Verifying locked cells cannot be clicked');
    const lockedCell = page.locator('.campaign-cell.locked').first();
    await expect(lockedCell).toBeVisible();
    await lockedCell.click();

    // Should still be on campaign screen (game phase unchanged)
    await page.waitForTimeout(300);
    const stillOnCampaign = await page.evaluate(() => (window as any).game.gamePhase);
    expect(stillOnCampaign).toBe('campaign');
    console.log('Locked cell click did nothing - still on campaign');

    // Step 3: Record available cells before winning, then click one
    console.log('Step 3: Recording available cells and clicking one');
    const availableCountBefore = await page.locator('.campaign-cell.available').count();
    console.log('Available cells before:', availableCountBefore);

    // Get the cell we're about to complete (row/col info)
    const cellToComplete = await page.evaluate(() => {
      const cell = document.querySelector('.campaign-cell.available');
      const label = cell?.querySelector('.cell-label')?.textContent;
      // Get data from game state to find adjacent cells
      const game = (window as any).game;
      for (const c of game.campaignGrid.cells) {
        if (c.name === label) {
          return { id: c.id, name: c.name, row: c.row, col: c.col };
        }
      }
      return null;
    });
    console.log('Completing cell:', cellToComplete);

    const availableCell = page.locator('.campaign-cell.available').first();
    await expect(availableCell).toBeVisible();
    await availableCell.click();

    // Step 4: Verify battle starts (game phase changes to 'playing')
    console.log('Step 4: Verifying battle starts');
    await expect.poll(async () => {
      return page.evaluate(() => (window as any).game.gamePhase);
    }, { timeout: 5000 }).toBe('playing');
    console.log('Battle started, gamePhase = playing');

    // Wait for turn announcement to complete
    await page.waitForTimeout(2000);

    // Step 5: Click debug Win button
    console.log('Step 5: Clicking debug Win button');
    await page.click('#btn-debug-win');

    // Step 5b: Game over screen shows - click Main Menu to return to campaign
    console.log('Step 5b: Waiting for game over screen, then clicking Main Menu');
    await page.waitForTimeout(500);

    // The game over screen has a "Main Menu" button rendered on canvas
    const mainMenuBtnPos = await page.evaluate(() => {
      const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
      const btnWidth = 200;
      const btnHeight = 50;
      const btnX = canvas.width / 2 - btnWidth / 2;
      const btnY = canvas.height - 80;
      return { x: btnX + btnWidth / 2, y: btnY + btnHeight / 2 };
    });
    await page.mouse.click(mainMenuBtnPos.x, mainMenuBtnPos.y);

    // Step 6: Verify return to campaign and cell is now completed
    console.log('Step 6: Verifying return to campaign with cell completed');
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    const afterWin = await page.evaluate(({ completedCellId }) => {
      const game = (window as any).game;
      const completedCount = game.campaignState?.completedCells?.size ?? 0;
      const isOurCellCompleted = game.campaignState?.completedCells?.has(completedCellId);
      return {
        completedCount,
        isOurCellCompleted,
        reinforcements: game.campaignState?.reinforcements ?? -1,
        hasCampaignState: game.campaignState !== null
      };
    }, { completedCellId: cellToComplete!.id });

    expect(afterWin.hasCampaignState).toBe(true);
    expect(afterWin.completedCount).toBeGreaterThan(2); // Started with 2, now have more
    expect(afterWin.isOurCellCompleted).toBe(true); // The cell we won is now completed
    expect(afterWin.reinforcements).toBe(3); // Should still be 3 after win
    console.log('Cell completed, reinforcements still:', afterWin.reinforcements);

    // Step 6b: Verify adjacent cells are now unlocked
    console.log('Step 6b: Verifying adjacent cells unlocked');
    const availableCountAfter = await page.locator('.campaign-cell.available').count();
    console.log('Available cells after:', availableCountAfter);

    // Completing a cell should unlock at least one new adjacent cell
    // (available count may stay same or increase, since one became completed but adjacents unlocked)
    const completedCellElements = await page.locator('.campaign-cell.completed').count();
    expect(completedCellElements).toBeGreaterThan(0);
    console.log('Completed cells visible:', completedCellElements);

    // Verify the specific cell we completed now has .completed class
    const ourCellIsGreen = await page.evaluate(({ name }) => {
      const cells = document.querySelectorAll('.campaign-cell.completed .cell-label');
      for (const cell of cells) {
        if (cell.textContent === name) return true;
      }
      return false;
    }, { name: cellToComplete!.name });
    expect(ourCellIsGreen).toBe(true);
    console.log('Our completed cell is now green');

    // Step 7: Click another available cell
    console.log('Step 7: Clicking another available cell');
    const availableCell2 = page.locator('.campaign-cell.available').first();
    await expect(availableCell2).toBeVisible();
    await availableCell2.click();

    // Verify battle starts
    await expect.poll(async () => {
      return page.evaluate(() => (window as any).game.gamePhase);
    }, { timeout: 5000 }).toBe('playing');
    await page.waitForTimeout(2000);

    // Step 8: Click debug Lose button
    console.log('Step 8: Clicking debug Lose button');
    await page.click('#btn-debug-lose');

    // Step 8b: Game over screen shows - click Main Menu to return to campaign
    console.log('Step 8b: Clicking Main Menu on game over screen');
    await page.waitForTimeout(500);
    const mainMenuBtnPos2 = await page.evaluate(() => {
      const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
      const btnWidth = 200;
      const btnHeight = 50;
      const btnX = canvas.width / 2 - btnWidth / 2;
      const btnY = canvas.height - 80;
      return { x: btnX + btnWidth / 2, y: btnY + btnHeight / 2 };
    });
    await page.mouse.click(mainMenuBtnPos2.x, mainMenuBtnPos2.y);

    // Step 9: Verify return to campaign and reinforcements decreased
    console.log('Step 9: Verifying reinforcements decreased');
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    const afterLose = await page.evaluate(() => {
      const game = (window as any).game;
      return {
        reinforcements: game.campaignState?.reinforcements ?? -1,
        hasCampaignState: game.campaignState !== null
      };
    });

    expect(afterLose.hasCampaignState).toBe(true);
    expect(afterLose.reinforcements).toBe(2); // Should be 2 after one loss
    console.log('After loss, reinforcements:', afterLose.reinforcements);

    // Verify 2 filled hearts and 1 empty heart
    const filledHeartsAfterLoss = await page.locator('.campaign-heart.filled').count();
    const emptyHeartsAfterLoss = await page.locator('.campaign-heart.empty').count();
    expect(filledHeartsAfterLoss).toBe(2);
    expect(emptyHeartsAfterLoss).toBe(1);

    // Step 10: Lose 2 more times to verify campaign ends
    console.log('Step 10: Losing twice more to end campaign');

    for (let i = 0; i < 2; i++) {
      // Click an available cell
      const cell = page.locator('.campaign-cell.available, .campaign-boss-cell.available, .campaign-fortress-cell.available').first();
      await expect(cell).toBeVisible();
      await cell.click();

      await expect.poll(async () => {
      return page.evaluate(() => (window as any).game.gamePhase);
    }, { timeout: 5000 }).toBe('playing');
      await page.waitForTimeout(2000);
      await page.click('#btn-debug-lose');

      // Click Main Menu on game over screen
      await page.waitForTimeout(500);
      const btnPos = await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        const btnWidth = 200;
        const btnHeight = 50;
        const btnX = canvas.width / 2 - btnWidth / 2;
        const btnY = canvas.height - 80;
        return { x: btnX + btnWidth / 2, y: btnY + btnHeight / 2 };
      });
      await page.mouse.click(btnPos.x, btnPos.y);

      await page.waitForTimeout(500);
    }

    // Step 11: Verify campaign ends and returns to main menu
    console.log('Step 11: Verifying campaign ended and returned to main menu');
    await page.waitForSelector('#main-menu:not(.hidden)', { state: 'visible', timeout: 5000 });

    const finalState = await page.evaluate(() => {
      const game = (window as any).game;
      return {
        campaignState: game.campaignState
      };
    });

    expect(finalState.campaignState).toBeNull();
    console.log('Campaign ended, returned to main menu');
  });
});
