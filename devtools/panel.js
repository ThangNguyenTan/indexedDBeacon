if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
  globalThis.chrome = globalThis.browser;
}

/**
 * IndexedDBeacon Main Panel Controller
 */
import { bridgeClient } from './bridgeClient.js';
import { themeManager } from './components/theme.js';
import { toast } from './components/toast.js';
import { DatabaseList } from './components/databaseList.js';
import { RecordTable } from './components/recordTable.js';
import { RecordInspector } from './components/recordInspector.js';
import { RecordEditorModal } from './components/recordEditorModal.js';
import { SchemaModal } from './components/schemaModal.js';
import { ImportExportModal } from './components/importExportModal.js';

class PanelController {
  constructor() {
    this.databases = [];
    this.activeDb = null;
    this.activeStore = null;
    this.activeStoreMeta = null;

    // Popout state
    const params = new URLSearchParams(window.location.search);
    this.isPopout = params.get('mode') === 'window';
    this.popoutWindow = null;

    // Layout states with persistence
    this.isSidebarCollapsed = localStorage.getItem('idb_beacon_sidebar_collapsed') === 'true';

    // Query state
    this.currentPage = 1;
    this.pageSize = 50;
    this.totalPages = 1;
    this.selectedIndex = '';
    this.selectedDirection = 'next';
    this.searchQuery = '';
    this.activeRange = null;
    this.isLoadingMore = false;

    // Stale Data Detection (Passive notification, zero polling overhead)
    this.isDataStale = false;
    this.lastDataFetchTime = Date.now();

    // Component instances
    this.dbList = null;
    this.table = null;
    this.inspector = null;
    this.editorModal = null;
    this.schemaModal = null;
    this.importExportModal = null;
  }

  async init() {
    themeManager.init();

    // Apply layout state
    this.applyLayoutState();

    // Setup Components
    this.initModalsAndInspectors();
    this.initResizers();
    this.initGlobalEvents();
    this.initPopoutHandler();
    this.initStaleWatcher();
    this.setupInfiniteScroll();

    // Check page connection
    await this.updatePageConnection();
    await this.loadDatabases();

    // Listen for page navigation/reload to notify user of stale data
    if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.network) {
      chrome.devtools.network.onNavigated.addListener(() => {
        this.markDataStale();
        this.updatePageConnection();
        this.loadDatabases();
      });
    }
  }

  applyLayoutState() {
    this.toggleSidebar(this.isSidebarCollapsed, false);

    const savedTopHeight = localStorage.getItem('idb_beacon_workspace_top_height');
    if (savedTopHeight) {
      const workspaceTop = document.getElementById('workspace-top');
      if (workspaceTop) workspaceTop.style.height = savedTopHeight;
    }

    const savedSidebarWidth = localStorage.getItem('idb_beacon_sidebar_width');
    if (savedSidebarWidth) {
      const sidebarPanel = document.getElementById('sidebar-panel');
      if (sidebarPanel) sidebarPanel.style.width = savedSidebarWidth;
    }
  }

  toggleSidebar(forceState, save = true) {
    if (typeof forceState === 'boolean') {
      this.isSidebarCollapsed = forceState;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    const sidebar = document.getElementById('sidebar-panel');
    const resizer = document.getElementById('sidebar-resizer');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');

    if (this.isSidebarCollapsed) {
      sidebar?.classList.add('sidebar-collapsed');
      resizer?.classList.add('hidden');
      toggleBtn?.classList.add('active');
      if (toggleBtn) toggleBtn.title = 'Show Sidebar (Ctrl+B)';
    } else {
      sidebar?.classList.remove('sidebar-collapsed');
      resizer?.classList.remove('hidden');
      toggleBtn?.classList.remove('active');
      if (toggleBtn) toggleBtn.title = 'Hide Sidebar (Ctrl+B)';
    }

    if (save) {
      localStorage.setItem('idb_beacon_sidebar_collapsed', this.isSidebarCollapsed ? 'true' : 'false');
    }
  }

  initModalsAndInspectors() {
    // Schema modal
    this.schemaModal = new SchemaModal(bridgeClient);

    // Import/Export
    this.importExportModal = new ImportExportModal(bridgeClient);

    // Record Editor modal
    this.editorModal = new RecordEditorModal({
      onSubmit: async ({ key, value, mode, isDuplicate }) => {
        if (mode === 'add') {
          await bridgeClient.addRecord(this.activeDb, this.activeStore, key, value);
        } else {
          await bridgeClient.putRecord(this.activeDb, this.activeStore, key, value);
        }
        toast.success(isDuplicate ? 'Record duplicated successfully' : 'Record saved');
        await this.loadStoreRecords();
      }
    });

    // Inspector (Permanently in Top-Right Pane)
    const inspectorEl = document.getElementById('inspector-panel');

    this.inspector = new RecordInspector({
      onClose: () => {
        this.table?.clearActiveSelection();
      },
      onSave: async (key, updatedVal) => {
        await bridgeClient.putRecord(this.activeDb, this.activeStore, key, updatedVal);
        await this.loadStoreRecords();
      },
      onDelete: async (record) => {
        await bridgeClient.deleteRecord(this.activeDb, this.activeStore, record.key);
        toast.success('Record deleted');
        this.inspector.close();
        await this.loadStoreRecords();
      },
      onDuplicate: (record) => {
        this.handleDuplicateRecord(record);
      }
    });
    this.inspector.mount(inspectorEl);

    // Table
    this.table = new RecordTable({
      onSelectRow: (record) => {
        this.inspector.setRecord(record);
      },
      onEditRow: (record) => {
        this.inspector.setRecord(record);
        this.inspector.activeTab = 'edit';
        this.inspector.updateTabButtons();
        this.inspector.renderTabBody();
      },
      onDeleteRow: async (record) => {
        if (confirm(`Delete record with key: ${JSON.stringify(record.key)}?`)) {
          await bridgeClient.deleteRecord(this.activeDb, this.activeStore, record.key);
          toast.success('Record deleted');
          if (this.inspector.currentRecord && this.inspector.currentRecord.key === record.key) {
            this.inspector.close();
          }
          await this.loadStoreRecords();
        }
      },
      onDuplicateRow: (record) => {
        this.handleDuplicateRecord(record);
      },
      onRequestNextPage: () => {
        this.loadNextPageAppend();
      },
      onSelectionChange: (selectedKeys) => {
        const batchBtn = document.getElementById('btn-batch-delete');
        const countSpan = document.getElementById('batch-delete-count');
        if (selectedKeys.length > 0) {
          batchBtn.style.display = 'inline-flex';
          countSpan.textContent = String(selectedKeys.length);
        } else {
          batchBtn.style.display = 'none';
        }
      }
    });

    // Sidebar Database List (Read & Inspect application DBs)
    const sidebarEl = document.getElementById('sidebar-panel');
    this.dbList = new DatabaseList({
      onSelectStore: (dbName, storeName, indexName) => this.selectStore(dbName, storeName, indexName),
      onCreateStore: (dbName) => this.schemaModal.showCreateStore(dbName, () => this.loadDatabases()),
      onCreateIndex: (dbName, storeName) => this.schemaModal.showCreateIndex(dbName, storeName, () => this.loadDatabases()),
      onDeleteDatabase: (dbName) => this.schemaModal.confirmDeleteDatabase(dbName, () => {
        if (this.activeDb === dbName) {
          this.activeDb = null;
          this.activeStore = null;
          this.showEmptyState();
        }
        this.loadDatabases();
      }),
      onDeleteStore: (dbName, storeName) => this.schemaModal.confirmDeleteStore(dbName, storeName, () => {
        if (this.activeDb === dbName && this.activeStore === storeName) {
          this.activeStore = null;
          this.showEmptyState();
        }
        this.loadDatabases();
      }),
      onDeleteIndex: (dbName, storeName, indexName) => this.schemaModal.confirmDeleteIndex(dbName, storeName, indexName, () => this.loadDatabases()),
      onClearStore: (dbName, storeName) => this.schemaModal.confirmClearStore(dbName, storeName, () => this.loadStoreRecords())
    });
    this.dbList.mount(sidebarEl);
  }

  initGlobalEvents() {
    // Sidebar toggle button
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      themeManager.toggle();
    });

    // Manual Refresh button
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.clearDataStale();
      this.refreshAll();
    });

    // Stale Data Notification Pill in header
    document.getElementById('stale-notify-pill')?.addEventListener('click', () => {
      this.clearDataStale();
      this.refreshAll();
    });

    // Clear Store button in toolbar
    document.getElementById('btn-clear-store')?.addEventListener('click', () => {
      if (!this.activeDb || !this.activeStore) return;
      this.schemaModal.confirmClearStore(this.activeDb, this.activeStore, () => this.loadStoreRecords());
    });

    // View Mode Toggle (Key-Value vs Columns)
    document.getElementById('btn-toggle-viewmode')?.addEventListener('click', () => {
      this.table.toggleViewMode();
      const tableContainer = document.getElementById('table-container');
      if (tableContainer) {
        tableContainer.innerHTML = '';
        tableContainer.appendChild(this.table.render());
      }
    });

    // Store action: Add Record
    document.getElementById('btn-add-record')?.addEventListener('click', () => {
      if (!this.activeStoreMeta) return;
      this.editorModal.open(this.activeStoreMeta);
    });

    // Store action: Export
    document.getElementById('btn-export-store')?.addEventListener('click', () => {
      if (!this.activeDb || !this.activeStore) return;
      this.importExportModal.showExport(
        this.activeDb,
        this.activeStore,
        this.table.records,
        this.activeStoreMeta ? this.activeStoreMeta.count : 0
      );
    });

    // Store action: Import
    document.getElementById('btn-import-store')?.addEventListener('click', () => {
      if (!this.activeDb || !this.activeStore) return;
      this.importExportModal.showImport(this.activeDb, this.activeStore, () => {
        this.loadStoreRecords();
      });
    });

    // Batch Delete
    document.getElementById('btn-batch-delete')?.addEventListener('click', async () => {
      const keys = Array.from(this.table.selectedKeys).map(k => {
        try { return JSON.parse(k); } catch (e) { return k; }
      });
      if (confirm(`Delete ${keys.length} selected records?`)) {
        await bridgeClient.deleteRecords(this.activeDb, this.activeStore, keys);
        toast.success(`Deleted ${keys.length} records`);
        this.table.selectedKeys.clear();
        await this.loadStoreRecords();
      }
    });

    // Query toolbar controls
    const selectIndex = document.getElementById('select-index');
    selectIndex?.addEventListener('change', (e) => {
      this.selectedIndex = e.target.value;
      this.currentPage = 1;
      this.loadStoreRecords();
    });

    // Sort order toggle button (ASC <-> DESC)
    document.getElementById('btn-toggle-sort')?.addEventListener('click', () => {
      this.selectedDirection = this.selectedDirection === 'next' ? 'prev' : 'next';
      const ascIcon = document.getElementById('icon-sort-asc');
      const descIcon = document.getElementById('icon-sort-desc');
      const sortBtn = document.getElementById('btn-toggle-sort');
      if (ascIcon && descIcon) {
        if (this.selectedDirection === 'next') {
          ascIcon.style.display = 'inline';
          descIcon.style.display = 'none';
          if (sortBtn) sortBtn.title = 'Sort: Ascending (click to toggle Descending)';
        } else {
          ascIcon.style.display = 'none';
          descIcon.style.display = 'inline';
          if (sortBtn) sortBtn.title = 'Sort: Descending (click to toggle Ascending)';
        }
      }
      this.currentPage = 1;
      this.loadStoreRecords();
    });

    // Search input with debounce & instant clear button
    const searchInput = document.getElementById('search-records-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    let debounceTimer = null;

    const updateClearBtn = () => {
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchInput && searchInput.value.length > 0 ? 'inline-flex' : 'none';
      }
    };

    searchInput?.addEventListener('input', (e) => {
      updateClearBtn();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.currentPage = 1;
        this.loadStoreRecords();
      }, 250);
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (searchInput.value) {
          searchInput.value = '';
          updateClearBtn();
          this.searchQuery = '';
          this.currentPage = 1;
          this.loadStoreRecords();
        }
        searchInput.blur();
      }
    });

    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        updateClearBtn();
        this.searchQuery = '';
        this.currentPage = 1;
        this.loadStoreRecords();
        searchInput.focus();
      }
    });

    // Key Range drawer toggle
    const rangeToggleBtn = document.getElementById('btn-key-range-toggle');
    const rangeDrawer = document.getElementById('key-range-drawer');
    const rangeDot = document.getElementById('range-active-dot');

    rangeToggleBtn?.addEventListener('click', () => {
      const isVisible = rangeDrawer.style.display !== 'none';
      rangeDrawer.style.display = isVisible ? 'none' : 'block';
    });

    // Range type select
    const rangeTypeSelect = document.getElementById('select-range-type');
    const valField = document.getElementById('range-val-field');
    const lowerField = document.getElementById('range-lower-field');
    const upperField = document.getElementById('range-upper-field');

    rangeTypeSelect?.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'only') {
        valField.style.display = 'flex';
        lowerField.style.display = 'none';
        upperField.style.display = 'none';
      } else if (type === 'lower') {
        valField.style.display = 'none';
        lowerField.style.display = 'flex';
        upperField.style.display = 'none';
      } else if (type === 'upper') {
        valField.style.display = 'none';
        lowerField.style.display = 'none';
        upperField.style.display = 'flex';
      } else if (type === 'bound') {
        valField.style.display = 'none';
        lowerField.style.display = 'flex';
        upperField.style.display = 'flex';
      } else {
        valField.style.display = 'none';
        lowerField.style.display = 'none';
        upperField.style.display = 'none';
      }
    });

    // Apply Range
    document.getElementById('btn-apply-range')?.addEventListener('click', () => {
      const type = rangeTypeSelect.value;
      if (type === 'none') {
        this.activeRange = null;
        rangeDot.style.display = 'none';
      } else if (type === 'only') {
        const val = this.parseKeyInputValue(document.getElementById('range-val-input').value);
        this.activeRange = { type: 'only', value: val };
        rangeDot.style.display = 'inline';
      } else if (type === 'lower') {
        const lower = this.parseKeyInputValue(document.getElementById('range-lower-input').value);
        this.activeRange = { type: 'lower', lower };
        rangeDot.style.display = 'inline';
      } else if (type === 'upper') {
        const upper = this.parseKeyInputValue(document.getElementById('range-upper-input').value);
        this.activeRange = { type: 'upper', upper };
        rangeDot.style.display = 'inline';
      } else if (type === 'bound') {
        const lower = this.parseKeyInputValue(document.getElementById('range-lower-input').value);
        const upper = this.parseKeyInputValue(document.getElementById('range-upper-input').value);
        this.activeRange = { type: 'bound', lower, upper };
        rangeDot.style.display = 'inline';
      }
      this.currentPage = 1;
      this.loadStoreRecords();
    });

    // Reset Range
    document.getElementById('btn-clear-range')?.addEventListener('click', () => {
      rangeTypeSelect.value = 'none';
      rangeTypeSelect.dispatchEvent(new Event('change'));
      this.activeRange = null;
      rangeDot.style.display = 'none';
      this.currentPage = 1;
      this.loadStoreRecords();
    });

    // Keyboard Shortcuts & Table Navigation
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || activeEl?.isContentEditable;

      // Ctrl+R inside panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.refreshAll();
        return;
      }
      // Ctrl+F focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchBox = document.getElementById('search-records-input');
        if (searchBox) {
          searchBox.focus();
          searchBox.select();
        }
        return;
      }
      // Ctrl+B / Cmd+B toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.toggleSidebar();
        return;
      }

      // If user is currently typing in an input field or a modal dialog is open, do not handle table arrow keys
      if (isInput || document.querySelector('.modal-backdrop')) {
        return;
      }

      // Arrow navigation for records table (native DevTools feel)
      if (this.activeStore && this.table && this.table.records.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.table.selectNextRow();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.table.selectPrevRow();
        } else if (e.key === 'Home') {
          e.preventDefault();
          this.table.selectFirstRow();
        } else if (e.key === 'End') {
          e.preventDefault();
          this.table.selectLastRow();
        } else if (e.key === 'Delete') {
          if (this.table.activeRecord) {
            e.preventDefault();
            this.confirmDeleteActiveRecord();
          }
        }
      }
    });
  }

  parseKeyInputValue(raw) {
    const trimmed = raw.trim();
    if (!isNaN(Number(trimmed)) && trimmed !== '') {
      return Number(trimmed);
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return trimmed;
    }
  }

  initResizers() {
    // Left Sidebar Resizer (Column resize)
    const sidebarResizer = document.getElementById('sidebar-resizer');
    const sidebarPanel = document.getElementById('sidebar-panel');
    let isResizingSidebar = false;

    sidebarResizer?.addEventListener('mousedown', () => {
      isResizingSidebar = true;
      sidebarResizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    // Middle Workspace Resizer (Row resize between Top & Bottom)
    const workspaceResizer = document.getElementById('workspace-resizer');
    const workspaceTop = document.getElementById('workspace-top');
    let isResizingWorkspace = false;

    workspaceResizer?.addEventListener('mousedown', () => {
      isResizingWorkspace = true;
      workspaceResizer.classList.add('resizing');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(160, Math.min(500, e.clientX));
        sidebarPanel.style.width = `${newWidth}px`;
        localStorage.setItem('idb_beacon_sidebar_width', `${newWidth}px`);
      }
      if (isResizingWorkspace) {
        const mainEl = document.getElementById('app-main');
        const mainRect = mainEl?.getBoundingClientRect();
        const topOffset = mainRect ? mainRect.top : 26;
        const newHeight = Math.max(100, Math.min(window.innerHeight - 150, e.clientY - topOffset));
        workspaceTop.style.height = `${newHeight}px`;
        localStorage.setItem('idb_beacon_workspace_top_height', `${newHeight}px`);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isResizingSidebar) {
        isResizingSidebar = false;
        sidebarResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (isResizingWorkspace) {
        isResizingWorkspace = false;
        workspaceResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  initPopoutHandler() {
    const popoutBtn = document.getElementById('btn-popout');
    const popoutText = document.getElementById('popout-btn-text');

    if (this.isPopout) {
      document.title = 'IndexedDBeacon - Detached Window';
      if (popoutText) popoutText.textContent = 'Dock Back';
      if (popoutBtn) {
        popoutBtn.title = 'Close window and return to DevTools panel';
        popoutBtn.addEventListener('click', () => {
          window.close();
        });
      }
      return;
    }

    popoutBtn?.addEventListener('click', () => {
      this.openPopoutWindow();
    });

    document.getElementById('btn-focus-popout')?.addEventListener('click', () => {
      if (this.popoutWindow && !this.popoutWindow.closed) {
        this.popoutWindow.focus();
      }
    });

    document.getElementById('btn-dock-back')?.addEventListener('click', () => {
      if (this.popoutWindow && !this.popoutWindow.closed) {
        this.popoutWindow.close();
      }
      this.popoutWindow = null;
      this.showPopoutOverlay(false);
      this.refreshAll();
    });
  }

  openPopoutWindow() {
    if (this.popoutWindow && !this.popoutWindow.closed) {
      this.popoutWindow.focus();
      return;
    }

    const width = 1120;
    const height = 740;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));

    const popout = window.open(
      'panel.html?mode=window',
      'IndexedDBeacon_Popout',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (!popout || popout.closed || typeof popout.closed === 'undefined') {
      toast.warning('Popout was blocked. Please allow popups for DevTools.');
      return;
    }

    this.popoutWindow = popout;
    this.showPopoutOverlay(true);

    const checkInterval = setInterval(() => {
      if (!this.popoutWindow || this.popoutWindow.closed) {
        clearInterval(checkInterval);
        this.popoutWindow = null;
        this.showPopoutOverlay(false);
        this.refreshAll();
      }
    }, 600);
  }

  showPopoutOverlay(visible) {
    const overlay = document.getElementById('popout-active-overlay');
    if (overlay) {
      overlay.style.display = visible ? 'flex' : 'none';
    }
  }

  async updatePageConnection() {
    try {
      const ping = await bridgeClient.ping();
      const originEl = document.getElementById('target-origin');
      if (originEl) {
        originEl.textContent = ping.origin || 'Active Page';
        originEl.title = `${ping.title} (${ping.href})`;
      }

      if (this.isPopout) {
        document.title = `IndexedDBeacon - ${ping.origin || ping.title || 'Standalone'}`;
      }

      // Storage estimate
      const est = await bridgeClient.getStorageEstimate();
      const storageText = document.getElementById('storage-usage-text');
      if (storageText && est.usage) {
        const mbUsed = (est.usage / (1024 * 1024)).toFixed(1);
        storageText.textContent = `Usage: ${mbUsed} MB (${est.percent}%)`;
      }
    } catch (e) {
      console.warn('Page connection ping:', e);
      const originEl = document.getElementById('target-origin');
      if (originEl) originEl.textContent = 'Inspected Page';
    }
  }

  async loadDatabases() {
    try {
      const basicList = await bridgeClient.listDatabases();
      const detailed = [];

      for (const item of basicList) {
        try {
          const detail = await bridgeClient.getDatabaseDetails(item.name);
          detailed.push(detail);
        } catch (detailErr) {
          detailed.push({ name: item.name, version: item.version, stores: [] });
        }
      }

      this.databases = detailed;
      this.dbList.setDatabases(detailed);

      // If active store is still present, refresh it
      if (this.activeDb && this.activeStore) {
        const dbStillExists = this.databases.find(d => d.name === this.activeDb);
        const storeStillExists = dbStillExists?.stores?.find(s => s.name === this.activeStore);
        if (storeStillExists) {
          this.activeStoreMeta = storeStillExists;
          await this.loadStoreRecords();
        } else {
          this.showEmptyState();
        }
      }
    } catch (e) {
      toast.error('Failed to load databases: ' + e.message);
    }
  }

  async selectStore(dbName, storeName, indexName = '') {
    this.activeDb = dbName;
    this.activeStore = storeName;
    this.selectedIndex = indexName || '';

    const db = this.databases.find(d => d.name === dbName);
    const store = db?.stores?.find(s => s.name === storeName);
    this.activeStoreMeta = store || null;

    // Reset pagination & filters
    this.currentPage = 1;
    this.searchQuery = '';
    this.activeRange = null;

    const searchInput = document.getElementById('search-records-input');
    if (searchInput) searchInput.value = '';
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';

    // Populate indexes dropdown
    const selectIndex = document.getElementById('select-index');
    if (selectIndex) {
      selectIndex.innerHTML = `<option value="">(Primary Key)</option>`;
      if (store && store.indexes) {
        store.indexes.forEach(idx => {
          const opt = document.createElement('option');
          opt.value = idx.name;
          opt.textContent = `${idx.name} [${idx.keyPath}]${idx.unique ? ' (UQ)' : ''}`;
          selectIndex.appendChild(opt);
        });
      }
      selectIndex.value = this.selectedIndex;
    }

    // Show store view
    document.getElementById('content-empty-view').style.display = 'none';
    document.getElementById('store-view').style.display = 'flex';

    // Update Header badges & breadcrumbs
    const headerStoreBadge = document.getElementById('header-store-badge');
    if (headerStoreBadge) headerStoreBadge.style.display = 'inline-flex';

    const crumbDb = document.getElementById('crumb-db-name');
    if (crumbDb) crumbDb.textContent = dbName;
    const crumbStore = document.getElementById('crumb-store-name');
    if (crumbStore) crumbStore.textContent = storeName;

    // Update status footer meta
    const statusMeta = document.getElementById('status-meta-info');
    if (statusMeta && store) {
      const kpText = store.keyPath ? `KeyPath: ${store.keyPath}` : 'Out-of-line Key';
      const autoIncText = store.autoIncrement ? 'AutoIncrement: true' : 'AutoIncrement: false';
      statusMeta.textContent = `${kpText} · ${autoIncText}`;
    }

    // Update View Mode label
    const viewModeLabel = document.getElementById('viewmode-label');
    if (viewModeLabel) {
      viewModeLabel.textContent = this.table.viewMode === 'kv' ? 'Mode: Key-Value' : 'Mode: Columns';
    }

    await this.loadStoreRecords();
  }

  initStaleWatcher() {
    // Check when window regains focus
    window.addEventListener('focus', () => {
      this.checkStaleState();
    });

    // Check periodically without polling data: only read single mutation timestamp
    this.staleCheckTimer = setInterval(() => {
      this.checkStaleState();
    }, 4000);
  }

  async checkStaleState() {
    if (this.isDataStale || !this.activeDb || !this.activeStore) return;
    try {
      const lastMutation = await bridgeClient.getLastMutation();
      if (lastMutation && lastMutation > this.lastDataFetchTime) {
        this.markDataStale();
      }
    } catch (e) {
      // Quiet fail if inspected page is unreachable
    }
  }

  markDataStale() {
    this.isDataStale = true;
    const stalePill = document.getElementById('stale-notify-pill');
    if (stalePill) stalePill.style.display = 'inline-flex';
    const staleDot = document.getElementById('refresh-stale-dot');
    if (staleDot) staleDot.style.display = 'block';
  }

  clearDataStale() {
    this.isDataStale = false;
    this.lastDataFetchTime = Date.now();
    const stalePill = document.getElementById('stale-notify-pill');
    if (stalePill) stalePill.style.display = 'none';
    const staleDot = document.getElementById('refresh-stale-dot');
    if (staleDot) staleDot.style.display = 'none';
  }

  setupInfiniteScroll() {
    const tableContainer = document.getElementById('table-container');
    if (!tableContainer) return;

    tableContainer.addEventListener('scroll', () => {
      if (this.isLoadingMore) return;
      if (this.currentPage >= this.totalPages) return;

      const { scrollTop, scrollHeight, clientHeight } = tableContainer;
      // When user scrolls within 60px of the bottom, fetch next batch
      if (scrollTop + clientHeight >= scrollHeight - 60) {
        this.loadNextPageAppend();
      }
    });
  }

  async loadNextPageAppend() {
    if (this.isLoadingMore || this.currentPage >= this.totalPages) return;
    this.isLoadingMore = true;

    try {
      const nextPage = this.currentPage + 1;
      const resp = await bridgeClient.getRecords({
        dbName: this.activeDb,
        storeName: this.activeStore,
        indexName: this.selectedIndex || null,
        direction: this.selectedDirection,
        range: this.activeRange,
        page: nextPage,
        pageSize: this.pageSize,
        search: this.searchQuery
      });

      if (resp && resp.records && resp.records.length > 0) {
        this.currentPage = nextPage;
        this.table.appendRecords(resp.records);
        this.updatePaginationUI(resp.totalCount);
      }
    } catch (err) {
      console.warn('Infinite scroll fetch error:', err);
    } finally {
      this.isLoadingMore = false;
    }
  }

  async loadStoreRecords() {
    if (!this.activeDb || !this.activeStore) return;

    this.clearDataStale();
    this.currentPage = 1;

    const tableContainer = document.getElementById('table-container');
    tableContainer.scrollTop = 0;
    tableContainer.innerHTML = `<div class="output-loading" style="padding: 40px; text-align: center;"><div class="spinner"></div> Loading records...</div>`;

    try {
      const resp = await bridgeClient.getRecords({
        dbName: this.activeDb,
        storeName: this.activeStore,
        indexName: this.selectedIndex || null,
        direction: this.selectedDirection,
        range: this.activeRange,
        page: this.currentPage,
        pageSize: this.pageSize,
        search: this.searchQuery
      });

      this.totalPages = Math.max(1, Math.ceil(resp.totalCount / this.pageSize));
      const isIndex = !!this.selectedIndex;
      this.table.setRecords(resp.records, isIndex);

      tableContainer.innerHTML = '';
      const tableWrapper = this.table.render();
      tableContainer.appendChild(tableWrapper);

      // Auto-select first record so the top-right inspector immediately shows it
      if (resp.records.length > 0) {
        this.table.selectFirstRow(tableWrapper);
      } else {
        this.inspector.setRecord(null);
      }

      // Update Pagination & status
      this.updatePaginationUI(resp.totalCount);
    } catch (err) {
      tableContainer.innerHTML = `
        <div class="output-error-banner" style="margin: 20px;">
          <strong>Failed to load records:</strong> ${this.escapeHtml(err.message)}
        </div>
      `;
      toast.error('Query error: ' + err.message);
    }
  }

  updatePaginationUI(totalCount) {
    this.totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
    const loadedCount = this.table ? this.table.records.length : 0;

    const info = document.getElementById('pagination-info');
    if (info) {
      if (totalCount === 0) {
        info.textContent = '0 records';
      } else if (loadedCount >= totalCount) {
        info.textContent = `${totalCount} records`;
      } else {
        info.textContent = `Loaded ${loadedCount} of ${totalCount} records`;
      }
    }

    const countBadge = document.getElementById('badge-record-count');
    if (countBadge) {
      if (totalCount === 0) {
        countBadge.textContent = '0 records';
      } else if (loadedCount >= totalCount) {
        countBadge.textContent = `${totalCount} records`;
      } else {
        countBadge.textContent = `${loadedCount} / ${totalCount} records`;
      }
    }
  }

  showEmptyState() {
    document.getElementById('content-empty-view').style.display = 'flex';
    document.getElementById('store-view').style.display = 'none';
    const headerStoreBadge = document.getElementById('header-store-badge');
    if (headerStoreBadge) headerStoreBadge.style.display = 'none';
    this.inspector.setRecord(null);
  }

  async refreshAll() {
    await this.updatePageConnection();
    await this.loadDatabases();
    if (this.activeDb && this.activeStore) {
      await this.loadStoreRecords();
    }
    toast.info('Refreshed');
  }

  handleDuplicateRecord(record) {
    if (!this.activeStoreMeta || !record) return;
    this.editorModal.open(this.activeStoreMeta, record, 'duplicate');
  }

  async confirmDeleteActiveRecord() {
    const record = this.table?.activeRecord;
    if (!record || !this.activeDb || !this.activeStore) return;
    const keyStr = typeof record.key === 'object' ? JSON.stringify(record.key) : String(record.key);
    if (confirm(`Delete record with key: ${keyStr}?`)) {
      await bridgeClient.deleteRecord(this.activeDb, this.activeStore, record.key);
      toast.success('Record deleted');
      if (this.inspector.currentRecord && this.inspector.currentRecord.key === record.key) {
        this.inspector.close();
      }
      await this.loadStoreRecords();
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Boot panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PanelController();
  controller.init();
});
