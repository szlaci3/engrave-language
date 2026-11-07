import Dexie, { type Table } from 'dexie';
import type {
  Folder,
  VocabularyEntry,
  VocabularyFile,
} from '../features/files/types';
import type { AppSetting } from '../features/settings/types';

export class WooordDatabase extends Dexie {
  folders!: Table<Folder, string>;
  files!: Table<VocabularyFile, string>;
  entries!: Table<VocabularyEntry, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('wooord-db');

    this.version(1).stores({
      folders: 'id, name, createdAt, updatedAt',
      files: 'id, title, folderId, createdAt, updatedAt',
      entries: 'id, fileId, order',
    });

    this.version(2).stores({
      folders: 'id, name, createdAt, updatedAt',
      files: 'id, title, folderId, createdAt, updatedAt',
      entries: 'id, fileId, order',
      settings: 'key',
    });
  }
}

export const db = new WooordDatabase();
