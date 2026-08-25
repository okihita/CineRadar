import { test, expect } from '@playwright/test';
import { auditPagePerformance } from './performance-helper';

test.describe('TikTok Radar Performance & Heaviness Audits', () => {
  test('evaluates payload, DOM complexity and interactive rendering on /tiktok/explorer', async ({ page }) => {
    const result = await auditPagePerformance(page, 'http://127.0.0.1:3101/tiktok/explorer', {
      maxDomNodeCount: 2000,
      maxLoadTimeMs: 15000, // Generous allowance
    });

    // Verify critical elements render properly
    await expect(page.getByRole('heading', { name: 'TikTok Radar' })).toBeVisible();
    await expect(page.getByText('Daily Market Signals')).toBeVisible();

    // Verify tab interactions work smoothly
    const commentsTab = page.getByRole('tab', { name: /Audience Comments/i });
    await expect(commentsTab).toBeVisible();
    await commentsTab.click();

    // Ensure DOM remains healthy after switching tabs
    const domCountAfterTab = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(domCountAfterTab).toBeLessThan(2500);

    console.log(`[TikTok Radar Audit] DOM Nodes: ${result.domNodeCount}, TTFB: ${result.ttfbMs}ms, Load: ${result.loadTimeMs}ms`);
  });
});
