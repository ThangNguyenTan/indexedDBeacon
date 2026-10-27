if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
  globalThis.chrome = globalThis.browser;
}

chrome.devtools.panels.create(
  "IndexedDBeacon",
  "icons/icon16.png",
  "devtools/panel.html",
  function(panel) {
    // DevTools panel registered successfully
  }
);
