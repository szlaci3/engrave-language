import { db } from './db';
import type {
  Folder,
  VocabularyEntry,
  VocabularyFile,
  VocabularyFileWithEntries,
} from '../features/files/types';

export type CreateVocabularyEntryInput = {
  dutch: string;
  chinese: string;
};

export type CreateVocabularyFileInput = {
  title: string;
  folderId?: string | null;
  entries: CreateVocabularyEntryInput[];
};

export type UpdateVocabularyFileInput = {
  title?: string;
  folderId?: string | null;
};

function createId() {
  return crypto.randomUUID();
}

function createTimestamp() {
  return new Date().toISOString();
}

function toVocabularyEntries(
  fileId: string,
  entries: CreateVocabularyEntryInput[],
): VocabularyEntry[] {
  return entries.map((entry, index) => ({
    id: createId(),
    fileId,
    dutch: entry.dutch,
    chinese: entry.chinese,
    order: index,
  }));
}

export async function openDatabase() {
  await db.open();
}

export async function createFolder(name: string): Promise<Folder> {
  const now = createTimestamp();
  const folder: Folder = {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
  };

  await db.folders.add(folder);

  return folder;
}

export async function listFolders(): Promise<Folder[]> {
  return db.folders.orderBy('createdAt').toArray();
}

export async function getFolder(folderId: string): Promise<Folder | null> {
  return (await db.folders.get(folderId)) ?? null;
}

export async function createVocabularyFile(
  input: CreateVocabularyFileInput,
): Promise<VocabularyFileWithEntries> {
  const now = createTimestamp();
  const file: VocabularyFile = {
    id: createId(),
    title: input.title,
    folderId: input.folderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const entries = toVocabularyEntries(file.id, input.entries);

  await db.transaction('rw', db.files, db.entries, async () => {
    await db.files.add(file);

    if (entries.length > 0) {
      await db.entries.bulkAdd(entries);
    }
  });

  return { file, entries };
}

export async function listVocabularyFiles(): Promise<VocabularyFile[]> {
  const files = await db.files.orderBy('createdAt').reverse().toArray();
  // Unordered (including newly created) decks stay at the top, newest first.
  return files.sort((a, b) => (a.sortOrder ?? -1) - (b.sortOrder ?? -1));
}

export async function saveVocabularyFileOrder(fileIds: string[]): Promise<void> {
  await db.transaction('rw', db.files, async () => {
    for (const [sortOrder, id] of fileIds.entries()) {
      await db.files.update(id, { sortOrder });
    }
  });
}

export async function listVocabularyFilesByFolder(
  folderId: string,
): Promise<VocabularyFile[]> {
  const files = await db.files.where('folderId').equals(folderId).toArray();

  return files.sort((firstFile, secondFile) =>
    secondFile.createdAt.localeCompare(firstFile.createdAt),
  );
}

export async function getVocabularyFile(
  fileId: string,
): Promise<VocabularyFileWithEntries | null> {
  const file = await db.files.get(fileId);

  if (!file) {
    return null;
  }

  const entries = await db.entries
    .where('fileId')
    .equals(fileId)
    .sortBy('order');

  return { file, entries };
}

export async function updateVocabularyFile(
  fileId: string,
  input: UpdateVocabularyFileInput,
): Promise<VocabularyFileWithEntries | null> {
  const now = createTimestamp();

  return db.transaction('rw', db.files, db.entries, async () => {
    const existingFile = await db.files.get(fileId);

    if (!existingFile) {
      return null;
    }

    const updatedFile: VocabularyFile = {
      ...existingFile,
      title: input.title ?? existingFile.title,
      folderId:
        input.folderId === undefined ? existingFile.folderId : input.folderId,
      updatedAt: now,
    };

    await db.files.put(updatedFile);

    const entries = await db.entries
      .where('fileId')
      .equals(fileId)
      .sortBy('order');

    return { file: updatedFile, entries };
  });
}

/** Update one pair without replacing IDs or changing the order of the deck. */
export async function updateVocabularyPair(fileId: string, entryId: string, dutch: string, chinese: string) {
  return db.transaction('rw', db.files, db.entries, async () => {
    const entry = await db.entries.get(entryId);
    if (!entry || entry.fileId !== fileId || !dutch.trim() || !chinese.trim()) throw new Error('Invalid card');
    await db.entries.update(entryId, { dutch, chinese });
    await db.files.update(fileId, { updatedAt: createTimestamp() });
    return getVocabularyFile(fileId);
  });
}
