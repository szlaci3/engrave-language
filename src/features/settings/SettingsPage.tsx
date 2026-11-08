import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { routes } from '../../app/routes';
import {
  getVoicePreferences,
  saveVoicePreferences,
  type VoicePreferences,
  type AudioAutoplay,
} from './voicePreferences';
import { useUiLanguage } from './uiLanguage';
import { listLanguageVoices } from './voiceSelection';

function canUseSpeechSynthesis() {
  return (
    'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  );
}

function loadVoices() {
  if (!canUseSpeechSynthesis()) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

export function SettingsPage() {
  const { language, setLanguage, t } = useUiLanguage();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    loadVoices(),
  );
  const [preferences, setPreferences] = useState<VoicePreferences>(() =>
    getVoicePreferences(),
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!canUseSpeechSynthesis()) {
      return;
    }

    function handleVoicesChanged() {
      setVoices(loadVoices());
    }

    handleVoicesChanged();
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      handleVoicesChanged,
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        handleVoicesChanged,
      );
    };
  }, []);

  const dutchVoices = useMemo(
    () => listLanguageVoices(voices, 'dutch'),
    [voices],
  );
  const chineseVoices = useMemo(
    () => listLanguageVoices(voices, 'chinese'),
    [voices],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveVoicePreferences(preferences);
    await setLanguage(language);
    setMessage(t('settingsSaved'));
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <a className="back-link" href={routes.home}>
          Engrave Language
        </a>
        <p className="eyebrow">{t('settings')}</p>
      </header>

      <form
        className="content-card settings-form"
        aria-labelledby="settings-heading"
        onSubmit={handleSubmit}
      >
        <h1 id="settings-heading" className="page-title">
          {t('voiceSettings')}
        </h1>

        <label className="settings-field" htmlFor="ui-language">
          <span><span className="setting-number">1.</span> {t('uiLanguage')}</span>
          <select
            id="ui-language"
            className="select-input"
            value={language}
            onChange={(event) => {
              const nextLanguage =
                event.target.value === 'en' ? 'en' : 'zh';

              void setLanguage(nextLanguage);
              setMessage('');
            }}
          >
            <option value="zh">{t('chineseUi')}</option>
            <option value="en">{t('englishUi')}</option>
          </select>
        </label>

        {!canUseSpeechSynthesis() ? (
          <p className="form-message" role="alert">
            {t('speechUnavailable')}
          </p>
        ) : null}

        <label className="settings-field" htmlFor="dutch-audio-source">
          <span><span className="setting-number">2.</span> {t('dutchAudioSource')}</span>
          <select
            id="dutch-audio-source"
            className="select-input"
            value={preferences.dutchAudioSource ?? 'wiktionary'}
            onChange={(event) =>
              setPreferences((currentPreferences) => ({
                ...currentPreferences,
                dutchAudioSource:
                  event.target.value === 'wiktionary'
                    ? 'wiktionary'
                    : 'speechSynthesis',
              }))
            }
          >
            <option value="speechSynthesis">{t('speechSynthesisAudio')}</option>
            <option value="wiktionary">{t('wiktionaryAudio')}</option>
          </select>
        </label>

        <label className="settings-field" htmlFor="chinese-audio-source">
          <span><span className="setting-number">3.</span> {t('chineseAudioSource')}</span>
          <select
            id="chinese-audio-source"
            className="select-input"
            value={preferences.chineseAudioSource ?? 'speechSynthesis'}
            onChange={(event) =>
              setPreferences((currentPreferences) => ({
                ...currentPreferences,
                chineseAudioSource:
                  event.target.value === 'wiktionary'
                    ? 'wiktionary'
                    : 'speechSynthesis',
              }))
            }
          >
            <option value="speechSynthesis">{t('speechSynthesisAudio')}</option>
            <option value="wiktionary">{t('wiktionaryAudio')}</option>
          </select>
        </label>

        <label className="settings-field" htmlFor="dutch-voice">
          <span><span className="setting-number">4.</span> {t('dutchVoice')}</span>
          <select
            id="dutch-voice"
            className="select-input"
            value={preferences.dutchVoiceURI ?? ''}
            onChange={(event) =>
              setPreferences((currentPreferences) => ({
                ...currentPreferences,
                dutchVoiceURI: event.target.value || undefined,
              }))
            }
          >
            <option value="">{t('automaticDutch')}</option>
            {dutchVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
          <small>{t('dutchVoiceHint')}</small>
        </label>

        <label className="settings-field" htmlFor="chinese-voice">
          <span><span className="setting-number">5.</span> {t('chineseVoice')}</span>
          <select
            id="chinese-voice"
            className="select-input"
            value={preferences.chineseVoiceURI ?? ''}
            onChange={(event) =>
              setPreferences((currentPreferences) => ({
                ...currentPreferences,
                chineseVoiceURI: event.target.value || undefined,
              }))
            }
          >
            <option value="">{t('automaticChinese')}</option>
            {chineseVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
          <small>{t('chineseVoiceHint')}</small>
        </label>

        <label className="settings-field" htmlFor="chinese-audio-text-splitting">
          <span>
            <span className="setting-number">6.</span>{' '}
            {t('chineseAudioTextHandling')}
          </span>
          <select
            id="chinese-audio-text-splitting"
            className="select-input"
            value={
              preferences.chineseAudioTextSplitting === false
                ? 'original'
                : 'split'
            }
            onChange={(event) =>
              setPreferences((currentPreferences) => ({
                ...currentPreferences,
                chineseAudioTextSplitting: event.target.value === 'split',
              }))
            }
          >
            <option value="split">{t('splitChineseAudioText')}</option>
            <option value="original">{t('originalChineseAudioText')}</option>
          </select>
          <small>{t('chineseAudioTextHandlingHint')}</small>
        </label>

        <label className="settings-field" htmlFor="audio-autoplay">
          <span><span className="setting-number">7.</span> {language === 'zh' ? '自动播放音频' : 'Audio autoplay'}</span>
          <select id="audio-autoplay" className="select-input" value={preferences.audioAutoplay ?? 'off'}
            onChange={event => setPreferences(current => ({ ...current, audioAutoplay: event.target.value as AudioAutoplay }))}>
            <option value="off">{language === 'zh' ? '关闭' : 'Off'}</option>
            <option value="front">{language === 'zh' ? '仅正面' : 'Front only'}</option>
            <option value="back">{language === 'zh' ? '仅背面' : 'Back only'}</option>
            <option value="both">{language === 'zh' ? '正面和背面' : 'Front and back'}</option>
          </select>
          <small>{language === 'zh' ? '适用于二维和三维练习。正面是每组的第一种语言，背面是第二种语言。显示所选面时播放音频。' : 'Applies to 2D and 3D practice. Front is the first language in each pair; back is the second. Audio plays when the selected side appears.'}</small>
        </label>

        <button className="data-action-button" type="submit">
          {t('saveSettings')}
        </button>

        {message ? (
          <p className="form-message form-message-success" role="status">
            {message}
          </p>
        ) : null}
      </form>
    </main>
  );
}
