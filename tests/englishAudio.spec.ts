import { test, expect } from '@playwright/test';

for (const hasEnglishVoice of [true, false]) test(`UI language selects English browser audio, available voice: ${hasEnglishVoice}`, async ({ page }) => {
  await page.addInitScript(({ hasEnglishVoice }) => {
    localStorage.setItem('wooord.voicePreferences', JSON.stringify({ chineseAudioSource: 'wiktionary', dutchAudioSource: 'speechSynthesis', audioAutoplay: 'front' }));
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
      text: string; constructor(text: string) { this.text = text; }
    } });
    const spoken: { text: string; lang: string; voice: string | null }[] = [];
    Object.assign(window, { spoken });
    const voices = [
      { lang: 'zh-CN', voiceURI: 'zh', name: 'Chinese', default: true },
      { lang: 'nl-BE', voiceURI: 'nl', name: 'Dutch', default: false },
      ...(hasEnglishVoice ? [{ lang: 'en-GB', voiceURI: 'en', name: 'English', default: false }] : []),
    ];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => voices, cancel() {}, addEventListener() {}, removeEventListener() {},
      speak(u: SpeechSynthesisUtterance) { spoken.push({ text: u.text, lang: u.lang, voice: u.voice?.voiceURI ?? null }); },
    } });
  }, { hasEnglishVoice });
  await page.route('https://en.wiktionary.org/**', r => r.fulfill({ json: { error: {} } }));
  await page.goto('/settings');
  await page.locator('#ui-language').selectOption('en');
  await page.reload();
  await expect(page.locator('#ui-language')).toHaveValue('en');
  await page.goto('/files/new');
  await page.locator('textarea').fill(JSON.stringify([{ sides: ['the water', 'het water'] }, { sides: ['the book', 'het boek'] }]));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/flashcards$/);
  const url = page.url();
  const speech = () => page.evaluate(() => (window as unknown as { spoken: { text: string; lang: string; voice: string | null }[] }).spoken);
  const english = { text: 'the water', lang: hasEnglishVoice ? 'en-GB' : 'en-US', voice: hasEnglishVoice ? 'en' : null };
  await expect.poll(speech).toContainEqual(english);
  await page.goto(url.replace(/\/flashcards$/, ''));
  await page.locator('.entry-chinese-button').first().click();
  await expect.poll(speech).toContainEqual(english);
  await page.locator('.entry-dutch-button').first().click();
  await expect.poll(speech).toContainEqual({ text: 'het water', lang: 'nl-BE', voice: 'nl' });
  await page.goto('/settings');
  await page.locator('#ui-language').selectOption('zh');
  await page.reload();
  await expect(page.locator('#ui-language')).toHaveValue('zh');
  await page.goto(url.replace(/\/flashcards$/, ''));
  await page.locator('.entry-chinese-button').first().click();
  await expect.poll(speech).toContainEqual({ text: 'the water', lang: 'zh-CN', voice: 'zh' });
});
