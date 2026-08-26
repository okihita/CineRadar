import { test, expect } from '@playwright/test';
import { auditPagePerformance } from './performance-helper';

test.describe('Consumer Web App Performance & Weight Audits', () => {
  test('evaluates lightweight payload and Core Web Vitals on /', async ({ page }) => {
    const result = await auditPagePerformance(page, 'http://127.0.0.1:3100/', {
      maxDomNodeCount: 1500,
      maxLoadTimeMs: 15000,
    });

    // Ensure main container is visible
    await expect(page.locator('main').or(page.locator('body'))).toBeVisible();

    console.log(`[Web App Audit] DOM Nodes: ${result.domNodeCount}, TTFB: ${result.ttfbMs}ms, Load: ${result.loadTimeMs}ms`);
  });
});
