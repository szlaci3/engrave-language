# ROADMAP.md

## Roadmap Principle

Build **wooord** milestone by milestone.

Each milestone should leave the app in a usable or clearly inspectable state.

Avoid large unfinished rewrites.

Prefer simple working features over complex abstractions.

Manual code changes are authoritative, even when this roadmap has not yet caught up. Inspect the current implementation before starting a milestone, and preserve intentional current behavior unless the user explicitly requests otherwise.

Codex should stop after each milestone and wait for the next instruction.

---
## Codex Workflow Rule

When the user says `continue`, Codex should implement the next unfinished milestone in this file.

Codex should work in milestone order.

Do not skip ahead unless all earlier milestones are already fully implemented.

At the start of each run, inspect the current project state and determine the first milestone whose acceptance criteria are not fully satisfied.

Implement that milestone completely.

After finishing, stop and wait for the next `continue` instruction.

---

## Milestone 1: Project Setup and App Shell

Status: Complete.

Goal: create the foundation of the app.

Build:

* Vite React TypeScript project
* basic app shell
* mobile-first layout
* Deep Study Blue theme
* global CSS
* static hosting redirects file
* basic route structure

Required files:

```txt id="cbe5no"
src/styles/theme.css
src/styles/global.css
public/_redirects
```

`public/_redirects` content:

```txt id="zu9903"
/* /index.html 200
```

Theme variables:

```css id="d6boby"
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

Acceptance criteria:

* app runs locally
* app displays the name `wooord`
* layout is mobile-friendly
* background and text use the Deep Study Blue palette
* `_redirects` exists

Stop after this milestone.

---

## Milestone 2: Dexie Database and Domain Types

Status: Complete.

Goal: create the local persistence layer.

Build:

* Dexie database
* domain types
* repository functions for basic read/write

Data entities:

```ts id="6mjn8c"
export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type VocabularyFile = {
  id: string;
  title: string;
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
```

Suggested Dexie schema:

```ts id="1akmci"
this.version(1).stores({
  folders: 'id, name, createdAt, updatedAt',
  files: 'id, title, folderId, createdAt, updatedAt',
  entries: 'id, fileId, order',
});
```

Build repository functions for:

* creating a file with entries
* listing files
* reading one file with entries
* updating a file
* creating a folder
* listing folders

Acceptance criteria:

* database opens without errors
* files, entries, and folders can be created through repository functions
* repository functions hide Dexie details from UI components

Stop after this milestone.

---

## Milestone 3: Vocabulary Parser

Status: Complete.

Goal: parse pasted Dutch-Chinese vocabulary text.

Build:

```txt id="urcvl1"
src/features/files/parseVocabulary.ts
```

Parsing behavior:

* one pair per line
* detect first Chinese character
* Dutch expression is before the first Chinese character
* Chinese translation is from the first Chinese character onward
* ignore empty lines
* skip invalid lines
* preserve order

Example input:

```txt id="za5kqk"
natuurlijk  当然
bestel订购
zalig舒服的
heerlijk舒服的，很棒的
```

Expected output:

```ts id="pjhd73"
[
  { dutch: 'natuurlijk', chinese: '当然' },
  { dutch: 'bestel', chinese: '订购' },
  { dutch: 'zalig', chinese: '舒服的' },
  { dutch: 'heerlijk', chinese: '舒服的，很棒的' }
]
```

Recommended return shape:

```ts id="i7xgr8"
type ParseVocabularyResult = {
  entries: ParsedVocabularyEntry[];
  skippedLines: string[];
};
```

Acceptance criteria:

* parser handles lines with spaces
* parser handles lines with no separator
* parser returns valid entries in original order
* parser reports skipped invalid lines

Stop after this milestone.

---

## Milestone 4: Create and Save Files

Status: Complete.

Goal: allow user to paste vocabulary text and save it as a file.

Build:

* New File page
* large textarea
* icon-only save button
* parser integration
* Dexie save integration
* generated file title

Title format:

```txt id="u5tlkz"
[first Dutch word] — YYYY-MM-DD
```

Example:

```txt id="l5xgd7"
natuurlijk — 2026-07-05
```

Save flow:

1. user pastes raw text
2. taps save icon
3. app parses text
4. app validates at least one entry exists
5. app creates file title
6. app saves file and entries in Dexie
7. app opens the saved file

Acceptance criteria:

* user can paste the sample vocabulary list
* user can save it
* a file is created in IndexedDB
* entries are saved in order
* app navigates to the opened file view
* empty or invalid input shows a readable message

Stop after this milestone.

---

## Milestone 5: Landing Page File List

Status: Complete.

Goal: show saved files on the landing page.

Build landing page with:

* app title `wooord`
* link/button to create a new file
* link/button to create a new folder
* link/button to open Data page
* list of existing files
* list of folders if any exist

File list item should show:

* title
* created or updated date
* folder if useful

Acceptance criteria:

* saved files appear on landing page
* tapping a file opens it
* Data page is reachable
* new file page is reachable
* empty state is readable when no files exist

Stop after this milestone.

---

## Milestone 6: Open File and Listen to Chinese

Status: Complete.

Goal: display a saved file and make Chinese translations audible.

Build:

* File View page
* file title
* ordered vocabulary entries
* Dutch expression
* Chinese translation
* speaker/audio icon
* tappable Chinese text or icon
* small top edit icon with no text

Speech behavior:

```ts id="8j40oc"
utterance.lang = 'zh-CN';
```

Recommended helper:

```ts id="x8fxjy"
export function speakChinese(text: string) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';

  window.speechSynthesis.speak(utterance);
}
```

Acceptance criteria:

* opened file shows all entries
* Chinese translations are easy to tap
* tapping Chinese text or speaker icon attempts audio playback
* edit icon appears near the top
* there are no large bottom `Bewerken` or `Opslaan` buttons

Stop after this milestone.

---

## Milestone 7: Edit Existing File

Status: Complete.

Goal: allow user to edit saved files.

Build one of these:

Preferred first version:

* edit mode inside File View page

Or:

* separate Edit File page

Simplest editing model:

1. reconstruct raw text from current entries
2. show textarea
3. allow title editing
4. save icon appears near the top
5. on save, parse textarea
6. update file metadata
7. replace old entries with new parsed entries

View/edit top action rule:

```txt id="l892qr"
view mode = edit icon
edit mode = save icon
```

No visible text label is needed on the icon.

Accessibility labels are still required.

Acceptance criteria:

* user can enter edit mode
* user can edit file title
* user can edit vocabulary content
* save updates the Dexie data
* file view reflects updated content
* invalid edited content shows a readable message

Stop after this milestone.

---

## Milestone 8: Folders

Status: Complete.

Goal: organize files into folders.

Build:

* create folder
* list folders
* assign file to folder
* show files by folder

Keep folders simple.

Rules:

* no nested folders
* one file can belong to zero or one folder
* deleting folders can be delayed unless easy

Acceptance criteria:

* user can create a folder
* user can move/add a file into a folder
* landing page shows folders
* user can open a folder and see its files
* existing files without folder still remain visible

Stop after this milestone.

---

## Milestone 9: Data Page Route and Export

Status: Complete.

Goal: create Data page and allow JSON backup export.

Build route:

```txt id="59s4zs"
/data
```

Build page:

```txt id="16ywzg"
DataPage
```

Add button:

```txt id="8hkesq"
Export database
```

Export shape:

```ts id="oo9wco"
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

Filename pattern:

```txt id="swwu61"
wooord-backup-YYYY-MM-DD.json
```

Acceptance criteria:

* Data page opens
* export button downloads JSON
* JSON contains folders, files, and entries
* export includes app name and version
* export does not require backend

Stop after this milestone.

---

## Milestone 10: Import Database, Replace Current Data

Status: Complete.

Goal: import a backup and replace the current local database.

Add button:

```txt id="l1ff5x"
Import database, replace current data
```

Required flow:

1. user selects JSON file
2. app reads file
3. app parses JSON
4. app validates export shape
5. app asks for confirmation
6. app clears current app-owned tables
7. app imports folders, files, entries
8. app refreshes UI

Confirmation copy:

```txt id="8hsawx"
This will replace all current wooord data on this device. Continue?
```

Validation happens before deletion.

Clear order:

```txt id="0xxpj1"
entries
files
folders
```

Import order:

```txt id="4yg1g9"
folders
files
entries
```

Acceptance criteria:

* invalid JSON does not affect current data
* incompatible JSON does not affect current data
* canceling confirmation does not affect current data
* valid import replaces current data
* imported files appear on landing page

Stop after this milestone.

---

## Milestone 11: Add Existing Database, Preserve Current Data

Status: Complete.

Goal: merge a backup into the current database without deleting current data.

Add button:

```txt id="xovbbw"
Add existing database, preserve current data
```

Required behavior:

* validate import first
* preserve existing data
* import incoming data as additional data
* do not overwrite existing records
* do not delete existing records

Recommended first implementation:

* generate new IDs for every imported folder
* generate new IDs for every imported file
* generate new IDs for every imported entry
* remap file-folder relationships
* remap entry-file relationships

Acceptance criteria:

* current data remains after merge
* imported files are added
* imported entries point to imported files
* imported files point to remapped imported folders when needed
* ID conflicts do not overwrite existing records
* invalid import does nothing

Stop after this milestone.

---

## Milestone 12: Polish and Hardening

Status: Complete.

Goal: improve usability and reliability.

Improve:

* empty states
* loading states
* error messages
* import/export success feedback
* active audio/listening state
* duplicate title handling
* folder assignment UI
* mobile spacing
* accessibility labels
* focus states
* button contrast
* textarea readability

Acceptance criteria:

* app feels clean and stable on mobile
* important buttons have accessible labels
* import/export gives clear feedback
* no obvious layout problems on small screens
* core flows are easy to understand

Stop after this milestone.

---

## Post-MVP Feature: Voice Settings and Dutch Audio

Status: Complete.

Goal: improve audio playback by allowing the user to choose voices for both Chinese and Dutch.

Build:

- Settings page
- route to Settings page
- navigation link to Settings page
- browser voice loading through the Web Speech API
- Chinese voice selection
- Dutch voice selection
- persisted selected voice preferences
- Chinese playback using the selected Chinese voice
- Dutch playback using the selected Dutch voice
- audible Dutch words in the file view
- support for Taiwan Chinese voices when available, especially `zh-TW`
- support for Dutch voices when available, especially `nl-NL` and `nl-BE`

Rules:

- Use installed browser/device voices from `window.speechSynthesis.getVoices()`.
- Do not use a paid TTS API.
- Do not add a backend.
- Do not make external network calls for audio.
- If the selected voice is unavailable later, fall back to the best available language match.
- Chinese fallback order should prefer `zh-CN`, then `zh-TW`, then `zh-HK`, then any `zh-*` voice.
- Dutch fallback order should prefer `nl-BE`, then `nl-NL`, then any `nl-*` voice.
- The Settings page should clearly show voice name and language code.
- The Dutch word and Chinese translation should both be audible from the opened file page.

Acceptance criteria:

- user can open Settings
- user can choose a Chinese voice
- user can choose a Dutch voice
- selected voices persist after refresh
- Chinese audio uses the selected Chinese voice when available
- Dutch audio uses the selected Dutch voice when available
- Taiwan Chinese voices are selectable when the browser exposes them
- Dutch words in vocabulary entries are listenable
- app remains runnable

---

## Milestone 13: Stable Settings Numbers and Chinese Audio Text Handling

Status: Complete.

Goal: make every setting easy to reference and let the user choose whether Chinese audio uses the existing text-splitting behavior.

Build in one implementation pass:

- Show a visible setting number before every setting label in the Settings UI.
- Treat setting numbers as stable identifiers: do not derive them from array position and do not renumber existing settings when settings are later added, removed, or reordered.
- Assign the current settings these stable numbers:
  - `1` — UI language
  - `2` — Dutch audio source
  - `3` — Chinese audio source
  - `4` — Dutch voice
  - `5` — Chinese voice
- Add setting `6` — Chinese audio text splitting.
- Persist setting `6` with the existing audio/voice preferences in browser `localStorage`.
- Default setting `6` to enabled when no saved value exists, preserving the current behavior for existing users.
- When enabled, Chinese playback must process the original text with `splitChineseAudioText` and continue the current per-entry cycling behavior.
- When disabled, Chinese playback must pass the original, unsplit Chinese text through the audio playback flow.
- Apply the setting consistently to Chinese playback in both the opened file view and flashcards.
- Make Chinese audio preloading follow the same enabled/disabled text choice so Wiktionary lookup/cache preparation matches the text that will be played.
- Add localized Chinese and English labels/help text for the new setting and accessible UI semantics for its control.

Implementation notes from the current code:

- `src/features/settings/SettingsPage.tsx` currently renders five settings in the numbering order above.
- `src/features/settings/voicePreferences.ts` owns the `wooord.voicePreferences` local-storage object and already tolerates missing preference fields; extend that shape without discarding existing saved fields.
- `splitChineseAudioText` currently splits on the Chinese comma `，` and returns trimmed, non-empty parts (or the original text as fallback).
- `src/features/files/FileViewPage.tsx` and `src/features/files/FlashcardsPage.tsx` call `splitChineseAudioText` unconditionally and keep a per-entry next-part index. Both call sites must honor setting `6`.
- `preloadVocabularyAudios` in `src/features/files/audioService.ts` also splits Chinese text unconditionally; it must honor the same setting.
- The underlying `speakChinese`/`playLanguageAudio` path receives the text chosen by those callers and supports either browser speech or Wiktionary-with-browser fallback.

Acceptance criteria:

- all six Settings controls display their assigned numbers visibly
- the assigned numbers remain fixed in source rather than changing with render order
- the Chinese audio text splitting choice persists after refresh
- users with no saved choice retain the current split-and-cycle behavior
- enabled mode uses `splitChineseAudioText` for Chinese playback and preloading
- disabled mode plays and preloads the original Chinese text without splitting
- file-view and flashcard Chinese playback both follow the saved choice
- existing UI language, audio-source, and voice preferences continue to load and save
- the app remains mobile-friendly, accessible, and runnable

Stop after this milestone.

---

## Milestone 14: Automatic Flashcard Prompt Audio

Status: Complete.

Goal: automatically play the visible prompt when a flashcard is presented while keeping answer playback user-controlled.

Build:

- In Flashcard mode, automatically start the prompt-side audio whenever a card's prompt is displayed.
- Auto-play the first card's prompt after the flashcard file has loaded.
- Auto-play the new prompt after moving to the previous or next card.
- Auto-play the current card's new prompt after changing flashcard direction.
- Use Dutch audio for a Dutch prompt and Chinese audio for a Chinese prompt.
- Chinese prompt auto-play must follow the Chinese audio text handling preference from Milestone 13.
- Keep the existing prompt audio button visible and usable so the user can replay the prompt manually.
- Do not automatically play the answer when it is revealed or otherwise displayed.
- Keep the existing answer audio button available for manual playback.
- Avoid duplicate automatic playback caused by React rerenders or unrelated state changes.
- Preserve the existing active-audio state and graceful behavior when browser audio is unavailable.

Implementation notes from the current code:

- `src/features/files/FlashcardsPage.tsx` already has `playPromptAudio` and `playAnswerAudio` paths and tracks the current card, direction, reveal state, and active audio ID.
- Automatic playback should be tied to a meaningful prompt presentation change, not to every render.
- Navigation wraps or exits through the existing end-of-deck confirmation flow; only a card that is actually displayed should trigger prompt audio.

Acceptance criteria:

- the first displayed flashcard prompt plays automatically
- each newly displayed previous or next prompt plays automatically
- changing direction automatically plays the newly displayed prompt in the correct language
- revealing the answer never starts answer audio automatically
- prompt and answer audio buttons remain visible and work manually
- Chinese prompt playback follows the saved split/original-text preference
- rerenders do not cause repeated or overlapping unintended auto-play
- audio unavailability does not block flashcard study
- the app remains mobile-friendly and runnable

Stop after this milestone.

---

## Later Ideas

Do not build these in the first milestones unless explicitly requested.

Possible future features:

* flashcard mode
* spaced repetition
* search across files
* tags
* nested folders
* cloud sync
* optional PWA installation
* pronunciation practice
* AI-assisted parsing
* OCR from screenshots
* export selected folder only
* duplicate detection
* import preview before merge
