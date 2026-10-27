if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
  globalThis.chrome = globalThis.browser;
}

/**
 * Theme Manager for IndexedDBeacon
 * Auto-detects DevTools theme and allows manual override.
 */
export const themeManager = {
  currentTheme: 'auto',

  init() {
    const saved = localStorage.getItem('idb_beacon_theme') || 'auto';
    this.setTheme(saved);

    // If chrome.devtools is available, listen for theme changes
    if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.panels) {
      if (chrome.devtools.panels.themeName) {
        this.updateDOM();
      }
    }
  },

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('idb_beacon_theme', theme);
    this.updateDOM();
  },

  getEffectiveTheme() {
    if (this.currentTheme === 'dark') return 'dark';
    if (this.currentTheme === 'light') return 'light';

    // Auto mode
    if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.panels) {
      const devtoolsTheme = chrome.devtools.panels.themeName;
      if (devtoolsTheme === 'dark') return 'dark';
      if (devtoolsTheme === 'default' || devtoolsTheme === 'light') return 'light';
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  updateDOM() {
    const eff = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', eff);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.title = `Theme: ${eff === 'dark' ? 'Dark' : 'Light'} - Click to switch to ${eff === 'dark' ? 'light' : 'dark'} mode`;
      themeBtn.innerHTML = eff === 'dark'
        ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
  },

  toggle() {
    const current = this.getEffectiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }
};
