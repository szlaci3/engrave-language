import { test, expect, type Page } from '@playwright/test';
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
    await expect(page.locator('.world-controls button').nth(5)).toBeDisabled();
    await page.screenshot({ path: `test-results/final-stone-${width}.png` });
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
