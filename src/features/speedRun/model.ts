import type { VocabularyEntry } from '../files/types';

export const SPEED_RUN_NEAR_DISTANCE_MULTIPLIER = 1;
export const SPEED_RUN_DROP_DISTANCE_MULTIPLIER = 0.7;
export const SPEED_RUN_VISIBLE_TRIOS = 2;
export const SPEED_RUN_TRIO_SPACING = 9;
export const ANSWER_AUDIO_DELAY_SECONDS = 2;
export const SPEED_RUN_ANSWER_OFFSET = 2.325;
// 1.65-unit stone height leaves a 0.25-unit gap after the prompt moves.
export const SPEED_RUN_PROMPT_MOVE = 0.425;
export type Direction = 'zh-nl' | 'nl-zh';
export type Outcome = 'correct' | 'mistake' | 'unanswered';
export type Progress = { id: string; entryId: string; direction: Direction; correct: number; mistakes: number; unanswered: number; lastPracticed: string };
export type Question = { entry: VocabularyEntry; prompt: string; answers: [string, string]; correctSide: 0 | 1 };
export const front = (entry: VocabularyEntry, direction: Direction) => direction === 'zh-nl' ? entry.chinese : entry.dutch;
export const back = (entry: VocabularyEntry, direction: Direction) => direction === 'zh-nl' ? entry.dutch : entry.chinese;
const normalized = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
export function makeQuestion(entry: VocabularyEntry, pool: VocabularyEntry[], direction: Direction): Question | null {
  const candidates = pool.filter(other => other.id !== entry.id && normalized(back(other, direction)) !== normalized(back(entry, direction)) && normalized(front(other, direction)) !== normalized(front(entry, direction)));
  if (!candidates.length) return null;
  const length = Array.from(entry.dutch).length;
  const distance = (other: VocabularyEntry) => Math.abs(Array.from(other.dutch).length - length);
  const closest = Math.min(...candidates.map(distance));
  const matches = candidates.filter(other => distance(other) === closest);
  const other = matches[Math.floor(Math.random() * matches.length)];
  const correctSide = Math.random() < .5 ? 0 : 1;
  const answers: [string, string] = [back(entry, direction), back(other, direction)];
  if (correctSide === 1) answers.reverse();
  return { entry, prompt: front(entry, direction), answers, correctSide };
}
export function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
