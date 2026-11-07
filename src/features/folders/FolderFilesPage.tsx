import { useEffect, useState } from 'react';
import { routes } from '../../app/routes';
import {
  getFolder,
  listVocabularyFilesByFolder,
} from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import type { Folder, VocabularyFile } from '../files/types';

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

type FolderFilesPageProps = {
  folderId: string;
};

export function FolderFilesPage({ folderId }: FolderFilesPageProps) {
  const { t } = useUiLanguage();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<VocabularyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadFolder() {
      try {
        const [loadedFolder, loadedFiles] = await Promise.all([
          getFolder(folderId),
          listVocabularyFilesByFolder(folderId),
        ]);

        if (isMounted) {
          setFolder(loadedFolder);
          setFiles(loadedFiles);
        }
      } catch {
        if (isMounted) {
          setMessage(t('folderLoadError'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFolder();

    return () => {
      isMounted = false;
    };
  }, [folderId, t]);

  return (
    <main className="app-shell">
      <header className="page-header">
        <a className="back-link" href={routes.home}>
          wooord
        </a>
        <p className="eyebrow">{t('folder')}</p>
      </header>

      <section className="content-card" aria-label={t('folderFiles')}>
        {isLoading ? (
          <p className="empty-state">{t('loadingFolder')}</p>
        ) : folder ? (
          <>
            <h1 className="page-title">{folder.name}</h1>
            {message ? <p className="form-message">{message}</p> : null}
            {files.length > 0 ? (
              <ul className="file-list">
                {files.map((file) => (
                  <li key={file.id}>
                    <div className="file-list-item">
                      <a className="file-list-link" href={routes.file(file.id)}>
                        <span className="file-list-title">{file.title}</span>
                        <span className="file-list-meta">
                          {formatDisplayDate(file.createdAt)}
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
            ) : (
              <p className="empty-state">{t('noFilesInFolder')}</p>
            )}
          </>
        ) : (
          <p className="empty-state">{t('folderNotFound')}</p>
        )}
      </section>
    </main>
  );
}
