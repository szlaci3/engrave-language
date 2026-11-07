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

Decks have separate **2D** and **3D** practice buttons on the home page, folder pages, and deck view. **2D** opens the original flat flashcards with reveal, language direction, listening, and Previous/Next controls. **3D** loads the water world. Both use the same saved deck. NL / 中 choose the first stone of each pair and restart at the first stone. Speaker icons play the current pair’s Chinese or Dutch audio using the existing voice/source settings; repeated Chinese listening cycles through split parts when enabled. Previous/Next travel to each stone’s closest fully visible position. When about ten stones remain, the next round’s stones appear ahead without advancing the progress counter or triggering the completion notice early. The last stone has the same viewing distance as every other stone. Continuing past it with Next or forward walking extends the row with the first stone of the next round, with no camera reset or skipped stone, and shows a brief end-of-deck notice. Previous and backward walking can retrace all earlier rounds and continue indefinitely. Repeated stones have separate occurrence identities; saved vocabulary IDs stay unchanged. Only a bounded window of meshes and cover textures stays in GPU memory. Stone artwork is generated once per language and reused, so passing each stone does not rebuild the procedural texture. Departing stones drop quickly downward, as in Bookworm, and rise back when reversing. 2D practice also repeats with the same notice. Hold the up/down controls or arrow keys to walk continuously; release to stop. Walking stops when the window loses focus or the page is hidden.

The main toolbar contains listening, Next, and continuous forward controls. Expand it for language order, Previous, continuous back, Edit, Low/High controls, and Exit. The height toggle defaults to high and places the toolbar 5px from the bottom in low mode. Touching outside the toolbar collapses the expanded panel. The expanded panel also lets you change continuous walking speed (0.25×–3×, remembered on this device), or edit the current vocabulary pair in a dialog. Changes save to IndexedDB without replacing the pair’s ID or order. Cancel leaves the stored pair unchanged. WebGL-unavailable devices get a text practice view with stepping and audio.

## Netlify

Import this repository in Netlify. `netlify.toml` selects Node 24, `npm run build`, and the `dist` publish directory. SPA redirects support direct deck URLs and refresh. No server, environment secrets, or database service is required. This repository is prepared for deployment; deploying the site is a separate Netlify action.

The world texture is bundled locally. Downloaded audio uses Wiktionary/Wikimedia when selected, with browser speech fallback. Voice availability depends on the device. Serve over HTTPS for deployment.

## Check a deployed site

To run the same isolated browser tests against Netlify, without starting a local server:

```sh
ENGRAVE_TEST_URL=https://engrave-l.netlify.app node_modules/.bin/playwright test
```

In the managed cloud environment, also set `ENGRAVE_TEST_PROXY="$HTTPS_PROXY"`. The test request layer uses the configured CA with TLS verification enabled. The hostname must be allowed by the environment network policy. Tests use disposable browser contexts and mock Wiktionary responses; they check the deployed application, not live audio delivery or voice availability.
