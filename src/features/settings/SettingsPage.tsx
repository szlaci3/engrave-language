import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { routes } from '../../app/routes';
import {
  getVoicePreferences,
  saveVoicePreferences,
  type VoicePreferences,
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
          wooord
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
            value={preferences.dutchAudioSource ?? 'speechSynthesis'}
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
