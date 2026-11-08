import { db } from '../../db/db';
import type { Direction, Outcome } from './model';
export async function recordResult(entryId: string, direction: Direction, outcome: Outcome) {
  await db.transaction('rw', db.progress, db.entries, async () => {
    if (!await db.entries.get(entryId)) return;
    const id = `${entryId}:${direction}`;
    const record = await db.progress.get(id) ?? { id, entryId, direction, correct: 0, mistakes: 0, unanswered: 0, lastPracticed: '' };
    if (outcome === 'correct') record.correct++;
    else if (outcome === 'mistake') record.mistakes++;
    else record.unanswered++;
    record.lastPracticed = new Date().toISOString();
    await db.progress.put(record);
  });
}
