import { test, expect, type Page } from '@playwright/test';
import { makeQuestion, SPEED_RUN_TRIO_SPACING } from '../src/features/speedRun/model';
import { readFile } from 'node:fs/promises';

async function deck(page: Page) {
  await page.route('https://en.wiktionary.org/**', route => route.fulfill({ json: { query: { pages: [] } } }));
  await page.goto('/files/new');
  await page.locator('#deck-title').fill('Run deck');
  await page.locator('textarea').fill('water 水\nboek 书\nwereld 世界');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/flashcards$/);
  return page.url();
}
async function backup(page: Page) {
  await page.goto('/data');
  const downloading = page.waitForEvent('download');
  await page.locator('.data-actions button').first().click();
  const download = await downloading;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

test('distractors use nearest Dutch length and exclude ambiguous answers', () => {
  const entries = ['water', 'boek', 'een hele lange zin', 'water'].map((dutch, i) => ({ id: String(i), fileId: 'deck', order: i, dutch, chinese: ['水', '书', '句子', '水'][i] }));
  expect(SPEED_RUN_TRIO_SPACING).toBe(9);
  for (let i = 0; i < 20; i++) expect(makeQuestion(entries[0], entries, 'zh-nl')?.answers.sort()).toEqual(['boek', 'water']);
  expect(makeQuestion(entries[0], [entries[0], entries[3]], 'zh-nl')).toBeNull();
});

for (const width of [390, 1280]) test(`speed run selects decks, keeps moving and saves results at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const url = await deck(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Speed Run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.locator('.run-deck')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.run-stage .run-prompt button')).toBeVisible();
  await page.getByRole('slider', { name: 'Speed', exact: true }).fill('0.1');
  await page.getByRole('slider', { name: 'Speed', exact: true }).blur();
  const prompt = await page.locator('.run-stage .run-prompt').innerText();
  const correct = ({ '水': 'water', '书': 'boek', '世界': 'wereld' } as Record<string, string>)[prompt];
  const buttons = page.locator('.run-stage .run-answers button');
  const left = await buttons.first().innerText() === correct;
  const start = Number(await page.locator('.run-scene').getAttribute('data-position'));
  if (width > 500) await page.keyboard.press(left ? 'ArrowLeft' : 'ArrowRight');
  else await buttons.nth(left ? 0 : 1).click({ force: true });
  await expect(page.locator('.run-heading [role=status]')).toContainText('Correct 1');
  await expect(page.locator('.run-feedback-history .run-correct')).toHaveCount(1);
  await expect.poll(async () => Number(await page.locator('.run-scene').getAttribute('data-position'))).toBeGreaterThan(start);
  await page.screenshot({ path: test.info().outputPath(`run-feedback-${width}.png`) });
  await page.getByRole('button', { name: '← Decks' }).click();
  await expect(page.locator('.run-deck')).toHaveAttribute('aria-pressed', 'true');
  const saved = await backup(page);
  expect(saved.version).toBe(3);
  expect(saved.data.progress).toHaveLength(1);
  expect(saved.data.progress[0]).toMatchObject({ correct: 1, mistakes: 0, unanswered: 0, direction: 'zh-nl' });
  const originalIds = saved.data.entries.map((entry: { id: string }) => entry.id);
  await page.goto(url.replace(/\/flashcards$/, ''));
  await page.locator('.top-action-row button').click();
  await expect(page.locator('textarea')).toHaveCount(0);
  await page.locator('#file-title').fill('Renamed deck');
  await page.locator('.top-action-row button').click();
  await expect(page.locator('#file-heading')).toHaveText('Renamed deck');
  const renamed = await backup(page);
  expect(renamed.data.entries.map((entry: { id: string }) => entry.id)).toEqual(originalIds);
  expect(renamed.data.progress).toEqual(saved.data.progress);
});

test('unanswered cards repeat, speed persists, and card edits preserve progress', async ({ page }) => {
  const url = await deck(page);
  await page.goto('/speed-run');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.run-stage .run-prompt button')).toBeVisible();
  await page.getByRole('slider', { name: 'Speed', exact: true }).fill('3');
  await expect(page.locator('.run-heading [role=status]')).toContainText('Unanswered 3', { timeout: 30000 });
  await expect(page.locator('.run-endline')).toHaveText('Endline - Starting again');
  await page.getByRole('button', { name: '← Decks' }).click();
  const original = await backup(page);
  expect(original.data.progress.reduce((sum: number, item: { unanswered: number }) => sum + item.unanswered, 0)).toBeGreaterThanOrEqual(3);
  await page.goto(url);
  await page.locator('[data-control=expand]').click();
  await page.locator('[data-control=edit]').click();
  await page.locator('dialog textarea').first().fill('water aangepast');
  await page.locator('dialog button[type=submit]').click();
  await expect(page.locator('dialog')).toHaveCount(0);
  const edited = await backup(page);
  expect(edited.data.entries.map((entry: { id: string }) => entry.id)).toEqual(original.data.entries.map((entry: { id: string }) => entry.id));
  expect(edited.data.progress).toEqual(original.data.progress);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').first().setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
  await expect(page.locator('[role=status]')).toBeVisible();
  const restored = await backup(page);
  expect(restored.data.progress).toEqual(edited.data.progress);
  await page.goto('/speed-run');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Speed', exact: true })).toHaveValue('3');
});

test('speed run reads prompts first and answers only after a choice', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wooord.voicePreferences', JSON.stringify({ audioAutoplay: 'both', dutchAudioSource: 'speechSynthesis' }));
    const spoken: string[] = []; Object.assign(window, { spoken });
    speechSynthesis.speak = utterance => { spoken.push(utterance.text); };
    speechSynthesis.cancel = () => {};
  });
  await deck(page);
  await page.goto('/speed-run');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.run-stage .run-prompt button')).toBeVisible();
  await page.getByRole('slider', { name: 'Speed', exact: true }).fill('0.1');
  await page.getByRole('slider', { name: 'Speed', exact: true }).blur();
  const prompt = await page.locator('.run-stage .run-prompt').innerText();
  const spoken = () => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);
  await expect.poll(spoken).toEqual([prompt]);
  const correct = ({ '水': 'water', '书': 'boek', '世界': 'wereld' } as Record<string, string>)[prompt];
  const leftCorrect = await page.locator('.run-stage .run-answers button').first().innerText() === correct;
  await page.keyboard.press(leftCorrect ? 'd' : 'a');
  await expect(page.locator('.run-heading [role=status]')).toContainText('Mistakes 1');
  await expect.poll(async () => (await spoken()).slice(0, 2)).toEqual([prompt, correct]);
});

test('portrait previews stay fixed and trios drop at the configured near distance', async ({ page }) => {
  await page.clock.install();
  await deck(page);
  await page.goto('/speed-run');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const scene = page.locator('.run-scene');
  await expect(scene).toHaveAttribute('data-stones', /position/);
  await page.getByRole('slider', { name: 'Speed', exact: true }).fill('0.1');
  await page.getByRole('slider', { name: 'Speed', exact: true }).blur();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  const read = async () => ({ camera: Number(await scene.getAttribute('data-camera-z')), stones: JSON.parse((await scene.getAttribute('data-stones'))!) as { id: number; position: number[] }[] });
  const before = await read();
  expect(before.stones).toHaveLength(6);
  expect(before.stones.slice(0, 3).map(stone => stone.position[0])).toEqual([0, 0, 0]);
  expect(before.stones[1].position[1]).toBeGreaterThan(before.stones[0].position[1]);
  expect(before.stones[2].position[1]).toBeLessThan(before.stones[0].position[1]);
  await page.clock.runFor(400);
  const after = await read();
  expect(after.camera).toBeLessThan(before.camera);
  expect(after.stones).toEqual(before.stones);
  await page.keyboard.press('a');
  await page.clock.runFor(400);
  const answeredStart = await read();
  await page.clock.runFor(400);
  const answeredEnd = await read();
  const oldStone = (state: typeof answeredStart) => state.stones.find(stone => stone.id === before.stones[1].id)!;
  expect(oldStone(answeredEnd).position).toEqual(oldStone(answeredStart).position);
  expect(answeredEnd.camera).toBeLessThan(answeredStart.camera);
  const prompt = answeredEnd.stones.find(stone => stone.id === before.stones[0].id)!;
  expect(oldStone(answeredEnd).position[1] - prompt.position[1] - 1.65).toBeCloseTo(.25, 5);
  expect(oldStone(answeredEnd).position[1]).toBe(oldStone(answeredStart).position[1]);
  await page.clock.runFor(1400);
  expect(oldStone(await read()).position).toEqual(oldStone(answeredStart).position);
  // The already-rendered preview becomes the next question without relocation.
  expect(answeredStart.stones.find(stone => stone.id === before.stones[3].id)?.position).toEqual(before.stones[3].position);
  await page.getByRole('slider', { name: 'Speed', exact: true }).fill('3');
  const state = await read();
  const near = Number(await scene.getAttribute('data-near-distance'));
  const distanceUntilDrop = -oldStone(state).position[2] + state.camera - near * .7;
  await page.clock.runFor(Math.max(0, Math.floor(distanceUntilDrop / 15 * 1000) - 50));
  expect(oldStone(await read()).position[1]).toBe(oldStone(answeredStart).position[1]);
  await page.clock.runFor(300);
  expect(oldStone(await read()).position[1]).toBeLessThan(oldStone(answeredStart).position[1]);

});
