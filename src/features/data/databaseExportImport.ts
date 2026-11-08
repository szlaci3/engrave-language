import { db } from '../../db/db';
import type { WooordDatabaseExport } from './types';
import type { Folder, VocabularyEntry, VocabularyFile } from '../files/types';
import type { AppSetting } from '../settings/types';

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function createBackupFilename(date = new Date()) {
  return `engrave-language-backup-${formatLocalDate(date)}.json`;
}

export async function exportWooordDatabase(): Promise<WooordDatabaseExport> {
  const [folders, files, entries, settings] = await Promise.all([
    db.folders.toArray(),
    db.files.toArray(),
    db.entries.toArray(),
    db.settings.toArray(),
  ]);

  return {
    app: 'wooord',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      folders,
      files,
      entries,
      settings,
    },
  };
}

export async function downloadWooordDatabaseExport() {
  const backup = await exportWooordDatabase();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = createBackupFilename();
  link.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFolder(value: unknown): value is Folder {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isVocabularyFile(value: unknown): value is VocabularyFile {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    (value.sortOrder === undefined ||
      (typeof value.sortOrder === 'number' &&
        Number.isSafeInteger(value.sortOrder) &&
        value.sortOrder >= 0)) &&
    (value.folderId === undefined ||
      value.folderId === null ||
      isString(value.folderId)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isVocabularyEntry(value: unknown): value is VocabularyEntry {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.fileId) &&
    isString(value.dutch) &&
    isString(value.chinese) &&
    typeof value.order === 'number'
  );
}

function isAppSetting(value: unknown): value is AppSetting {
  return (
    isRecord(value) &&
    isString(value.key) &&
    isString(value.value) &&
    isString(value.updatedAt)
  );
}

function assertUniqueIds(records: { id: string }[], label: string) {
  const ids = new Set<string>();

  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Backup file contains duplicate ${label} IDs.`);
    }

    ids.add(record.id);
  }
}

function assertUniqueKeys(records: { key: string }[], label: string) {
  const keys = new Set<string>();

  for (const record of records) {
    if (keys.has(record.key)) {
      throw new Error(`Backup file contains duplicate ${label} keys.`);
    }

    keys.add(record.key);
  }
}

export function validateWooordDatabaseExport(
  value: unknown,
): WooordDatabaseExport {
  if (!isRecord(value)) {
    throw new Error('Backup file must contain a JSON object.');
  }

  if (value.app !== 'wooord' || (value.version !== 1 && value.version !== 2)) {
    throw new Error('Backup file is not a compatible Engrave Language export.');
  }

  if (!isString(value.exportedAt) || !isRecord(value.data)) {
    throw new Error('Backup file is missing export metadata.');
  }

  const { folders, files, entries } = value.data;
  const settings = value.version === 2 ? value.data.settings : [];

  if (
    !Array.isArray(folders) ||
    !Array.isArray(files) ||
    !Array.isArray(entries) ||
    !Array.isArray(settings) ||
    !folders.every(isFolder) ||
    !files.every(isVocabularyFile) ||
    !entries.every(isVocabularyEntry) ||
    !settings.every(isAppSetting)
  ) {
    throw new Error('Backup file contains malformed Engrave Language data.');
  }

  assertUniqueIds(folders, 'folder');
  assertUniqueIds(files, 'file');
  assertUniqueIds(entries, 'entry');
  assertUniqueKeys(settings, 'setting');

  const folderIds = new Set(folders.map((folder) => folder.id));
  const fileIds = new Set(files.map((file) => file.id));

  for (const file of files) {
    if (file.folderId && !folderIds.has(file.folderId)) {
      throw new Error('Backup file contains a file with an unknown folder.');
    }
  }

  for (const entry of entries) {
    if (!fileIds.has(entry.fileId)) {
      throw new Error('Backup file contains an entry with an unknown file.');
    }
  }

  return {
    app: 'wooord',
    version: value.version,
    exportedAt: value.exportedAt,
    data: {
      folders,
      files,
      entries,
      settings,
    },
  };
}

export async function readWooordExportFile(file: File) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }

  return validateWooordDatabaseExport(parsed);
}

export async function replaceWooordDatabase(backup: WooordDatabaseExport) {
  await db.transaction('rw', db.folders, db.files, db.entries, db.settings, async () => {
    await db.entries.clear();
    await db.files.clear();
    await db.folders.clear();
    await db.settings.clear();

    if (backup.data.folders.length > 0) {
      await db.folders.bulkAdd(backup.data.folders);
    }

    if (backup.data.files.length > 0) {
      await db.files.bulkAdd(backup.data.files);
    }

    if (backup.data.entries.length > 0) {
      await db.entries.bulkAdd(backup.data.entries);
    }

    if (backup.data.settings.length > 0) {
      await db.settings.bulkAdd(backup.data.settings);
    }
  });
}

function createId() {
  return crypto.randomUUID();
}

function createUniqueId(existingIds: Set<string>) {
  let newId = createId();

  while (existingIds.has(newId)) {
    newId = createId();
  }

  existingIds.add(newId);
  return newId;
}

export async function mergeWooordDatabase(backup: WooordDatabaseExport) {
  await db.transaction('rw', db.folders, db.files, db.entries, async () => {
    const [existingFolders, existingFiles, existingEntries] =
      await Promise.all([
        db.folders.toArray(),
        db.files.toArray(),
        db.entries.toArray(),
      ]);

    const folderIds = new Set(existingFolders.map((folder) => folder.id));
    const fileIds = new Set(existingFiles.map((file) => file.id));
    const entryIds = new Set(existingEntries.map((entry) => entry.id));
    const folderIdMap = new Map<string, string>();
    const fileIdMap = new Map<string, string>();

    const folders = backup.data.folders.map((folder) => {
      const id = createUniqueId(folderIds);

      folderIdMap.set(folder.id, id);

      return { ...folder, id };
    });

    const files = backup.data.files.map((file) => {
      const id = createUniqueId(fileIds);

      fileIdMap.set(file.id, id);

      return {
        ...file,
        id,
        folderId: file.folderId ? folderIdMap.get(file.folderId) : null,
      };
    });

    const entries = backup.data.entries.map((entry) => ({
      ...entry,
      id: createUniqueId(entryIds),
      fileId: fileIdMap.get(entry.fileId) ?? entry.fileId,
    }));

    if (folders.length > 0) {
      await db.folders.bulkAdd(folders);
    }

    if (files.length > 0) {
      await db.files.bulkAdd(files);
    }

    if (entries.length > 0) {
      await db.entries.bulkAdd(entries);
    }
  });
}
