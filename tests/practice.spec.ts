import { test, expect, type Page } from '@playwright/test';

// Use Node's configured CA trust for proxied HTTPS, with verification enabled.
test.beforeEach(async ({ page }) => {
  if (process.env.ENGRAVE_TEST_PROXY) {
    await page.route('https://**/*', async route => {
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } catch (error) {
        // Reload can cancel an older document's requests while Node is still
        // fetching them. Chromium has already handled those routes by aborting.
        if (page.isClosed() || route.request().failure() ||
          (error instanceof Error && error.message.includes('Route is already handled'))) return;
        throw error;
      }
    });
    if (process.env.ENGRAVE_TEST_URL) {
      const response = await page.goto(process.env.ENGRAVE_TEST_URL);
      expect(response?.status(), 'The deployed site must be reachable before testing the app').toBe(200);
    }
  }
});
// Assertions are finished; canceled reload requests must not fail teardown.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

async function createDeck(page: Page, title = 'Practice') {
  await page.route('https://en.wiktionary.org/**', r => r.fulfill({ json: { query: { pages: [] } } }));
  await page.goto('/files/new');
  await page.locator('#deck-title').fill(title);
  await page.locator('textarea').fill('water 水\nboek 书');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/flashcards$/);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.world-scene')).toHaveAttribute('data-position', '0.0000');
}
async function position(page: Page, value: number) {
  await expect.poll(async () => Number(await page.locator('.world-scene').getAttribute('data-position'))).toBeCloseTo(value, 3);
}
async function timedWalk(page: Page, duration: number) {
  await page.locator('.world-controls button').nth(7).hover();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await page.mouse.down();
  await page.clock.runFor(duration);
  await page.mouse.up();
  await page.clock.resume();
}
for (const width of [360, 1280]) {
  test(`practice and edit in ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await createDeck(page);
    await page.locator('.world-controls button').nth(0).click(); // Dutch first
    await expect(page.locator('.world-heading [role=status]')).toContainText('water');
    for (let i = 1; i <= 2; i++) { await page.locator('.world-controls button').nth(5).click(); await position(page, 3.6 * i); }
    await page.clock.install();
    await timedWalk(page, 100);
    await expect(page.locator('.world-controls button').nth(5)).toBeEnabled();
    await page.locator('.world-controls button').nth(5).click(); await position(page, 10.8);
    await expect(page.locator('.world-heading [role=status]')).toContainText('书');
    await expect(page.locator('.world-controls button').nth(5)).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`final-stone-${width}.png`) });
    await page.locator('.world-controls button').nth(4).click(); await position(page, 7.2);
    await page.locator('.world-controls button').nth(8).click();
    await page.locator('.world-options button').click();
    await expect(page.locator('dialog')).toBeVisible();
    await page.locator('dialog textarea').first().fill('boeken');
    await page.locator('dialog button[type=submit]').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await position(page, 7.2);
    await expect(page.locator('.world-heading [role=status]')).toContainText('boeken');
    await page.reload();
    await page.locator('.world-controls button').nth(0).click();
    await expect(page.locator('.world-scene')).toHaveAttribute('data-position', '0.0000');
    for (let i=1; i<=2; i++) { await page.locator('.world-controls button').nth(5).click(); await position(page, 3.6*i); }
    await expect(page.locator('.world-heading [role=status]')).toContainText('boeken');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('new deck draft survives reload and default title is generated', async ({ page }) => {
  await page.goto('/files/new');
  await page.locator('#deck-title').fill('My draft');
  await page.locator('textarea').fill('water 水');
  await page.reload();
  await expect(page.locator('#deck-title')).toHaveValue('My draft');
  await expect(page.locator('textarea')).toHaveValue('water 水');
  await page.locator('#deck-title').fill('');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/flashcards$/);
  await expect(page.locator('h1')).toContainText('water —');
  await page.goto('/files/new');
  await expect(page.locator('textarea')).toHaveValue('');
});
test('continuous walk stops on release and speed changes only continuous walk', async ({ page }) => {
  await createDeck(page);
  await page.clock.install();
  await timedWalk(page, 320);
  const first = Number(await page.locator('.world-scene').getAttribute('data-position'));
  expect(first).toBeGreaterThan(0);
  await page.waitForTimeout(350); await position(page, first);
  await page.locator('.world-controls button').nth(8).click();
  await page.locator('#walk-speed').fill('3');
  await page.locator('.world-controls button').nth(4).click(); await position(page, 0);
  await timedWalk(page, 320);
  const fast = Number(await page.locator('.world-scene').getAttribute('data-position'));
  expect(fast).toBeGreaterThan(first * 1.5);
  await page.reload(); await page.locator('.world-controls button').nth(8).click();
  await expect(page.locator('#walk-speed')).toHaveValue('3');
});

test('practice remains usable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/files/new');
  await page.locator('textarea').fill('water 水\nboek 书');
  await page.locator('button[type=submit]').click();
  await expect(page.locator('.world-fallback')).toBeVisible();
  await expect(page.locator('.world-fallback h2')).toHaveText('水');
  await page.locator('.world-controls button').nth(5).click();
  await expect(page.locator('.world-fallback h2')).toHaveText('water');
  await page.locator('.world-controls button').nth(0).click();
  await expect(page.locator('.world-fallback h2')).toHaveText('water');
  await expect(page.locator('.world-controls button').nth(7)).toBeDisabled();
});

test('deck buttons open working 2D and 3D practice on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await createDeck(page);
  const worldUrl = page.url();
  await page.goto('/');
  await page.getByRole('link', { name: '2D', exact: true }).click();
  await expect(page).toHaveURL(/\/flashcards\/2d$/);
  await expect(page.locator('.flashcard-text')).toHaveText('水');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('.flashcard-card').click();
  await expect(page.locator('.flashcard-text')).toHaveText('water');
  await page.locator('.flashcard-nav-row button').last().click();
  await expect(page.locator('.flashcard-text')).toHaveText('书');
  await page.locator('.flashcard-nav-row button').last().click();
  await expect(page.locator('.flashcard-text')).toHaveText('水');
  await expect(page.locator('.form-message-success')).toBeVisible();
  await page.reload();
  await expect(page.locator('.flashcard-card')).toBeVisible();
  await page.goto(worldUrl.replace(/\/flashcards$/, ''));
  await expect(page.getByRole('link', { name: '2D', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('3D loops from the last stone with a nonblocking notice', async ({ page }) => {
  await createDeck(page);
  page.on('dialog', () => { throw new Error('Practice must not ask for confirmation'); });
  for (let i = 1; i <= 3; i++) {
    await page.locator('.world-controls button').nth(5).click();
    await position(page, i * 3.6);
  }
  await page.locator('.world-controls button').nth(5).click();
  await position(page, 0);
  await expect(page.locator('.world-complete')).toBeVisible();
  await expect(page.locator('.world-heading [role=status]')).toContainText('水');
  for (let i = 1; i <= 2; i++) {
    await page.locator('.world-controls button').nth(5).click();
    await position(page, i * 3.6);
  }
  await page.clock.install();
  await timedWalk(page, 1000);
  await expect(page.locator('.world-complete')).toBeVisible();
  expect(Number(await page.locator('.world-scene').getAttribute('data-position'))).toBeLessThan(7.2);
  const stopped = Number(await page.locator('.world-scene').getAttribute('data-position'));
  await page.waitForTimeout(250); await position(page, stopped);
});

test('next round is visible ten stones before the end without an early notice', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/files/new');
  await page.locator('textarea').fill(Array.from({ length: 12 }, (_, i) => `woord${i} 词${i}`).join('\n'));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/flashcards$/);
  await expect(page.locator('canvas')).toBeVisible();
  for (let i = 1; i <= 12; i++) {
    await page.locator('.world-controls button').nth(5).click();
    await position(page, i * 3.6);
  }
  // Index 12: eleven stones remain after the current one. No preview yet.
  await expect(page.locator('canvas')).not.toHaveAttribute('aria-description', /词0 → woord0/);
  await page.locator('.world-controls button').nth(5).click(); await position(page, 13 * 3.6);
  // Index 13: ten remain, and the beginning of the next round is already visible.
  await expect(page.locator('canvas')).toHaveAttribute('aria-description', /词11 → woord11 → 词0 → woord0/);
  await expect(page.locator('.world-complete')).toHaveCount(0);
  await expect(page.locator('.world-heading [role=status]')).toContainText('14 / 24');
  await page.screenshot({ path: test.info().outputPath('next-round-ahead-mobile.png') });
  for (let i = 14; i <= 23; i++) {
    await page.locator('.world-controls button').nth(5).click();
    await position(page, i * 3.6);
  }
  await expect(page.locator('.world-complete')).toHaveCount(0);
  await page.locator('.world-controls button').nth(5).click(); await position(page, 0);
  await expect(page.locator('.world-complete')).toBeVisible();
  await expect(page.locator('.world-heading [role=status]')).toContainText('1 / 24');
});
