export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type VocabularyFile = {
  id: string;
  title: string;
  sortOrder?: number;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VocabularyEntry = {
  id: string;
  fileId: string;
  dutch: string;
  chinese: string;
  order: number;
};

export type VocabularyFileWithEntries = {
  file: VocabularyFile;
  entries: VocabularyEntry[];
};
