import { type ChangeEvent, useRef, useState } from 'react';
import { routes } from '../../app/routes';
import {
  downloadWooordDatabaseExport,
  mergeWooordDatabase,
  readWooordExportFile,
  replaceWooordDatabase,
} from './databaseExportImport';
import { useUiLanguage } from '../settings/uiLanguage';

export function DataPage() {
  const { t } = useUiLanguage();
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const mergeInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleExport() {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setMessage('');

    try {
      await downloadWooordDatabaseExport();
      setMessageTone('success');
      setMessage(t('exportStarted'));
    } catch {
      setMessageTone('error');
      setMessage(t('exportError'));
    } finally {
      setIsExporting(false);
    }
  }

  function handleReplaceClick() {
    replaceInputRef.current?.click();
  }

  function handleMergeClick() {
    mergeInputRef.current?.click();
  }

  async function handleReplaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    setMessage('');

    try {
      const backup = await readWooordExportFile(file);
      const confirmed = window.confirm(t('replaceConfirm'));

      if (!confirmed) {
        setMessageTone('success');
        setMessage(t('importCanceled'));
        return;
      }

      await replaceWooordDatabase(backup);
      setMessageTone('success');
      setMessage(t('importReplaced'));
    } catch {
      setMessageTone('error');
      setMessage(t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleMergeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    setMessage('');

    try {
      const backup = await readWooordExportFile(file);

      await mergeWooordDatabase(backup);
      setMessageTone('success');
      setMessage(t('databaseMerged'));
    } catch {
      setMessageTone('error');
      setMessage(t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <a className="back-link" href={routes.home}>
          wooord
        </a>
        <p className="eyebrow">{t('data')}</p>
      </header>

      <section className="content-card" aria-labelledby="data-heading">
        <h1 id="data-heading" className="page-title">
          {t('localData')}
        </h1>

        <div className="data-actions">
          <button
            className="data-action-button"
            type="button"
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            {t('exportDatabase')}
          </button>
          <button
            className="data-action-button data-action-danger"
            type="button"
            onClick={handleReplaceClick}
            disabled={isExporting || isImporting}
          >
            {t('importReplace')}
          </button>
          <input
            ref={replaceInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={handleReplaceFile}
          />
          <button
            className="data-action-button"
            type="button"
            onClick={handleMergeClick}
            disabled={isExporting || isImporting}
          >
            {t('mergeDatabase')}
          </button>
          <input
            ref={mergeInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={handleMergeFile}
          />
        </div>

        {message ? (
          <p
            className={
              messageTone === 'success'
                ? 'form-message form-message-success'
                : 'form-message'
            }
            role={messageTone === 'success' ? 'status' : 'alert'}
          >
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
