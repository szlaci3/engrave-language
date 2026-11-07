import { playLanguageAudio, type PlayAudioOptions } from './audioService';

export function speakChinese(text: string, options: PlayAudioOptions = {}) {
  return playLanguageAudio(text, 'chinese', options);
}

export function speakDutch(text: string, options: PlayAudioOptions = {}) {
  return playLanguageAudio(text, 'dutch', options);
}
