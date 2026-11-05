/* Up Next's connections. Neither value is a secret: a Firebase web config is meant to sit in the page (the database
   rules are what keep Joey's data private), and the Worker only answers Joey's own signed-in requests. */
export default {
  // from Firebase → Project settings → Your apps → Up Next (web)
  firebase: null,
  // Joey's Cloudflare Worker (worker/worker.js), which calls Claude with the Anthropic key kept on Cloudflare
  workerUrl: "",
};
