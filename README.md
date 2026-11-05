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
