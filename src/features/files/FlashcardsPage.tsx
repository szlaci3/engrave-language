import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../../app/routes';
import { getVocabularyFile } from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import {
  getChineseAudioTextParts,
  preloadVocabularyAudios,
} from './audioService';
import { speakChinese, speakDutch } from './speech';
import type { VocabularyEntry, VocabularyFileWithEntries } from './types';

type FlashcardsPageProps = {
  fileId: string;
};

type FlashcardDirection = 'dutch-to-chinese' | 'chinese-to-dutch';

function SpeakerIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4Zm12.6-.7-1.4 1.4A3.2 3.2 0 0 1 16 12c0 .9-.3 1.7-.8 2.3l1.4 1.4A5.1 5.1 0 0 0 18 12c0-1.4-.5-2.7-1.4-3.7Zm2.8-2.8L18 6.9a7.2 7.2 0 0 1 2 5.1c0 2-.8 3.8-2 5.1l1.4 1.4A9.1 9.1 0 0 0 22 12c0-2.5-1-4.8-2.6-6.5Z" />
    </svg>
  );
}

function getFrontText(entry: VocabularyEntry, direction: FlashcardDirection) {
  return direction === 'dutch-to-chinese' ? entry.dutch : entry.chinese;
}

function getBackText(entry: VocabularyEntry, direction: FlashcardDirection) {
  return direction === 'dutch-to-chinese' ? entry.chinese : entry.dutch;
}

export function FlashcardsPage({ fileId }: FlashcardsPageProps) {
  const { t } = useUiLanguage();
  const [fileData, setFileData] = useState<VocabularyFileWithEntries | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [direction, setDirection] =
    useState<FlashcardDirection>('chinese-to-dutch');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [promptPresentationSequence, setPromptPresentationSequence] =
    useState(0);
  const [message, setMessage] = useState('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const nextChinesePartByEntryId = useRef(new Map<string, number>());
  const lastAutoPlayedPromptKey = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFile() {
      try {
        const savedFile = await getVocabularyFile(fileId);

        if (isMounted) {
          setFileData(savedFile);
        }

        if (savedFile) {
          preloadVocabularyAudios(savedFile.entries);
        }
      } catch {
        if (isMounted) {
          setMessage(t('flashcardsLoadError'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFile();

    return () => {
      isMounted = false;
    };
  }, [fileId, t]);

  const entries = fileData?.entries ?? [];
  const currentEntry = entries[currentIndex] ?? null;
  const progressText = useMemo(() => {
    if (entries.length === 0) {
      return '0 / 0';
    }

    return `${currentIndex + 1} / ${entries.length}`;
  }, [currentIndex, entries.length]);

  function changeDirection(nextDirection: FlashcardDirection) {
    if (nextDirection === direction) {
      return;
    }

    setDirection(nextDirection);
    setIsRevealed(false);
    setActiveAudioId(null);
    setPromptPresentationSequence((sequence) => sequence + 1);
  }

  function goToPreviousCard() {
    setCurrentIndex((index) =>
      entries.length > 0 ? (index + entries.length - 1) % entries.length : 0,
    );
    setIsRevealed(false);
    setActiveAudioId(null);
    setPromptPresentationSequence((sequence) => sequence + 1);
  }

  function goToNextCard() {
    if (entries.length === 0) {
      setCurrentIndex(0);
      setIsRevealed(false);
      setActiveAudioId(null);
      return;
    }

    if (currentIndex >= entries.length - 1) {
      if (window.confirm('Go to start?')) {
        setCurrentIndex(0);
        setIsRevealed(false);
        setActiveAudioId(null);
        setPromptPresentationSequence((sequence) => sequence + 1);
      } else if (fileData) {
        window.location.href = routes.file(fileData.file.id);
      }

      return;
    }

    setCurrentIndex((index) => index + 1);
    setIsRevealed(false);
    setActiveAudioId(null);
    setPromptPresentationSequence((sequence) => sequence + 1);
  }

  const finishAudio = useCallback((audioId: string) => {
    setActiveAudioId((currentAudioId) =>
      currentAudioId === audioId ? null : currentAudioId,
    );
  }, []);

  const playChineseFlashcardAudio = useCallback((
    entryId: string,
    text: string,
    onEnd: () => void,
  ) => {
    const parts = getChineseAudioTextParts(text);
    const partIndex = nextChinesePartByEntryId.current.get(entryId) ?? 0;
    const didStart = speakChinese(parts[partIndex % parts.length], { onEnd });

    if (didStart) {
      nextChinesePartByEntryId.current.set(
        entryId,
        (partIndex + 1) % parts.length,
      );
    }

    return didStart;
  }, []);

  const playPromptAudio = useCallback(() => {
    if (!currentEntry) {
      return;
    }

    const audioId = `${currentEntry.id}:prompt`;
    setActiveAudioId(audioId);

    const onEnd = () => finishAudio(audioId);
    const didStart =
      direction === 'dutch-to-chinese'
        ? speakDutch(currentEntry.dutch, { onEnd })
        : playChineseFlashcardAudio(
            currentEntry.id,
            currentEntry.chinese,
            onEnd,
          );

    if (!didStart) {
      setActiveAudioId(null);
    }
  }, [currentEntry, direction, finishAudio, playChineseFlashcardAudio]);

  useEffect(() => {
    if (!currentEntry) {
      return;
    }

    const promptKey = [
      fileId,
      currentEntry.id,
      direction,
      promptPresentationSequence,
    ].join(':');

    if (lastAutoPlayedPromptKey.current === promptKey) {
      return;
    }

    lastAutoPlayedPromptKey.current = promptKey;
    playPromptAudio();
  }, [
    currentEntry,
    direction,
    fileId,
    playPromptAudio,
    promptPresentationSequence,
  ]);

  function playAnswerAudio() {
    if (!currentEntry) {
      return;
    }

    const audioId = `${currentEntry.id}:answer`;
    setActiveAudioId(audioId);

    const onEnd = () => finishAudio(audioId);
    const didStart =
      direction === 'dutch-to-chinese'
        ? playChineseFlashcardAudio(
            currentEntry.id,
            currentEntry.chinese,
            onEnd,
          )
        : speakDutch(currentEntry.dutch, { onEnd });

    if (!didStart) {
      setActiveAudioId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <a className="back-link" href={routes.home}>
          wooord
        </a>
        <p className="eyebrow">{t('flashcards')}</p>
      </header>

      <section className="content-card" aria-label={t('flashcards')}>
        {isLoading ? (
          <p className="empty-state">{t('loadingFlashcards')}</p>
        ) : fileData && currentEntry ? (
          <>
            <div className="flashcard-heading">
              <div>
                <h1 className="page-title">{fileData.file.title}</h1>
                <p className="flashcard-progress">{progressText}</p>
              </div>
              <a className="text-link" href={routes.file(fileData.file.id)}>
                {t('file')}
              </a>
            </div>

            {message ? <p className="form-message">{message}</p> : null}

            <div className="segmented-control" aria-label={t('flashcardDirection')}>
              <button
                className={
                  direction === 'dutch-to-chinese'
                    ? 'segment-button segment-button-active'
                    : 'segment-button'
                }
                type="button"
                onClick={() => changeDirection('dutch-to-chinese')}
              >
                {t('dutch')}
              </button>
              <button
                className={
                  direction === 'chinese-to-dutch'
                    ? 'segment-button segment-button-active'
                    : 'segment-button'
                }
                type="button"
                onClick={() => changeDirection('chinese-to-dutch')}
              >
                {t('chinese')}
              </button>
            </div>

            <button
              className="flashcard-card"
              type="button"
              onClick={() => setIsRevealed((value) => !value)}
              aria-pressed={isRevealed}
            >
              <span className="flashcard-label">
                {isRevealed ? t('answer') : t('prompt')}
              </span>
              <span
                className={
                  direction === 'chinese-to-dutch' && !isRevealed
                    ? 'flashcard-text flashcard-text-chinese'
                    : direction === 'dutch-to-chinese' && isRevealed
                      ? 'flashcard-text flashcard-text-chinese'
                      : 'flashcard-text'
                }
              >
                {isRevealed
                  ? getBackText(currentEntry, direction)
                  : getFrontText(currentEntry, direction)}
              </span>
            </button>

            <div className="flashcard-audio-row">
              <button
                className={
                  activeAudioId === `${currentEntry.id}:prompt`
                    ? 'secondary-action action-button flashcard-audio-active'
                    : 'secondary-action action-button'
                }
                type="button"
                aria-pressed={activeAudioId === `${currentEntry.id}:prompt`}
                onClick={playPromptAudio}
              >
                <SpeakerIcon />
                {direction === 'dutch-to-chinese'
                  ? t('dutch')
                  : t('chinese')}
              </button>
              <button
                className={
                  activeAudioId === `${currentEntry.id}:answer`
                    ? 'secondary-action action-button flashcard-audio-active'
                    : 'secondary-action action-button'
                }
                type="button"
                aria-pressed={activeAudioId === `${currentEntry.id}:answer`}
                onClick={playAnswerAudio}
              >
                <SpeakerIcon />
                {direction === 'dutch-to-chinese'
                  ? t('chinese')
                  : t('dutch')}
              </button>
            </div>

            <div className="flashcard-nav-row">
              <button
                className="secondary-action action-button"
                type="button"
                onClick={goToPreviousCard}
              >
                {t('previous')}
              </button>
              <button
                className="primary-action action-button"
                type="button"
                onClick={goToNextCard}
              >
                {t('next')}
              </button>
            </div>
          </>
        ) : fileData ? (
          <p className="empty-state">{t('noEntriesForFlashcards')}</p>
        ) : (
          <p className="empty-state">{t('fileNotFound')}</p>
        )}
      </section>
    </main>
  );
}
