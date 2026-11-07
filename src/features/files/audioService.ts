import { getVoicePreferences } from '../settings/voicePreferences';
import {
  selectLanguageVoice,
  type VoiceLanguage,
} from '../settings/voiceSelection';

export type PlayAudioOptions = {
  onStart?: () => void;
  onEnd?: () => void;
};

const wiktionaryApiUrl = 'https://en.wiktionary.org/w/api.php';
const commonsRedirectBaseUrl =
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/';
const persistentLookupCacheKey = 'wooord.wiktionaryAudioLookupCache.v2';
const audioResponseCacheName = 'wooord-wiktionary-audio-v2';
const maxPersistentLookupEntries = 1000;

const fallbackLanguageByVoiceLanguage: Record<VoiceLanguage, string> = {
  chinese: 'zh-CN',
  dutch: 'nl-BE',
};

const wiktionaryLanguageCodeByVoiceLanguage: Record<VoiceLanguage, string> = {
  chinese: 'zh',
  dutch: 'nl',
};

const wiktionaryAudioCache = new Map<string, Promise<string | null>>();
let activeHtmlAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let persistentLookupCache: Record<string, string | null> | null = null;

function stopCurrentAudio() {
  window.speechSynthesis?.cancel();

  if (activeHtmlAudio) {
    activeHtmlAudio.pause();
    activeHtmlAudio.src = '';
    activeHtmlAudio = null;
  }

  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function speakWithSpeechSynthesis(
  text: string,
  language: VoiceLanguage,
  options: PlayAudioOptions = {},
) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return false;
  }

  stopCurrentAudio();

  const preferences = getVoicePreferences();
  const preferredVoiceURI =
    language === 'dutch'
      ? preferences.dutchVoiceURI
      : preferences.chineseVoiceURI;
  const voice = selectLanguageVoice(
    window.speechSynthesis.getVoices(),
    language,
    preferredVoiceURI,
  );
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? fallbackLanguageByVoiceLanguage[language];
  utterance.voice = voice;
  utterance.onstart = options.onStart ?? null;
  utterance.onend = options.onEnd ?? null;
  utterance.onerror = options.onEnd ?? null;

  window.speechSynthesis.speak(utterance);
  return true;
}

function normalizeLookupText(text: string) {
  return text
    .trim()
    .replace(/[。！？!?.,，、；;:：()[\]{}"“”'‘’]+$/u, '')
    .trim();
}

export function splitChineseAudioText(text: string) {
  const parts = text
    .split('，')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [text];
}

export function getChineseAudioTextParts(text: string) {
  const { chineseAudioTextSplitting = true } = getVoicePreferences();

  return chineseAudioTextSplitting ? splitChineseAudioText(text) : [text];
}

function getWiktionaryCacheKey(text: string, language: VoiceLanguage) {
  return `${language}:${text.toLocaleLowerCase()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadPersistentLookupCache() {
  if (persistentLookupCache) {
    return persistentLookupCache;
  }

  try {
    const storedValue = window.localStorage.getItem(persistentLookupCacheKey);
    const parsed: unknown = storedValue ? JSON.parse(storedValue) : {};

    if (!isRecord(parsed)) {
      persistentLookupCache = {};
      return persistentLookupCache;
    }

    persistentLookupCache = Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === 'string' || value === null,
      ),
    ) as Record<string, string | null>;
  } catch {
    persistentLookupCache = {};
  }

  return persistentLookupCache;
}

function savePersistentLookupCache() {
  if (!persistentLookupCache) {
    return;
  }

  try {
    const entries = Object.entries(persistentLookupCache).slice(
      -maxPersistentLookupEntries,
    );
    persistentLookupCache = Object.fromEntries(entries);
    window.localStorage.setItem(
      persistentLookupCacheKey,
      JSON.stringify(persistentLookupCache),
    );
  } catch {
    // Ignore storage quota and private browsing failures.
  }
}

function getPersistentLookupCacheValue(cacheKey: string) {
  const cache = loadPersistentLookupCache();

  return Object.prototype.hasOwnProperty.call(cache, cacheKey)
    ? cache[cacheKey]
    : undefined;
}

function setPersistentLookupCacheValue(
  cacheKey: string,
  audioUrl: string | null,
) {
  const cache = loadPersistentLookupCache();
  cache[cacheKey] = audioUrl;
  savePersistentLookupCache();
}

function splitTemplateParts(template: string) {
  return template
    .slice(2, -2)
    .split('|')
    .map((part) => part.trim());
}

function normalizeAudioFileName(fileName: string) {
  return fileName.replace(/^File:/i, '').replace(/^Image:/i, '').trim();
}

function isAudioFileName(value: string) {
  return /\.(oga|ogg|mp3|wav|webm)$/i.test(value);
}

function getAudioFileFromTemplate(
  template: string,
  wiktionaryLanguageCode: string,
) {
  const parts = splitTemplateParts(template);
  const templateName = parts[0]?.toLowerCase();

  if (templateName !== 'audio') {
    return null;
  }

  const languageCode = parts[1]?.toLowerCase();

  if (languageCode !== wiktionaryLanguageCode) {
    return null;
  }

  const fileName = normalizeAudioFileName(parts[2] ?? '');
  return isAudioFileName(fileName) ? fileName : null;
}

function getChineseAudioFileFromPronunciationTemplate(
  template: string,
  audioParameter: 'ma' | 'ca',
) {
  const audioMatch = template.match(
    new RegExp(`(?:^|\\n)\\s*\\|\\s*${audioParameter}\\s*=\\s*([^\\n|]+)`, 'i'),
  );
  const fileName = normalizeAudioFileName(audioMatch?.[1] ?? '');

  return isAudioFileName(fileName) ? fileName : null;
}

function findChinesePronunciationAudioFile(
  wikitext: string,
  audioParameter: 'ma' | 'ca',
) {
  const pronunciationTemplates = wikitext.match(/\{\{zh-pron[\s\S]*?\n}}/gi) ?? [];

  for (const template of pronunciationTemplates) {
    const fileName = getChineseAudioFileFromPronunciationTemplate(
      template,
      audioParameter,
    );

    if (fileName) {
      return fileName;
    }
  }

  return null;
}

function findWiktionaryAudioFile(
  wikitext: string,
  language: VoiceLanguage,
) {
  if (language === 'chinese') {
    const mandarinAudioFile = findChinesePronunciationAudioFile(wikitext, 'ma');

    if (mandarinAudioFile) {
      return mandarinAudioFile;
    }
  }

  const wiktionaryLanguageCode =
    wiktionaryLanguageCodeByVoiceLanguage[language];
  const audioTemplates = wikitext.match(/\{\{audio\|[^{}]+}}/gi) ?? [];

  for (const template of audioTemplates) {
    const fileName = getAudioFileFromTemplate(
      template,
      wiktionaryLanguageCode,
    );

    if (fileName) {
      return fileName;
    }
  }

  if (language === 'chinese') {
    return findChinesePronunciationAudioFile(wikitext, 'ma');
  }

  return null;
}

async function fetchWiktionaryAudioUrl(
  text: string,
  language: VoiceLanguage,
) {
  const url = new URL(wiktionaryApiUrl);
  url.search = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    origin: '*',
    page: text,
    prop: 'wikitext',
    redirects: '1',
  }).toString();

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const result: unknown = await response.json();
    const wikitext =
      typeof result === 'object' &&
      result !== null &&
      'parse' in result &&
      typeof result.parse === 'object' &&
      result.parse !== null &&
      'wikitext' in result.parse &&
      typeof result.parse.wikitext === 'string'
        ? result.parse.wikitext
        : null;

    if (!wikitext) {
      return null;
    }

    const fileName = findWiktionaryAudioFile(wikitext, language);

    if (!fileName) {
      return null;
    }

    return `${commonsRedirectBaseUrl}${encodeURIComponent(fileName)}`;
  } catch {
    return null;
  }
}

function getCachedWiktionaryAudioUrl(
  text: string,
  language: VoiceLanguage,
) {
  const cacheKey = getWiktionaryCacheKey(text, language);
  const cachedValue = wiktionaryAudioCache.get(cacheKey);

  if (cachedValue) {
    return cachedValue;
  }

  const persistentValue = getPersistentLookupCacheValue(cacheKey);

  if (persistentValue !== undefined) {
    const audioUrl = Promise.resolve(persistentValue);
    wiktionaryAudioCache.set(cacheKey, audioUrl);
    return audioUrl;
  }

  const audioUrl = fetchWiktionaryAudioUrl(text, language).then((result) => {
    setPersistentLookupCacheValue(cacheKey, result);
    return result;
  });
  wiktionaryAudioCache.set(cacheKey, audioUrl);
  return audioUrl;
}

function canUseCacheStorage() {
  return 'caches' in window;
}

async function cacheAudioResponse(url: string) {
  if (!canUseCacheStorage()) {
    return;
  }

  try {
    const request = new Request(url, { mode: 'cors' });
    const cache = await window.caches.open(audioResponseCacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return;
    }

    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }
  } catch {
    // Network and CORS failures should only disable preloading, not playback.
  }
}

async function getCachedAudioObjectUrl(url: string) {
  if (!canUseCacheStorage()) {
    return null;
  }

  try {
    const request = new Request(url, { mode: 'cors' });
    const cache = await window.caches.open(audioResponseCacheName);
    let response = await cache.match(request);

    if (!response) {
      response = await fetch(request);

      if (response.ok) {
        await cache.put(request, response.clone());
      }
    }

    if (!response.ok) {
      return null;
    }

    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

async function playHtmlAudio(url: string, options: PlayAudioOptions) {
  const objectUrl = await getCachedAudioObjectUrl(url);
  const audio = new Audio(objectUrl ?? url);
  activeHtmlAudio = audio;
  activeObjectUrl = objectUrl;
  let didFinish = false;

  function finishAudio() {
    if (didFinish) {
      return;
    }

    didFinish = true;

    if (activeObjectUrl === objectUrl) {
      activeObjectUrl = null;
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    options.onEnd?.();
  }

  audio.onended = finishAudio;
  audio.onerror = finishAudio;

  try {
    options.onStart?.();
    await audio.play();
    return true;
  } catch {
    finishAudio();
    return false;
  }
}

export function preloadLanguageAudio(text: string, language: VoiceLanguage) {
  const preferences = getVoicePreferences();
  const audioSource =
    language === 'dutch'
      ? preferences.dutchAudioSource
      : preferences.chineseAudioSource;

  if (audioSource !== 'wiktionary') {
    return;
  }

  const lookupText = normalizeLookupText(text);

  if (!lookupText) {
    return;
  }

  void getCachedWiktionaryAudioUrl(lookupText, language).then((audioUrl) => {
    if (audioUrl) {
      void cacheAudioResponse(audioUrl);
    }
  });
}

export function preloadVocabularyAudios(
  entries: Array<{ dutch: string; chinese: string }>,
) {
  for (const entry of entries) {
    preloadLanguageAudio(entry.dutch, 'dutch');
    for (const chinesePart of getChineseAudioTextParts(entry.chinese)) {
      preloadLanguageAudio(chinesePart, 'chinese');
    }
  }
}

function playWiktionaryOrFallback(
  text: string,
  language: VoiceLanguage,
  options: PlayAudioOptions = {},
) {
  const lookupText = normalizeLookupText(text);

  if (!lookupText) {
    return speakWithSpeechSynthesis(text, language, options);
  }

  stopCurrentAudio();

  void getCachedWiktionaryAudioUrl(lookupText, language).then((audioUrl) => {
    if (!audioUrl) {
      if (!speakWithSpeechSynthesis(text, language, options)) {
        options.onEnd?.();
      }

      return;
    }

    void playHtmlAudio(audioUrl, options).then((didPlay) => {
      if (!didPlay && !speakWithSpeechSynthesis(text, language, options)) {
        options.onEnd?.();
      }
    });
  });

  return true;
}

export function playLanguageAudio(
  text: string,
  language: VoiceLanguage,
  options: PlayAudioOptions = {},
) {
  const preferences = getVoicePreferences();
  const audioSource =
    language === 'dutch'
      ? preferences.dutchAudioSource
      : preferences.chineseAudioSource;

  if (audioSource === 'wiktionary') {
    return playWiktionaryOrFallback(text, language, options);
  }

  return speakWithSpeechSynthesis(text, language, options);
}
