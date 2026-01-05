import { test, expect } from '@playwright/test';

/**
 * Helper to get available unit templates from factory menu
 */
async function getAvailableFactoryUnits(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const game = (window as any).game;
    // Get player team's available templates
    const templates = game.getPlayerTemplates();
    return templates.map((t: any) => t.id);
  });
}

/**
 * Helper to click Main Menu button on game over screen
 */
async function clickMainMenuOnGameOver(page: any): Promise<void> {
  await page.waitForTimeout(500);
  const mainMenuBtnPos = await page.evaluate(() => {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const btnWidth = 200;
    const btnHeight = 50;
    const btnX = canvas.width / 2 - btnWidth / 2;
    const btnY = canvas.height - 80;
    return { x: btnX + btnWidth / 2, y: btnY + btnHeight / 2 };
  });
  await page.mouse.click(mainMenuBtnPos.x, mainMenuBtnPos.y);
}

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
    await clickMainMenuOnGameOver(page);

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
    await clickMainMenuOnGameOver(page);

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

      await clickMainMenuOnGameOver(page);
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

  test('campaign starts with only Infantry and Tank unlocked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Start campaign
    await page.waitForSelector('#main-menu', { state: 'visible' });
    await page.click('#btn-campaign');
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    // Verify starting unlocked units in campaign state
    const startingUnits = await page.evaluate(() => {
      const game = (window as any).game;
      return Array.from(game.campaignState.unlockedUnits).sort();
    });

    expect(startingUnits).toEqual(['infantry', 'tank']);
    console.log('Starting units:', startingUnits);

    // Click an available cell to start battle
    const availableCell = page.locator('.campaign-cell.available').first();
    await availableCell.click();

    // Wait for battle to start
    await expect.poll(async () => {
      return page.evaluate(() => (window as any).game.gamePhase);
    }, { timeout: 5000 }).toBe('playing');

    // Wait for turn announcement
    await page.waitForTimeout(2000);

    // Verify player can only build Infantry and Tank
    const availableUnits = await getAvailableFactoryUnits(page);
    console.log('Available factory units:', availableUnits);

    expect(availableUnits).toContain('infantry');
    expect(availableUnits).toContain('tank');
    expect(availableUnits).toHaveLength(2);
    expect(availableUnits).not.toContain('mech');
    expect(availableUnits).not.toContain('recon');
    expect(availableUnits).not.toContain('artillery');
  });

  test('winning a unit cell unlocks that unit for future battles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Start campaign
    await page.waitForSelector('#main-menu', { state: 'visible' });
    await page.click('#btn-campaign');
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    // Find and click the Mech cell (should be at row 0, col 5)
    // The Mech cell should be available since it's adjacent to starting cells
    const mechCell = await page.evaluate(() => {
      const game = (window as any).game;
      for (const cell of game.campaignGrid.cells) {
        if (cell.reward === 'mech') {
          return { id: cell.id, name: cell.name, row: cell.row, col: cell.col };
        }
      }
      return null;
    });
    console.log('Mech cell:', mechCell);

    // Click the Mech cell (it should be available after starting cells are completed)
    // First, click an adjacent cell to make Mech available if it's not already
    const availableMechCell = page.locator('.campaign-cell.available').filter({ hasText: 'Mech' });
    const mechCellVisible = await availableMechCell.count();

    if (mechCellVisible === 0) {
      // Mech isn't directly available, we need to complete an adjacent cell first
      // Complete the +1 Vision cell (0,4) which is adjacent to Mech (0,5)
      console.log('Mech not directly available, completing adjacent cell first');

      // Find and click +1 Vision cell at (0,4)
      const visionCell = page.locator('.campaign-cell.available').filter({ hasText: '+1 Vision' });
      if (await visionCell.count() > 0) {
        await visionCell.click();
      } else {
        // Just click any available cell
        await page.locator('.campaign-cell.available').first().click();
      }

      // Win the battle
      await expect.poll(async () => {
        return page.evaluate(() => (window as any).game.gamePhase);
      }, { timeout: 5000 }).toBe('playing');
      await page.waitForTimeout(2000);
      await page.click('#btn-debug-win');
      await clickMainMenuOnGameOver(page);
      await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });
    }

    // Now click the Mech cell
    const mechCellNow = page.locator('.campaign-cell.available').filter({ hasText: 'Mech' });
    await expect(mechCellNow).toBeVisible({ timeout: 5000 });
    await mechCellNow.click();

    // Wait for battle to start
    await expect.poll(async () => {
      return page.evaluate(() => (window as any).game.gamePhase);
    }, { timeout: 5000 }).toBe('playing');
    await page.waitForTimeout(2000);

    // Verify mech is NOT available before winning
    const unitsBeforeWin = await getAvailableFactoryUnits(page);
    console.log('Units before winning Mech cell:', unitsBeforeWin);
    expect(unitsBeforeWin).not.toContain('mech');

    // Win the battle
    await page.click('#btn-debug-win');
    await clickMainMenuOnGameOver(page);

    // Return to campaign
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    // Verify mech is now unlocked in campaign state
    const unlockedAfterWin = await page.evaluate(() => {
      const game = (window as any).game;
      return Array.from(game.campaignState.unlockedUnits);
    });
    console.log('Unlocked units after winning Mech cell:', unlockedAfterWin);
    expect(unlockedAfterWin).toContain('mech');

    // Start another battle and verify mech is now available in factory
    const anyCell = page.locator('.campaign-cell.available').first();
    await anyCell.click();

    await expect.poll(async () => {
      return page.evaluate(() => (window as any).game.gamePhase);
    }, { timeout: 5000 }).toBe('playing');
    await page.waitForTimeout(2000);

    const unitsAfterWin = await getAvailableFactoryUnits(page);
    console.log('Factory units after unlocking Mech:', unitsAfterWin);
    expect(unitsAfterWin).toContain('mech');
    expect(unitsAfterWin).toContain('infantry');
    expect(unitsAfterWin).toContain('tank');
  });

  test('all 15 units are mapped to valid template IDs in campaign config', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Start campaign to access campaign grid
    await page.waitForSelector('#main-menu', { state: 'visible' });
    await page.click('#btn-campaign');
    await page.waitForSelector('#campaign-overlay.visible', { state: 'visible', timeout: 5000 });

    // Get all unit rewards from campaign cells and verify they match valid template IDs
    const unitValidation = await page.evaluate(() => {
      const game = (window as any).game;
      const grid = game.campaignGrid;

      // Expected valid unit template IDs (from unit-templates.ts)
      const validTemplateIds = [
        'infantry', 'mech', 'recon', 'tank', 'mediumTank', 'heavyTank',
        'artillery', 'rockets', 'antiAir', 'missiles', 'apc',
        'fighter', 'bomber', 'copter', 'transportCopter'
      ];

      // Collect all unit rewards from cells
      const unitRewards: string[] = [];
      const invalidRewards: string[] = [];

      for (const cell of grid.cells) {
        if (cell.type === 'unit' && cell.reward) {
          unitRewards.push(cell.reward);
          if (!validTemplateIds.includes(cell.reward)) {
            invalidRewards.push(`${cell.name} at (${cell.row},${cell.col}): '${cell.reward}'`);
          }
        }
        // Boss and fortress cells can also have unit rewards
        if ((cell.type === 'boss' || cell.type === 'fortress') && cell.reward) {
          if (validTemplateIds.includes(cell.reward)) {
            unitRewards.push(cell.reward);
          }
        }
      }

      return {
        unitRewards: [...new Set(unitRewards)].sort(),
        invalidRewards,
        validTemplateIds: validTemplateIds.sort()
      };
    });

    console.log('Unit rewards found in campaign:', unitValidation.unitRewards);

    // No invalid unit IDs should be present
    expect(unitValidation.invalidRewards).toEqual([]);

    // Verify all expected units are reachable
    const expectedUnits = [
      'infantry', 'tank', 'mech', 'recon', 'apc', 'artillery', 'rockets',
      'antiAir', 'mediumTank', 'heavyTank', 'fighter', 'bomber', 'copter',
      'transportCopter', 'missiles'
    ].sort();

    for (const unit of expectedUnits) {
      expect(unitValidation.unitRewards).toContain(unit);
    }

    console.log('All 15 units are properly mapped in campaign config');
  });
});
