import { test, expect } from '@playwright/test';
import { parseCardJson } from '../src/features/files/parseCardJson';

const cards = [{ id: 'same-id', sides: [' the foam\n', 'het\n\nschuim', 'ignored'], category: 'ignored', rate: 7, dueAt: 123 }];

test('JSON validates all cards and maps only the first two sides', () => {
  expect(parseCardJson(JSON.stringify(cards))).toEqual([{ dutch: 'het schuim', chinese: 'the foam' }]);
  for (const invalid of ['[', '{}', '[]', '[{"sides":[1,"a"]}]', JSON.stringify([...cards, { sides: ['only one'] }])]) {
    expect(() => parseCardJson(invalid)).toThrow();
  }
});

test('paste JSON, preserve its draft, save and read both sides', async ({ page }) => {
  await page.goto('/files/new');
  await page.locator('textarea').fill(JSON.stringify(cards));
  await page.reload();
  await expect(page.getByText(/1 (cards ready to import|张卡片可导入)/)).toBeVisible();
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/flashcards$/);
  await page.goto(page.url().replace(/\/flashcards$/, ''));
  await expect(page.locator('.entry-item')).toHaveCount(1);
  await expect(page.locator('.entry-item')).toContainText('het schuim');
  await expect(page.locator('.entry-item')).toContainText('the foam');
  await expect(page.locator('.entry-item')).not.toContainText('ignored');
});

test('upload 400 cards and reject malformed uploads without replacing draft', async ({ page }) => {
  await page.goto('/files/new');
  await page.locator('textarea').fill('water 水');
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('[{}]') });
  await expect(page.locator('.form-message')).toContainText('Card 1');
  await expect(page.locator('textarea')).toHaveValue('water 水');
  const bigDeck = Array.from({ length: 400 }, (_, i) => ({ ...cards[0], sides: [`English ${i}`, `Dutch ${i}`, 'ignored'] }));
  await input.setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bigDeck)) });
  await expect(page.getByText(/400 (cards ready to import|张卡片可导入)/)).toBeVisible();
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/flashcards$/);
  await page.goto(page.url().replace(/\/flashcards$/, ''));
  await expect(page.locator('.entry-item')).toHaveCount(400);
  await expect(page.locator('.entry-item').last()).toContainText('Dutch 399');
  await page.reload();
  await expect(page.locator('.entry-item')).toHaveCount(400);
});
