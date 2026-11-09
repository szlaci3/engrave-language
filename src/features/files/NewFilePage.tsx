import { type FormEvent, useId, useMemo, useState } from 'react';
import { routes } from '../../app/routes';
import { createVocabularyFile } from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import { parseVocabulary } from './parseVocabulary';
import { parseCardJson } from './parseCardJson';

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createFileTitle(firstDutchExpression: string) {
  const firstDutchWord = firstDutchExpression.trim().split(/\s+/u)[0];

  return `${firstDutchWord} — ${formatLocalDate(new Date())}`;
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

const DRAFT_KEY = 'engrave-new-deck-draft';
function readDraft(): { title: string; rawText: string } {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    return { title: typeof draft.title === 'string' ? draft.title : '', rawText: typeof draft.rawText === 'string' ? draft.rawText : '' };
  } catch { return { title: '', rawText: '' }; }
}

export function NewFilePage() {
  const { t, language } = useUiLanguage();
  const textareaId = useId();
  const [draft, setDraft] = useState(readDraft);
  const { rawText, title } = draft;
  const [draftStatus, setDraftStatus] = useState('');
  function saveDraft(next: typeof draft) {
    setDraft(next);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); setDraftStatus(language === 'zh' ? '草稿已自动保存到此设备。' : 'Draft autosaved on this device.'); }
    catch { setDraftStatus(language === 'zh' ? '无法自动保存，请保持此页面打开并手动保存。' : 'Autosave unavailable. Keep this page open and save the deck.'); }
  }
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const parsedPreview = useMemo(() => {
    if (/^[\s\uFEFF]*[[{]/u.test(rawText)) {
      try { return { entries: parseCardJson(rawText), skippedLines: [], json: true, error: '' }; }
      catch (error) { return { entries: [], skippedLines: [], json: true, error: (error as Error).message }; }
    }
    return { ...parseVocabulary(rawText), json: false, error: '' };
  }, [rawText]);

  async function uploadJson(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      parseCardJson(text); // Validate before replacing the current draft.
      saveDraft({ ...draft, rawText: text });
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read the JSON file.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (parsedPreview.entries.length === 0) {
      setMessage(parsedPreview.error || t('pasteValidLine'));
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const savedFile = await createVocabularyFile({
        title: title.trim() || createFileTitle(parsedPreview.entries[0].dutch || parsedPreview.entries[0].chinese),
        entries: parsedPreview.entries,
      });

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* Saved deck is already persisted in IndexedDB. */ }
      window.location.assign(routes.flashcards(savedFile.file.id));
    } catch {
      setMessage(t('fileSaveError'));
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <a className="back-link" href={routes.home}>
          Engrave Language
        </a>
        <p className="eyebrow">{t('newFileEyebrow')}</p>
      </header>

      <form
        className="content-card file-form"
        aria-labelledby="new-file-heading"
        onSubmit={handleSubmit}
      >
        <div className="top-action-row">
          <div>
            <h1 id="new-file-heading" className="page-title">
              {t('pasteVocabulary')}
            </h1>
          </div>
          <button
            className="icon-button"
            type="submit"
            aria-label={t('saveVocabularyFile')}
            disabled={isSaving}
          >
            <SaveIcon />
          </button>
        </div>

        <label className="field-label" htmlFor="deck-title">{t('fileTitle')}</label>
        <input className="text-input" id="deck-title" value={title} placeholder={language === 'zh' ? '可选，留空则自动生成标题' : 'Optional — generated from the first word if empty'} onChange={e => saveDraft({ ...draft, title: e.target.value })} />
        <p className="form-hint" role="status">{draftStatus || (language === 'zh' ? '输入时自动保存草稿到此设备。' : 'Your draft is saved on this device as you type.')}</p>
        <label className="field-label" htmlFor="card-json-upload">{language === 'zh' ? '上传卡片 JSON' : 'Upload card JSON'}</label>
        <input id="card-json-upload" type="file" accept=".json,application/json" disabled={isSaving} onChange={event => { void uploadJson(event.target.files?.[0]); event.target.value = ''; }} />
        <p className="form-hint">{language === 'zh' ? '也可在下方粘贴 JSON。每张卡片的前两面依次为英语、荷兰语；英语显示在中文一面。' : 'Or paste JSON below. The first two sides of each card are English, then Dutch; English appears on the Chinese side.'}</p>
        <label className="field-label" htmlFor={textareaId}>
          {t('vocabularyText')}
        </label>
        <textarea
          id={textareaId}
          className="vocabulary-textarea"
          value={rawText}
          onChange={(event) => saveDraft({ ...draft, rawText: event.target.value })}
          placeholder={'natuurlijk  当然\nbestel订购\nzalig舒服的'}
          rows={12}
        />

        {rawText.trim() ? (
          <p className="form-hint" aria-live="polite">
            {parsedPreview.error || (parsedPreview.json ? `${parsedPreview.entries.length} ${language === 'zh' ? '张卡片可导入' : 'cards ready to import'}` : t('validLines', {
              count: parsedPreview.entries.length,
              skipped: parsedPreview.skippedLines.length,
            }))}
          </p>
        ) : null}

        {message ? <p className="form-message">{message}</p> : null}
      </form>
    </main>
  );
}
