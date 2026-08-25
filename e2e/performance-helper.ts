import { Page, expect } from '@playwright/test';

export interface PerformanceAuditResult {
  totalTransferBytes: number;
  jsTransferBytes: number;
  domNodeCount: number;
  ttfbMs: number;
  loadTimeMs: number;
  requestCount: number;
}

export interface PerformanceBudget {
  maxTotalTransferBytes?: number;
  maxJsTransferBytes?: number;
  maxDomNodeCount?: number;
  maxTtfbMs?: number;
  maxLoadTimeMs?: number;
  maxRequestCount?: number;
}

/**
 * Attaches network listeners, navigates to the target URL, and audits
 * page weight, DOM complexity, and navigation timing against a budget.
 */
export async function auditPagePerformance(
  page: Page,
  url: string,
  budget: PerformanceBudget = {}
): Promise<PerformanceAuditResult> {
  let totalTransferBytes = 0;
  let jsTransferBytes = 0;
  let requestCount = 0;

  page.on('response', (response) => {
    requestCount++;
    const headers = response.headers();
    const length = Number(headers['content-length'] || 0);
    totalTransferBytes += length;

    if (
      response.request().resourceType() === 'script' ||
      response.url().endsWith('.js') ||
      response.url().includes('_next/static/chunks')
    ) {
      jsTransferBytes += length;
    }
  });

  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const loadTimeMs = Date.now() - startTime;

  // Extract browser performance timing
  const navTiming = await page.evaluate(() => {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!entry) return { ttfb: 0 };
    return {
      ttfb: Math.round(entry.responseStart - entry.requestStart),
    };
  });

  // Extract DOM complexity
  const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

  const result: PerformanceAuditResult = {
    totalTransferBytes,
    jsTransferBytes,
    domNodeCount,
    ttfbMs: navTiming.ttfb,
    loadTimeMs,
    requestCount,
  };

  // Assert against provided budgets if set
  if (budget.maxTotalTransferBytes !== undefined) {
    expect(
      result.totalTransferBytes,
      `Total transfer size (${(result.totalTransferBytes / 1024).toFixed(1)} KB) should be < ${(budget.maxTotalTransferBytes / 1024).toFixed(1)} KB`
    ).toBeLessThanOrEqual(budget.maxTotalTransferBytes);
  }

  if (budget.maxJsTransferBytes !== undefined) {
    expect(
      result.jsTransferBytes,
      `JS transfer size (${(result.jsTransferBytes / 1024).toFixed(1)} KB) should be < ${(budget.maxJsTransferBytes / 1024).toFixed(1)} KB`
    ).toBeLessThanOrEqual(budget.maxJsTransferBytes);
  }

  if (budget.maxDomNodeCount !== undefined) {
    expect(
      result.domNodeCount,
      `DOM node count (${result.domNodeCount}) should be < ${budget.maxDomNodeCount}`
    ).toBeLessThanOrEqual(budget.maxDomNodeCount);
  }

  if (budget.maxTtfbMs !== undefined && result.ttfbMs > 0) {
    expect(
      result.ttfbMs,
      `TTFB (${result.ttfbMs} ms) should be < ${budget.maxTtfbMs} ms`
    ).toBeLessThanOrEqual(budget.maxTtfbMs);
  }

  if (budget.maxLoadTimeMs !== undefined) {
    expect(
      result.loadTimeMs,
      `Load time (${result.loadTimeMs} ms) should be < ${budget.maxLoadTimeMs} ms`
    ).toBeLessThanOrEqual(budget.maxLoadTimeMs);
  }

  return result;
}
