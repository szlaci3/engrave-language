# engrave-language

A mobile-first Dutch/Chinese vocabulary app, based on wooord, with the 3D world from Bookworm’s `water` branch. Data stays in this browser’s IndexedDB; export backups from the Data page before switching devices.

## Develop and validate

Requires Node 24 and npm.

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run test:e2e
```

Browser tests run against the production build, using `/usr/bin/chromium` or `CHROMIUM_PATH`. On other machines, install Chromium and set `CHROMIUM_PATH` to its executable. Tests cover phone/desktop practice, exact stone stops including the last stone, edits and persistence, draft autosave, walking speed, release-to-stop and 3D fallback.

## Practice

Create a deck with one Dutch/Chinese pair per line. The optional title and raw text autosave as a local draft while typing, including incomplete lines. Reloading the new-deck page restores the draft. Submit to create the deck and start practicing; blank titles use the first Dutch word and local date. The draft clears only after a successful save. Drafts belong to this browser and are separate from database exports.

Decks have separate **2D** and **3D** practice buttons on the home page, folder pages, and deck view. **2D** opens the original flat flashcards with reveal, language direction, listening, and Previous/Next controls. **3D** loads the water world. Both use the same saved deck. NL / 中 choose the first stone of each pair and restart at the first stone. Speaker icons play the current pair’s Chinese or Dutch audio using the existing voice/source settings; repeated Chinese listening cycles through split parts when enabled. Previous/Next travel to each stone’s closest fully visible position. Click again during a step to queue another full stone movement, up to four moves including the active move. Starting continuous walking or stopping practice clears queued moves. When about ten stones remain, the next round’s stones appear ahead without advancing the progress counter or triggering the completion notice early. The last stone has the same viewing distance as every other stone. Continuing past it with Next or forward walking extends the row with the first stone of the next round, with no camera reset or skipped stone, and shows a brief end-of-deck notice. Previous and backward walking can retrace all earlier rounds and continue indefinitely. Repeated stones have separate occurrence identities; saved vocabulary IDs stay unchanged. Only a bounded window of meshes and cover textures stays in GPU memory. Stone artwork is generated once per language and reused, so passing each stone does not rebuild the procedural texture. Departing stones drop quickly downward, as in Bookworm, and rise back when reversing. 2D practice also repeats with the same notice. Hold the up/down controls or arrow keys to walk continuously; release to stop. Walking stops when the window loses focus or the page is hidden.

The main toolbar contains listening, Next, and continuous forward controls. Expand it for language order, Previous, continuous back, Edit, Low/High controls, and Exit. The height toggle defaults to high and places the toolbar 5px from the bottom in low mode. Its choice is saved in the Dexie settings table, shared across decks, and included in database backups. Touching outside the toolbar collapses the expanded panel. The expanded panel also lets you change continuous walking speed (0.25×–3×, remembered on this device), or edit the current vocabulary pair in a dialog. Changes save to IndexedDB without replacing the pair’s ID or order. Cancel leaves the stored pair unchanged. WebGL-unavailable devices get a text practice view with stepping and audio.

## Netlify

Import this repository in Netlify. `netlify.toml` selects Node 24, `npm run build`, and the `dist` publish directory. SPA redirects support direct deck URLs and refresh. No server, environment secrets, or database service is required. This repository is prepared for deployment; deploying the site is a separate Netlify action.

The world texture is bundled locally. Dutch audio defaults to Wiktionary/Wikimedia, with browser speech fallback; explicit saved audio-source choices are preserved. For Dutch Wiktionary lookups and preloading, leading “de ” or “het ” is removed internally, including capitalized articles. Displayed vocabulary and browser speech retain the full original text. Chinese audio keeps its existing source preference. Voice availability depends on the device. Serve over HTTPS for deployment.

## Check a deployed site

To run the same isolated browser tests against Netlify, without starting a local server:

```sh
ENGRAVE_TEST_URL=https://engrave-l.netlify.app node_modules/.bin/playwright test
```

In the managed cloud environment, also set `ENGRAVE_TEST_PROXY="$HTTPS_PROXY"`. The test request layer uses the configured CA with TLS verification enabled. The hostname must be allowed by the environment network policy. Tests use disposable browser contexts and mock Wiktionary responses; they check the deployed application, not live audio delivery or voice availability.

### Speed Run

Open Speed Run after Settings, tap decks to select them, choose the prompt language,
and press Play. A/D and Left/Right arrows select answers on desktop; tap stones on
mobile. The aisle moves continuously at adjustable speed. There is no round timer.
Unanswered questions count separately from mistakes. At the end of the selected
material, the run displays “Endline - Starting again” and shuffles another lap.

`SPEED_RUN_TRIO_SPACING = 9` world units and
the portrait layout constants are in `src/features/speedRun/model.ts`. Answers are
above and below the prompt. Answered trios remain opaque at fixed world positions
as the camera passes; ghost holding and dropping are disabled. Progress is saved by stable
card ID and language direction in Dexie and included in version 3 backups. Older
backups remain importable. Deck editing now changes only the title; edit vocabulary
pairs in 3D review to retain their IDs and history.

Speed Run stones use the same Three.js slab geometry, engraved canvas textures,
lighting, and floor reflections as 3D review. Trios have fixed world positions;
the camera advances through the aisle. Invisible accessible buttons follow the
projected mesh faces for tapping and keyboard focus.

`SPEED_RUN_NEAR_DISTANCE_MULTIPLIER = 1` sets the unanswered-decision distance as a
multiple of the viewport-dependent review near distance. The camera continues past
answered trios. Speed ranges from 0.1× to 3× in 0.1 increments.
