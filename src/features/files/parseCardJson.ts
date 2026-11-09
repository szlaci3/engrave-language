import type { ParsedVocabularyEntry } from './parseVocabulary';

// Import only card text: scheduling, categories, IDs and additional sides are ignored.
export function parseCardJson(rawText: string): ParsedVocabularyEntry[] {
  let cards: unknown;
  try { cards = JSON.parse(rawText.replace(/^\uFEFF/u, '')); }
  catch { throw new Error('Invalid JSON. Check the JSON syntax and try again.'); }
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('Expected a non-empty JSON array of cards.');
  }
  return cards.map((card: unknown, index) => {
    const sides = card && typeof card === 'object' && 'sides' in card ? card.sides : undefined;
    if (!Array.isArray(sides) || sides.length < 2 || typeof sides[0] !== 'string' || typeof sides[1] !== 'string') {
      throw new Error(`Card ${index + 1} must have at least two text sides: English, then Dutch.`);
    }
    const clean = (text: string) => text.replace(/\s+/gu, ' ').trim();
    const chinese = clean(sides[0]);
    const dutch = clean(sides[1]);
    if (!chinese && !dutch) throw new Error(`Card ${index + 1} has two empty sides.`);
    return { dutch, chinese };
  });
}
