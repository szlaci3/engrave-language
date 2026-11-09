import { listVocabularyFiles } from '../../db/vocabularyRepository';
import type { RunStone } from '../world/createNaveScene';
import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';
import { db } from '../../db/db';
import { routes } from '../../app/routes';
import type { VocabularyEntry, VocabularyFile } from '../files/types';
import { getVoicePreferences } from '../settings/voicePreferences';
import { getChineseAudioTextParts, stopCurrentAudio } from '../files/audioService';
import { speakChinese, speakDutch } from '../files/speech';
import { WALK_SPEED } from '../world/navigation';
import { SPEED_RUN_VISIBLE_TRIOS, ANSWER_AUDIO_DELAY_SECONDS, SPEED_RUN_ANSWER_OFFSET, SPEED_RUN_PROMPT_MOVE, SPEED_RUN_TRIO_SPACING, makeQuestion, shuffled, type Direction, type Outcome, type Question } from './model';
import { recordResult } from './progress';
import './speedRun.css';

function audio(text: string, language: 'nl' | 'zh') {
  if (language === 'nl') speakDutch(text); else speakChinese(getChineseAudioTextParts(text)[0]);
}
function Stone({ text, className = '', onClick, label }: { text: string; className?: string; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; label?: string }) {
  return <button className={`run-stone ${className}`} onClick={onClick} disabled={!onClick} aria-label={label ?? text}><span>{text}</span></button>;
}
type Trio = { question: Question; chosen: 0 | 1 | null; outcome?: Outcome };
function TrioView({ trio, choose, feedback = false }: { trio: Trio; choose?: (side: 0 | 1, event: React.MouseEvent<HTMLButtonElement>) => void; feedback?: boolean }) {
  return <div className={`run-trio ${feedback ? 'run-feedback-trio' : ''}`} data-chosen={trio.chosen ?? ''}>
    <div className="run-prompt"><Stone text={trio.question.prompt} /></div>
    <div className="run-answers">{trio.question.answers.map((answer, side) => <Stone key={side} text={answer} label={`${side === 0 ? 'Upper answer' : 'Lower answer'}: ${answer}`} onClick={choose ? event => choose(side as 0 | 1, event) : undefined}
      className={trio.outcome ? side === trio.question.correctSide ? 'run-correct' : side === trio.chosen ? 'run-wrong' : '' : ''} />)}</div>
    {trio.outcome && <p className="run-feedback">{trio.outcome === 'correct' ? 'Correct' : trio.outcome === 'mistake' ? 'Incorrect — correct answer highlighted' : 'Unanswered — correct answer highlighted'}</p>}
  </div>;
}
function Run({ entries, direction, exit }: { entries: VocabularyEntry[]; direction: Direction; exit: () => void }) {
  const source = useRef(entries);
  useEffect(() => { source.current = entries; }, [entries]);
  const host = useRef<HTMLDivElement>(null);
  const approaching = useRef<HTMLDivElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const choose = useRef<(side: 0 | 1, x?: number, y?: number) => void>(() => {});
  const speedRef = useRef(1);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    let active = true;
    db.settings.get('speed-run-speed').then(saved => { const value = Number(saved?.value); if (active && value >= .1 && value <= 3) { const normalized = Math.round(value * 10) / 10; speedRef.current = normalized; setSpeed(normalized); } }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [trio, setTrio] = useState<Trio | null>(null);
  const [feedbackList, setFeedbackList] = useState<(Trio & { id: number; born: number; station: number })[]>([]);
  const [counts, setCounts] = useState({ correct: 0, mistake: 0, unanswered: 0 });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, frame = 0, last = 0, distance = 0, nextAt = SPEED_RUN_TRIO_SPACING, elapsed = 0;
    let pool: VocabularyEntry[] = [], cursor = 0, current: Question | null = null, answered = false, noticeUntil = 0, promptAt = 0, answerUntil = 0, serial = 0;
    let feedback: (Trio & { id: number; born: number; station: number })[] = [];
    let world: Awaited<ReturnType<typeof import('../world/createNaveScene')['createNaveScene']>> | undefined;
    let upcoming: { question: Question; startsLap: boolean } | null = null;
    const takeQuestion = () => {
      let startsLap = false;
      if (cursor >= pool.length) {
        startsLap = pool.length > 0;
        pool = shuffled(source.current); cursor = 0;
      }
      while (cursor < pool.length) {
        const queued = pool[cursor++];
        const latest = source.current.find(entry => entry.id === queued.id);
        const question = latest ? makeQuestion(latest, source.current, direction) : null;
        if (question) return { question, startsLap };
      }
      return null;
    };
    const next = () => {
      const item = upcoming ?? takeQuestion();
      current = item?.question ?? null;
      if (!current) { setError('Choose decks with at least two different prompts and answers.'); return; }
      if (item?.startsLap) { setNotice('Endline - Starting again'); noticeUntil = elapsed + 3; }
      upcoming = takeQuestion();
      answered = false;
      setTrio({ question: current, chosen: null });
      promptAt = Math.max(elapsed, answerUntil);
    };
    const answer = (side: 0 | 1 | null) => {
      if (!current || answered) return;
      answered = true;
      const outcome: Outcome = side === null ? 'unanswered' : side === current.correctSide ? 'correct' : 'mistake';
      setCounts(value => ({ ...value, [outcome]: value[outcome] + 1 }));
      void recordResult(current.entry.id, direction, outcome).catch(() => { if (active) setError('Could not save progress. Please check device storage.'); });
      const snapshot = { id: serial++, question: current, chosen: side, outcome, born: elapsed, station: nextAt };
      feedback.push(snapshot);
      setFeedbackList([...feedback]);
      setTrio(null);
      stopCurrentAudio();
      const mode = getVoicePreferences().audioAutoplay;
      if (mode === 'back' || mode === 'both') { audio(current.answers[current.correctSide], direction === 'zh-nl' ? 'nl' : 'zh'); answerUntil = elapsed + ANSWER_AUDIO_DELAY_SECONDS; }
      nextAt += SPEED_RUN_TRIO_SPACING;
      next();
    };
    choose.current = (side, x, y) => {
      if (!world?.isRunStoneWritten(serial * 3)) return;
      if (x !== undefined && y !== undefined && world?.pickRunStone(x, y) !== serial * 3 + side + 1) return;
      answer(side);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable]'))) return;
      const key = event.key.toLowerCase();
      if (['a', 'd', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); choose.current(key === 'a' || key === 'arrowleft' ? 0 : 1); }
    };
    const tick = (time: number) => {
      if (!active) return;
      const delta = last && !document.hidden ? Math.max(0, Math.min((time - last) / 1000, .1)) : 0; last = time;
      elapsed += delta; distance += delta * WALK_SPEED * speedRef.current;
      const stones: RunStone[] = [];
      const addTrio = (question: Question, id: number, station: number, age = -1, chosen: 0 | 1 | null = null) => {
        const movement = chosen === null ? 0 : (chosen === 0 ? 1 : -1) * SPEED_RUN_PROMPT_MOVE * Math.min(1, age / .3);
        stones.push({ id, title: question.prompt, language: direction === 'zh-nl' ? 'zh' : 'nl', x: 0, y: 4 + movement, station, opacity: 1 });
        question.answers.forEach((title, side) => stones.push({ id: id + side + 1, title, language: direction === 'zh-nl' ? 'nl' : 'zh', x: 0, y: 4 + (side === 0 ? SPEED_RUN_ANSWER_OFFSET : -SPEED_RUN_ANSWER_OFFSET), station, opacity: 1, shatter: age >= 0 && chosen === null && side !== question.correctSide, tint: age < 0 ? undefined : side === question.correctSide ? '#82d793' : side === chosen ? '#ed8b80' : undefined }));
      };
      if (current) addTrio(current, serial * 3, nextAt);
      if (SPEED_RUN_VISIBLE_TRIOS > 1 && upcoming) addTrio(upcoming.question, (serial + 1) * 3, nextAt + SPEED_RUN_TRIO_SPACING);
      for (const item of feedback) addTrio(item.question, item.id * 3, item.station, elapsed - item.born, item.chosen);
      const rectangles = world?.tour(distance, stones, elapsed) ?? [];
      const buttons = approaching.current?.querySelectorAll<HTMLButtonElement>('button');
      rectangles.filter(rect => rect.id >= serial * 3 && rect.id < (serial + 1) * 3).forEach((rect, i) => {
        const button = buttons?.[i];
        if (button) button.hidden = !rect.written;
        if (button) Object.assign(button.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      });
      if (host.current) host.current.dataset.position = distance.toFixed(3);

      if (current && !answered && elapsed >= promptAt && world?.isRunStoneWritten(serial * 3)) {
        promptAt = Infinity;
        const mode = getVoicePreferences().audioAutoplay;
        if (mode === 'front' || mode === 'both') audio(current.prompt, direction === 'zh-nl' ? 'zh' : 'nl');
      }
      if (feedback.some(item => distance > item.station + 20)) {
        feedback = feedback.filter(item => distance <= item.station + 20);
        setFeedbackList([...feedback]);
      }
      if (noticeUntil && elapsed > noticeUntil) { setNotice(''); noticeUntil = 0; }
      if (distance >= nextAt && !answered) answer(null);
      frame = requestAnimationFrame(tick);
    };
    import('../world/createNaveScene').then(({ createNaveScene }) => {
      if (!active || !host.current) return;
      try { world = createNaveScene(host.current, () => {}, () => setError('3D rendering is unavailable. Return to decks and reload to try again.'), () => {}, true); }
      catch { setError('3D rendering is unavailable. Return to decks and reload to try again.'); }
      next(); frame = requestAnimationFrame(tick);
    });
    window.addEventListener('keydown', keyboard);
    return () => { active = false; cancelAnimationFrame(frame); window.removeEventListener('keydown', keyboard); world?.dispose(); stopCurrentAudio(); };
  }, [direction]);
  return <main className="speed-world">
    <div className="run-scene" ref={host} />
    <header className="run-heading"><button onClick={exit}>← Decks</button><h1>Speed Run</h1><p role="status">Correct {counts.correct} · Mistakes {counts.mistake} · Unanswered {counts.unanswered}</p><p className="run-endline">{notice}</p>{error && <p role="alert">{error}</p>}</header>
    <div className={`run-stage${feedbackList.length ? ' run-stage-with-feedback' : ''}`} ref={approaching}>{trio && <TrioView trio={trio} choose={(side, event) => choose.current(side, event.detail === 0 ? undefined : event.clientX, event.detail === 0 ? undefined : event.clientY)} />}</div>
    <div ref={history}>{feedbackList.map(item => <div className="run-feedback-history" key={item.id} data-born={item.born} ><TrioView trio={item} feedback /></div>)}</div>
    <footer className="run-toolbar"><label><span className="run-speed-text">Speed {speed.toFixed(1)}×</span><input aria-label="Speed" type="range" min="0.1" max="3" step="0.1" value={speed} onChange={event => { const value = Number(event.target.value); setSpeed(value); speedRef.current = value; void db.settings.put({ key: 'speed-run-speed', value: String(value), updatedAt: new Date().toISOString() }).catch(() => setError('Could not save speed.')); }} /></label><span className="run-key-hints">A / ← Upper · D / → Lower</span></footer>
  </main>;
}
export function SpeedRunPage() {
  const [files, setFiles] = useState<VocabularyFile[]>([]);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [direction, setDirection] = useState<Direction>('zh-nl');
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const subscription = liveQuery(() => Promise.all([listVocabularyFiles(), db.entries.toArray()])).subscribe({ next: ([decks, cards]) => { setFiles(decks); setEntries(cards); }, error: () => setError('Could not load decks.') });
    let active = true;
    db.settings.get('speed-run-selection').then(value => { if (!active) return; if (value) { try { const saved = JSON.parse(value.value); if (Array.isArray(saved.ids)) setSelected(saved.ids.filter((id: unknown) => typeof id === 'string')); if (saved.direction === 'nl-zh') setDirection('nl-zh'); } catch { /* Use defaults for invalid saved preferences. */ } } setLoaded(true); }).catch(() => { if (active) { setError('Could not load saved selection.'); setLoaded(true); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const pool = entries.filter(entry => selected.includes(entry.fileId) && entry.dutch.trim() && entry.chinese.trim());
  const canPlay = pool.some(entry => makeQuestion(entry, pool, direction) !== null);
  async function play() {
    try { await db.settings.put({ key: 'speed-run-selection', value: JSON.stringify({ ids: selected, direction }), updatedAt: new Date().toISOString() }); setPlaying(true); }
    catch { setError('Could not save your selection. Please try again.'); }
  }
  if (playing) return <Run entries={pool} direction={direction} exit={() => setPlaying(false)} />;
  return <main className="app-shell"><header className="page-header"><a href={routes.home}>Engrave Language</a><h1>Speed Run</h1></header>
    <div className="run-selection-actions"><button className="secondary-action" onClick={() => setSelected(selected.length === files.length ? [] : files.map(file => file.id))}>{files.length > 0 && selected.length === files.length ? 'Deselect all' : 'Select all'}</button><button className="primary-action" disabled={!loaded || !canPlay} onClick={() => void play()}>Play</button></div>
    <label className="settings-field">Prompt → Answer<select className="select-input" value={direction} onChange={event => setDirection(event.target.value as Direction)}><option value="zh-nl">Chinese → Dutch</option><option value="nl-zh">Dutch → Chinese</option></select></label>
    <p>Tap decks to select them. Keep moving, aim for fewer mistakes, and repeat for as long as you like.</p>
    {error && <p role="alert">{error}</p>}
    {!files.length && loaded && <p>Create a deck to get started.</p>}
    <div className="run-decks">{files.map(file => <button className="run-deck" key={file.id} aria-pressed={selected.includes(file.id)} onClick={() => setSelected(ids => ids.includes(file.id) ? ids.filter(id => id !== file.id) : [...ids, file.id])}><strong>{file.title}</strong><small>{entries.filter(entry => entry.fileId === file.id).length} cards</small></button>)}</div>
    {selected.length > 0 && !canPlay && <p>Select material with at least two different prompts and answers.</p>}
  </main>;
}
