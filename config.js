/* Up Next's connections. Neither value is a secret: a Firebase web config is meant to sit in the page (the database
   rules are what keep Joey's data private), and the Worker only answers Joey's own signed-in requests. */
export default {
  // from Firebase → Project settings → Your apps → Up Next (web), project up-next-5ed72
  firebase: {
    apiKey: "AIzaSyANzK0yozlyry5iX1N947J53tZrvunMjIU",
    authDomain: "up-next-5ed72.firebaseapp.com",
    projectId: "up-next-5ed72",
    storageBucket: "up-next-5ed72.firebasestorage.app",
    messagingSenderId: "72317541982",
    appId: "1:72317541982:web:2cfefdd2a4698059afdecf",
  },
  // Joey's Cloudflare Worker (worker/worker.js), which calls Claude with the Anthropic key kept on Cloudflare
  workerUrl: "https://up-next-claude.josephprestley.workers.dev/",
};
