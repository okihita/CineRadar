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
    await expect(page.getByText(/Theatrical Signals|Market Signals|Theatrical Lineup|Social Crawl Scheduled|No Crawl Snapshot|Scheduled Data Pipeline/i).first()).toBeVisible();

    // Verify tab interactions work smoothly if data is present
    const commentsTab = page.getByRole('tab', { name: /Audience Comments/i });
    if (await commentsTab.isVisible()) {
      await commentsTab.click();
    }

    // Ensure DOM remains healthy
    const domCountAfterTab = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(domCountAfterTab).toBeLessThan(2500);

    console.log(`[TikTok Radar Audit] DOM Nodes: ${result.domNodeCount}, TTFB: ${result.ttfbMs}ms, Load: ${result.loadTimeMs}ms`);
  });

  test('evaluates interactive Xyflow graph and sequence diagram on /tiktok/workflow', async ({ page }) => {
    const result = await auditPagePerformance(page, 'http://127.0.0.1:3101/tiktok/workflow', {
      maxDomNodeCount: 2000,
      maxLoadTimeMs: 15000,
    });

    // Verify header and pipeline stages
    await expect(page.getByRole('heading', { name: /TikTok Intelligence Pipeline/i })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.react-flow__renderer', { state: 'visible', timeout: 8000 });

    const sequenceBtn = page.getByRole('button', { name: /Sequence & Step Breakdown/i });
    await expect(sequenceBtn).toBeVisible();
    await sequenceBtn.click();

    await expect(page.getByText(/Chronological step-by-step pipeline sequence/i)).toBeVisible();

    console.log(`[TikTok Workflow Audit] DOM Nodes: ${result.domNodeCount}, TTFB: ${result.ttfbMs}ms, Load: ${result.loadTimeMs}ms`);
  });
});
