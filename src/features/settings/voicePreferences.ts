const storageKey = 'wooord.voicePreferences';

export type AudioSource = 'speechSynthesis' | 'wiktionary';

export type VoicePreferences = {
  dutchVoiceURI?: string;
  chineseVoiceURI?: string;
  dutchAudioSource?: AudioSource;
  chineseAudioSource?: AudioSource;
  chineseAudioTextSplitting?: boolean;
};

const defaultPreferences: VoicePreferences = { dutchAudioSource: 'wiktionary' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function toAudioSource(value: unknown): AudioSource | undefined {
  return value === 'wiktionary' || value === 'speechSynthesis'
    ? value
    : undefined;
}

export function getVoicePreferences(): VoicePreferences {
  const storedValue = window.localStorage.getItem(storageKey);

  if (!storedValue) {
    return { ...defaultPreferences };
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);

    if (!isRecord(parsed)) {
      return { ...defaultPreferences };
    }

    const legacyAudioSource = toAudioSource(parsed.audioSource);

    return {
      dutchVoiceURI: toOptionalString(parsed.dutchVoiceURI),
      chineseVoiceURI: toOptionalString(parsed.chineseVoiceURI),
      dutchAudioSource:
        toAudioSource(parsed.dutchAudioSource) ?? legacyAudioSource ?? defaultPreferences.dutchAudioSource,
      chineseAudioSource:
        toAudioSource(parsed.chineseAudioSource) ?? legacyAudioSource,
      chineseAudioTextSplitting:
        typeof parsed.chineseAudioTextSplitting === 'boolean'
          ? parsed.chineseAudioTextSplitting
          : true,
    };
  } catch {
    return { ...defaultPreferences };
  }
}

export function saveVoicePreferences(preferences: VoicePreferences) {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}
