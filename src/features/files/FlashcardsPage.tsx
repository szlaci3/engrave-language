import { liveQuery } from 'dexie';
import { useAudioAutoplay } from './useAudioAutoplay';
import { usePracticeCompletion } from './usePracticeCompletion';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { routes } from '../../app/routes';
import { getVocabularyFile, updateVocabularyPair } from '../../db/vocabularyRepository';
import { useUiLanguage } from '../settings/uiLanguage';
import { getLowControls, saveLowControls } from '../settings/worldSettings';
import { getChineseAudioTextParts } from './audioService';
import { speakChinese, speakDutch } from './speech';
import type { VocabularyFileWithEntries } from './types';
import type { createNaveScene } from '../world/createNaveScene';
import '../world/world.css';

type Scene = ReturnType<typeof createNaveScene>;
type IconName = 'previous' | 'next' | 'back' | 'forward' | 'expand' | 'audio';
function Icon({ name }: { name: IconName }) {
  const paths = {
    previous: 'M6 5v14M18 5l-9 7 9 7Z', next: 'M18 5v14M6 5l9 7-9 7Z',
    back: 'm5 9 7 7 7-7', forward: 'm5 15 7-7 7 7',
    expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    audio: 'M3 9v6h4l5 4V5L7 9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} transform={name === 'previous' || name === 'next' ? 'rotate(-90 12 12)' : undefined} /></svg>;
}
function readSpeed() {
  try { const value = Number(localStorage.getItem('engrave-walk-speed')); return value >= .25 && value <= 3 ? value : 1; }
  catch { return 1; }
}

export function FlashcardsPage({ fileId }: { fileId: string }) {
  const { language, t } = useUiLanguage();
  const { notice, complete } = usePracticeCompletion();
  const label = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [deck, setDeck] = useState<VocabularyFileWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [first, setFirst] = useState<'zh' | 'nl'>('zh');
  const previousFirst = useRef(first);
  const [index, setIndex] = useState(0);
  const [lowControls, setLowControls] = useState(false);
  const dock = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [speed, setSpeed] = useState(readSpeed);
  const [editing, setEditing] = useState(false);
  const [dutch, setDutch] = useState('');
  const [chinese, setChinese] = useState('');
  const [saving, setSaving] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const chinesePart = useRef(new Map<string, number>());
  const stones = useMemo(() => (deck?.entries ?? []).flatMap(entry => {
    const pair = [{ id: entry.id + '-zh', title: entry.chinese, language: 'zh' as const },
      { id: entry.id + '-nl', title: entry.dutch, language: 'nl' as const }];
    return first === 'zh' ? pair : pair.reverse();
  }), [deck, first]);
  const entry = deck?.entries[Math.floor(index / 2)];
  useAudioAutoplay(`${fileId}:${index}:${first}`, index % 2 === 0 ? 'front' : 'back',
    !editing && (ready || fallback) ? stones[index]?.title ?? '' : '', stones[index]?.language ?? 'zh');

  useEffect(() => {
    const subscription = liveQuery(() => getVocabularyFile(fileId)).subscribe(value => setDeck(value));
    return () => subscription.unsubscribe();
  }, [fileId]);
  useEffect(() => {
    let active = true;
    Promise.all([getVocabularyFile(fileId), getLowControls()]).then(([value, low]) => { if (active) { setDeck(value); setLowControls(low); setLoading(false); } })
      .catch(() => { if (active) { setError('Unable to load deck. Please reload.'); setLoading(false); } });
    return () => { active = false; };
  }, [fileId]);
  useEffect(() => {
    if (loading || !host.current || !deck?.entries.length) return;
    let active = true;
    import('../world/createNaveScene').then(({ createNaveScene }) => {
      if (!active || !host.current) return;
      try { scene.current = createNaveScene(host.current, setIndex, () => setFallback(true), complete); setReady(true); }
      catch { setFallback(true); }
    }).catch(() => { if (active) setFallback(true); });
    return () => { active = false; scene.current?.dispose(); scene.current = null; };
  }, [loading, deck?.entries.length, complete]);
  useEffect(() => {
    if (!ready) return;
    const reset = previousFirst.current !== first;
    scene.current?.update(stones, reset);
    previousFirst.current = first;
    if (reset) setIndex(0);
  }, [stones, ready, first]);
  useEffect(() => {
    scene.current?.setSpeed(speed);
    try { localStorage.setItem('engrave-walk-speed', String(speed)); } catch { /* Walking still works without storage. */ }
  }, [speed, ready]);
  useEffect(() => {
    if (!editing) return;
    scene.current?.stop();
    const element = dialog.current; element?.showModal();
    return () => element?.close();
  }, [editing]);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !dock.current?.contains(event.target)) {
        scene.current?.stop(); setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [expanded]);

  function hold(event: PointerEvent<HTMLButtonElement>, direction: number) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    scene.current?.move(direction);
  }
  function step(direction: number) {
    if (fallback) {
      if (direction > 0 && index === stones.length - 1) { complete(); setIndex(0); }
      else setIndex(value => Math.max(0, Math.min(stones.length - 1, value + direction)));
    }
    else scene.current?.step(direction);
  }
  function listen(lang: 'zh' | 'nl') {
    if (!entry) return;
    if (lang === 'nl') { speakDutch(entry.dutch); return; }
    const parts = getChineseAudioTextParts(entry.chinese);
    const part = chinesePart.current.get(entry.id) ?? 0;
    if (speakChinese(parts[part % parts.length])) chinesePart.current.set(entry.id, part + 1);
  }
  function edit() {
    if (!entry) return;
    setError(''); setDutch(entry.dutch); setChinese(entry.chinese); setEditing(true);
  }
  async function toggleControlsHeight() {
    const next = !lowControls;
    setLowControls(next); setError('');
    try { await saveLowControls(next); }
    catch { setError(label('Could not save control height. Try again.', '无法保存控制栏高度，请重试。')); }
  }
  async function savePair(event: React.FormEvent) {
    event.preventDefault();
    if (!entry || !dutch.trim() || !chinese.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await updateVocabularyPair(fileId, entry.id, dutch.trim(), chinese.trim());
      setDeck(updated); setEditing(false);
    } catch { setError(label('Could not save. Try again.', '无法保存，请重试。')); }
    finally { setSaving(false); }
  }
  const stop = () => scene.current?.move(0);
  return <main className="world-page">
    <div className="world-scene" ref={host} />
    <header className="world-heading">
      <a href={routes.home}>Engrave Language</a>
      <h1>{deck?.file.title ?? t('flashcards')}</h1>
      <p role="status" aria-live="polite">{loading ? t('loadingFlashcards') : `${Math.min(index + 1, stones.length)} / ${stones.length} · ${stones[index]?.title ?? ''}`}</p>
    </header>
    {!!notice && <p key={notice} role="status" className="world-complete">{t('practiceComplete')}</p>}
    {(!loading && !stones.length) && <div className="world-notice">{deck ? t('noEntriesForFlashcards') : t('fileNotFound')} <a href={routes.home}>{label('Back to decks', '返回')}</a></div>}
    {fallback && entry && <section className="world-fallback"><p>{label('3D is unavailable on this device. You can still practice here.', '此设备无法显示3D，仍可在此学习。')}</p><h2>{stones[index]?.title}</h2></section>}
    {error && !editing && <p role="alert" className="world-notice">{error}</p>}
    {!!stones.length && <footer ref={dock} className={`world-dock${lowControls ? ' world-dock-low' : ''}`}>
      {expanded && <section className="world-options" id="world-options">
        <div className="world-controls world-secondary-controls">
<button data-control="previous" title={t('previous')} aria-label={t('previous')} disabled={fallback && index === 0} onClick={() => step(-1)}><Icon name="previous" /><small className="world-key-hint">a</small></button>
<button data-control="back" title={label('Hold to walk back', '按住后退')} aria-label={label('Hold to walk back', '按住后退')} disabled={fallback} onPointerDown={e => hold(e, -1)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onContextMenu={e => e.preventDefault()}><Icon name="back" /><small className="world-key-hint">s</small></button>
<button data-control="dutch" title={label('Dutch first', '荷兰语优先')} aria-label={label('Dutch first', '荷兰语优先')} aria-pressed={first === 'nl'} onClick={() => { setFirst('nl'); if (fallback) setIndex(0); }}>NL</button>
<button data-control="chinese" title={label('Chinese first', '中文优先')} aria-label={label('Chinese first', '中文优先')} aria-pressed={first === 'zh'} onClick={() => { setFirst('zh'); if (fallback) setIndex(0); }}>中</button>
        </div>
        <div className="world-option-actions">
          <button className="secondary-action" data-control="edit" onClick={edit}>{label('Edit', '编辑')}</button>
          <button className="secondary-action" data-control="height" onClick={toggleControlsHeight}>{lowControls ? label('High controls', '升高控制栏') : label('Low controls', '降低控制栏')}</button>
          <a className="secondary-action" data-control="exit" href={routes.home}>{label('Exit', '退出')}</a>
        </div>
        <label htmlFor="walk-speed">{label('Walking speed', '步行速度')} · {speed}×</label>
        <input id="walk-speed" type="range" min="0.25" max="3" step="0.25" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
      </section>}
      <nav className="world-controls world-primary-controls" aria-label={label('Practice controls', '学习控制')}>
<button data-control="listen-chinese" title={label('Listen Chinese', '听中文')} aria-label={label('Listen Chinese', '听中文')} onClick={() => listen('zh')}><Icon name="audio" /><small>中</small></button>
<button data-control="listen-dutch" title={label('Listen Dutch', '听荷兰语')} aria-label={label('Listen Dutch', '听荷兰语')} onClick={() => listen('nl')}><Icon name="audio" /><small>NL</small></button>
<button data-control="next" title={t('next')} aria-label={t('next')} onClick={() => step(1)}><Icon name="next" /><small className="world-key-hint">d</small></button>
<button data-control="forward" title={label('Hold to walk forward', '按住前进')} aria-label={label('Hold to walk forward', '按住前进')} disabled={fallback} onPointerDown={e => hold(e, 1)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onContextMenu={e => e.preventDefault()}><Icon name="forward" /><small className="world-key-hint">w</small></button>
<button data-control="expand" title={label('More controls', '更多控制')} aria-label={label('More controls', '更多控制')} aria-expanded={expanded} aria-controls="world-options" onClick={() => { scene.current?.stop(); setExpanded(!expanded); }}><Icon name="expand" /></button>
      </nav>
    </footer>}
    {editing && <dialog ref={dialog} className="world-editor" onCancel={e => { if (saving) e.preventDefault(); else setEditing(false); }}>
      <form onSubmit={savePair}>
        <h2>{label('Edit card', '编辑卡片')}</h2>
        <label>{t('dutch')}<textarea autoFocus required value={dutch} onChange={e => setDutch(e.target.value)} /></label>
        <label>{t('chinese')}<textarea required value={chinese} onChange={e => setChinese(e.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <div><button type="button" disabled={saving} onClick={() => setEditing(false)}>{label('Cancel', '取消')}</button><button type="submit" disabled={saving || !dutch.trim() || !chinese.trim()}>{saving ? '…' : label('Save', '保存')}</button></div>
      </form>
    </dialog>}
  </main>;
}
