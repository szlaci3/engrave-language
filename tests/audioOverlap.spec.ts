import { test, expect } from '@playwright/test';

test('recordings overlap and speech does not cancel active recordings or earlier speech', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { played: 0, paused: 0, cancelled: 0, spoken: [] as string[] };
    Object.assign(window, { audioState: state });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [], cancel() { state.cancelled++; },
      speak(utterance: SpeechSynthesisUtterance) { state.spoken.push(utterance.text); },
    } });
    Object.defineProperty(window, 'Audio', { configurable: true, value: class {
      src: string;
      constructor(src: string) { this.src = src; }
      pause() { state.paused++; }
      play() { state.played++; return Promise.resolve(); }
    } });
  });
  await page.route('https://en.wiktionary.org/**', route => route.fulfill({ json: {
    parse: { wikitext: '{{audio|nl|Nl-water.ogg}}' },
  } }));
  await page.route('https://commons.wikimedia.org/**', route => route.fulfill({
    contentType: 'audio/ogg', body: 'mock recording',
  }));
  await page.goto('/files/new');
  await page.locator('textarea').fill('water 水');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/flashcards$/);
  await page.goto(page.url().replace(/\/flashcards$/, ''));
  await page.locator('.entry-dutch-button').click();
  await page.locator('.entry-dutch-button').click();
  const state = () => page.evaluate(() => (window as unknown as {
    audioState: { played: number; paused: number; cancelled: number; spoken: string[] };
  }).audioState);
  await expect.poll(async () => (await state()).played).toBe(2);
  await page.locator('.entry-chinese-button').click();
  await page.locator('.entry-chinese-button').click();
  await expect.poll(async () => (await state()).spoken.length).toBe(2);
  expect((await state()).paused).toBe(0);
  expect((await state()).cancelled).toBe(0);
});
