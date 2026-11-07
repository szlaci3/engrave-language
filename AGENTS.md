# AGENTS.md

## Project

**wooord** is a mobile-first browser app for storing pasted Dutch vocabulary lists with Chinese translations.

The app is built with:

* React
* TypeScript
* Vite
* Dexie / IndexedDB
* Plain CSS

The app is intended to run well in a mobile browser and should be deployable as a static site.

The app name is written exactly as:

```txt
wooord
```

with three `o` characters.

---

## Product Goal

The user can paste a vocabulary list like this:

```txt
natuurlijk  当然
bestel订购
zalig舒服的
heerlijk舒服的，很棒的
fantastisch非常棒，极好的，精彩的
```

The app parses the pasted text into Dutch-Chinese pairs.

Each pasted text is stored as a **file**.

A file title is generated automatically from:

```txt
[first Dutch word] — [current date]
```

Example:

```txt
natuurlijk — 2026-07-05
```

The user can open a file and see its vocabulary entries.

Dutch and Chinese expressions are clickable/listenable. When the user taps a Dutch or Chinese expression, or its audio icon, the app reads that expression aloud with the selected voice when available.

The user can organize files into folders.

The user can export, import, or merge the local Dexie database from a dedicated Data page.

The user can choose Dutch and Chinese speech voices from a dedicated Settings page.

---

## Core Vocabulary Model

Each vocabulary entry has:

* Dutch expression
* Chinese translation
* order inside the file

Example:

```ts
{
  id: string;
  fileId: string;
  dutch: string;
  chinese: string;
  order: number;
}
```

Each file has:

```ts
{
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Each folder has:

```ts
{
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

The database export format should include all app-owned Dexie tables needed to restore the app state.

At minimum, exported data should include:

* files
* vocabulary entries
* folders

---

## UX Rules

The app is mobile-first.

Prioritize:

* large readable text
* high contrast
* simple navigation
* low visual noise
* fast access to saved files
* easy listening practice
* clear data safety around import/export actions

Avoid dense desktop layouts.

Avoid small tap targets.

Avoid complex styling systems.

Prefer icons over word buttons for common actions such as edit and save.

For destructive or high-risk actions, clear text labels are acceptable and preferred.

---

## Main Screens

### Landing Page

The landing page shows:

* app title: `wooord`
* action to create a new file
* action to create a new folder
* action/link to open the Data page
* action/link to open the Settings page
* list of folders
* list of existing files

A user can tap a file to open it.

A user can add files to folders.

A user can create folders.

---

### New File Screen

The user can paste raw vocabulary text into a large textarea.

There should be an icon-only save button.

When saving:

1. parse pasted text
2. create a file title from the first Dutch word and today’s date
3. store the file and vocabulary entries in Dexie
4. navigate to the opened file view

---

### Open File Screen

The opened file screen shows:

* file title
* vocabulary entries
* Dutch expression
* Chinese translation
* audio/listen icon or tappable Chinese expression

Dutch and Chinese expressions are listenable.

Tapping the Dutch or Chinese expression, or its audio icon, should trigger speech synthesis.

The page should have a small icon-only edit button near the top.

Do not show large bottom buttons for edit/save.

In view mode:

```txt
top action = edit icon
```

In edit mode:

```txt
top action = save icon
```

The button changes behavior depending on mode.

---

### Edit File Screen / Edit Mode

The user can edit:

* file title
* vocabulary entries
* raw pasted content, or parsed rows

Prefer the simplest maintainable implementation first.

It is acceptable to edit the raw pasted content and re-parse it on save in the first version.

---

### Data Page

The app needs a dedicated **Data** page for local database management.

The page should contain three main actions:

```txt
Export database
Import database, replace current data
Add existing database, preserve current data
```

These actions are about the Dexie / IndexedDB database used by the app.

The page should be reachable from the landing page or top navigation.

Because import actions affect user data, these buttons should use clear text labels. Icon-only buttons are not recommended here.

---

## Data Page Behavior

### Export Database

The user can export the current local database to a downloadable JSON file.

The export should include all app-owned data needed to restore the app.

At minimum:

* folders
* files
* vocabulary entries

The export filename should be understandable.

Recommended filename pattern:

```txt
wooord-backup-YYYY-MM-DD.json
```

The export should not require a backend.

---

### Import Database, Replace Current Data

This action imports a previously exported `wooord` database JSON file.

It replaces the current local data.

Before replacing data, the app should show a clear confirmation step.

The confirmation should communicate that current local data will be deleted/replaced.

Recommended confirmation copy:

```txt
This will replace all current wooord data on this device. Continue?
```

After confirmation:

1. read selected JSON file
2. validate that it looks like a compatible wooord export
3. clear current app-owned Dexie tables
4. import folders, files, and vocabulary entries from the selected file
5. refresh the UI

If validation fails, do not replace current data.

Show a readable error message.

---

### Add Existing Database, Preserve Current Data

This action imports a previously exported `wooord` database JSON file and adds it to the current local data.

It should preserve existing local data.

This is a merge/import-add action.

The safest first implementation is:

* keep all current data
* import incoming folders, files, and vocabulary entries
* avoid overwriting existing records accidentally

If IDs conflict, generate new IDs for imported records and remap relationships.

Example:

* imported folder ID conflicts with an existing folder ID
* create a new folder ID
* imported files that belonged to that folder should point to the new folder ID

Same principle for files and vocabulary entries.

The merge action should not delete current local data.

After import, refresh the UI.

If validation fails, do not import anything.

Show a readable error message.

---

## Data Import Safety Rules

Do not partially replace user data.

For replace import:

* validate first
* then clear existing tables
* then import
* if validation fails, do nothing

For merge import:

* validate first
* prepare ID remapping
* then write imported data
* if validation fails, do nothing

Use Dexie transactions where practical.

Do not silently ignore malformed files.

Do not import unknown arbitrary JSON as if it were valid app data.

The app should tolerate future export versions.

Recommended export shape:

```ts
{
  app: 'wooord';
  version: 1;
  exportedAt: string;
  data: {
    folders: Folder[];
    files: VocabularyFile[];
    entries: VocabularyEntry[];
  };
}
```

---

## Audio Behavior

Use the Web Speech API.

The app lets the user choose a Dutch voice and a Chinese voice in Settings. Store these voice preferences locally in browser storage.

For Chinese speech fallback:

```ts
utterance.lang = 'zh-CN';
```

Chinese voice fallback order should prefer `zh-CN`, then `zh-TW`, then `zh-HK`, then any `zh-*` voice.

For Dutch speech fallback:

```ts
utterance.lang = 'nl-BE';
```

Dutch voice fallback order should prefer `nl-BE`, then `nl-NL`, then any `nl-*` voice.

If no Chinese voice is available, still attempt speech synthesis with `zh-CN`.

Do not block the user with errors if audio is unavailable.

A small visual active/listening state is useful but not required for the first version.

The Settings page must show a visible, stable number before every setting so the user can refer to settings unambiguously. Once assigned, a setting number must not change when settings are added, removed, or reordered.

Settings must include a persistent Chinese audio text handling option:

* enabled: process Chinese text with `splitChineseAudioText` before playback
* disabled: play the original Chinese text without splitting

All Chinese playback flows must honor this setting. Existing installations without a saved value should default to enabled so current playback behavior is preserved.

---

## Parsing Rules

The pasted content contains one vocabulary pair per line.

Each line contains:

```txt
Dutch expression + Chinese translation
```

The separator may be:

* multiple spaces
* one or more tabs
* no visible space between Dutch and Chinese

Examples:

```txt
natuurlijk  当然
bestel订购
zalig舒服的
heerlijk舒服的，很棒的
```

The parser should detect where Chinese characters start.

Everything before the first Chinese character is the Dutch expression.

Everything from the first Chinese character onward is the Chinese translation.

Ignore empty lines.

Trim whitespace.

---

## Styling Direction

Use the **Deep Study Blue** palette.

Place theme variables in:

```txt
src/styles/theme.css
```

Place global app styling in:

```txt
src/styles/global.css
```

Import them once in:

```ts
src/main.tsx
```

Recommended import order:

```ts
import './styles/theme.css';
import './styles/global.css';
```

Theme variables:

```css
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

Component CSS should consume these variables.

Do not redefine the palette inside individual components.

---

## Design Reference Image

A draft PNG mockup may be added as documentation only.

Recommended location:

```txt
docs/design/deep-study-blue-open-file-draft.png
```

This image is a loose visual reference.

It is not an implementation target.

Do not place it in:

```txt
public/
src/assets/
```

unless the running app needs to display it.

---

## Deployment Requirement

The app should support browser refresh and direct routing on static hosting.

Add this file:

```txt
public/_redirects
```

Content:

```txt
/* /index.html 200
```

This is especially useful for Netlify-style static deployment.

---

## Implementation Rules for Codex

Work milestone by milestone.

Manual code changes are authoritative, even when instruction or planning files do not yet reflect them. Before implementing a milestone, inspect the current code and preserve intentional behavior already present unless the user explicitly asks to change it.

Do not overbuild.

Prefer simple, clear React code.

Use TypeScript types for the domain model.

Use Dexie for local persistence.

Do not introduce backend code.

Do not introduce authentication.

Do not introduce UI libraries unless explicitly requested.

Do not use Tailwind unless explicitly requested.

Do not generate unnecessary abstractions.

Prefer understandable file names and feature folders.

Keep the app usable on mobile first.

Use clear confirmation flows for destructive database actions.

---

## Suggested Initial File Structure

```txt
src/
  app/
    App.tsx
    routes.tsx
  components/
    IconButton.tsx
    PageHeader.tsx
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
      parseVocabulary.ts
      types.ts
    folders/
      FolderList.tsx
      FolderCreateForm.tsx
  styles/
    theme.css
    global.css
  main.tsx
```

This structure may be adjusted if a simpler implementation is better.

---

## First Milestone

Build a working mobile-first version with:

* Vite React TypeScript setup
* Dexie database
* Deep Study Blue theme
* landing page with existing files
* new file page
* paste vocabulary content
* parse Dutch-Chinese lines
* save file to IndexedDB
* open saved file
* play Chinese audio with Web Speech API
* small icon-only edit button near the top
* `_redirects` file for static hosting

The Data page can be included in the first milestone if it is simple to implement cleanly.

If it would slow down the first usable version, create the route and placeholder page first, then implement export/import/merge in the next milestone.

After completing this milestone, stop and wait for the next instruction.
