/**
 * Interactive Tree View Component for Complex IndexedDB Data
 */
import { toast } from './toast.js';

export class TreeView {
  constructor(data, options = {}) {
    this.data = data;
    this.options = {
      expandedDepth: options.expandedDepth ?? 2,
      rootName: options.rootName ?? null,
      onEdit: options.onEdit ?? null,
      ...options
    };
  }

  render() {
    const container = document.createElement('div');
    container.className = 'tree-view-root';

    const rootNode = this.createNode(
      this.options.rootName,
      this.data,
      0,
      ''
    );
    container.appendChild(rootNode);
    return container;
  }

  createNode(key, value, depth, path) {
    const isObject = value !== null && typeof value === 'object' && !value.__idb_type;
    const isArray = Array.isArray(value);
    const hasSpecialType = value && typeof value === 'object' && value.__idb_type;

    const row = document.createElement('div');
    row.className = 'tree-node';

    const header = document.createElement('div');
    header.className = 'tree-node-header';

    const currentPath = path ? (key !== null ? `${path}.${key}` : path) : (key !== null ? String(key) : '');

    // Expand/Collapse caret
    const isExpandable = (isObject || isArray) && Object.keys(value).length > 0;
    const caret = document.createElement('span');
    caret.className = `tree-caret ${isExpandable ? 'expandable' : 'leaf'}`;
    caret.innerHTML = isExpandable
      ? `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M6 4l4 4-4 4z"/></svg>`
      : '';
    header.appendChild(caret);

    // Key display
    if (key !== null && key !== undefined) {
      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = key;
      header.appendChild(keySpan);

      const colon = document.createElement('span');
      colon.className = 'tree-colon';
      colon.textContent = ': ';
      header.appendChild(colon);
    }

    // Children container (if expandable)
    let childrenContainer = null;
    let isExpanded = depth < this.options.expandedDepth;

    if (isExpandable) {
      const count = isArray ? value.length : Object.keys(value).length;
      const typeSpan = document.createElement('span');
      typeSpan.className = 'tree-bracket';
      typeSpan.textContent = isArray ? `Array(${count})` : `Object{${count}}`;
      header.appendChild(typeSpan);

      childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';

      const entries = isArray ? value.entries() : Object.entries(value);
      for (const [k, v] of entries) {
        const childNode = this.createNode(k, v, depth + 1, currentPath);
        childrenContainer.appendChild(childNode);
      }

      const updateExpandedState = () => {
        if (isExpanded) {
          caret.classList.add('open');
          childrenContainer.style.display = 'block';
        } else {
          caret.classList.remove('open');
          childrenContainer.style.display = 'none';
        }
      };

      header.addEventListener('click', (e) => {
        // Prevent toggle if clicking action buttons
        if (e.target.closest('.tree-action-btn')) return;
        isExpanded = !isExpanded;
        updateExpandedState();
      });

      updateExpandedState();
    } else {
      // Leaf or special type
      const valueSpan = document.createElement('span');
      valueSpan.className = 'tree-value';
      this.renderValue(valueSpan, value);
      header.appendChild(valueSpan);
    }

    // Quick hover actions: Copy path, copy value
    const actions = document.createElement('div');
    actions.className = 'tree-actions';

    if (currentPath) {
      const copyPathBtn = document.createElement('button');
      copyPathBtn.className = 'tree-action-btn';
      copyPathBtn.title = `Copy path: ${currentPath}`;
      copyPathBtn.innerHTML = `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M4 4v8h8V4H4zm1-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path fill="currentColor" d="M2 6h1v7h7v1H2V6z"/></svg>`;
      copyPathBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(currentPath);
        toast.info(`Copied path: ${currentPath}`);
      });
      actions.appendChild(copyPathBtn);
    }

    const copyValBtn = document.createElement('button');
    copyValBtn.className = 'tree-action-btn';
    copyValBtn.title = 'Copy raw JSON value';
    copyValBtn.innerHTML = `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M10 2H4a2 2 0 00-2 2v8h2V4h6V2zm2 3H7a2 2 0 00-2 2v7a2 2 0 002 2h5a2 2 0 002-2V7a2 2 0 00-2-2zm0 9H7V7h5v7z"/></svg>`;
    copyValBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      navigator.clipboard.writeText(text);
      toast.info('Copied value to clipboard');
    });
    actions.appendChild(copyValBtn);

    header.appendChild(actions);
    row.appendChild(header);

    if (childrenContainer) {
      row.appendChild(childrenContainer);
    }

    return row;
  }

  renderValue(el, val) {
    if (val === null) {
      el.className += ' val-null';
      el.textContent = 'null';
      return;
    }
    if (val === undefined) {
      el.className += ' val-undefined';
      el.textContent = 'undefined';
      return;
    }

    if (typeof val === 'string') {
      el.className += ' val-string';
      el.textContent = `"${val}"`;
      return;
    }

    if (typeof val === 'number') {
      el.className += ' val-number';
      el.textContent = String(val);
      return;
    }

    if (typeof val === 'boolean') {
      el.className += ' val-boolean';
      el.textContent = String(val);
      return;
    }

    // Special types
    if (typeof val === 'object' && val.__idb_type) {
      switch (val.__idb_type) {
        case 'undefined':
          el.className += ' val-undefined';
          el.textContent = 'undefined';
          break;

        case 'Date':
          el.className += ' val-date';
          el.innerHTML = `<span class="tree-type-tag">Date</span> <span class="val-date-str">${val.iso}</span>`;
          break;

        case 'BigInt':
          el.className += ' val-bigint';
          el.textContent = `${val.value}n`;
          break;

        case 'RegExp':
          el.className += ' val-regexp';
          el.textContent = `/${val.source}/${val.flags}`;
          break;

        case 'Blob':
          el.className += ' val-blob';
          const sizeKb = (val.size / 1024).toFixed(1);
          el.innerHTML = `
            <span class="tree-type-tag">${val.isFile ? 'File' : 'Blob'}</span>
            <span class="blob-meta">${val.name ? val.name + ' • ' : ''}${val.mime || 'application/octet-stream'} (${sizeKb} KB)</span>
          `;
          if (val.dataUrl && (val.mime?.startsWith('image/') || val.mime === 'image/svg+xml')) {
            const preview = document.createElement('div');
            preview.className = 'tree-image-preview';
            preview.innerHTML = `<img src="${val.dataUrl}" alt="Blob preview" style="max-height: 80px; max-width: 140px; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 4px; display: block;">`;
            el.appendChild(preview);
          }
          break;

        case 'ArrayBuffer':
          el.className += ' val-buffer';
          el.innerHTML = `<span class="tree-type-tag">${val.className || 'ArrayBuffer'}</span> <span class="buffer-hex">${val.byteLength}B [${val.hexPreview}]</span>`;
          break;

        case 'Map':
          el.className += ' val-map';
          el.innerHTML = `<span class="tree-type-tag">Map</span> (${val.entries ? val.entries.length : 0} entries)`;
          break;

        case 'Set':
          el.className += ' val-set';
          el.innerHTML = `<span class="tree-type-tag">Set</span> (${val.values ? val.values.length : 0} items)`;
          break;

        case 'Circular':
          el.className += ' val-circular';
          el.textContent = '[Circular Reference]';
          break;

        default:
          el.textContent = JSON.stringify(val);
      }
      return;
    }

    el.textContent = typeof val === 'object' ? JSON.stringify(val) : String(val);
  }
}
