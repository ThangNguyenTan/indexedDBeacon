/**
 * Database & Object Store List (Sidebar Tree Explorer)
 */
import { toast } from './toast.js';

export class DatabaseList {
  constructor(options = {}) {
    this.options = {
      onSelectStore: options.onSelectStore ?? null,
      onCreateDatabase: options.onCreateDatabase ?? null,
      onCreateStore: options.onCreateStore ?? null,
      onCreateIndex: options.onCreateIndex ?? null,
      onDeleteDatabase: options.onDeleteDatabase ?? null,
      onDeleteStore: options.onDeleteStore ?? null,
      onDeleteIndex: options.onDeleteIndex ?? null,
      onClearStore: options.onClearStore ?? null,
      onManualConnect: options.onManualConnect ?? null,
      ...options
    };

    this.container = null;
    this.databases = []; // Array of { name, version, stores: [...] }
    this.activeDb = null;
    this.activeStore = null;
    this.activeIndex = '';
    this.expandedDbs = new Set();
    this.expandedStores = new Set();
    this.searchFilter = '';
  }

  mount(el) {
    this.container = el;
    this.render();
  }

  setDatabases(databases) {
    this.databases = databases || [];

    // Auto expand first db if only 1
    if (this.databases.length === 1 && this.expandedDbs.size === 0) {
      this.expandedDbs.add(this.databases[0].name);
    }

    this.render();
  }

  selectStore(dbName, storeName, indexName = '') {
    this.activeDb = dbName;
    this.activeStore = storeName;
    this.activeIndex = indexName;
    this.expandedDbs.add(dbName);
    this.render();
    if (this.options.onSelectStore) {
      this.options.onSelectStore(dbName, storeName, indexName);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <span class="sidebar-title">Databases</span>
          <span class="sidebar-db-count">${this.databases.length}</span>
        </div>
        <div class="sidebar-search">
          <input type="text" class="sidebar-search-input" placeholder="Filter databases & stores..." value="${this.escapeAttr(this.searchFilter)}" />
        </div>
      </div>

      <div class="sidebar-tree-container">
        ${this.databases.length === 0 ? `
          <div class="sidebar-empty">
            <p>No IndexedDB databases found on this page.</p>
          </div>
        ` : `
          <div class="db-tree-list">
            ${this.renderTreeNodes()}
          </div>
        `}
      </div>
    `;

    // Hook listeners
    const searchInput = this.container.querySelector('.sidebar-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchFilter = e.target.value.toLowerCase().trim();
      this.render();
      // Keep focus on input
      const nextInput = this.container.querySelector('.sidebar-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });

    this.bindTreeEvents();
  }

  renderTreeNodes() {
    let html = '';

    const filter = this.searchFilter;

    this.databases.forEach(db => {
      // Filter logic
      const dbMatches = !filter || db.name.toLowerCase().includes(filter);
      const matchingStores = (db.stores || []).filter(s => !filter || s.name.toLowerCase().includes(filter));

      if (!dbMatches && matchingStores.length === 0) {
        return;
      }

      const isExpanded = this.expandedDbs.has(db.name) || filter.length > 0;
      const isDbActive = this.activeDb === db.name;

      html += `
        <div class="db-tree-node ${isDbActive ? 'db-node-active' : ''}" data-db="${this.escapeAttr(db.name)}">
          <div class="db-header-row">
            <span class="tree-caret ${isExpanded ? 'open' : ''}">
              <svg viewBox="0 0 16 16"><path fill="currentColor" d="M6 4l4 4-4 4z"/></svg>
            </span>
            <span class="db-icon">
              <svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 1c3.866 0 7 1.343 7 3v8c0 1.657-3.134 3-7 3s-7-1.343-7-3V4c0-1.657 3.134-3 7-3zm0 2C4.686 3 2 4.007 2 5.25s2.686 2.25 6 2.25 6-1.007 6-2.25S11.314 3 8 3zm6 3.874c-.93.633-2.316 1.054-3.9 1.258V10.2c1.43-.186 2.688-.57 3.9-1.126V6.874zm-5.9 1.376C6.516 8.054 5.13 7.633 4.2 7V9.074c1.212.556 2.47.94 3.9 1.126V8.25z"/></svg>
            </span>
            <span class="db-name" title="${this.escapeAttr(db.name)}">${this.escapeHtml(db.name)}</span>
            <span class="tree-version">v${db.version}</span>

            <div class="db-hover-actions">
              <button class="btn-icon btn-action-add-store" title="Create Object Store" data-db="${this.escapeAttr(db.name)}">
                <svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/></svg>
              </button>
              <button class="btn-icon btn-action-delete-db text-danger" title="Delete Database" data-db="${this.escapeAttr(db.name)}">
                <svg viewBox="0 0 16 16"><path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill="currentColor" fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
              </button>
            </div>
          </div>

          <div class="db-stores-list" style="display: ${isExpanded ? 'block' : 'none'};">
            ${(db.stores && db.stores.length > 0) ? db.stores.map(store => {
              if (filter && !store.name.toLowerCase().includes(filter) && !dbMatches) return '';

              const isStoreActive = this.activeDb === db.name && this.activeStore === store.name;
              const isStoreExpanded = this.expandedStores.has(`${db.name}/${store.name}`) || filter.length > 0;
              const hasIndexes = store.indexes && store.indexes.length > 0;

              return `
                <div class="store-tree-node ${isStoreActive ? 'store-node-active' : ''}" data-db="${this.escapeAttr(db.name)}" data-store="${this.escapeAttr(store.name)}">
                  <div class="store-header-row">
                    ${hasIndexes ? `
                      <span class="tree-caret-store ${isStoreExpanded ? 'open' : ''}">
                        <svg viewBox="0 0 16 16"><path fill="currentColor" d="M6 4l4 4-4 4z"/></svg>
                      </span>
                    ` : `<span class="tree-indent"></span>`}
                    <span class="store-icon">
                      <svg viewBox="0 0 16 16"><path fill="currentColor" d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>
                    </span>
                    <span class="store-name" title="${this.escapeAttr(store.name)}">${this.escapeHtml(store.name)}</span>
                    <span class="tree-count">${store.count ?? 0}</span>

                    <div class="store-hover-actions">
                      <button class="btn-icon btn-action-add-index" title="Create Index" data-db="${this.escapeAttr(db.name)}" data-store="${this.escapeAttr(store.name)}">
                        <svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/></svg>
                      </button>
                      <button class="btn-icon btn-action-clear-store" title="Clear All Records" data-db="${this.escapeAttr(db.name)}" data-store="${this.escapeAttr(store.name)}">
                        <svg viewBox="0 0 16 16"><path fill="currentColor" d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/></svg>
                      </button>
                      <button class="btn-icon btn-action-delete-store text-danger" title="Delete Store" data-db="${this.escapeAttr(db.name)}" data-store="${this.escapeAttr(store.name)}">
                        <svg viewBox="0 0 16 16"><path fill="currentColor" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                      </button>
                    </div>
                  </div>

                  ${hasIndexes ? `
                    <div class="store-indexes-list" style="display: ${isStoreExpanded ? 'block' : 'none'};">
                      ${store.indexes.map(idx => {
                        const isIndexActive = isStoreActive && this.activeIndex === idx.name;
                        return `
                        <div class="index-tree-node ${isIndexActive ? 'index-node-active' : ''}" data-db="${this.escapeAttr(db.name)}" data-store="${this.escapeAttr(store.name)}" data-index="${this.escapeAttr(idx.name)}">
                          <span class="index-icon">
                            <svg viewBox="0 0 16 16"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/></svg>
                          </span>
                          <span class="index-name" title="${this.escapeAttr(idx.name)} (${this.escapeAttr(idx.keyPath)})">${this.escapeHtml(idx.name)}</span>
                          ${idx.unique ? '<span class="badge badge-unique">UQ</span>' : ''}
                          <button class="btn-icon btn-action-delete-index text-danger" title="Delete Index" data-db="${this.escapeAttr(db.name)}" data-store="${this.escapeAttr(store.name)}" data-index="${this.escapeAttr(idx.name)}">
                            <svg viewBox="0 0 16 16"><path fill="currentColor" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                          </button>
                        </div>
                      `}).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('') : `
              <div class="no-stores-label">No object stores</div>
            `}
          </div>
        </div>
      `;
    });

    return html;
  }

  bindTreeEvents() {
    // Database accordion toggle
    this.container.querySelectorAll('.db-header-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.db-hover-actions')) return;
        const dbNode = row.closest('.db-tree-node');
        const dbName = dbNode.dataset.db;

        if (this.expandedDbs.has(dbName)) {
          this.expandedDbs.delete(dbName);
        } else {
          this.expandedDbs.add(dbName);
        }
        this.render();
      });
    });

    // Store accordion toggle (for index sub-list)
    this.container.querySelectorAll('.tree-caret-store').forEach(caret => {
      caret.addEventListener('click', (e) => {
        e.stopPropagation();
        const storeNode = caret.closest('.store-tree-node');
        const key = `${storeNode.dataset.db}/${storeNode.dataset.store}`;
        if (this.expandedStores.has(key)) {
          this.expandedStores.delete(key);
        } else {
          this.expandedStores.add(key);
        }
        this.render();
      });
    });

    // Store select
    this.container.querySelectorAll('.store-header-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.store-hover-actions') || e.target.closest('.tree-caret-store')) return;
        const storeNode = row.closest('.store-tree-node');
        this.selectStore(storeNode.dataset.db, storeNode.dataset.store, '');
      });
    });

    // Index select
    this.container.querySelectorAll('.index-tree-node').forEach(node => {
      node.addEventListener('click', (e) => {
        if (e.target.closest('.btn-action-delete-index')) return;
        this.selectStore(node.dataset.db, node.dataset.store, node.dataset.index);
      });
    });

    // Database Actions
    this.container.querySelectorAll('.btn-action-add-store').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onCreateStore) this.options.onCreateStore(btn.dataset.db);
      });
    });

    this.container.querySelectorAll('.btn-action-delete-db').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onDeleteDatabase) this.options.onDeleteDatabase(btn.dataset.db);
      });
    });

    // Store Actions
    this.container.querySelectorAll('.btn-action-add-index').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onCreateIndex) this.options.onCreateIndex(btn.dataset.db, btn.dataset.store);
      });
    });

    this.container.querySelectorAll('.btn-action-clear-store').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onClearStore) this.options.onClearStore(btn.dataset.db, btn.dataset.store);
      });
    });

    this.container.querySelectorAll('.btn-action-delete-store').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onDeleteStore) this.options.onDeleteStore(btn.dataset.db, btn.dataset.store);
      });
    });

    // Index Actions
    this.container.querySelectorAll('.btn-action-delete-index').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onDeleteIndex) this.options.onDeleteIndex(btn.dataset.db, btn.dataset.store, btn.dataset.index);
      });
    });
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  escapeAttr(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/"/g, '&quot;');
  }
}
