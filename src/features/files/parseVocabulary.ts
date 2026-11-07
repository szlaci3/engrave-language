export type ParsedVocabularyEntry = {
  dutch: string;
  chinese: string;
};

export type ParseVocabularyResult = {
  entries: ParsedVocabularyEntry[];
  skippedLines: string[];
};

const chineseStartPattern = /[\u3400-\u9FFF]/u;

export function parseVocabulary(rawText: string): ParseVocabularyResult {
  const entries: ParsedVocabularyEntry[] = [];
  const skippedLines: string[] = [];

  for (const rawLine of rawText.split(/\r?\n/u)) {
    const line = rawLine.replace(/(?:—|&mdash;?)/gu, '').trim();

    if (!line) {
      continue;
    }

    const chineseStart = line.search(chineseStartPattern);

    if (chineseStart === -1) {
      skippedLines.push(line);
      continue;
    }

    const dutch = line.slice(0, chineseStart).trim();
    const chinese = line.slice(chineseStart).trim();

    if (!dutch || !chinese) {
      skippedLines.push(line);
      continue;
    }

    entries.push({ dutch, chinese });
  }

  return { entries, skippedLines };
}
