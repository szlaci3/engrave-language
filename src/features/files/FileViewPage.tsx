import '../world/world.css';
import { DeckStudyLinks } from './DeckStudyLinks';
import { useEffect, useRef, useState } from 'react';
import { routes } from '../../app/routes';
import {
  getVocabularyFile,
  addVocabularyPair,
  deleteVocabularyPair,
  updateVocabularyFile,
} from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import {
  getChineseAudioTextParts,
  preloadVocabularyAudios,
} from './audioService';
import { speakChinese, speakDutch } from './speech';
import type { VocabularyFileWithEntries } from './types';

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

export function FileViewPage({ fileId }: FileViewPageProps) {
  const { t, language } = useUiLanguage();
  const label = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [fileData, setFileData] = useState<VocabularyFileWithEntries | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDutch, setNewDutch] = useState('');
  const [newChinese, setNewChinese] = useState('');
  const [cardError, setCardError] = useState('');
  const [cardSaving, setCardSaving] = useState(false);
  const addDialog = useRef<HTMLDialogElement>(null);
  const addBusy = useRef(false);
  useEffect(() => {
    if (!adding) return;
    const dialog = addDialog.current; dialog?.showModal();
    return () => dialog?.close();
  }, [adding]);
  async function saveNewCard(close: boolean) {
    if (addBusy.current) return;
    if (!newDutch.trim() && !newChinese.trim()) {
      if (close) setAdding(false);
      else setCardError(label('Enter at least one side.', '请至少填写一面。'));
      return;
    }
    addBusy.current = true; setCardSaving(true); setCardError('');
    try {
      setFileData(await addVocabularyPair(fileId, newDutch, newChinese));
      setNewDutch(''); setNewChinese('');
      if (close) setAdding(false); else addDialog.current?.querySelector('textarea')?.focus();
    } catch { setCardError(label('Could not save card. Please try again.', '无法保存卡片，请重试。')); }
    finally { addBusy.current = false; setCardSaving(false); }
  }
  async function deleteCard(entryId: string) {
    if (addBusy.current || !window.confirm(label('Delete this card and its practice history?', '删除此卡片及其学习记录？'))) return;
    addBusy.current = true; setCardSaving(true);
    try { setFileData(await deleteVocabularyPair(fileId, entryId)); }
    catch { setMessage(label('Could not delete card. Please try again.', '无法删除卡片，请重试。')); }
    finally { addBusy.current = false; setCardSaving(false); }
  }

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [message, setMessage] = useState('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const nextChinesePartByEntryId = useRef(new Map<string, number>());
  const [listenedEntryIds, setListenedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadFile() {
      const savedFile = await getVocabularyFile(fileId);

      if (isMounted) {
        setFileData(savedFile);
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

    setIsSaving(true);
    setMessage('');

    try {
      const updatedFile = await updateVocabularyFile(fileData.file.id, {
        title: titleDraft.trim(),
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
          Engrave Language
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

            {isEditing ? null : (
              <>
                <DeckStudyLinks fileId={fileData.file.id} />
                <button className="secondary-action action-button" onClick={() => { setNewDutch(''); setNewChinese(''); setCardError(''); setAdding(true); }}>{label('Add card', '添加卡片')}</button>

                <ol className="entry-list">
                  {fileData.entries.map((entry) => (
                    <li key={entry.id} className="entry-item">
                      <button className="secondary-action action-button" disabled={cardSaving} aria-label={label(`Delete card: ${entry.dutch || entry.chinese}`, `删除卡片：${entry.dutch || entry.chinese}`)} onClick={() => void deleteCard(entry.id)}>{label('Delete', '删除')}</button>
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
      {adding && <dialog ref={addDialog} className="world-editor" onCancel={event => { event.preventDefault(); void saveNewCard(true); }}>
        <form onSubmit={event => { event.preventDefault(); void saveNewCard(false); }}>
          <h2>{label('Add card', '添加卡片')}</h2>
          <label>{t('dutch')}<textarea autoFocus value={newDutch} onChange={event => setNewDutch(event.target.value)} /></label>
          <label>{t('chinese')}<textarea value={newChinese} onChange={event => setNewChinese(event.target.value)} /></label>
          {cardError && <p role="alert">{cardError}</p>}
          <div><button type="button" disabled={cardSaving} onClick={() => void saveNewCard(true)}>{label('Close', '关闭')}</button><button type="submit" disabled={cardSaving}>{label('Add another', '再添加一张')}</button></div>
        </form>
      </dialog>}
    </main>
  );
}
