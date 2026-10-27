/**
 * Record Inspector Component
 * Displays detailed record view, JSON tree, raw editor, and media preview.
 */
import { TreeView } from './treeView.js';
import { toast } from './toast.js';

export class RecordInspector {
  constructor(options = {}) {
    this.options = {
      onSave: options.onSave ?? null,
      onDelete: options.onDelete ?? null,
      onDuplicate: options.onDuplicate ?? null,
      onClose: options.onClose ?? null,
      ...options
    };
    this.currentRecord = null;
    this.activeTab = 'tree'; // 'tree' | 'raw' | 'media' | 'edit'
    this.container = null;
  }

  setRecord(record) {
    this.currentRecord = record;
    this.renderContent();
  }

  close() {
    this.currentRecord = null;
    this.renderContent();
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  mount(el) {
    this.container = el;
    this.container.classList.add('record-inspector');
    this.renderContent();
  }

  renderContent() {
    if (!this.container) return;

    if (!this.currentRecord) {
      this.container.innerHTML = `
        <div class="inspector-empty">
          <svg viewBox="0 0 16 16" width="30" height="30" fill="currentColor" style="opacity: 0.35; margin-bottom: 8px;">
            <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
            <path d="M3 4.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
          </svg>
          <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px; color: var(--text-secondary);">No Record Selected</div>
          <p style="margin: 0; font-size: 11px; max-width: 260px; line-height: 1.4;">Select a record from the table below to inspect its JSON structure and properties.</p>
        </div>
      `;
      return;
    }

    const keyStr = typeof this.currentRecord.key === 'object'
      ? JSON.stringify(this.currentRecord.key)
      : String(this.currentRecord.key);

    const hasBlobs = this.checkForBlobs(this.currentRecord.value);

    this.container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title-group">
          <span class="inspector-badge">Record</span>
          <span class="inspector-key-title" title="${this.escapeAttr(keyStr)}">${this.escapeHtml(keyStr)}</span>
        </div>
        <div class="inspector-actions">
          <button class="header-icon-btn" id="insp-btn-copy" title="Copy JSON">
            <svg viewBox="0 0 16 16" width="13" height="13"><path fill="currentColor" d="M10 2H4a2 2 0 00-2 2v8h2V4h6V2zm2 3H7a2 2 0 00-2 2v7a2 2 0 002 2h5a2 2 0 002-2V7a2 2 0 00-2-2zm0 9H7V7h5v7z"/></svg>
          </button>
          <button class="header-icon-btn" id="insp-btn-duplicate" title="Duplicate Record">
            <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/></svg>
          </button>
          <button class="header-icon-btn" id="insp-btn-edit" title="Edit in Record Editor">
            <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/></svg>
          </button>
          <button class="header-icon-btn btn-danger-icon" id="insp-btn-delete" title="Delete record">
            <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill="currentColor" fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
          </button>
          <button class="header-icon-btn" id="insp-btn-close" title="Clear selection">
            <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
          </button>
        </div>
      </div>

      <div class="inspector-tabs">
        <button class="tab-btn ${this.activeTab === 'tree' ? 'active' : ''}" data-tab="tree">Tree</button>
        <button class="tab-btn ${this.activeTab === 'raw' ? 'active' : ''}" data-tab="raw">JSON</button>
        ${hasBlobs ? `<button class="tab-btn ${this.activeTab === 'media' ? 'active' : ''}" data-tab="media">Media</button>` : ''}
        <button class="tab-btn ${this.activeTab === 'edit' ? 'active' : ''}" data-tab="edit">Editor</button>
      </div>

      <div class="inspector-body" id="inspector-body-content"></div>
    `;

    // Hook listeners
    this.container.querySelector('#insp-btn-close').addEventListener('click', () => this.close());

    this.container.querySelector('#insp-btn-copy').addEventListener('click', () => {
      const jsonStr = JSON.stringify(this.currentRecord.value, null, 2);
      navigator.clipboard.writeText(jsonStr);
      toast.success('Record copied to clipboard');
    });

    this.container.querySelector('#insp-btn-duplicate')?.addEventListener('click', () => {
      if (this.options.onDuplicate) {
        this.options.onDuplicate(this.currentRecord);
      }
    });

    this.container.querySelector('#insp-btn-edit').addEventListener('click', () => {
      this.activeTab = 'edit';
      this.updateTabButtons();
      this.renderTabBody();
    });

    this.container.querySelector('#insp-btn-delete').addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete this record?\nKey: ${keyStr}`)) {
        if (this.options.onDelete) {
          this.options.onDelete(this.currentRecord);
        }
      }
    });

    this.container.querySelectorAll('.inspector-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.target.dataset.tab;
        this.updateTabButtons();
        this.renderTabBody();
      });
    });

    this.renderTabBody();
  }

  updateTabButtons() {
    this.container.querySelectorAll('.inspector-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
    });
  }

  renderTabBody() {
    const body = this.container.querySelector('#inspector-body-content');
    if (!body) return;
    body.innerHTML = '';

    if (this.activeTab === 'tree') {
      const tree = new TreeView(this.currentRecord.value, { expandedDepth: 3 });
      body.appendChild(tree.render());
    } else if (this.activeTab === 'raw') {
      const pre = document.createElement('pre');
      pre.className = 'raw-json-viewer';
      pre.textContent = JSON.stringify(this.currentRecord.value, null, 2);
      body.appendChild(pre);
    } else if (this.activeTab === 'media') {
      body.appendChild(this.renderMediaView(this.currentRecord.value));
    } else if (this.activeTab === 'edit') {
      body.appendChild(this.renderEditorView());
    }
  }

  renderEditorView() {
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-wrapper';

    const formattedJson = JSON.stringify(this.currentRecord.value, null, 2);

    wrapper.innerHTML = `
      <div class="editor-toolbar">
        <button class="btn-xs btn-secondary" id="editor-prettify">Prettify JSON</button>
        <span class="editor-status" id="editor-status">Valid JSON</span>
        <div class="editor-buttons-right">
          <button class="btn-xs btn-secondary" id="editor-cancel">Cancel</button>
          <button class="btn-xs btn-primary" id="editor-save">Save Changes</button>
        </div>
      </div>
      <textarea class="editor-textarea" id="record-json-input" spellcheck="false">${this.escapeHtml(formattedJson)}</textarea>
    `;

    const textarea = wrapper.querySelector('#record-json-input');
    const statusEl = wrapper.querySelector('#editor-status');
    const btnSave = wrapper.querySelector('#editor-save');
    const btnPrettify = wrapper.querySelector('#editor-prettify');
    const btnCancel = wrapper.querySelector('#editor-cancel');

    const validate = () => {
      try {
        JSON.parse(textarea.value);
        statusEl.textContent = 'Valid JSON';
        statusEl.className = 'editor-status status-valid';
        btnSave.disabled = false;
        return true;
      } catch (err) {
        statusEl.textContent = 'Syntax Error: ' + err.message;
        statusEl.className = 'editor-status status-error';
        btnSave.disabled = true;
        return false;
      }
    };

    textarea.addEventListener('input', validate);

    btnPrettify.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        validate();
      } catch (err) {
        toast.error('Cannot format invalid JSON: ' + err.message);
      }
    });

    btnCancel.addEventListener('click', () => {
      this.activeTab = 'tree';
      this.updateTabButtons();
      this.renderTabBody();
    });

    btnSave.addEventListener('click', async () => {
      if (!validate()) return;
      try {
        const updatedValue = JSON.parse(textarea.value);
        if (this.options.onSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Saving...';
          await this.options.onSave(this.currentRecord.key, updatedValue);
          this.currentRecord.value = updatedValue;
          this.activeTab = 'tree';
          this.updateTabButtons();
          this.renderTabBody();
          toast.success('Record saved successfully');
        }
      } catch (e) {
        toast.error('Failed to save record: ' + e.message);
        btnSave.disabled = false;
        btnSave.textContent = 'Save Changes';
      }
    });

    // Handle Ctrl+Enter / Cmd+Enter inside textarea
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        btnSave.click();
      }
    });

    return wrapper;
  }

  renderMediaView(obj) {
    const wrapper = document.createElement('div');
    wrapper.className = 'media-viewer-list';

    const blobs = [];
    this.extractBlobs(obj, '', blobs);

    if (blobs.length === 0) {
      wrapper.innerHTML = `<p class="text-muted">No media or Blob items found in this record.</p>`;
      return wrapper;
    }

    blobs.forEach(({ path, blob }) => {
      const card = document.createElement('div');
      card.className = 'media-card';

      const isImage = blob.mime?.startsWith('image/') || blob.mime === 'image/svg+xml';
      const isAudio = blob.mime?.startsWith('audio/');
      const sizeKb = (blob.size / 1024).toFixed(1);

      card.innerHTML = `
        <div class="media-card-header">
          <span class="media-path">${this.escapeHtml(path)}</span>
          <span class="media-type-badge">${this.escapeHtml(blob.mime || 'application/octet-stream')} (${sizeKb} KB)</span>
        </div>
        <div class="media-card-preview">
          ${isImage && blob.dataUrl ? `<img src="${blob.dataUrl}" alt="${blob.name || 'Preview'}" class="media-preview-img"/>` : ''}
          ${isAudio && blob.dataUrl ? `<audio controls src="${blob.dataUrl}" class="media-preview-audio"></audio>` : ''}
          ${!isImage && !isAudio ? `<div class="media-binary-icon"><svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div>` : ''}
        </div>
        <div class="media-card-footer">
          <button class="btn-xs btn-secondary btn-download-media">
            Download File
          </button>
        </div>
      `;

      card.querySelector('.btn-download-media').addEventListener('click', () => {
        if (blob.dataUrl) {
          const a = document.createElement('a');
          a.href = blob.dataUrl;
          a.download = blob.name || `blob_${Date.now()}.${this.getExtensionFromMime(blob.mime)}`;
          a.click();
        } else {
          toast.warning('Full file content not loaded for download');
        }
      });

      wrapper.appendChild(card);
    });

    return wrapper;
  }

  extractBlobs(val, path, results) {
    if (!val || typeof val !== 'object') return;

    if (val.__idb_type === 'Blob') {
      results.push({ path: path || 'value', blob: val });
      return;
    }

    if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        this.extractBlobs(item, `${path}[${idx}]`, results);
      });
    } else {
      Object.keys(val).forEach(k => {
        const nextPath = path ? `${path}.${k}` : k;
        this.extractBlobs(val[k], nextPath, results);
      });
    }
  }

  checkForBlobs(val) {
    if (!val || typeof val !== 'object') return false;
    if (val.__idb_type === 'Blob') return true;
    if (Array.isArray(val)) return val.some(item => this.checkForBlobs(item));
    return Object.values(val).some(item => this.checkForBlobs(item));
  }

  getExtensionFromMime(mime) {
    const map = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/json': 'json',
      'text/plain': 'txt',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav'
    };
    return map[mime] || 'bin';
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
