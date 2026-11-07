import { useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../../app/routes';
import {
  getVocabularyFile,
  listFolders,
  updateVocabularyFile,
} from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import {
  getChineseAudioTextParts,
  preloadVocabularyAudios,
} from './audioService';
import { parseVocabulary } from './parseVocabulary';
import { speakChinese, speakDutch } from './speech';
import type { Folder, VocabularyFileWithEntries } from './types';

type FileViewPageProps = {
  fileId: string;
};

function EditIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 16.9-.8 3.9 3.9-.8L18.8 9.3l-3.1-3.1L5 16.9Zm12.1-12.3 3.1 3.1 1-1a1.5 1.5 0 0 0 0-2.1l-1.8-1.8a1.5 1.5 0 0 0-2.1 0l-1 1Z" />
    </svg>
  );
}

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

function SaveIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 3h12l2 2v16H5V3Zm2 2v14h10V6.2L15.8 5H15v5H8V5H7Zm3 0v3h3V5h-3Zm-1 9h6v2H9v-2Z" />
    </svg>
  );
}

function entriesToRawText(fileData: VocabularyFileWithEntries) {
  return fileData.entries
    .map((entry) => `${entry.dutch}  ${entry.chinese}`)
    .join('\n');
}

export function FileViewPage({ fileId }: FileViewPageProps) {
  const { t } = useUiLanguage();
  const [fileData, setFileData] = useState<VocabularyFileWithEntries | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [titleDraft, setTitleDraft] = useState('');
  const [folderDraft, setFolderDraft] = useState('');
  const [rawDraft, setRawDraft] = useState('');
  const [message, setMessage] = useState('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const nextChinesePartByEntryId = useRef(new Map<string, number>());
  const [listenedEntryIds, setListenedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const parsedDraft = useMemo(() => parseVocabulary(rawDraft), [rawDraft]);

  useEffect(() => {
    let isMounted = true;

    async function loadFile() {
      const [savedFile, loadedFolders] = await Promise.all([
        getVocabularyFile(fileId),
        listFolders(),
      ]);

      if (isMounted) {
        setFileData(savedFile);
        setFolders(loadedFolders);
        setIsLoading(false);
        setIsEditing(false);
        setMessage('');
      }

      if (savedFile) {
        preloadVocabularyAudios(savedFile.entries);
      }
    }

    void loadFile();

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  function enterEditMode() {
    if (!fileData) {
      return;
    }

    setTitleDraft(fileData.file.title);
    setFolderDraft(fileData.file.folderId ?? '');
    setRawDraft(entriesToRawText(fileData));
    setMessage('');
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!fileData || isSaving) {
      return;
    }

    if (!titleDraft.trim()) {
      setMessage(t('addFileTitle'));
      return;
    }

    if (parsedDraft.entries.length === 0) {
      setMessage(t('keepValidLine'));
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const updatedFile = await updateVocabularyFile(fileData.file.id, {
        title: titleDraft.trim(),
        folderId: folderDraft || null,
        entries: parsedDraft.entries,
      });

      if (!updatedFile) {
        setMessage(t('fileNotFound'));
        return;
      }

      setFileData(updatedFile);
      setIsEditing(false);
      preloadVocabularyAudios(updatedFile.entries);
    } catch {
      setMessage(t('fileSaveError'));
    } finally {
      setIsSaving(false);
    }
  }

  function playEntry(entryId: string, audioId: string, speak: () => boolean) {
    setActiveAudioId(audioId);

    const didStart = speak();

    if (!didStart) {
      setActiveAudioId(null);
      return;
    }

    setListenedEntryIds((current) => {
      const next = new Set(current);
      next.add(entryId);
      return next;
    });
  }

  function finishEntryAudio(audioId: string) {
    setActiveAudioId((currentAudioId) =>
      currentAudioId === audioId ? null : currentAudioId,
    );
  }

  function playChineseEntry(entryId: string, chinese: string) {
    const audioId = `${entryId}:chinese`;
    const parts = getChineseAudioTextParts(chinese);
    const partIndex = nextChinesePartByEntryId.current.get(entryId) ?? 0;

    playEntry(entryId, audioId, () => {
      const didStart = speakChinese(parts[partIndex % parts.length], {
        onEnd: () => finishEntryAudio(audioId),
      });

      if (didStart) {
        nextChinesePartByEntryId.current.set(
          entryId,
          (partIndex + 1) % parts.length,
        );
      }

      return didStart;
    });
  }

  function getEntryButtonClass(
    baseClassName: string,
    activeClassName: string,
    entryId: string,
    audioId: string,
  ) {
    return [
      baseClassName,
      listenedEntryIds.has(entryId) ? 'entry-button-listened' : '',
      activeAudioId === audioId ? activeClassName : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <a className="back-link" href={routes.home}>
          wooord
        </a>
        <p className="eyebrow">{t('file')}</p>
      </header>

      <section className="content-card" aria-label={t('file')}>
        {isLoading ? (
          <p className="empty-state">{t('loadingFile')}</p>
        ) : fileData ? (
          <>
            <div className="top-action-row">
              {isEditing ? (
                <div className="edit-title-field">
                  <label className="field-label" htmlFor="file-title">
                    {t('fileTitle')}
                  </label>
                  <input
                    id="file-title"
                    className="title-input"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                  />
                </div>
              ) : (
                <h1 id="file-heading" className="page-title">
                  {fileData.file.title}
                </h1>
              )}
              <button
                className="icon-button icon-button-secondary"
                type="button"
                aria-label={isEditing ? t('saveFile') : t('editFile')}
                disabled={isSaving}
                onClick={isEditing ? saveEdit : enterEditMode}
              >
                {isEditing ? <SaveIcon /> : <EditIcon />}
              </button>
            </div>

            {message ? <p className="form-message">{message}</p> : null}

            {isEditing ? (
              <div className="edit-fields">
                <div className="edit-content-field">
                  <label className="field-label" htmlFor="file-folder">
                    {t('folder')}
                  </label>
                  <select
                    id="file-folder"
                    className="select-input"
                    value={folderDraft}
                    onChange={(event) => setFolderDraft(event.target.value)}
                  >
                    <option value="">{t('noFolder')}</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="edit-content-field">
                  <label className="field-label" htmlFor="file-content">
                    {t('vocabularyText')}
                  </label>
                  <textarea
                    id="file-content"
                    className="vocabulary-textarea"
                    value={rawDraft}
                    onChange={(event) => setRawDraft(event.target.value)}
                    rows={12}
                  />
                  <p className="form-hint" aria-live="polite">
                    {t('validLines', {
                      count: parsedDraft.entries.length,
                      skipped: parsedDraft.skippedLines.length,
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <a
                  className="secondary-action file-study-link"
                  href={routes.flashcards(fileData.file.id)}
                >
                  {t('studyFlashcards')}
                </a>

                <ol className="entry-list">
                  {fileData.entries.map((entry) => (
                    <li key={entry.id} className="entry-item">
                      <div className="entry-language-row">
                        <button
                          className={getEntryButtonClass(
                            'entry-dutch-button',
                            'entry-dutch-button-active',
                            entry.id,
                            `${entry.id}:dutch`,
                          )}
                          type="button"
                          aria-pressed={activeAudioId === `${entry.id}:dutch`}
                          onClick={() =>
                            playEntry(entry.id, `${entry.id}:dutch`, () =>
                              speakDutch(entry.dutch, {
                                onEnd: () =>
                                  finishEntryAudio(`${entry.id}:dutch`),
                              }),
                            )
                          }
                        >
                          {entry.dutch}
                        </button>
                        <button
                          className={
                            activeAudioId === `${entry.id}:dutch`
                              ? 'entry-audio-button entry-audio-button-active'
                              : 'entry-audio-button'
                          }
                          type="button"
                          aria-label={t('playDutchExpression', {
                            text: entry.dutch,
                          })}
                          aria-pressed={activeAudioId === `${entry.id}:dutch`}
                          onClick={() =>
                            playEntry(entry.id, `${entry.id}:dutch`, () =>
                              speakDutch(entry.dutch, {
                                onEnd: () =>
                                  finishEntryAudio(`${entry.id}:dutch`),
                              }),
                            )
                          }
                        >
                          <SpeakerIcon />
                        </button>
                      </div>
                      <div className="entry-language-row">
                        <button
                          className={getEntryButtonClass(
                            'entry-chinese-button',
                            'entry-chinese-button-active',
                            entry.id,
                            `${entry.id}:chinese`,
                          )}
                          type="button"
                          aria-pressed={activeAudioId === `${entry.id}:chinese`}
                          onClick={() =>
                            playChineseEntry(entry.id, entry.chinese)
                          }
                        >
                          {entry.chinese}
                        </button>
                        <button
                          className={
                            activeAudioId === `${entry.id}:chinese`
                              ? 'chinese entry-audio-button entry-audio-button-active'
                              : 'chinese entry-audio-button'
                          }
                          type="button"
                          aria-label={t('playChineseTranslation', {
                            text: entry.chinese,
                          })}
                          aria-pressed={activeAudioId === `${entry.id}:chinese`}
                          onClick={() =>
                            playChineseEntry(entry.id, entry.chinese)
                          }
                        >
                          <SpeakerIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        ) : (
          <p className="empty-state">{t('fileNotFound')}</p>
        )}
      </section>
    </main>
  );
}
