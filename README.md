# Up Next

Joey's TV tracker as a web app you can add to a phone's home screen. Live at **https://josephprestley.github.io/up-next/**.

It's the Up Next app from Home Base (claude.ai), moved onto its own services:

| Piece | Where it lives |
|---|---|
| The app (these files) | GitHub Pages, from this repository |
| Your shows, what you've watched, show photos | Firebase Firestore, readable only by your sign-in (`firestore.rules`) |
| Sign-in | Firebase Authentication, email and password |
| Claude features (find a show, episode summaries, season titles) | `worker/worker.js` on Cloudflare, which holds the Anthropic key |
| Episode schedules (`episodes.json`, `synopses.json`) | This repository, refreshed weekly |

Nothing private is in this repository: the Firebase settings in `config.js` are meant to be public, and the database rules are what keep the data yours.

## On the iPhone
Open the link in Safari, sign in, then Share → Add to Home Screen. It opens full screen with its own icon and keeps working offline.

## Files
- `index.html`: the app (Up Next's page from Home Base, with a sign-in screen)
- `runtime.js`: stands in for what claude.ai provided (database, sign-in, Claude, photos, downloads)
- `config.js`: the Firebase web settings and the Worker's address
- `firebase.js`: the Firebase SDK, bundled
- `sw.js`, `manifest.webmanifest`, `icons/`: what makes it an installable, offline app
- `worker/worker.js`: the Cloudflare Worker (checks it's you, then asks Claude)
- `firestore.rules`: the database rules to paste into Firebase

## Daily Spin (spin/)
Joey's habit game, moved off claude.ai on Nov 5, 2026: https://josephprestley.github.io/up-next/spin/. It shares Up Next's
Firebase sign-in and database (`data/users/<uid>/lake/lucky` for the park, `lake/world/{grants,ledger}` for Trello
rewards) and runtime (`runtime.js`), and reads Trello only through the Worker's read-only route (`{trello: "health" |
"cards" | "activity"}`; the board, list and card ids are the Worker's `TRELLO_IDS` setting, the key and a read-only token
its `TRELLO_KEY` and `TRELLO_TOKEN` secrets). `spin/rewards.js` pays finished personal cards; `spin/sw.js` keeps it
working offline. Its tests (made-up data) live outside this public repository.

## My Closet (closet/)
Joey's wardrobe app, moved off claude.ai: https://josephprestley.github.io/up-next/closet/. It shares Up Next's Firebase
sign-in and database (`data/users/<uid>/closet/{items,outfits,weeks,settings,photos,thumbs,drafts}`) and Worker. It has
its own `closet/runtime.js` (a copy of `runtime.js` with the closet's additions: a database rooted at the closet, a photo
store of two small JPEG documents per photo, backup and restore, today's weather from Open-Meteo, and Claude calls with
photos), `closet/sw.js` (cache `closet-vN`) and manifest. `closet/index.html` is made from Home Base's closet page by a
conversion script kept outside this repository; `closet/extra.js` holds the menu, backup and Add several. Pieces and photos
stay in Firebase; nothing private is in this repository. Its tests (made-up data, a stand-in Firebase and Worker) live outside it.
