import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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

async function expandControls(page: Page) {
  const button = page.locator('[data-control=expand]');
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function control(page: Page, index: number) {
  const names = ['dutch', 'chinese', 'listen-chinese', 'listen-dutch', 'previous', 'next', 'back', 'forward', 'expand'];
  if ([0, 1, 4, 6].includes(index)) await expandControls(page);
  return page.locator(`[data-control="${names[index]}"]`);
}
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
  await (await control(page, 7)).hover();
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
    await (await control(page, 0)).click(); // Dutch first
    await expect(page.locator('.world-heading [role=status]')).toContainText('water');
    for (let i = 1; i <= 2; i++) { await (await control(page, 5)).click(); await position(page, 3.6 * i); }
    await page.clock.install();
    await timedWalk(page, 100);
    await expect((await control(page, 5))).toBeEnabled();
    await (await control(page, 5)).click(); await position(page, 10.8);
    await expect(page.locator('.world-heading [role=status]')).toContainText('书');
    await expect((await control(page, 5))).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`final-stone-${width}.png`) });
    await (await control(page, 4)).click(); await position(page, 7.2);
    await expandControls(page);
    await page.locator('[data-control=edit]').click();
    await expect(page.locator('dialog')).toBeVisible();
    await page.locator('dialog textarea').first().fill('boeken');
    await page.locator('dialog button[type=submit]').click();
    await expect(page.locator('dialog')).toHaveCount(0);
    await position(page, 7.2);
    await expect(page.locator('.world-heading [role=status]')).toContainText('boeken');
    await page.reload();
    await (await control(page, 0)).click();
    await expect(page.locator('.world-scene')).toHaveAttribute('data-position', '0.0000');
    for (let i=1; i<=2; i++) { await (await control(page, 5)).click(); await position(page, 3.6*i); }
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
  await expandControls(page);
  await page.locator('#walk-speed').fill('3');
  await (await control(page, 4)).click(); await position(page, 0);
  await timedWalk(page, 320);
  const fast = Number(await page.locator('.world-scene').getAttribute('data-position'));
  expect(fast).toBeGreaterThan(first * 1.5);
  await page.reload(); await expandControls(page);
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
  await (await control(page, 5)).click();
  await expect(page.locator('.world-fallback h2')).toHaveText('water');
  await (await control(page, 0)).click();
  await expect(page.locator('.world-fallback h2')).toHaveText('water');
  await expect((await control(page, 7))).toBeDisabled();
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


test('3D continues through repeated decks and can retrace earlier rounds', async ({ page }) => {
  await createDeck(page);
  page.on('dialog', () => { throw new Error('Practice must not ask for confirmation'); });
  for (let i = 1; i <= 3; i++) {
    await (await control(page, 5)).click();
    await position(page, i * 3.6);
  }
  await (await control(page, 5)).click();
  await position(page, 14.4);
  await expect(page.locator('.world-complete')).toBeVisible();
  await expect(page.locator('.world-heading [role=status]')).toContainText('水');
  await page.screenshot({ path: test.info().outputPath('first-stone-next-round.png') });
  for (let i = 1; i <= 2; i++) {
    await (await control(page, 5)).click();
    await position(page, (4 + i) * 3.6);
  }
  await page.clock.install();
  await timedWalk(page, 1000);
  await expect(page.locator('.world-complete')).toBeVisible();
  expect(Number(await page.locator('.world-scene').getAttribute('data-position'))).toBeGreaterThan(25.2);
  await expect(page.locator('.world-heading [role=status]')).toHaveText('1 / 4 · 水');
  const stopped = Number(await page.locator('.world-scene').getAttribute('data-position'));
  await page.waitForTimeout(250); await position(page, stopped);
  // Retrace both rounds and continue into negative occurrences as well.
  for (let occurrence = 7; occurrence >= -5; occurrence--) {
    await (await control(page, 4)).click();
    await position(page, occurrence * 3.6);
    const index = ((occurrence % 4) + 4) % 4;
    await expect(page.locator('.world-heading [role=status]')).toHaveText(`${index + 1} / 4 · ${['水', 'water', '书', 'boek'][index]}`);
  }
});


test('held walking crosses the deck seam without resetting, skipping, or stopping', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await createDeck(page);
  for (let i = 1; i <= 3; i++) {
    await (await control(page, 5)).click(); await position(page, i * 3.6);
  }
  await page.clock.install();
  await (await control(page, 7)).hover();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await page.mouse.down();
  let previous = 10.8;
  const seen = new Set<string>();
  for (let i = 0; i < 18; i++) {
    await page.clock.runFor(160);
    const next = Number(await page.locator('.world-scene').getAttribute('data-position'));
    expect(next - previous).toBeGreaterThan(.65);
    expect(next - previous).toBeLessThan(.9);
    previous = next;
    seen.add((await page.locator('.world-heading [role=status]').textContent())!);
  }
  await page.mouse.up();
  await page.clock.runFor(300);
  await position(page, previous);
  expect([...seen]).toEqual(['1 / 4 · 水', '2 / 4 · water', '3 / 4 · 书', '4 / 4 · boek']);
  await page.clock.resume();
  // Reverse across multiple seams while the same hold remains active.
  await (await control(page, 8)).click();
  await page.locator('#walk-speed').fill('3');
  await (await control(page, 6)).hover();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await page.mouse.down();
  await page.clock.runFor(2000);
  await page.mouse.up();
  await page.clock.runFor(300);
  const reversed = Number(await page.locator('.world-scene').getAttribute('data-position'));
  expect(reversed).toBeLessThan(0);
  await page.clock.resume();
  await page.waitForTimeout(250); await position(page, reversed);
  await page.screenshot({ path: test.info().outputPath('backward-round-mobile.png') });
});

test('new covers reuse stone artwork and repeated occurrences reuse cover textures', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.addInitScript(() => {
    localStorage.setItem('engrave-walk-speed', '3');
    const original = CanvasRenderingContext2D.prototype.createImageData;
    CanvasRenderingContext2D.prototype.createImageData = function(...args: Parameters<typeof original>) {
      if (this.canvas.width === 1024 && this.canvas.height === 319) {
        document.documentElement.dataset.stoneArtworkCount = String(Number(document.documentElement.dataset.stoneArtworkCount || 0) + 1);
      }
      return Reflect.apply(original, this, args);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args: Parameters<typeof fillText>) {
      if (this.canvas.width === 1024 && this.canvas.height === 319) {
        document.documentElement.dataset.stoneTextCount = String(Number(document.documentElement.dataset.stoneTextCount || 0) + 1);
      }
      return Reflect.apply(fillText, this, args);
    };
  });
  await createDeck(page);
  await expect(page.locator('html')).toHaveAttribute('data-stone-artwork-count', '2');
  const textCount = await page.locator('html').getAttribute('data-stone-text-count');
  await page.clock.install();
  await timedWalk(page, 2400);
  expect(Number(await page.locator('.world-scene').getAttribute('data-position'))).toBeGreaterThan(30);
  await expect(page.locator('html')).toHaveAttribute('data-stone-artwork-count', '2');
  await expect(page.locator('html')).toHaveAttribute('data-stone-text-count', textCount!);
  // A larger deck introduces genuinely new covers into the visible window.
  await page.goto('/files/new');
  await page.locator('textarea').fill(Array.from({ length: 30 }, (_, i) => `word${i} 词${i}`).join('\n'));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/flashcards$/);
  await position(page, 0);
  const initial = Number(await page.locator('html').getAttribute('data-stone-text-count'));
  await timedWalk(page, 2000);
  expect(Number(await page.locator('html').getAttribute('data-stone-text-count'))).toBeGreaterThan(initial);
  await expect(page.locator('html')).toHaveAttribute('data-stone-artwork-count', '2');
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
    await (await control(page, 5)).click();
    await position(page, i * 3.6);
  }
  // Index 12: eleven stones remain after the current one. No preview yet.
  await expect(page.locator('canvas')).not.toHaveAttribute('aria-description', /词0 → woord0/);
  await (await control(page, 5)).click(); await position(page, 13 * 3.6);
  // Index 13: ten remain, and the beginning of the next round is already visible.
  await expect(page.locator('canvas')).toHaveAttribute('aria-description', /词11 → woord11 → 词0 → woord0/);
  await expect(page.locator('.world-complete')).toHaveCount(0);
  await expect(page.locator('.world-heading [role=status]')).toContainText('14 / 24');
  await page.screenshot({ path: test.info().outputPath('next-round-ahead-mobile.png') });
  for (let i = 14; i <= 23; i++) {
    await (await control(page, 5)).click();
    await position(page, i * 3.6);
  }
  await expect(page.locator('.world-complete')).toHaveCount(0);
  await (await control(page, 5)).click(); await position(page, 24 * 3.6);
  await expect(page.locator('.world-complete')).toBeVisible();
  await expect(page.locator('.world-heading [role=status]')).toContainText('1 / 24');
});

test('mobile expanded controls, height toggle, outside dismissal and exit', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await createDeck(page);
  await expect(page.locator('.world-primary-controls button')).toHaveCount(5);
  await expect(page.locator('.world-dock')).toHaveCSS('bottom', '126.6px');
  await expandControls(page);
  await expect(page.locator('.world-secondary-controls button')).toHaveCount(4);
  await expect(page.locator('[data-control=next] path')).toHaveAttribute('transform', 'rotate(-90 12 12)');
  await expect(page.locator('[data-control=previous] path')).toHaveAttribute('transform', 'rotate(-90 12 12)');
  const height = page.locator('[data-control=height]');
  const highLabel = await height.textContent();
  await height.click();
  await expect(page.locator('.world-dock')).toHaveCSS('bottom', '5px');
  expect(await height.textContent()).not.toBe(highLabel);
  await page.mouse.click(300, 160);
  await expect(page.locator('#world-options')).toHaveCount(0);
  await expandControls(page);
  await height.click();
  await expect(page.locator('.world-dock')).toHaveCSS('bottom', '126.6px');
  await expect(height).toHaveText(highLabel!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('expanded-mobile.png') });
  await page.locator('[data-control=exit]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: '3D', exact: true })).toBeVisible();
});


test('control height persists in Dexie and database backups', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await createDeck(page);
  const deckUrl = page.url();
  await expandControls(page);
  await page.locator('[data-control=height]').click();
  await expect(page.locator('.world-dock')).toHaveClass(/world-dock-low/);
  // Export checks the actual Dexie settings store, rather than another browser cache.
  await page.goto('/data');
  const downloading = page.waitForEvent('download');
  await page.locator('.data-actions button').first().click();
  const download = await downloading;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.data.settings).toContainEqual({ key: 'world-low-controls', value: 'true', updatedAt: expect.any(String) });
  await page.evaluate(() => localStorage.clear());
  await page.goto(deckUrl);
  await expect(page.locator('.world-scene')).toHaveAttribute('data-position', '0.0000');
  await expect(page.locator('.world-dock')).toHaveClass(/world-dock-low/);
  await page.reload();
  await expect(page.locator('.world-dock')).toHaveClass(/world-dock-low/);
  await expandControls(page);
  await page.locator('[data-control=height]').click();
  await expect(page.locator('.world-dock')).not.toHaveClass(/world-dock-low/);
  await page.reload();
  await expect(page.locator('.world-scene')).toHaveAttribute('data-position', '0.0000');
  await expect(page.locator('.world-dock')).not.toHaveClass(/world-dock-low/);
});

test('Next double click queues consecutive stone animations, capped at four, and blur cancels them', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await createDeck(page);
  const next = page.locator('[data-control=next]');
  await next.hover();
  const box = (await next.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.world-scene')!;
    const samples: number[] = [];
    (window as unknown as { stepPositions: number[] }).stepPositions = samples;
    new MutationObserver(() => samples.push(Number(host.dataset.position))).observe(host, { attributes: true, attributeFilter: ['data-position'] });
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await page.mouse.dblclick(point.x, point.y);
  await page.clock.runFor(450);
  const between = Number(await page.locator('.world-scene').getAttribute('data-position'));
  expect(between).toBeGreaterThan(3.6);
  expect(between).toBeLessThan(7.2);
  await page.clock.runFor(450);
  await position(page, 7.2);
  // Six rapid clicks request only four moves, spanning a deck boundary.
  for (let i = 0; i < 6; i++) await page.mouse.click(point.x, point.y);
  await page.clock.runFor(1700);
  await position(page, 21.6);
  const samples = await page.evaluate(() => (window as unknown as { stepPositions: number[] }).stepPositions);
  expect(samples.filter((value, i) => i === 0 || samples[i - 1] !== value)).toEqual(expect.arrayContaining([3.6, 7.2, 10.8, 14.4, 18, 21.6]));
  for (let i = 0; i < 4; i++) await page.mouse.click(point.x, point.y);
  await page.clock.runFor(100);
  const stopped = Number(await page.locator('.world-scene').getAttribute('data-position'));
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.clock.runFor(600);
  await position(page, stopped);
  await page.clock.resume();
});


test('Dutch defaults to Wiktionary while an explicitly saved browser choice remains selected', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('#dutch-audio-source')).toHaveValue('wiktionary');
  await expect(page.locator('#chinese-audio-source')).toHaveValue('speechSynthesis');
  await page.locator('#dutch-audio-source').selectOption('speechSynthesis');
  await page.locator('button[type=submit]').click();
  await expect(page.locator('.form-message-success')).toBeVisible();
  await page.reload();
  await expect(page.locator('#dutch-audio-source')).toHaveValue('speechSynthesis');
});

test('Dutch article-free lookups are shared by preloading and playback without changing displayed or fallback text', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => {
    const state = window as unknown as { spoken: string[]; played: string[] };
    state.spoken = []; state.played = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [], cancel() {},
      speak(utterance: SpeechSynthesisUtterance) { state.spoken.push(utterance.text); },
    } });
    Object.defineProperty(window, 'Audio', { configurable: true, value: class {
      src: string;
      constructor(src: string) { this.src = src; }
      pause() {}
      play() { state.played.push(this.src); return Promise.resolve(); }
    } });
  });
  const entries = ['de tafel', 'het huis', 'DE boom', 'HET boek', 'deur', 'hetzelfde', 'de'];
  const lookups: string[] = [];
  await page.route('https://en.wiktionary.org/**', route => {
    const title = new URL(route.request().url()).searchParams.get('page')!;
    lookups.push(title);
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: title === 'tafel' ? { parse: { wikitext: '{{audio|nl|Nl-tafel.ogg}}' } } : { error: { code: 'missingtitle' } },
    });
  });
  await page.route('https://commons.wikimedia.org/**', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' }, contentType: 'audio/ogg', body: 'mock audio',
  }));
  await page.goto('/files/new');
  await page.locator('textarea').fill(entries.map(text => `${text} 字`).join('\n'));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/flashcards$/);
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-control=expand]').click();
  await page.locator('[data-control=dutch]').click();
  await expect(page.locator('.world-heading [role=status]')).toContainText('de tafel');
  await page.locator('[data-control=listen-dutch]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { played: string[] }).played.length)).toBe(1);
  expect(lookups).toEqual(['tafel']);
  expect(await page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toEqual([]);
  // The deck view preloads the remaining words using exactly the same lookup normalization.
  await page.goto(page.url().replace(/\/flashcards$/, ''));
  const words = page.locator('.entry-dutch-button');
  await expect(words).toHaveText(entries);
  await expect.poll(() => [...new Set(lookups)].sort()).toEqual(['tafel', 'huis', 'boom', 'boek', 'deur', 'hetzelfde', 'de'].sort());
  const lookupCount = lookups.length;
  for (let i = 1; i < entries.length; i++) {
    await words.nth(i).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toContain(entries[i]);
  }
  expect(lookups.length).toBe(lookupCount);
  await expect(words).toHaveText(entries);
});

test('desktop WASD walking, queued steps and control order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await createDeck(page);
  await expect(page.locator('.world-heading a')).toHaveText('Engrave Language');
  await expect(page.locator('[data-control=next] .world-key-hint')).toBeVisible();
  await expandControls(page);
  expect(await page.locator('.world-secondary-controls button').evaluateAll(buttons => buttons.map(button => button.getAttribute('data-control')))).toEqual(['previous', 'back', 'dutch', 'chinese']);
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await position(page, 7.2);
  await page.keyboard.press('a');
  await position(page, 3.6);
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await page.locator('.world-scene').getAttribute('data-position'))).toBeGreaterThan(4);
  await page.keyboard.up('w');
  await page.keyboard.down('s');
  await expect.poll(async () => Number(await page.locator('.world-scene').getAttribute('data-position'))).toBeLessThan(3.6);
  await page.keyboard.up('s');
  await page.locator('[data-control=edit]').click();
  const input = page.locator('dialog textarea').first();
  await input.fill('');
  await input.pressSequentially('wasd');
  await expect(input).toHaveValue('wasd');
});

test('Dutch stones dynamically size up to three lines', async ({ page }) => {
  await page.addInitScript(() => {
    const draws: { text: string; font: string; width: number; available: number }[] = [];
    Object.assign(window, { stoneTextDraws: draws });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.width === 1024) draws.push({ text, font: this.font, width: this.measureText(text).width, available: this.canvas.width - 150 });
      original.call(this, text, x, y, ...(maxWidth === undefined ? [] : [maxWidth]));
    };
  });
  const reference = 'Open de app op je smartphone';
  const wrapped = 'controleer het bedrag van je aankoop';
  const long = 'Dit is een bijzonder lange Nederlandse zin met heel veel woorden die ook over twee regels nog kleiner moet worden om helemaal op de steen te passen';
  await page.goto('/files/new');
  await page.locator('#deck-title').fill('Readable Dutch');
  await page.locator('textarea').fill(`${reference} 水\n${wrapped} 书\n${long} 世界`);
  await page.locator('button[type=submit]').click();
  await expect(page.locator('.world-scene')).toHaveAttribute('data-position', '0.0000');
  await expect.poll(() => page.evaluate(text => (window as unknown as { stoneTextDraws: { text: string }[] }).stoneTextDraws.some(draw => draw.text === text), reference)).toBe(true);
  const draws = await page.evaluate(() => (window as unknown as { stoneTextDraws: { text: string; font: string; width: number; available: number }[] }).stoneTextDraws);
  const referenceDraw = draws.find(draw => draw.text === reference)!;
  expect(referenceDraw).toBeTruthy();
  const referenceSize = parseFloat(referenceDraw.font);
  for (const [text, smaller] of [[wrapped, false], [long, true]] as const) {
    const lines = draws.filter(draw => draw.text.length > 10 && text.includes(draw.text) && draw.text !== reference);
    expect(lines).toHaveLength(smaller ? 3 : 2);
    expect(lines.map(line => line.text).join(' ')).toBe(text);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(line.available);
      if (smaller) expect(parseFloat(line.font)).toBeLessThan(referenceSize);
      else expect(parseFloat(line.font)).toBeGreaterThan(referenceSize);
    }
  }
});

for (const mode of ['off', 'front', 'back', 'both']) {
  test(`audio autoplay ${mode} persists and applies to both practice views`, async ({ page }) => {
    await page.addInitScript(() => {
      const spoken: string[] = [];
      Object.assign(window, { spoken });
      window.speechSynthesis.speak = utterance => { spoken.push(utterance.text); };
      window.speechSynthesis.cancel = () => {};
    });
    await createDeck(page);
    const worldUrl = page.url();
    await page.goto('/settings');
    await page.locator('#audio-autoplay').selectOption(mode);
    await page.locator('#dutch-audio-source').selectOption('speechSynthesis');
    await page.locator('button[type=submit]').click();
    await page.reload();
    await expect(page.locator('#audio-autoplay')).toHaveValue(mode);
    for (const suffix of ['', '/2d']) {
      await page.goto(worldUrl + suffix);
      const spoken = () => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);
      if (suffix) await expect(page.locator('.flashcard-card')).toBeVisible();
      else await expect(page.locator('canvas')).toBeVisible();
      if (mode === 'front' || mode === 'both') await expect.poll(spoken).toEqual(['水']);
      else expect(await spoken()).toEqual([]);
      if (suffix) await page.locator('.flashcard-card').click();
      else { await page.locator('[data-control=next]').click(); await position(page, 3.6); }
      const expected = mode === 'both' ? ['水', 'water'] : mode === 'front' ? ['水'] : mode === 'back' ? ['water'] : [];
      await expect.poll(spoken).toEqual(expected);
    }
  });
}
