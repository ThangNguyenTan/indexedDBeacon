/**
 * Record Table Component
 * Native Chrome DevTools-styled data grid with Key-Value & Multi-Column modes,
 * syntax highlighting, multi-select, and row actions.
 */
import { toast } from './toast.js';

export class RecordTable {
  constructor(options = {}) {
    this.options = {
      onSelectRow: options.onSelectRow ?? null,
      onEditRow: options.onEditRow ?? null,
      onDeleteRow: options.onDeleteRow ?? null,
      onDuplicateRow: options.onDuplicateRow ?? null,
      onSelectionChange: options.onSelectionChange ?? null,
      ...options
    };
    this.records = [];
    this.selectedKeys = new Set();
    this.activeRecord = null;
    this.isIndexQuery = false;
    this.viewMode = localStorage.getItem('idb_beacon_view_mode') || 'kv'; // 'kv' (native Chrome) | 'multi'
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'kv' ? 'multi' : 'kv';
    localStorage.setItem('idb_beacon_view_mode', this.viewMode);
    return this.viewMode;
  }

  setRecords(records, isIndexQuery = false) {
    this.records = records || [];
    this.isIndexQuery = isIndexQuery;
    this.selectedKeys.clear();
    this.notifySelection();
  }

  notifySelection() {
    if (this.options.onSelectionChange) {
      this.options.onSelectionChange(Array.from(this.selectedKeys));
    }
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    if (this.records.length === 0) {
      wrapper.innerHTML = `
        <div class="table-empty-state">
          <p>No records match the current query or this store is empty.</p>
        </div>
      `;
      return wrapper;
    }

    // Discover column headers for 'multi' mode
    const propSet = new Set();
    if (this.viewMode === 'multi') {
      this.records.forEach(r => {
        const v = r.value;
        if (v && typeof v === 'object' && !Array.isArray(v) && !v.__idb_type) {
          Object.keys(v).forEach(k => propSet.add(k));
        }
      });
    }
    const dynamicCols = Array.from(propSet).slice(0, 10);

    const table = document.createElement('table');
    table.className = `records-table mode-${this.viewMode}`;
    this.tableElement = table;
    this.dynamicCols = dynamicCols;

    // THEAD
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    // Checkbox column
    const thCheck = document.createElement('th');
    thCheck.className = 'col-checkbox';
    const selectAllCheck = document.createElement('input');
    selectAllCheck.type = 'checkbox';
    selectAllCheck.title = 'Select all records on page';
    selectAllCheck.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.records.forEach(r => this.selectedKeys.add(this.serializeKeyToId(r.key)));
      } else {
        this.selectedKeys.clear();
      }
      this.updateCheckboxStates(table);
      this.notifySelection();
    });
    thCheck.appendChild(selectAllCheck);
    headRow.appendChild(thCheck);

    // Key column
    const thKey = document.createElement('th');
    thKey.className = 'col-key';
    thKey.textContent = this.isIndexQuery ? 'Index Key' : 'Key';
    headRow.appendChild(thKey);

    // Primary Key (if querying an index)
    if (this.isIndexQuery) {
      const thPk = document.createElement('th');
      thPk.className = 'col-pk';
      thPk.textContent = 'Primary Key';
      headRow.appendChild(thPk);
    }

    // Value column vs Multi-Columns
    if (this.viewMode === 'kv' || dynamicCols.length === 0) {
      const thVal = document.createElement('th');
      thVal.className = 'col-value';
      thVal.textContent = 'Value';
      headRow.appendChild(thVal);
    } else {
      dynamicCols.forEach(col => {
        const th = document.createElement('th');
        th.className = 'col-prop';
        th.textContent = col;
        headRow.appendChild(th);
      });
    }

    // Actions column
    const thActions = document.createElement('th');
    thActions.className = 'col-actions';
    thActions.textContent = '';
    headRow.appendChild(thActions);

    thead.appendChild(headRow);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement('tbody');
    this.tbody = tbody;

    this.records.forEach(record => {
      const row = this.createRowElement(record, dynamicCols);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  createRowElement(record, dynamicCols = []) {
    const row = document.createElement('tr');
    const keyId = this.serializeKeyToId(record.key);
    row.dataset.keyId = keyId;

    if (this.activeRecord && this.serializeKeyToId(this.activeRecord.key) === keyId) {
      row.classList.add('row-selected');
    }

    // Checkbox cell
    const tdCheck = document.createElement('td');
    tdCheck.className = 'col-checkbox';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = this.selectedKeys.has(keyId);
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) {
        this.selectedKeys.add(keyId);
      } else {
        this.selectedKeys.delete(keyId);
      }
      const selectAllCheck = this.tableElement?.querySelector('thead input[type="checkbox"]');
      if (selectAllCheck) selectAllCheck.checked = this.selectedKeys.size === this.records.length;
      this.notifySelection();
    });
    tdCheck.appendChild(chk);
    row.appendChild(tdCheck);

    // Key cell
    const tdKey = document.createElement('td');
    tdKey.className = 'col-key';
    tdKey.innerHTML = this.renderCellContent(record.key, true);
    tdKey.title = 'Click to copy key';
    tdKey.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(JSON.stringify(record.key));
      toast.info('Copied key to clipboard');
    });
    row.appendChild(tdKey);

    // Index Primary Key
    if (this.isIndexQuery) {
      const tdPk = document.createElement('td');
      tdPk.className = 'col-pk';
      tdPk.innerHTML = this.renderCellContent(record.primaryKey, true);
      row.appendChild(tdPk);
    }

    // Value cell or Dynamic Columns
    if (this.viewMode === 'kv' || dynamicCols.length === 0) {
      const tdVal = document.createElement('td');
      tdVal.className = 'col-value';
      tdVal.innerHTML = this.renderValuePreview(record.value);
      row.appendChild(tdVal);
    } else {
      dynamicCols.forEach(col => {
        const td = document.createElement('td');
        td.className = 'col-prop';
        const val = record.value && typeof record.value === 'object' ? record.value[col] : undefined;
        td.innerHTML = this.renderCellContent(val);
        row.appendChild(td);
      });
    }

    // Actions cell (Hover tools)
    const tdActions = document.createElement('td');
    tdActions.className = 'col-actions';
    tdActions.innerHTML = `
      <div class="row-actions-group">
        <button class="row-btn btn-inspect" title="Inspect Record">
          <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M8 3c-4 0-7 5-7 5s3 5 7 5 7-5 7-5-3-5-7-5zm0 8.5A3.5 3.5 0 118 4.5a3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z"/></svg>
        </button>
        <button class="row-btn btn-duplicate" title="Duplicate Record">
          <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/></svg>
        </button>
        <button class="row-btn btn-copy" title="Copy JSON">
          <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path fill="currentColor" d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>
        </button>
        <button class="row-btn btn-edit" title="Edit JSON">
          <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/></svg>
        </button>
        <button class="row-btn btn-delete text-danger" title="Delete">
          <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill="currentColor" fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>
      </div>
    `;

    tdActions.querySelector('.btn-inspect')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectRow(record, row, this.tbody);
    });

    tdActions.querySelector('.btn-duplicate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onDuplicateRow) {
        this.options.onDuplicateRow(record);
      }
    });

    tdActions.querySelector('.btn-copy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(JSON.stringify(record.value, null, 2));
      toast.success('Copied record JSON');
    });

    tdActions.querySelector('.btn-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onEditRow) {
        this.options.onEditRow(record);
      }
    });

    tdActions.querySelector('.btn-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onDeleteRow) {
        this.options.onDeleteRow(record);
      }
    });

    row.addEventListener('click', () => {
      this.selectRow(record, row, this.tbody);
    });

    row.addEventListener('dblclick', () => {
      if (this.options.onEditRow) {
        this.options.onEditRow(record);
      }
    });

    return row;
  }

  appendRecords(newRecords) {
    if (!newRecords || newRecords.length === 0) return;
    this.records.push(...newRecords);
    if (!this.tbody) return;
    newRecords.forEach(record => {
      const row = this.createRowElement(record, this.dynamicCols || []);
      this.tbody.appendChild(row);
    });
  }

  selectNextRow() {
    if (!this.records || this.records.length === 0) return;
    const currentIndex = this.records.findIndex(r => r.key === this.activeRecord?.key);
    if (currentIndex === -1) {
      this.selectRowByIndex(0);
      return;
    }
    if (currentIndex < this.records.length - 1) {
      this.selectRowByIndex(currentIndex + 1);
    } else if (this.options.onRequestNextPage) {
      this.options.onRequestNextPage();
    }
  }

  selectPrevRow() {
    if (!this.records || this.records.length === 0) return;
    const currentIndex = this.records.findIndex(r => r.key === this.activeRecord?.key);
    if (currentIndex === -1) {
      this.selectRowByIndex(0);
      return;
    }
    if (currentIndex > 0) {
      this.selectRowByIndex(currentIndex - 1);
    }
  }

  selectRowByIndex(index) {
    if (!this.tbody || index < 0 || index >= this.records.length) return;
    const rows = this.tbody.querySelectorAll('tr');
    const row = rows[index];
    const record = this.records[index];
    if (row && record) {
      this.selectRow(record, row, this.tbody);
      row.scrollIntoView({ block: 'nearest' });
    }
  }

  selectFirstRow(tableWrapper = null) {
    if (!this.records || this.records.length === 0) return;
    this.selectRowByIndex(0);
  }

  selectLastRow() {
    if (!this.records || this.records.length === 0) return;
    this.selectRowByIndex(this.records.length - 1);
  }

  clearActiveSelection() {
    this.activeRecord = null;
    const table = document.querySelector('.records-table');
    table?.querySelectorAll('tr.row-selected').forEach(tr => tr.classList.remove('row-selected'));
  }

  selectRow(record, rowEl, tbody) {
    this.activeRecord = record;
    tbody.querySelectorAll('tr').forEach(tr => tr.classList.remove('row-selected'));
    rowEl.classList.add('row-selected');
    if (this.options.onSelectRow) {
      this.options.onSelectRow(record);
    }
  }

  updateCheckboxStates(table) {
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
    checkboxes.forEach(chk => {
      const row = chk.closest('tr');
      chk.checked = this.selectedKeys.has(row.dataset.keyId);
    });
  }

  serializeKeyToId(key) {
    return typeof key === 'object' ? JSON.stringify(key) : String(key);
  }

  /**
   * Formats an object value cleanly for the Value column (native Chrome style)
   */
  renderValuePreview(val, maxChars = 140) {
    if (val === undefined) return '<span class="cell-undefined">undefined</span>';
    if (val === null) return '<span class="cell-null">null</span>';
    if (typeof val === 'boolean') return `<span class="cell-bool ${val ? 'bool-true' : 'bool-false'}">${val}</span>`;
    if (typeof val === 'number') return `<span class="cell-number">${val}</span>`;
    if (typeof val === 'string') {
      const truncated = val.length > 50 ? val.slice(0, 47) + '…' : val;
      return `<span class="cell-string">"${this.escapeHtml(truncated)}"</span>`;
    }

    if (typeof val === 'object') {
      if (val.__idb_type) {
        switch (val.__idb_type) {
          case 'Date':
            return `<span class="cell-date">${val.iso ? val.iso.slice(0, 19).replace('T', ' ') : new Date(val.time).toISOString()}</span>`;
          case 'BigInt':
            return `<span class="cell-bigint">${val.value}n</span>`;
          case 'Blob':
            const sizeKb = (val.size / 1024).toFixed(1);
            return `<span class="cell-blob">${val.isFile ? 'File' : 'Blob'} {${val.mime || 'bin'}, ${sizeKb} KB}</span>`;
          case 'ArrayBuffer':
            return `<span class="cell-buffer">${val.className || 'Buffer'} (${val.byteLength} B)</span>`;
          case 'RegExp':
            return `<span class="cell-regexp">/${val.source}/${val.flags || ''}</span>`;
          case 'Map':
            return `<span class="cell-meta">Map(${val.entries?.length || 0})</span>`;
          case 'Set':
            return `<span class="cell-meta">Set(${val.values?.length || 0})</span>`;
          default:
            return `<span class="cell-obj">{…}</span>`;
        }
      }

      if (Array.isArray(val)) {
        const items = val.slice(0, 4).map(item => this.renderCellContent(item)).join(', ');
        return `<span class="cell-array">[${items}${val.length > 4 ? `, … (${val.length})` : ''}]</span>`;
      }

      const keys = Object.keys(val);
      if (keys.length === 0) return `<span class="cell-meta">{}</span>`;

      const parts = [];
      let charCount = 0;
      for (const k of keys) {
        if (charCount > maxChars) {
          parts.push('…');
          break;
        }
        const vPreview = this.renderCellContent(val[k]);
        parts.push(`<span class="obj-prop-key">${this.escapeHtml(k)}</span>: ${vPreview}`);
        charCount += k.length + 8;
      }
      return `<span class="cell-object">{ ${parts.join(', ')} }</span>`;
    }

    return this.escapeHtml(String(val));
  }

  renderCellContent(val, isKey = false) {
    if (val === undefined) {
      return '<span class="cell-undefined">—</span>';
    }
    if (val === null) {
      return '<span class="cell-null">null</span>';
    }
    if (typeof val === 'boolean') {
      return `<span class="cell-bool ${val ? 'bool-true' : 'bool-false'}">${val}</span>`;
    }
    if (typeof val === 'number') {
      return `<span class="cell-number">${val}</span>`;
    }
    if (typeof val === 'string') {
      const truncated = val.length > 45 ? val.slice(0, 42) + '…' : val;
      return `<span class="cell-string" title="${this.escapeAttr(val)}">${this.escapeHtml(truncated)}</span>`;
    }

    if (typeof val === 'object') {
      if (val.__idb_type) {
        switch (val.__idb_type) {
          case 'Date':
            return `<span class="cell-date">${val.iso ? val.iso.slice(0, 19).replace('T', ' ') : ''}</span>`;
          case 'BigInt':
            return `<span class="cell-bigint">${val.value}n</span>`;
          case 'Blob':
            const sizeKb = (val.size / 1024).toFixed(1);
            return `<span class="cell-blob">[${val.isFile ? 'File' : 'Blob'} ${sizeKb}KB]</span>`;
          case 'ArrayBuffer':
            return `<span class="cell-buffer">[${val.className || 'Buffer'} ${val.byteLength}B]</span>`;
          case 'RegExp':
            return `<span class="cell-regexp">/${val.source}/${val.flags || ''}</span>`;
          case 'Map':
            return `<span class="cell-meta">Map(${val.entries?.length || 0})</span>`;
          case 'Set':
            return `<span class="cell-meta">Set(${val.values?.length || 0})</span>`;
          default:
            return `<span class="cell-obj">{…}</span>`;
        }
      }

      if (Array.isArray(val)) {
        return `<span class="cell-array">[${val.length}]</span>`;
      }

      const keys = Object.keys(val);
      return `<span class="cell-object">{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}}</span>`;
    }

    return this.escapeHtml(String(val));
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
