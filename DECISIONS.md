# DECISIONS.md

## Decision 1: App Name

The app name is:

```txt id="mafs9p"
wooord
```

with three `o` characters.

Use this spelling consistently in:

* page titles
* headings
* export filenames
* documentation
* user-facing text

---

## Decision 2: Mobile-First Browser App

The app is designed primarily for mobile browser use.

Reason:

* the user will paste vocabulary content and review it on mobile
* listenable Chinese expressions are useful for mobile study
* the interface should stay simple, readable, and touch-friendly

Implications:

* large text
* high contrast
* generous tap targets
* simple stacked layouts
* no dense desktop table layout
* no hover-dependent interactions

---

## Decision 3: Static Front-End Only

The app has no backend.

All data is stored locally in the browser.

Reason:

* faster to build
* easier to deploy
* no authentication needed
* no server maintenance
* enough for the first useful version

Implications:

* use Dexie / IndexedDB for persistence
* export/import is needed for backup and transfer
* data exists per browser/device unless manually exported/imported

---

## Decision 4: Use React, TypeScript, Vite, Dexie

The core stack is:

```txt id="tlls80"
React
TypeScript
Vite
Dexie
IndexedDB
Plain CSS
```

Reason:

* React and TypeScript fit the user’s front-end skill set
* Vite is simple and fast for a small app
* Dexie makes IndexedDB easier to use
* plain CSS keeps the project lightweight

Rejected for now:

* backend API
* authentication
* Tailwind
* UI component libraries
* external state management libraries

These can be reconsidered only if the app grows enough to justify them.

---

## Decision 5: Each Pasted Text Is a File

Every pasted vocabulary list is stored as a **file**.

Reason:

* “file” is a simple mental model
* the landing page can show existing files
* files can later be moved into folders
* a pasted list is naturally a self-contained study unit

Implications:

* the main entity is `VocabularyFile`
* each file has many `VocabularyEntry` records
* a file can belong to one folder or no folder

---

## Decision 6: Automatic File Title

The default file title is generated from:

```txt id="8imb9s"
[first Dutch word] — [current date]
```

Example:

```txt id="iub9ak"
natuurlijk — 2026-07-05
```

Reason:

* the title is immediately meaningful
* the user does not need to type a title before saving
* the title is predictable and easy to recognize later

Implications:

* the parser must identify the first valid Dutch expression
* local date should be used
* duplicate titles are allowed in the first version

---

## Decision 7: Parser Detects First Chinese Character

The parser should split each line at the first Chinese character.

Example:

```txt id="j6rlsl"
bestel订购
```

Becomes:

```ts id="drbcot"
{
  dutch: 'bestel',
  chinese: '订购'
}
```

Reason:

* the pasted source may have inconsistent spacing
* some lines may have two spaces
* some lines may have no visible separator
* detecting Chinese characters is more reliable than splitting only on whitespace

Implications:

* lines without Chinese characters are skipped
* everything before the first Chinese character is Dutch
* everything from the first Chinese character onward is Chinese
* parser should preserve row order

---

## Decision 8: Chinese Text Is Listenable

Chinese translations should be clickable/listenable.

Reason:

* the app is for language learning
* listening to Chinese translations makes the stored vocabulary more useful
* mobile browser speech synthesis is good enough for the first version

Implementation decision:

```ts id="74rzj0"
utterance.lang = 'zh-CN';
```

Use the Web Speech API.

Implications:

* no audio files are stored
* no backend text-to-speech service is required
* speech failure should not break the app
* Chinese text and/or speaker icon can trigger playback

---

## Decision 9: Deep Study Blue Theme

The chosen visual direction is **Deep Study Blue**.

Palette:

```css id="hnxjxt"
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

Reason:

* high contrast
* calm study-focused feeling
* strong blue accent for interactive elements
* works well with large light text

Implications:

* theme variables belong in `src/styles/theme.css`
* component CSS should consume variables
* components should not redefine the palette

---

## Decision 10: Use Plain CSS

Use plain CSS instead of a styling framework.

Reason:

* the styling target is simple
* a central palette is enough
* avoids dependency overhead
* keeps Codex implementation easier to inspect

Implications:

* global styles go in `src/styles/global.css`
* theme variables go in `src/styles/theme.css`
* feature/page CSS can be colocated where useful
* avoid over-engineering styling abstractions

---

## Decision 11: Prefer Icon-Only for Common Top Actions

For common file actions such as edit and save, prefer icon-only controls.

The opened file page should not have large bottom buttons for:

```txt id="7d2e2f"
Bewerken
Opslaan
```

Instead:

* view mode has a small edit icon near the top
* edit mode has a small save icon in the same area
* no text label is shown for these top actions

Reason:

* keeps the mobile screen cleaner
* matches the intended simple visual direction
* avoids oversized controls for frequent actions

Accessibility requirement:

Icon-only buttons must have `aria-label`.

Example:

```tsx id="j582ui"
<button aria-label={isEditing ? 'Save file' : 'Edit file'}>
  {isEditing ? <SaveIcon /> : <EditIcon />}
</button>
```

---

## Decision 12: Data Page Uses Text Buttons

The Data page should use clear text buttons for database actions.

Buttons:

```txt id="1txvvx"
Export database
Import database, replace current data
Add existing database, preserve current data
```

Reason:

* these actions are data-sensitive
* import/replace can destroy local data
* text labels reduce ambiguity
* icon-only controls are not appropriate for destructive or high-risk actions

Implications:

* Data page buttons may be larger and explicitly labeled
* confirmation is required for replace import
* validation must happen before replacing data

---

## Decision 13: Database Export Is JSON

The app exports the local Dexie database as a JSON file.

Recommended filename pattern:

```txt id="0dhftf"
wooord-backup-YYYY-MM-DD.json
```

Recommended export shape:

```ts id="g6vfze"
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

Reason:

* JSON is simple and inspectable
* works without backend
* easy to import later
* suitable for backups and device transfer

Implications:

* exported data should include all app-owned tables
* export should include app and version metadata
* import code should validate the shape before using it

---

## Decision 14: Replace Import Must Validate Before Deleting

For:

```txt id="75t8ns"
Import database, replace current data
```

the app must validate the selected file before deleting current data.

Reason:

* user data is local and may not exist anywhere else
* a malformed import file should not destroy current data
* destructive actions require careful sequencing

Required order:

```txt id="mmfkzh"
1. read selected file
2. parse JSON
3. validate export shape
4. ask user to confirm replacement
5. clear current tables
6. import selected data
7. refresh UI
```

If validation fails, do nothing to current data.

---

## Decision 15: Merge Import Preserves Current Data

For:

```txt id="9z7s1e"
Add existing database, preserve current data
```

the app should preserve all current data.

Reason:

* this action is for combining databases/backups
* it should not overwrite or delete the current local database
* safest behavior is additive import

Implementation decision:

* generate new IDs for imported folders
* generate new IDs for imported files
* generate new IDs for imported entries
* remap relationships

Reason:

* avoids ID collision problems
* avoids accidental overwrite
* keeps logic predictable

Implications:

* duplicate titles are acceptable in the first version
* folder/file relationships from the imported database should be preserved through ID remapping
* imported entries should point to the new imported file IDs

---

## Decision 16: Design Reference Image Is Documentation Only

The draft PNG visual mockup may be stored as a design reference.

Recommended location:

```txt id="864g69"
docs/design/deep-study-blue-open-file-draft.png
```

Reason:

* useful for color and layout direction
* not needed by the running app
* should not increase app bundle size

Do not place it in:

```txt id="hkdgc2"
public/
src/assets/
```

unless the app itself displays it.

The mockup is a loose reference only.

It is not an exact implementation target.

---

## Decision 17: Add `_redirects` for Static Routing

Add:

```txt id="w0lvtk"
public/_redirects
```

Content:

```txt id="tt9fal"
/* /index.html 200
```

Reason:

* the app uses client-side routing
* direct visits to `/files/:fileId` should work after deployment
* browser refresh should not return a static-hosting 404

---

## Decision 18: First Version Should Not Overbuild

The first version should focus on a usable core.

Build first:

* create file
* parse pasted text
* save to Dexie
* list files
* open file
* play Chinese audio
* basic edit support
* basic folder support
* Data page route and database backup tools

Avoid for now:

* cloud sync
* accounts
* backend
* nested folders
* flashcard scheduling
* AI translation
* OCR
* pronunciation scoring
* complex animations
* advanced theming

Reason:

* this is a learning and utility app
* a small complete app is more valuable than a large unfinished one
* Codex should work milestone by milestone

---

## Decision 19: Start With Lightweight Route Constants

The first app shell uses route constants and a small path resolver instead of a routing library.

Reason:

* Milestone 1 only needs a basic route structure
* the app has very few initial routes
* this keeps the first shell simple and runnable

Implications:

* `src/app/routes.ts` owns the route paths
* `src/app/App.tsx` renders the current shell view from `window.location.pathname`
* a router library can be introduced later if nested routes or navigation state become worth the dependency

---

## Decision 20: Use Browser Voices for Dutch and Chinese Audio

The app uses installed browser/device Web Speech voices for both Dutch and Chinese playback.

Reason:

* keeps the app static and backend-free
* avoids paid text-to-speech APIs
* lets users choose a preferred voice when their device exposes multiple voices
* supports regional voices such as `zh-TW`, `nl-NL`, and `nl-BE` when available

Implementation decision:

* store selected Dutch and Chinese `voiceURI` values in localStorage
* use `window.speechSynthesis.getVoices()` and `voiceschanged`
* if a selected voice is unavailable later, fall back by language
* Chinese fallback order is `zh-CN`, `zh-TW`, `zh-HK`, then any `zh-*`
* Dutch fallback order is `nl-BE`, `nl-NL`, then any `nl-*`

Implications:

* voice preferences are local to the browser/device
* voice availability depends on the operating system and browser
* playback should still attempt speech with language fallback if no matching voice is exposed
