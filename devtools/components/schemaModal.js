/**
 * Schema Operations Modal
 * Handles database creation, store creation, index creation, and deletions.
 */
import { toast } from './toast.js';

export class SchemaModal {
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

  // 1. Create Database Modal
  showCreateDatabase(onSuccess) {
    this.close();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    modal.innerHTML = `
      <div class="modal-dialog animate-scale-up">
        <div class="modal-header">
          <h3>Create New Database</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Database Name <span class="text-danger">*</span></label>
            <input type="text" class="form-input db-name-input" placeholder="e.g. AppDatabase" required />
          </div>
          <div class="form-group">
            <label class="form-label">Initial Store Name</label>
            <input type="text" class="form-input store-name-input" placeholder="e.g. items" value="items" />
          </div>
          <div class="form-group">
            <label class="form-label">Key Path (optional)</label>
            <input type="text" class="form-input key-path-input" placeholder="e.g. id" value="id" />
            <small class="form-hint">Leave blank for out-of-line keys</small>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" class="auto-inc-check" checked />
              Auto-increment keys
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary modal-submit-btn">Create Database</button>
        </div>
      </div>
    `;

    this.bindEvents(modal, async () => {
      const name = modal.querySelector('.db-name-input').value.trim();
      const initialStore = modal.querySelector('.store-name-input').value.trim() || 'items';
      const keyPath = modal.querySelector('.key-path-input').value.trim();
      const autoIncrement = modal.querySelector('.auto-inc-check').checked;

      if (!name) {
        toast.error('Database name is required');
        return;
      }

      const submitBtn = modal.querySelector('.modal-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        await this.bridge.createDatabase(name, initialStore, keyPath, autoIncrement);
        toast.success(`Database "${name}" created successfully`);
        this.close();
        if (onSuccess) onSuccess(name);
      } catch (err) {
        toast.error('Failed to create database: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Database';
      }
    });

    document.body.appendChild(modal);
    this.modalEl = modal;
    modal.querySelector('.db-name-input').focus();
  }

  // 2. Create Object Store Modal
  showCreateStore(dbName, onSuccess) {
    this.close();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    modal.innerHTML = `
      <div class="modal-dialog animate-scale-up">
        <div class="modal-header">
          <h3>Create Object Store</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="info-alert">
            <span class="info-icon">ℹ</span>
            <span>Target Database: <strong>${this.escapeHtml(dbName)}</strong>. Adding a store increments the database version.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Store Name <span class="text-danger">*</span></label>
            <input type="text" class="form-input store-name-input" placeholder="e.g. users" required />
          </div>
          <div class="form-group">
            <label class="form-label">Key Path (optional)</label>
            <input type="text" class="form-input key-path-input" placeholder="e.g. id or user_id" />
            <small class="form-hint">Leave blank for out-of-line keys.</small>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" class="auto-inc-check" checked />
              Auto-increment primary key
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary modal-submit-btn">Create Store</button>
        </div>
      </div>
    `;

    this.bindEvents(modal, async () => {
      const storeName = modal.querySelector('.store-name-input').value.trim();
      const keyPath = modal.querySelector('.key-path-input').value.trim();
      const autoIncrement = modal.querySelector('.auto-inc-check').checked;

      if (!storeName) {
        toast.error('Store name is required');
        return;
      }

      const submitBtn = modal.querySelector('.modal-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Store...';

      try {
        await this.bridge.createObjectStore(dbName, storeName, keyPath, autoIncrement);
        toast.success(`Store "${storeName}" created in ${dbName}`);
        this.close();
        if (onSuccess) onSuccess(storeName);
      } catch (err) {
        toast.error('Failed to create store: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Store';
      }
    });

    document.body.appendChild(modal);
    this.modalEl = modal;
    modal.querySelector('.store-name-input').focus();
  }

  // 3. Create Index Modal
  showCreateIndex(dbName, storeName, onSuccess) {
    this.close();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop animate-fade-in';

    modal.innerHTML = `
      <div class="modal-dialog animate-scale-up">
        <div class="modal-header">
          <h3>Create Index</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="info-alert">
            <span class="info-icon">ℹ</span>
            <span>Target: <strong>${this.escapeHtml(dbName)} > ${this.escapeHtml(storeName)}</strong></span>
          </div>
          <div class="form-group">
            <label class="form-label">Index Name <span class="text-danger">*</span></label>
            <input type="text" class="form-input index-name-input" placeholder="e.g. by_email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Key Path <span class="text-danger">*</span></label>
            <input type="text" class="form-input index-keypath-input" placeholder="e.g. email or profile.email" required />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" class="unique-check" />
              Unique (enforce distinct values)
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" class="multientry-check" />
              Multi-entry (index each element of array fields separately)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary modal-submit-btn">Create Index</button>
        </div>
      </div>
    `;

    this.bindEvents(modal, async () => {
      const indexName = modal.querySelector('.index-name-input').value.trim();
      const keyPath = modal.querySelector('.index-keypath-input').value.trim();
      const unique = modal.querySelector('.unique-check').checked;
      const multiEntry = modal.querySelector('.multientry-check').checked;

      if (!indexName || !keyPath) {
        toast.error('Index name and Key Path are required');
        return;
      }

      const submitBtn = modal.querySelector('.modal-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Index...';

      try {
        await this.bridge.createIndex(dbName, storeName, indexName, keyPath, unique, multiEntry);
        toast.success(`Index "${indexName}" created`);
        this.close();
        if (onSuccess) onSuccess(indexName);
      } catch (err) {
        toast.error('Failed to create index: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Index';
      }
    });

    document.body.appendChild(modal);
    this.modalEl = modal;
    modal.querySelector('.index-name-input').focus();
  }

  // 4. Delete Database Confirmation
  confirmDeleteDatabase(dbName, onSuccess) {
    if (confirm(`⚠️ DANGER: Are you sure you want to completely delete database "${dbName}"?\n\nThis will permanently destroy all object stores, indexes, and records.`)) {
      this.bridge.deleteDatabase(dbName)
        .then(() => {
          toast.success(`Database "${dbName}" deleted`);
          if (onSuccess) onSuccess();
        })
        .catch(err => {
          toast.error('Failed to delete database: ' + err.message);
        });
    }
  }

  // 5. Delete Store Confirmation
  confirmDeleteStore(dbName, storeName, onSuccess) {
    if (confirm(`Are you sure you want to delete object store "${storeName}" in database "${dbName}"?\nAll records will be deleted.`)) {
      this.bridge.deleteObjectStore(dbName, storeName)
        .then(() => {
          toast.success(`Store "${storeName}" deleted`);
          if (onSuccess) onSuccess();
        })
        .catch(err => {
          toast.error('Failed to delete store: ' + err.message);
        });
    }
  }

  // 6. Delete Index Confirmation
  confirmDeleteIndex(dbName, storeName, indexName, onSuccess) {
    if (confirm(`Delete index "${indexName}" from store "${storeName}"?`)) {
      this.bridge.deleteIndex(dbName, storeName, indexName)
        .then(() => {
          toast.success(`Index "${indexName}" deleted`);
          if (onSuccess) onSuccess();
        })
        .catch(err => {
          toast.error('Failed to delete index: ' + err.message);
        });
    }
  }

  // 7. Clear Store Confirmation
  confirmClearStore(dbName, storeName, onSuccess) {
    if (confirm(`Clear all records from object store "${storeName}"?\nThis cannot be undone.`)) {
      this.bridge.clearStore(dbName, storeName)
        .then(() => {
          toast.success(`Object store "${storeName}" cleared`);
          if (onSuccess) onSuccess();
        })
        .catch(err => {
          toast.error('Failed to clear store: ' + err.message);
        });
    }
  }

  bindEvents(modal, submitFn) {
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    const submitBtn = modal.querySelector('.modal-submit-btn');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    submitBtn.addEventListener('click', submitFn);

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        submitFn();
      }
    });
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
