# ARCHITECTURE.md

## Overview

**wooord** is a mobile-first React + TypeScript browser app for storing Dutch-Chinese vocabulary files locally.

The app has no backend.

All user data is stored in the browser using IndexedDB through Dexie.

The app should be deployable as a static site.

Primary responsibilities:

* parse pasted Dutch-Chinese vocabulary text
* store vocabulary files locally
* organize files into folders
* display saved files
* play Dutch expressions and Chinese translations aloud
* persist browser voice preferences locally
* export/import/merge the local Dexie database

---

## Technology Stack

Use:

* React
* TypeScript
* Vite
* Dexie
* IndexedDB
* Web Speech API
* plain CSS

Do not use:

* backend server
* authentication
* Tailwind
* UI component libraries
* external state libraries unless clearly needed

The app is small enough to start with React local state plus repository functions.

---

## Routing

The app should use client-side routing.

Current implementation:

* `src/app/routes.ts` defines the initial route constants.
* `src/app/App.tsx` uses a lightweight path resolver for the first app shell.
* `/`, `/files/new`, `/files/:fileId`, `/folders/:folderId`, `/data`, and `/settings` render inspectable shell or feature views.
* `src/features/files/FileListPage.tsx` owns the landing page file and folder lists.
* `src/features/files/FileViewPage.tsx` owns the opened file view and listenable Chinese entries.
* `src/features/folders/FolderFilesPage.tsx` owns folder-specific file lists.
* `src/features/settings/SettingsPage.tsx` owns voice selection.

A dedicated router library can be added later if route complexity justifies it.

Suggested routes:

```txt id="yawx2u"
/
```

Landing page with folders and files.

```txt id="9pj57d"
/files/new
```

Create a new vocabulary file from pasted text.

```txt id="sk3yjr"
/files/:fileId
```

View an existing file.

```txt id="ev5pwe"
/files/:fileId/edit
```

Edit an existing file.

This can also be implemented as edit mode inside the file view page if simpler.

```txt id="m2ke00"
/data
```

Data page for Dexie export/import/merge.

```txt
/settings
```

Settings page for browser Web Speech voice preferences.

```txt id="pisvjv"
/folders/:folderId
```

Optional folder-specific file list.

This can be delayed if the landing page already supports folder display.

---

## Static Hosting Redirects

The app should support browser refresh and direct route access.

Add:

```txt id="ib180s"
public/_redirects
```

With content:

```txt id="v85ulp"
/* /index.html 200
```

This allows routes such as `/files/:fileId` to work on Netlify-style static hosting.

---

## Suggested Source Structure

```txt id="7gvgnj"
src/
  app/
    App.tsx
    routes.tsx

  components/
    IconButton.tsx
    PageHeader.tsx
    EmptyState.tsx

  db/
    db.ts
    vocabularyRepository.ts
    databaseBackup.ts

  features/
    data/
      DataPage.tsx
      databaseExportImport.ts
      types.ts

    files/
      FileListPage.tsx
      FileViewPage.tsx
      NewFilePage.tsx
      EditFilePage.tsx
      parseVocabulary.ts
      speech.ts
      types.ts

    folders/
      FolderList.tsx
      FolderCreateForm.tsx
      folderTypes.ts

  styles/
    theme.css
    global.css

  main.tsx
```

Keep this structure flexible.

If a simpler structure is cleaner during the first milestone, prefer simplicity.

---

## Domain Model

### Folder

```ts id="jldmze"
export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

### Vocabulary File

```ts id="xhppke"
export type VocabularyFile = {
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### Vocabulary Entry

```ts id="jyo1fx"
export type VocabularyEntry = {
  id: string;
  fileId: string;
  dutch: string;
  chinese: string;
  order: number;
};
```

---

## Dexie Database

Create one Dexie database for the app.

Current implementation:

* `src/db/db.ts` exports `WooordDatabase` and the shared `db` instance.
* The database name is `wooord-db`.
* Version 1 contains `folders`, `files`, and `entries`.

Suggested database name:

```txt id="a82w6y"
wooord-db
```

Suggested tables:

```ts id="h1bkef"
folders: 'id, name, createdAt, updatedAt'
files: 'id, title, folderId, createdAt, updatedAt'
entries: 'id, fileId, order'
```

`entries.fileId` should be indexed because entries are usually loaded by file.

`files.folderId` should be indexed because files can be listed by folder.

Example:

```ts id="8eftaw"
import Dexie, { type Table } from 'dexie';

export class WooordDatabase extends Dexie {
  folders!: Table<Folder, string>;
  files!: Table<VocabularyFile, string>;
  entries!: Table<VocabularyEntry, string>;

  constructor() {
    super('wooord-db');

    this.version(1).stores({
      folders: 'id, name, createdAt, updatedAt',
      files: 'id, title, folderId, createdAt, updatedAt',
      entries: 'id, fileId, order',
    });
  }
}

export const db = new WooordDatabase();
```

---

## Repository Layer

Use repository functions to isolate Dexie access from React components.

Current implementation:

* `src/db/vocabularyRepository.ts` creates folders and vocabulary files.
* The repository lists folders and files, reads one file with ordered entries, and updates file metadata or entries inside Dexie transactions where needed.
* Shared domain types live in `src/features/files/types.ts`.

Recommended file:

```txt id="bk3jvl"
src/db/vocabularyRepository.ts
```

Responsibilities:

* create folder
* list folders
* create file with entries
* list files
* list files by folder
* get file with entries
* update file
* delete file if implemented
* move file to folder

Example function names:

```ts id="ykrb0w"
createVocabularyFile(input)
getVocabularyFile(fileId)
listVocabularyFiles()
updateVocabularyFile(fileId, input)
createFolder(name)
listFolders()
moveFileToFolder(fileId, folderId)
```

Keep database code out of UI components where possible.

---

## Creating a File

Input:

```txt id="rfbdhv"
raw pasted vocabulary text
```

Process:

1. parse text into entries
2. reject if no valid entries are found
3. use first Dutch word as title base
4. append current date
5. create file record
6. create entry records
7. save all in one Dexie transaction
8. navigate to file view

Title format:

```txt id="00fcaf"
[first Dutch word] — YYYY-MM-DD
```

Example:

```txt id="6y64ki"
natuurlijk — 2026-07-05
```

Use local date for the title.

Current implementation:

* `src/features/files/NewFilePage.tsx` renders the paste form and icon-only save action.
* The page parses pasted text, rejects empty or invalid input, generates `[first Dutch word] — YYYY-MM-DD`, saves through `createVocabularyFile`, and navigates to `/files/:fileId`.

---

## Vocabulary Parser

Recommended location:

```txt id="f6l3tp"
src/features/files/parseVocabulary.ts
```

Parsing rule:

Each non-empty line contains a Dutch expression followed by a Chinese translation.

The separator may be:

* multiple spaces
* tabs
* no visible space

The parser should detect the first Chinese character.

Everything before that is Dutch.

Everything from that point onward is Chinese.

Example:

```txt id="7hnwa1"
bestel订购
```

Should become:

```ts id="voletb"
{
  dutch: 'bestel',
  chinese: '订购'
}
```

Suggested Chinese character detection:

```ts id="baj1sq"
const chineseStartPattern = /[\u3400-\u9FFF]/u;
```

This covers common CJK unified ideographs.

Parser behavior:

* trim each line
* ignore empty lines
* ignore invalid lines without Chinese characters
* trim Dutch and Chinese values
* preserve original order

Return a structured result:

```ts id="r6t9w0"
type ParsedVocabularyEntry = {
  dutch: string;
  chinese: string;
};

type ParseVocabularyResult = {
  entries: ParsedVocabularyEntry[];
  skippedLines: string[];
};
```

This lets the UI later show useful warnings if needed.

---

## File View

The file view page loads:

* file metadata
* ordered entries

Display each row with:

* Dutch expression
* Chinese translation
* audio icon

The Chinese expression and/or audio icon should be tappable.

Tapping should play the Chinese expression.

The top area should contain a small icon-only edit button.

Do not show large bottom edit/save buttons.

View mode top action:

```txt id="6vfe4j"
edit icon
```

Edit mode top action:

```txt id="kqor80"
save icon
```

The same top-right position can change behavior depending on mode.

---

## Speech / Audio

Recommended location:

```txt id="j90kpv"
src/features/files/speech.ts
```

Use the Web Speech API.

Current behavior:

```ts id="6g9tih"
speakDutch(text)
speakChinese(text)
```

Do not make audio failure fatal.

The app should remain usable even if speech synthesis is unavailable.

Voice preferences are stored in `localStorage` by `src/features/settings/voicePreferences.ts`.

Voice selection logic lives in `src/features/settings/voiceSelection.ts`:

* Chinese fallback order: `zh-CN`, `zh-TW`, `zh-HK`, then any `zh-*` voice
* Dutch fallback order: `nl-BE`, `nl-NL`, then any `nl-*` voice
* if a previously selected voice is unavailable, playback falls back to the best available language match

Current implementation:

* `src/features/files/speech.ts` exports `speakChinese` and `speakDutch`.
* `src/features/files/FileViewPage.tsx` calls these helpers from Dutch and Chinese text/audio buttons.
* The opened file view shows a small top edit icon; edit behavior is implemented in the edit milestone.

---

## Settings Page

Recommended route:

```txt
/settings
```

The Settings page lets the user choose installed browser voices for:

* Dutch playback
* Chinese playback

Current implementation:

* `src/features/settings/SettingsPage.tsx` loads voices from `window.speechSynthesis.getVoices()`.
* `voiceschanged` refreshes the voice list when browsers load voices asynchronously.
* selected `voiceURI` values are persisted in `localStorage`.
* options display voice name and language code.

---

## Edit File Flow

The simplest first implementation:

1. open existing file
2. reconstruct raw text from entries
3. allow editing in a textarea
4. re-parse on save
5. replace entries for that file
6. update file title if the user edits title
7. update `updatedAt`

This is simpler than building a row-by-row editor.

A row editor can be added later.

When saving edited entries, use a Dexie transaction:

* update file
* delete old entries for that file
* insert new entries

Current implementation:

* `src/features/files/FileViewPage.tsx` contains the first edit mode.
* View mode shows a top edit icon; edit mode swaps it for a top save icon.
* Edit mode allows title editing and raw vocabulary text editing, then reparses and saves through `updateVocabularyFile`.

---

## Folders

Folders are a lightweight organization layer.

A file may have:

```ts id="9flm23"
folderId: string | null
```

A folder can contain many files.

A file belongs to zero or one folder.

First version can support:

* create folder
* list folders
* assign file to folder
* list files in folder

Avoid nested folders in the first version.

Current implementation:

* `src/features/files/FileListPage.tsx` creates folders and links to folder pages.
* `src/features/folders/FolderFilesPage.tsx` shows files assigned to one folder.
* `src/features/files/FileViewPage.tsx` includes folder assignment in edit mode.
* `src/db/vocabularyRepository.ts` exposes folder lookup and folder-filtered file listing.

---

## Data Page

Recommended route:

```txt id="tm3whs"
/data
```

Recommended location:

```txt id="du6h5e"
src/features/data/DataPage.tsx
```

The Data page contains three main actions:

```txt id="1cncme"
Export database
Import database, replace current data
Add existing database, preserve current data
```

Unlike edit/save actions, these should be text buttons because the meaning is important and data-sensitive.

The Data page should be reachable from the landing page or top navigation.

Current implementation:

* `src/features/data/DataPage.tsx` owns the `/data` route.
* Milestone 9 implements the `Export database` action.
* Import and merge actions are implemented in later Data milestones.

---

## Export Format

Recommended type:

```ts id="1gxe0o"
export type WooordDatabaseExport = {
  app: 'wooord';
  version: 1;
  exportedAt: string;
  data: {
    folders: Folder[];
    files: VocabularyFile[];
    entries: VocabularyEntry[];
  };
};
```

Export filename:

```txt id="kymdy7"
wooord-backup-YYYY-MM-DD.json
```

Export should:

1. read all folders
2. read all files
3. read all entries
4. build export object
5. create JSON blob
6. trigger browser download

This should not require a backend.

Current implementation:

* `src/features/data/databaseExportImport.ts` builds and downloads the JSON export.
* `src/features/data/types.ts` defines `WooordDatabaseExport`.
* Export reads `folders`, `files`, and `entries` from Dexie and downloads `wooord-backup-YYYY-MM-DD.json`.

---

## Import: Replace Current Data

This imports a compatible JSON export and replaces current local data.

Flow:

1. user chooses JSON file
2. app reads file text
3. app parses JSON
4. app validates export shape
5. app asks for confirmation
6. app clears current app-owned tables
7. app inserts imported folders, files, entries
8. app refreshes UI

Validation must happen before deleting current data.

If validation fails, current data must remain unchanged.

Use Dexie transaction where practical.

Clear tables in this order:

```txt id="6dqzfq"
entries
files
folders
```

Then import in this order:

```txt id="bn5dlh"
folders
files
entries
```

Current implementation:

* `src/features/data/databaseExportImport.ts` validates compatible exports before replacement.
* `replaceWooordDatabase` clears and imports `entries`, `files`, and `folders` inside one Dexie transaction.
* `src/features/data/DataPage.tsx` asks for confirmation with the required replacement warning before calling the replace import.

---

## Import: Add Existing Database / Merge

This imports a compatible JSON export while preserving current data.

Flow:

1. user chooses JSON file
2. app reads file text
3. app parses JSON
4. app validates export shape
5. app prepares ID remapping
6. app inserts imported data
7. app refreshes UI

This action must not delete current local data.

If IDs conflict, create new IDs for imported records and remap relationships.

Suggested merge behavior:

* always generate new IDs for imported folders
* always generate new IDs for imported files
* always generate new IDs for imported entries
* preserve names, titles, dates, and order
* remap `file.folderId`
* remap `entry.fileId`

This is simple and avoids accidental overwrites.

Example:

```txt id="5s0czt"
old imported file id: file-a
new local file id: file-x
entries pointing to file-a now point to file-x
```

This can create duplicate file titles, which is acceptable in the first version.

Later, the app can add duplicate-title warnings or automatic suffixes.

---

## Import Validation

Recommended location:

```txt id="6krhkw"
src/features/data/databaseExportImport.ts
```

Validate:

* root object exists
* `app` equals `'wooord'`
* supported `version`
* `data.folders` is an array
* `data.files` is an array
* `data.entries` is an array
* each file has required fields
* each entry has required fields
* each entry points to a file present in the imported data
* folder references are either null/undefined or point to a folder present in the imported data

Validation should be strict enough to avoid corrupting the local database.

Do not treat arbitrary JSON as valid app data.

---

## Styling Architecture

Use plain CSS.

Place palette variables in:

```txt id="cc8cgn"
src/styles/theme.css
```

Place global styling in:

```txt id="ezyzmf"
src/styles/global.css
```

Import order in `main.tsx`:

```ts id="u286lc"
import './styles/theme.css';
import './styles/global.css';
```

Component-specific CSS may live next to components or in feature folders.

Recommended:

```txt id="90zkf1"
FileViewPage.css
NewFilePage.css
DataPage.css
```

Do not redefine the Deep Study Blue palette inside component CSS.

Use CSS variables.

---

## Deep Study Blue Theme

```css id="wb5epk"
:root {
  --color-bg: #07111f;
  --color-surface: #0f1f33;
  --color-surface-soft: #173451;

  --color-primary: #38bdf8;
  --color-primary-dark: #0284c7;
  --color-primary-soft: #082f49;

  --color-text: #f8fafc;
  --color-text-muted: #cbd5e1;

  --color-border: #2b5f87;
  --color-focus: #7dd3fc;

  --color-danger: #fb7185;
  --color-success: #4ade80;
}
```

---

## Mobile Layout Principles

The app is primarily for mobile browser use.

Use:

* large font sizes
* generous tap targets
* simple stacked layouts
* readable contrast
* cards or panels for grouped content
* top actions instead of large bottom buttons

Avoid:

* dense tables
* hover-only behavior
* tiny icons
* desktop-first layouts
* unnecessary sidebars

Recommended body styling:

```css id="eorjtn"
body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

---

## Error Handling

Show readable messages for:

* no valid vocabulary lines found
* database save failure
* file not found
* import validation failure
* failed import
* failed export

Do not crash the app for speech synthesis failure.

For destructive data operations, use confirmation before action.

---

## First Implementation Milestones

### Milestone 1: Usable Core

Build:

* Vite React TypeScript setup
* Dexie database
* Deep Study Blue styling
* landing page
* new file page
* vocabulary parser
* save file
* list files
* open file
* Chinese speech playback
* small top edit icon
* static `_redirects`

### Milestone 2: Editing and Folders

Build:

* edit mode or edit page
* save edited file
* create folders
* assign files to folders
* list files by folder

### Milestone 3: Data Page

Build:

* `/data` route
* export database JSON
* import database and replace current data
* import database and preserve current data
* validation and confirmation flows

### Milestone 4: Polish

Improve:

* empty states
* active listening state
* import/export feedback
* accessibility labels
* mobile spacing
* duplicate title handling
* lightweight design polish

---

## Accessibility Notes

Icon-only buttons must have accessible labels.

Example:

```tsx id="a9p57v"
<button aria-label="Edit file">
  <EditIcon />
</button>
```

For view/edit toggle:

```tsx id="en790e"
<button aria-label={isEditing ? 'Save file' : 'Edit file'}>
  {isEditing ? <SaveIcon /> : <EditIcon />}
</button>
```

Audio buttons should also have labels:

```tsx id="3v1smq"
<button aria-label={`Play Chinese translation: ${entry.chinese}`}>
  <SpeakerIcon />
</button>
```

Keep visible text large, but do not rely only on visual icons for screen readers.

---

## Non-Goals for Now

Do not implement:

* user accounts
* cloud sync
* backend API
* spaced repetition scheduling
* flashcard testing mode
* nested folders
* sharing between users
* AI translation
* OCR
* pronunciation scoring

These can be considered later, but they are outside the first architecture.
