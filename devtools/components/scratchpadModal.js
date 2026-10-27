/**
 * Interactive JS Scratchpad / Query Console
 */
import { TreeView } from './treeView.js';
import { toast } from './toast.js';

export class ScratchpadModal {
  constructor(bridge) {
    this.bridge = bridge;
    this.modalEl = null;
    this.activeDb = null;
    this.activeStore = null;
  }

  open(dbName, storeName) {
    this.activeDb = dbName;
    this.activeStore = storeName;
    this.render();
  }

  close() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }

  render() {
    this.close();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    const defaultCode = `// Available in scope:
// - store: IDBObjectStore instance
// - db: IDBDatabase instance
// - helpers: async { getAll(), get(k), put(v, k?), add(v, k?), delete(k), count(), clear(), log(...) }
// - window.indexedDB, window.IDBKeyRange

const records = await helpers.getAll();
helpers.log('Total fetched records:', records.length);

return records.slice(0, 10);`;

    modal.innerHTML = `
      <div class="modal-dialog modal-xl scratchpad-dialog animate-scale-up">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>IndexedDB Scratchpad / Console</h3>
            <span class="modal-subtitle">
              Database: <strong>${this.escapeHtml(this.activeDb)}</strong> &bull; Store: <strong>${this.escapeHtml(this.activeStore)}</strong>
            </span>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="modal-body scratchpad-body">
          <div class="scratchpad-editor-pane">
            <div class="scratchpad-toolbar">
              <div class="snippet-selector-group">
                <label>Snippets:</label>
                <select class="form-select select-snippet">
                  <option value="">-- Choose a template --</option>
                  <option value="getAll">Get all records</option>
                  <option value="filter">Filter records by property</option>
                  <option value="batchUpdate">Batch update field on records</option>
                  <option value="insertMock">Insert 5 test records</option>
                  <option value="count">Count records</option>
                </select>
              </div>
              <div class="scratchpad-run-group">
                <span class="shortcut-hint">Ctrl+Enter to run</span>
                <button type="button" class="btn btn-primary btn-sm btn-run-script">
                  <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>
                  Run Script
                </button>
              </div>
            </div>
            <textarea class="scratchpad-textarea code-textarea" spellcheck="false">${defaultCode}</textarea>
          </div>

          <div class="scratchpad-output-pane">
            <div class="output-header">
              <div class="output-tabs">
                <button type="button" class="tab-btn active" data-tab="result">Result</button>
                <button type="button" class="tab-btn" data-tab="logs">Logs <span class="badge badge-count badge-logs-count">0</span></button>
              </div>
              <div class="output-meta">
                <span class="execution-time-badge" style="display:none;"></span>
                <button type="button" class="btn-xs btn-secondary btn-copy-result" title="Copy result to clipboard">Copy</button>
                <button type="button" class="btn-xs btn-secondary btn-clear-output" title="Clear output">Clear</button>
              </div>
            </div>
            <div class="output-content" id="scratchpad-output-content">
              <div class="output-placeholder">Run a script above to see output here.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Elements
    const closeBtn = modal.querySelector('.modal-close-btn');
    const textarea = modal.querySelector('.scratchpad-textarea');
    const runBtn = modal.querySelector('.btn-run-script');
    const snippetSelect = modal.querySelector('.select-snippet');
    const outputContainer = modal.querySelector('#scratchpad-output-content');
    const execTimeBadge = modal.querySelector('.execution-time-badge');
    const copyResultBtn = modal.querySelector('.btn-copy-result');
    const clearOutputBtn = modal.querySelector('.btn-clear-output');
    const logsBadge = modal.querySelector('.badge-logs-count');
    const tabBtns = modal.querySelectorAll('.output-tabs .tab-btn');

    let currentResultData = null;
    let currentLogs = [];
    let activeTab = 'result';

    // Close logic
    closeBtn.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Snippets
    snippetSelect.addEventListener('change', () => {
      const val = snippetSelect.value;
      if (val === 'getAll') {
        textarea.value = `const all = await helpers.getAll();\nhelpers.log('Retrieved ' + all.length + ' items');\nreturn all;`;
      } else if (val === 'filter') {
        textarea.value = `const all = await helpers.getAll();\n// Filter items by condition:\nconst filtered = all.filter(item => item && (item.active || item.price > 50));\nhelpers.log('Found ' + filtered.length + ' matches');\nreturn filtered;`;
      } else if (val === 'batchUpdate') {
        textarea.value = `const all = await helpers.getAll();\nlet updated = 0;\nfor (const item of all) {\n  if (item && typeof item === 'object') {\n    item.lastAudited = new Date().toISOString();\n    await helpers.put(item);\n    updated++;\n  }\n}\nhelpers.log('Updated ' + updated + ' records');\nreturn { updatedCount: updated };`;
      } else if (val === 'insertMock') {
        textarea.value = `const items = [];\nfor (let i = 1; i <= 5; i++) {\n  const doc = {\n    name: 'Item #' + i,\n    score: Math.floor(Math.random() * 100),\n    timestamp: new Date().toISOString()\n  };\n  await helpers.put(doc);\n  items.push(doc);\n}\nhelpers.log('Inserted ' + items.length + ' mock items');\nreturn items;`;
      } else if (val === 'count') {
        textarea.value = `const total = await helpers.count();\nhelpers.log('Count:', total);\nreturn { count: total };`;
      }
    });

    // Output tab switcher
    const renderOutputTab = () => {
      tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
      outputContainer.innerHTML = '';

      if (activeTab === 'result') {
        if (currentResultData === null) {
          outputContainer.innerHTML = `<div class="output-placeholder">No result yet. Click "Run Script" to execute.</div>`;
        } else {
          const tree = new TreeView(currentResultData, { expandedDepth: 3 });
          outputContainer.appendChild(tree.render());
        }
      } else if (activeTab === 'logs') {
        if (currentLogs.length === 0) {
          outputContainer.innerHTML = `<div class="output-placeholder">No console logs recorded. Use <code>helpers.log(...)</code> in your code.</div>`;
        } else {
          const logList = document.createElement('div');
          logList.className = 'logs-list';
          currentLogs.forEach(entry => {
            const line = document.createElement('div');
            line.className = 'log-line';
            line.textContent = entry;
            logList.appendChild(line);
          });
          outputContainer.appendChild(logList);
        }
      }
    };

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        renderOutputTab();
      });
    });

    clearOutputBtn.addEventListener('click', () => {
      currentResultData = null;
      currentLogs = [];
      logsBadge.textContent = '0';
      execTimeBadge.style.display = 'none';
      renderOutputTab();
    });

    copyResultBtn.addEventListener('click', () => {
      if (currentResultData !== null) {
        navigator.clipboard.writeText(JSON.stringify(currentResultData, null, 2));
        toast.success('Result copied to clipboard');
      } else {
        toast.info('No result to copy');
      }
    });

    // Run execution
    const execute = async () => {
      const code = textarea.value.trim();
      if (!code) {
        toast.warning('Please enter some JavaScript code to execute');
        return;
      }

      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      outputContainer.innerHTML = `<div class="output-loading"><div class="spinner"></div> Executing script...</div>`;

      try {
        const resp = await this.bridge.executeScript(this.activeDb, this.activeStore, code);
        currentResultData = resp.result;
        currentLogs = resp.logs || [];
        logsBadge.textContent = String(currentLogs.length);

        execTimeBadge.textContent = `${resp.durationMs}ms`;
        execTimeBadge.style.display = 'inline-block';

        renderOutputTab();
        toast.success(`Script completed in ${resp.durationMs}ms`);
      } catch (err) {
        outputContainer.innerHTML = `
          <div class="output-error-banner">
            <strong>Script Error:</strong>
            <pre>${this.escapeHtml(err.message)}</pre>
          </div>
        `;
        toast.error('Script execution error: ' + err.message);
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = `
          <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>
          Run Script
        `;
      }
    };

    runBtn.addEventListener('click', execute);

    // Keyboard shortcut inside textarea: Ctrl+Enter / Cmd+Enter
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        execute();
      }
      // Support Tab key for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
    });

    document.body.appendChild(modal);
    this.modalEl = modal;
    textarea.focus();
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
