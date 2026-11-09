import { useEffect } from 'react';
import { getVoicePreferences } from '../settings/voicePreferences';
import { getChineseAudioTextParts, stopCurrentAudio } from './audioService';
import { speakChinese, speakDutch } from './speech';

export function useAudioAutoplay(key: string, side: 'front' | 'back', text: string, language: 'nl' | 'zh') {
  useEffect(() => stopCurrentAudio, []);
  useEffect(() => {
    const mode = getVoicePreferences().audioAutoplay ?? 'off';
    if (!text || (mode !== 'both' && mode !== side)) return;
    if (language === 'nl') speakDutch(text);
    else speakChinese(getChineseAudioTextParts(text)[0]);
  }, [key, side, text, language]);
}
