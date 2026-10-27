if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
  globalThis.chrome = globalThis.browser;
}

document.addEventListener('DOMContentLoaded', () => {
  // Populate active tab origin if possible
  const originEl = document.getElementById('active-tab-origin');
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          if (originEl) {
            originEl.textContent = url.origin || url.hostname;
          }
        } catch (e) {
          if (originEl) originEl.textContent = 'Active Page';
        }
      } else if (originEl) {
        originEl.textContent = 'Active Page';
      }
    });
  } else if (originEl) {
    originEl.textContent = 'Active Page';
  }

  // Open demo playground button
  const btnDemo = document.getElementById('btn-open-demo');
  if (btnDemo) {
    btnDemo.addEventListener('click', () => {
      const demoUrl = chrome.runtime.getURL('test/test-page.html');
      chrome.tabs.create({ url: demoUrl });
      window.close();
    });
  }
});
