/**
 * Add / Edit Record Modal
 */
import { toast } from './toast.js';

export class RecordEditorModal {
  constructor(options = {}) {
    this.options = {
      onSubmit: options.onSubmit ?? null,
      ...options
    };
    this.modalEl = null;
    this.storeMeta = null;
  }

  open(storeMeta, initialRecord = null, mode = 'add') {
    this.storeMeta = storeMeta;
    this.initialRecord = initialRecord;
    this.initialMode = mode;
    this.isDuplicate = mode === 'duplicate' && !!initialRecord;
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

    const hasKeyPath = !!this.storeMeta.keyPath;
    const isAutoIncrement = !!this.storeMeta.autoIncrement;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    let defaultPayload;
    let suggestedKey = '';

    if (this.isDuplicate) {
      try {
        defaultPayload = JSON.parse(JSON.stringify(this.initialRecord.value));
      } catch (e) {
        defaultPayload = { ...this.initialRecord.value };
      }

      if (hasKeyPath && !isAutoIncrement) {
        const origKey = defaultPayload[this.storeMeta.keyPath];
        if (typeof origKey === 'number') {
          defaultPayload[this.storeMeta.keyPath] = origKey + 1;
        } else if (typeof origKey === 'string') {
          defaultPayload[this.storeMeta.keyPath] = `${origKey}_copy`;
        }
      }

      if (!hasKeyPath) {
        const origKey = this.initialRecord.key;
        if (typeof origKey === 'number') {
          suggestedKey = String(origKey + 1);
        } else if (typeof origKey === 'string') {
          suggestedKey = `${origKey}_copy`;
        } else if (origKey !== undefined && origKey !== null) {
          suggestedKey = JSON.stringify(origKey);
        }
      }
    } else {
      defaultPayload = hasKeyPath
        ? (isAutoIncrement ? { name: "Sample Item", createdAt: new Date().toISOString() } : { [this.storeMeta.keyPath]: 1, name: "Sample Item", createdAt: new Date().toISOString() })
        : { name: "Sample Item", active: true, createdAt: new Date().toISOString() };
    }

    const titleText = this.isDuplicate ? 'Duplicate Record' : 'Add New Record';
    const subtitleKeyInfo = this.isDuplicate
      ? ` &middot; <span style="color: var(--text-muted)">Cloned from key: <code>${this.escapeHtml(JSON.stringify(this.initialRecord.key))}</code></span>`
      : '';

    modal.innerHTML = `
      <div class="modal-dialog modal-lg animate-scale-up">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>${titleText}</h3>
            <span class="modal-subtitle">Target Store: <strong>${this.escapeHtml(this.storeMeta.name)}</strong>${subtitleKeyInfo}</span>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="modal-body">
          ${!hasKeyPath ? `
            <div class="form-group">
              <label class="form-label">
                Out-of-line Primary Key
                ${isAutoIncrement ? '<span class="badge badge-info">Auto-Incrementing (leave blank to auto-generate)</span>' : '<span class="text-danger">*</span>'}
              </label>
              <div class="input-group">
                <select class="form-select key-type-select" style="max-width: 130px;">
                  <option value="string" ${typeof this.initialRecord?.key === 'string' ? 'selected' : ''}>String</option>
                  <option value="number" ${typeof this.initialRecord?.key === 'number' ? 'selected' : ''}>Number</option>
                  <option value="json" ${typeof this.initialRecord?.key === 'object' ? 'selected' : ''}>JSON</option>
                </select>
                <input type="text" class="form-input key-value-input" value="${this.escapeAttr(suggestedKey)}" placeholder="${isAutoIncrement ? 'Optional key (e.g. 100)' : 'Required key (e.g. user_101)'}" />
              </div>
            </div>
          ` : `
            <div class="info-alert">
              <span class="info-icon">ℹ</span>
              <span>This store uses inline key path <code>${this.escapeHtml(this.storeMeta.keyPath)}</code>. ${isAutoIncrement ? 'Key will auto-increment if omitted.' : 'Ensure your JSON includes this property.'}</span>
            </div>
          `}

          <div class="form-group">
            <div class="editor-header-flex">
              <label class="form-label">Record Value (JSON)</label>
              <div class="template-chips">
                <button type="button" class="chip-btn" data-template="user">User</button>
                <button type="button" class="chip-btn" data-template="product">Product</button>
                <button type="button" class="chip-btn" data-template="empty">Empty</button>
                <button type="button" class="chip-btn btn-prettify-json">Prettify</button>
              </div>
            </div>
            <textarea class="form-textarea code-textarea" rows="12" spellcheck="false">${JSON.stringify(defaultPayload, null, 2)}</textarea>
            <div class="editor-status-bar">
              <span class="status-indicator status-valid">Valid JSON</span>
            </div>
          </div>

          <div class="form-group inline-flex">
            <label class="form-label-inline">Operation Mode:</label>
            <label class="radio-label">
              <input type="radio" name="op-mode" value="put" ${this.isDuplicate ? '' : 'checked'} />
              Put (Upsert / Overwrite if key exists)
            </label>
            <label class="radio-label">
              <input type="radio" name="op-mode" value="add" ${this.isDuplicate ? 'checked' : ''} />
              Add (Fail if key exists)
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary modal-submit-btn">${this.isDuplicate ? 'Create Duplicate' : 'Save Record'}</button>
        </div>
      </div>
    `;

    // Elements
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    const submitBtn = modal.querySelector('.modal-submit-btn');
    const textarea = modal.querySelector('.code-textarea');
    const statusIndicator = modal.querySelector('.status-indicator');
    const prettifyBtn = modal.querySelector('.btn-prettify-json');

    // Close handlers
    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Validation
    const validate = () => {
      try {
        JSON.parse(textarea.value);
        statusIndicator.textContent = 'Valid JSON';
        statusIndicator.className = 'status-indicator status-valid';
        submitBtn.disabled = false;
        return true;
      } catch (e) {
        statusIndicator.textContent = 'Invalid JSON: ' + e.message;
        statusIndicator.className = 'status-indicator status-error';
        submitBtn.disabled = true;
        return false;
      }
    };

    textarea.addEventListener('input', validate);

    prettifyBtn.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        validate();
      } catch (e) {
        toast.error('Invalid JSON syntax');
      }
    });

    // Templates
    modal.querySelectorAll('.template-chips .chip-btn[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tmpl = btn.dataset.template;
        let obj = {};
        if (tmpl === 'user') {
          obj = {
            id: 101,
            name: "Jane Doe",
            email: "jane.doe@example.com",
            role: "developer",
            skills: ["JavaScript", "IndexedDB", "CSS"],
            active: true,
            createdAt: new Date().toISOString()
          };
        } else if (tmpl === 'product') {
          obj = {
            sku: "PROD-9982",
            title: "Ultra Ergonomic Keyboard",
            price: 189.99,
            stock: 45,
            tags: ["hardware", "ergonomic", "electronics"],
            updatedAt: new Date().toISOString()
          };
        } else if (tmpl === 'empty') {
          obj = {};
        }

        if (hasKeyPath && !obj[this.storeMeta.keyPath] && !isAutoIncrement) {
          obj[this.storeMeta.keyPath] = 1;
        }

        textarea.value = JSON.stringify(obj, null, 2);
        validate();
      });
    });

    // Submit handler
    submitBtn.addEventListener('click', async () => {
      if (!validate()) return;

      try {
        const recordValue = JSON.parse(textarea.value);
        const mode = modal.querySelector('input[name="op-mode"]:checked').value;

        let key = undefined;
        if (!hasKeyPath) {
          const keyInput = modal.querySelector('.key-value-input');
          const keyType = modal.querySelector('.key-type-select').value;
          const rawVal = keyInput ? keyInput.value.trim() : '';

          if (rawVal) {
            if (keyType === 'number') {
              key = Number(rawVal);
              if (isNaN(key)) throw new Error('Key must be a valid number');
            } else if (keyType === 'json') {
              key = JSON.parse(rawVal);
            } else {
              key = rawVal;
            }
          } else if (!isAutoIncrement) {
            throw new Error('Key is required for this store');
          }
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        if (this.options.onSubmit) {
          await this.options.onSubmit({ key, value: recordValue, mode, isDuplicate: this.isDuplicate });
        }

        this.close();
      } catch (err) {
        toast.error((this.isDuplicate ? 'Failed to duplicate record: ' : 'Failed to add record: ') + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = this.isDuplicate ? 'Create Duplicate' : 'Save Record';
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
