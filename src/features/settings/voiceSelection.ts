export type VoiceLanguage = 'dutch' | 'chinese';

function normalizeLanguage(language: string) {
  return language.toLocaleLowerCase();
}

function rankChineseVoice(voice: SpeechSynthesisVoice) {
  const language = normalizeLanguage(voice.lang);

  if (language === 'zh-cn') {
    return 0;
  }

  if (language === 'zh-tw') {
    return 1;
  }

  if (language === 'zh-hk') {
    return 2;
  }

  return language.startsWith('zh-') || language === 'zh' ? 3 : 4;
}

function rankDutchVoice(voice: SpeechSynthesisVoice) {
  const language = normalizeLanguage(voice.lang);

  if (language === 'nl-be') {
    return 0;
  }

  if (language === 'nl-nl') {
    return 1;
  }

  return language.startsWith('nl-') || language === 'nl' ? 2 : 3;
}

function rankVoice(voice: SpeechSynthesisVoice, language: VoiceLanguage) {
  return language === 'dutch' ? rankDutchVoice(voice) : rankChineseVoice(voice);
}

export function listLanguageVoices(
  voices: SpeechSynthesisVoice[],
  language: VoiceLanguage,
) {
  return voices
    .filter((voice) => rankVoice(voice, language) < 4)
    .sort(
      (left, right) =>
        rankVoice(left, language) - rankVoice(right, language) ||
        Number(right.default) - Number(left.default) ||
        left.name.localeCompare(right.name),
    );
}

export function selectLanguageVoice(
  voices: SpeechSynthesisVoice[],
  language: VoiceLanguage,
  preferredVoiceURI?: string,
) {
  const languageVoices = listLanguageVoices(voices, language);
  const preferredVoice = languageVoices.find(
    (voice) => voice.voiceURI === preferredVoiceURI,
  );

  return preferredVoice ?? languageVoices[0] ?? null;
}

