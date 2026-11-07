# Lexideck Audio Reference Notes

## Purpose

This document summarizes the audio/voice-selection ideas taken from the Lexideck reference source.

The Lexideck source is reference-only.

It should not be treated as part of the wooord application.

Do not import from the Lexideck source folder.

Do not copy Lexideck architecture blindly.

Use these notes only to guide a small wooord-specific implementation.

---

## wooord Audio Goal

wooord should support audio playback for both sides of a vocabulary entry:

```txt
Dutch expression → Dutch voice
Chinese translation → Chinese voice
```

The user should be able to choose preferred voices in a Settings page.

The app should remember these choices.

The opened file page should automatically use the correct voice based on the language of the tapped text.

The user should not choose a voice during every playback.

---

## Required Voice Preferences

wooord needs two separate voice preferences:

```ts
type VoicePreferences = {
  dutchVoiceURI?: string | null;
  chineseVoiceURI?: string | null;
};
```

Use `voiceURI` when possible because voice names can be less stable.

If `voiceURI` is unavailable or unreliable in a browser, fallback matching by `name` and `lang` is acceptable.

---

## Language Groups

### Chinese Voices

Chinese voice selection should include voices with language codes such as:

```txt
zh-CN
zh-TW
zh-HK
zh-SG
```

At minimum, support:

```txt
zh-CN
zh-TW
zh-HK
```

Taiwan Chinese voices must be selectable when the browser exposes them.

The Chinese fallback order should be:

```txt
selected Chinese voice
zh-CN voice
zh-TW voice
zh-HK voice
any zh-* voice
browser default
```

---

### Dutch Voices

Dutch voice selection should include voices with language codes such as:

```txt
nl-BE
nl-NL
```

The Dutch fallback order should be:

```txt
selected Dutch voice
nl-BE voice
nl-NL voice
any nl-* voice
browser default
```

---

## Settings Page Behavior

Create a Settings page with two voice selectors:

```txt
Chinese voice
Dutch voice
```

Each selector should include:

```txt
Auto
Available matching voices
```

The visible option label should include both voice name and language code.

Example:

```txt
Mei-Jia — zh-TW
Ting-Ting — zh-CN
Sin-Ji — zh-HK
Xander — nl-NL
Ellen — nl-BE
```

The exact available voices depend on the device, browser, iOS version, and downloaded system voices.

Do not hard-code Apple voice names as required values.

They are examples only.

---

## Voice Loading

Browser voices are loaded through the Web Speech API:

```ts
window.speechSynthesis.getVoices()
```

Important: in some browsers, the voice list may be empty at first and populate later.

Use the `voiceschanged` event where available.

Recommended helper behavior:

```ts
function getAvailableVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}
```

Recommended React behavior:

```ts
useEffect(() => {
  const loadVoices = () => {
    setVoices(window.speechSynthesis.getVoices());
  };

  loadVoices();

  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);

  return () => {
    window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
  };
}, []);
```

If `addEventListener` is not supported on `speechSynthesis`, use the older callback style only if needed:

```ts
window.speechSynthesis.onvoiceschanged = loadVoices;
```

Keep the implementation simple.

---

## Persistence

Voice choices are user settings.

They can be stored in either:

```txt
localStorage
```

or in Dexie.

For wooord, `localStorage` is acceptable and simple.

Recommended localStorage key:

```txt
wooord.voicePreferences
```

Recommended stored shape:

```ts
{
  dutchVoiceURI: string | null;
  chineseVoiceURI: string | null;
}
```

If the selected voice is not available later, keep the stored preference but fallback gracefully during playback.

Do not crash or block playback.

---

## Audio Playback API

Use one shared speech helper with language-specific selection.

Recommended public functions:

```ts
speakDutch(text: string): void
speakChinese(text: string): void
```

These can call a generic internal helper:

```ts
speakText(text: string, language: 'nl' | 'zh'): void
```

The helper should:

1. check whether `speechSynthesis` exists
2. cancel any current speech
3. create `SpeechSynthesisUtterance`
4. select the preferred voice if available
5. set `utterance.voice`
6. set `utterance.lang`
7. optionally set a study-friendly rate
8. speak

Recommended default rate:

```ts
utterance.rate = 0.9;
```

This can make study audio slightly easier to follow.

---

## Voice Matching

Use saved `voiceURI` first.

Example:

```ts
function findVoiceByURI(
  voices: SpeechSynthesisVoice[],
  voiceURI?: string | null
) {
  if (!voiceURI) return undefined;

  return voices.find((voice) => voice.voiceURI === voiceURI);
}
```

Then fallback by language.

Example:

```ts
function findFirstVoiceByLang(
  voices: SpeechSynthesisVoice[],
  languageCodes: string[]
) {
  for (const languageCode of languageCodes) {
    const exactMatch = voices.find((voice) => voice.lang === languageCode);
    if (exactMatch) return exactMatch;
  }

  for (const languageCode of languageCodes) {
    const prefix = languageCode.split('-')[0];
    const prefixMatch = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(`${prefix}-`)
    );
    if (prefixMatch) return prefixMatch;
  }

  return undefined;
}
```

For Chinese:

```ts
const chineseFallbackLanguages = ['zh-CN', 'zh-TW', 'zh-HK'];
```

For Dutch:

```ts
const dutchFallbackLanguages = ['nl-BE', 'nl-NL'];
```

---

## File View Behavior

The opened file page should make both languages audible.

Each vocabulary entry may show:

```txt
Dutch expression     Dutch audio icon
Chinese translation  Chinese audio icon
```

or a compact row layout:

```txt
natuurlijk 🔊     当然 🔊
```

Important behavior:

```txt
Dutch audio icon → speakDutch(entry.dutch)
Chinese audio icon → speakChinese(entry.chinese)
```

The app should not show voice dropdowns inside the file view.

Voice selection belongs on the Settings page.

---

## Accessibility

Audio buttons need accessible labels.

Examples:

```tsx
<button aria-label={`Play Dutch expression: ${entry.dutch}`}>
  <SpeakerIcon />
</button>

<button aria-label={`Play Chinese translation: ${entry.chinese}`}>
  <SpeakerIcon />
</button>
```

Voice selectors should have clear labels:

```tsx
<label htmlFor="chineseVoice">Chinese voice</label>
<select id="chineseVoice">...</select>

<label htmlFor="dutchVoice">Dutch voice</label>
<select id="dutchVoice">...</select>
```

---

## Error Handling

If speech synthesis is unavailable:

* do not crash
* optionally show a small message
* keep the rest of the app usable

If no matching voice is available:

* use browser default voice
* set `utterance.lang` to the target language
* continue playback attempt

If a saved voice is missing:

* fallback to language matching
* do not delete the saved setting automatically

---

## Non-Goals

Do not add:

```txt
paid TTS API
backend audio generation
audio file storage
voice recording
pronunciation scoring
AI voice generation
network calls for audio
```

The goal is only to use installed browser/device voices better.

---

## Implementation Scope for wooord

The desired wooord implementation is small:

```txt
1. Add Settings page.
2. Add Chinese voice selector.
3. Add Dutch voice selector.
4. Persist selected voice preferences.
5. Use selected Chinese voice for Chinese playback.
6. Add Dutch playback to vocabulary entries.
7. Use selected Dutch voice for Dutch playback.
```

This should be treated as a post-MVP feature, not a full audio subsystem rewrite.
