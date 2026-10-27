/**
 * Import and Export Modal Component
 */
import { toast } from './toast.js';

export class ImportExportModal {
  constructor(bridge) {
    this.bridge = bridge;
    this.modalEl = null;
  }

  close() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }

  // Show Export Dialog
  showExport(dbName, storeName, currentRecords, totalCount) {
    this.close();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    modal.innerHTML = `
      <div class="modal-dialog animate-scale-up">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>Export Data</h3>
            <span class="modal-subtitle">Store: <strong>${this.escapeHtml(storeName)}</strong></span>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Export Scope</label>
            <div class="radio-group-vertical">
              <label class="radio-label">
                <input type="radio" name="export-scope" value="page" checked />
                Current Page (${currentRecords.length} records)
              </label>
              <label class="radio-label">
                <input type="radio" name="export-scope" value="all" />
                All Records in Store (${totalCount} records)
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Export Format</label>
            <div class="radio-group-vertical">
              <label class="radio-label">
                <input type="radio" name="export-format" value="json-values" checked />
                JSON (Array of record values)
              </label>
              <label class="radio-label">
                <input type="radio" name="export-format" value="json-pairs" />
                JSON (Array of { key, value } pairs)
              </label>
              <label class="radio-label">
                <input type="radio" name="export-format" value="csv" />
                CSV (Flattened table format)
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-secondary btn-copy-export">Copy to Clipboard</button>
          <button type="button" class="btn btn-primary btn-download-export">Download File</button>
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    const copyBtn = modal.querySelector('.btn-copy-export');
    const downloadBtn = modal.querySelector('.btn-download-export');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    const getExportPayload = async () => {
      const scope = modal.querySelector('input[name="export-scope"]:checked').value;
      const format = modal.querySelector('input[name="export-format"]:checked').value;

      let records = currentRecords;
      if (scope === 'all') {
        const resp = await this.bridge.getRecords({
          dbName,
          storeName,
          page: 1,
          pageSize: 100000
        });
        records = resp.records;
      }

      if (format === 'json-values') {
        const values = records.map(r => r.value);
        return {
          content: JSON.stringify(values, null, 2),
          filename: `${dbName}_${storeName}_export.json`,
          mime: 'application/json'
        };
      }

      if (format === 'json-pairs') {
        return {
          content: JSON.stringify(records, null, 2),
          filename: `${dbName}_${storeName}_keyvalues.json`,
          mime: 'application/json'
        };
      }

      if (format === 'csv') {
        const csv = this.convertToCsv(records);
        return {
          content: csv,
          filename: `${dbName}_${storeName}.csv`,
          mime: 'text/csv'
        };
      }
    };

    copyBtn.addEventListener('click', async () => {
      try {
        copyBtn.disabled = true;
        copyBtn.textContent = 'Generating...';
        const data = await getExportPayload();
        await navigator.clipboard.writeText(data.content);
        toast.success('Data copied to clipboard');
        this.close();
      } catch (err) {
        toast.error('Export failed: ' + err.message);
      } finally {
        copyBtn.disabled = false;
        copyBtn.textContent = 'Copy to Clipboard';
      }
    });

    downloadBtn.addEventListener('click', async () => {
      try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Generating...';
        const data = await getExportPayload();
        const blob = new Blob([data.content], { type: data.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${data.filename}`);
        this.close();
      } catch (err) {
        toast.error('Download failed: ' + err.message);
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download File';
      }
    });

    document.body.appendChild(modal);
    this.modalEl = modal;
  }

  // Show Import Dialog
  showImport(dbName, storeName, onComplete) {
    this.close();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    modal.innerHTML = `
      <div class="modal-dialog modal-lg animate-scale-up">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>Import Data</h3>
            <span class="modal-subtitle">Target: <strong>${this.escapeHtml(dbName)} > ${this.escapeHtml(storeName)}</strong></span>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="modal-body">
          <div class="import-dropzone" id="import-dropzone">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p><strong>Drag & Drop JSON file here</strong> or <span class="file-browse-link">browse file</span></p>
            <input type="file" id="import-file-input" accept=".json,application/json" style="display: none;" />
            <small class="text-muted">Accepts JSON array of objects or key-value pairs</small>
          </div>

          <div class="form-group" style="margin-top: 14px;">
            <label class="form-label">Or paste JSON content:</label>
            <textarea class="form-textarea code-textarea" id="import-textarea" rows="6" placeholder="[ { &quot;id&quot;: 1, &quot;name&quot;: &quot;Alice&quot; }, ... ]"></textarea>
          </div>

          <div class="import-stats-box" style="display: none;">
            <span class="import-count-label">Parsed items: <strong id="parsed-count">0</strong></span>
          </div>

          <div class="form-group inline-flex">
            <label class="form-label-inline">Import Mode:</label>
            <label class="radio-label">
              <input type="radio" name="import-mode" value="put" checked />
              Put (Upsert / Overwrite)
            </label>
            <label class="radio-label">
              <input type="radio" name="import-mode" value="add" />
              Add (Skip or fail existing)
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary btn-start-import" disabled>Start Import</button>
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    const dropzone = modal.querySelector('#import-dropzone');
    const fileInput = modal.querySelector('#import-file-input');
    const textarea = modal.querySelector('#import-textarea');
    const startBtn = modal.querySelector('.btn-start-import');
    const statsBox = modal.querySelector('.import-stats-box');
    const parsedCountEl = modal.querySelector('#parsed-count');

    let recordsToImport = [];

    const updateParsedState = () => {
      const text = textarea.value.trim();
      if (!text) {
        recordsToImport = [];
        statsBox.style.display = 'none';
        startBtn.disabled = true;
        return;
      }

      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          recordsToImport = parsed.map(item => {
            // Check if item has { key, value } structure
            if (item && typeof item === 'object' && 'value' in item && 'key' in item) {
              return item.value;
            }
            return item;
          });
        } else if (typeof parsed === 'object' && parsed !== null) {
          recordsToImport = [parsed];
        } else {
          throw new Error('Expected JSON array of objects');
        }

        parsedCountEl.textContent = `${recordsToImport.length} valid records ready to import`;
        statsBox.style.display = 'block';
        startBtn.disabled = recordsToImport.length === 0;
      } catch (err) {
        statsBox.style.display = 'block';
        parsedCountEl.textContent = 'Invalid JSON: ' + err.message;
        parsedCountEl.className = 'text-danger';
        startBtn.disabled = true;
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          textarea.value = reader.result;
          updateParsedState();
        };
        reader.readAsText(file);
      }
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-active'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          textarea.value = reader.result;
          updateParsedState();
        };
        reader.readAsText(file);
      }
    });

    textarea.addEventListener('input', updateParsedState);

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    startBtn.addEventListener('click', async () => {
      if (recordsToImport.length === 0) return;
      const mode = modal.querySelector('input[name="import-mode"]:checked').value;

      startBtn.disabled = true;
      startBtn.textContent = `Importing ${recordsToImport.length} records...`;

      try {
        const resp = await this.bridge.importRecords(dbName, storeName, recordsToImport, mode);
        toast.success(`Successfully imported ${resp.count} records`);
        this.close();
        if (onComplete) onComplete();
      } catch (err) {
        toast.error('Import failed: ' + err.message);
        startBtn.disabled = false;
        startBtn.textContent = 'Start Import';
      }
    });

    document.body.appendChild(modal);
    this.modalEl = modal;
  }

  convertToCsv(records) {
    if (!records || records.length === 0) return '';

    // Collect all headers
    const headers = ['_key'];
    records.forEach(r => {
      if (r.value && typeof r.value === 'object' && !Array.isArray(r.value)) {
        Object.keys(r.value).forEach(k => {
          if (!headers.includes(k)) headers.push(k);
        });
      }
    });

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [headers.map(escapeCsv).join(',')];

    records.forEach(r => {
      const row = headers.map(h => {
        if (h === '_key') return escapeCsv(r.key);
        return escapeCsv(r.value ? r.value[h] : undefined);
      });
      rows.push(row.join(','));
    });

    return rows.join('\r\n');
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
