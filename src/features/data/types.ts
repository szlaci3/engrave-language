import type { Progress } from '../speedRun/model';
import type {
  Folder,
  VocabularyEntry,
  VocabularyFile,
} from '../files/types';
import type { AppSetting } from '../settings/types';

export type WooordDatabaseExport = {
  app: 'wooord';
  version: 1 | 2 | 3;
  exportedAt: string;
  data: {
    folders: Folder[];
    files: VocabularyFile[];
    entries: VocabularyEntry[];
    settings: AppSetting[];
    progress?: Progress[];
  };
};
