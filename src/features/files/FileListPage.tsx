import { type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { routes } from '../../app/routes';
import {
  createFolder,
  listFolders,
  listVocabularyFiles,
  saveVocabularyFileOrder,
} from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import type { Folder, VocabularyFile } from './types';

// Temporary: set to true to show the folders list again.
const SHOW_FOLDERS = false;

type DeckDrag = {
  fileId: string;
  pointerId: number;
  startY: number;
  y: number;
  active: boolean;
};

function getDropIndex(list: HTMLUListElement | null, drag: DeckDrag) {
  if (!list) return 0;

  return Array.from(list.children).filter((element) => {
    if ((element as HTMLElement).dataset.fileId === drag.fileId) return false;
    const bounds = element.getBoundingClientRect();
    return drag.y > bounds.top + bounds.height / 2;
  }).length;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function FileListPage() {
  const { t } = useUiLanguage();
  const [files, setFiles] = useState<VocabularyFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [folderName, setFolderName] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<DeckDrag | null>(null);
  const savingOrderRef = useRef(false);

  useEffect(() => {
    if (!draggingId) return;

    let frame: number;
    let lastTime = 0;
    function updateDrag(time: number) {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.active) {
        // Keep long lists usable while a finger or mouse is near the screen edge.
        const edge = 64;
        const speed = drag.y < edge
          ? -Math.min(1, (edge - drag.y) / edge)
          : drag.y > window.innerHeight - edge
            ? Math.min(1, (drag.y - window.innerHeight + edge) / edge)
            : 0;
        const elapsed = lastTime ? Math.min(time - lastTime, 32) : 16;
        if (speed) window.scrollBy(0, speed * elapsed * 0.6);
        setDropIndex(getDropIndex(listRef.current, drag));
      }
      lastTime = time;
      frame = requestAnimationFrame(updateDrag);
    }
    frame = requestAnimationFrame(updateDrag);
    return () => cancelAnimationFrame(frame);
  }, [draggingId]);

  function cancelDrag() {
    dragRef.current = null;
    setDraggingId(null);
    setDropIndex(null);
  }

  async function moveFile(fileId: string, index: number) {
    const previousIndex = files.findIndex((file) => file.id === fileId);
    if (savingOrderRef.current || previousIndex < 0 || previousIndex === index) return;

    const previousFiles = files;
    const reordered = [...files];
    const [moved] = reordered.splice(previousIndex, 1);
    reordered.splice(index, 0, moved);
    savingOrderRef.current = true;
    setIsSavingOrder(true);
    setOrderStatus('');
    setMessage('');
    setFiles(reordered);

    try {
      await saveVocabularyFileOrder(reordered.map((file) => file.id));
      setOrderStatus(t('fileOrderSaved'));
    } catch {
      setFiles(previousFiles);
      setMessage(t('fileOrderSaveError'));
    } finally {
      savingOrderRef.current = false;
      setIsSavingOrder(false);
    }
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, fileId: string) {
    if (!event.isPrimary || event.button !== 0 || savingOrderRef.current || dragRef.current) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      fileId,
      pointerId: event.pointerId,
      startY: event.clientY,
      y: event.clientY,
      active: false,
    };
    setDraggingId(fileId);
    setOrderStatus('');
  }

  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.y = event.clientY;
    if (Math.abs(drag.y - drag.startY) >= 6) drag.active = true;
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.y = event.clientY;
    const index = getDropIndex(listRef.current, drag);
    cancelDrag();
    if (drag.active) void moveFile(drag.fileId, index);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadLandingData() {
      try {
        const [loadedFiles, loadedFolders] = await Promise.all([
          listVocabularyFiles(),
          listFolders(),
        ]);

        if (isMounted) {
          setFiles(loadedFiles);
          setFolders(loadedFolders);
        }
      } catch {
        if (isMounted) {
          setMessage(t('savedFilesLoadError'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLandingData();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const folderNamesById = useMemo(() => {
    return new Map(folders.map((folder) => [folder.id, folder.name]));
  }, [folders]);

  const dropFiles = files.filter((file) => file.id !== draggingId);
  const dropBeforeId = dropIndex === null ? undefined : dropFiles[dropIndex]?.id;
  const dropAfterId = dropIndex === dropFiles.length ? dropFiles.at(-1)?.id : undefined;

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = folderName.trim();

    if (!trimmedName) {
      setMessage(t('addFolderName'));
      return;
    }

    try {
      const folder = await createFolder(trimmedName);

      setFolders((currentFolders) => [...currentFolders, folder]);
      setFolderName('');
      setMessage('');
    } catch {
      setMessage(t('folderCreateError'));
    }
  }

  return (
    <main className="app-shell">
      <section className="home-panel" aria-labelledby="app-title">
        <p className="eyebrow">{t('appEyebrow')}</p>
        <h1 id="app-title">wooord</h1>
        <p className="intro">{t('appIntro')}</p>

        <nav className="quick-actions" aria-label={t('primaryNavigation')}>
          <a className="primary-action" href={routes.newFile}>
            {t('newFile')}
          </a>
          <a className="secondary-action" href={routes.data}>
            {t('data')}
          </a>
          <a className="secondary-action" href={routes.settings}>
            {t('settings')}
          </a>
        </nav>
      </section>

      {message ? <p className="form-message" role="alert">{message}</p> : null}
      <p className="sr-only" role="status">{orderStatus}</p>

      {SHOW_FOLDERS && <section className="content-section" aria-labelledby="new-folder-heading">
        <div className="section-heading">
          <h2 id="new-folder-heading">{t('newFolder')}</h2>
        </div>
        <form className="inline-form" onSubmit={handleCreateFolder}>
          <label className="sr-only" htmlFor="folder-name">
            {t('folderName')}
          </label>
          <input
            id="folder-name"
            className="text-input"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder={t('folderName')}
          />
          <button className="secondary-action action-button" type="submit">
            {t('create')}
          </button>
        </form>
      </section>}

      {SHOW_FOLDERS && folders.length > 0 ? (
        <section className="content-section" aria-labelledby="folders-heading">
          <div className="section-heading">
            <h2 id="folders-heading">{t('folders')}</h2>
          </div>
          <ul className="folder-list">
            {folders.map((folder) => (
              <li key={folder.id}>
                <a className="folder-list-link" href={routes.folder(folder.id)}>
                  <span>{folder.name}</span>
                  <small>{formatDisplayDate(folder.updatedAt)}</small>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="content-section" aria-labelledby="files-heading">
        <div className="section-heading">
          <h2 id="files-heading">{t('files')}</h2>
          <a className="text-link" href={routes.newFile}>
            {t('createFile')}
          </a>
        </div>

        {isLoading ? (
          <p className="empty-state">{t('loadingFiles')}</p>
        ) : files.length > 0 ? (
          <>
            <p id="reorder-files-hint" className="sr-only">{t('reorderFilesHint')}</p>
            <ul className="file-list reorderable-file-list" ref={listRef} aria-busy={isSavingOrder}>
              {files.map((file, index) => (
                <li
                  key={file.id}
                  data-file-id={file.id}
                  className={[
                    draggingId === file.id ? 'deck-dragging' : '',
                    dropBeforeId === file.id ? 'deck-drop-before' : '',
                    dropAfterId === file.id ? 'deck-drop-after' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <button
                    type="button"
                    className="deck-drag-handle"
                    aria-label={t('reorderFile', { title: file.title })}
                    aria-describedby="reorder-files-hint"
                    aria-disabled={isSavingOrder || files.length < 2}
                    title={t('reorderFilesHint')}
                    onPointerDown={(event) => {
                      if (files.length > 1) startDrag(event, file.id);
                    }}
                    onPointerMove={updateDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={cancelDrag}
                    onLostPointerCapture={cancelDrag}
                    onContextMenu={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        cancelDrag();
                      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        if (!dragRef.current) {
                          const next = index + (event.key === 'ArrowUp' ? -1 : 1);
                          if (next >= 0 && next < files.length) void moveFile(file.id, next);
                        }
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
                      <circle cx="8" cy="5" r="2" /><circle cx="16" cy="5" r="2" />
                      <circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" />
                      <circle cx="8" cy="19" r="2" /><circle cx="16" cy="19" r="2" />
                    </svg>
                  </button>
                  <div className="file-list-item">
                    <a className="file-list-link" href={routes.file(file.id)}>
                      <span className="file-list-title">{file.title}</span>
                      <span className="file-list-meta">
                        {formatDisplayDate(file.createdAt)}
                        {file.folderId && folderNamesById.has(file.folderId)
                          ? ` - ${folderNamesById.get(file.folderId)}`
                          : ''}
                      </span>
                    </a>
                    <a
                      className="file-list-study-link"
                      href={routes.flashcards(file.id)}
                    >
                      {t('flashcards')}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty-state">{t('noFiles')}</p>
        )}
      </section>
    </main>
  );
}
