import { test, expect } from '@playwright/test';
import { auditPagePerformance } from './performance-helper';

test.describe('CinePoint Insights Performance & Heaviness Audits', () => {
  test('evaluates payload and charts rendering on /competitors/cinepoint/insights', async ({ page }) => {
    const result = await auditPagePerformance(page, 'http://127.0.0.1:3101/competitors/cinepoint/insights', {
      maxDomNodeCount: 2500,
      maxLoadTimeMs: 15000,
    });

    // Verify page loads without runtime errors
    await expect(page.getByRole('heading', { name: /Box Office Intelligence/i })).toBeVisible();

    console.log(`[CinePoint Insights Audit] DOM Nodes: ${result.domNodeCount}, TTFB: ${result.ttfbMs}ms, Load: ${result.loadTimeMs}ms`);
  });
});
