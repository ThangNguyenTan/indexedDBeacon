/**
 * IndexedDBeacon Bridge Script
 * Runs in the context of the inspected window.
 * Provides high-performance, asynchronous IndexedDB operations
 * and safe serialization for complex data types.
 */
(function() {
  if (window.__IDB_BEACON__) {
    return;
  }

  const tasks = new Map();
  const knownDatabases = new Set();
  let lastMutationTime = Date.now();

  // Non-invasively monitor page-level IndexedDB mutations to inform the DevTools panel when data is stale
  try {
    if (typeof IDBObjectStore !== 'undefined' && !IDBObjectStore.prototype.__beacon_hooked) {
      IDBObjectStore.prototype.__beacon_hooked = true;
      ['put', 'add', 'delete', 'clear'].forEach(method => {
        const orig = IDBObjectStore.prototype[method];
        if (typeof orig === 'function') {
          IDBObjectStore.prototype[method] = function(...args) {
            lastMutationTime = Date.now();
            return orig.apply(this, args);
          };
        }
      });
    }
  } catch (e) {
    // Fail-safe
  }

  // Helper: Promisify IDBRequest
  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  // Helper: Promisify IDBTransaction
  function promisifyTransaction(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  // Safe Serialization for cross-boundary transfer
  async function serializeValueAsync(val, seen = new WeakSet(), depth = 0) {
    if (val === undefined) {
      return { __idb_type: 'undefined' };
    }
    if (val === null || typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
      return val;
    }
    if (typeof val === 'bigint') {
      return { __idb_type: 'BigInt', value: val.toString() };
    }
    if (typeof val === 'symbol') {
      return { __idb_type: 'Symbol', description: val.description };
    }
    if (typeof val === 'function') {
      return { __idb_type: 'Function', name: val.name };
    }
    if (val instanceof Date) {
      return { __idb_type: 'Date', iso: val.toISOString(), time: val.getTime() };
    }
    if (val instanceof RegExp) {
      return { __idb_type: 'RegExp', source: val.source, flags: val.flags };
    }

    // Blob & File Handling
    if (typeof Blob !== 'undefined' && val instanceof Blob) {
      const isFile = typeof File !== 'undefined' && val instanceof File;
      const res = {
        __idb_type: 'Blob',
        size: val.size,
        mime: val.type,
        name: isFile ? val.name : null,
        isFile: isFile
      };

      // Read small blobs (<= 1.5MB) as DataURL for inline preview
      if (val.size <= 1.5 * 1024 * 1024) {
        try {
          res.dataUrl = await new Promise((resBlob, rejBlob) => {
            const reader = new FileReader();
            reader.onload = () => resBlob(reader.result);
            reader.onerror = () => rejBlob(reader.error);
            reader.readAsDataURL(val);
          });
        } catch (e) {
          // Ignore read errors
        }
      }
      return res;
    }

    // ArrayBuffer & TypedArrays
    if (val instanceof ArrayBuffer || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(val))) {
      const byteLength = val.byteLength;
      const view = val instanceof Uint8Array ? val : new Uint8Array(val.buffer || val);
      const previewLen = Math.min(32, view.length);
      const hex = Array.from(view.slice(0, previewLen)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      return {
        __idb_type: 'ArrayBuffer',
        className: val.constructor.name,
        byteLength,
        hexPreview: hex + (view.length > 32 ? '...' : '')
      };
    }

    // Map
    if (val instanceof Map) {
      const entries = [];
      for (const [k, v] of val.entries()) {
        const sk = await serializeValueAsync(k, seen, depth + 1);
        const sv = await serializeValueAsync(v, seen, depth + 1);
        entries.push([sk, sv]);
      }
      return { __idb_type: 'Map', entries };
    }

    // Set
    if (val instanceof Set) {
      const values = [];
      for (const item of val.values()) {
        values.push(await serializeValueAsync(item, seen, depth + 1));
      }
      return { __idb_type: 'Set', values };
    }

    // Objects & Arrays
    if (typeof val === 'object') {
      if (seen.has(val)) {
        return { __idb_type: 'Circular' };
      }
      seen.add(val);

      if (Array.isArray(val)) {
        const arr = [];
        for (let i = 0; i < val.length; i++) {
          arr.push(await serializeValueAsync(val[i], seen, depth + 1));
        }
        return arr;
      }

      const res = {};
      for (const key of Object.keys(val)) {
        res[key] = await serializeValueAsync(val[key], seen, depth + 1);
      }
      return res;
    }

    return String(val);
  }

  // Deserialization to recreate native types from user edits
  function deserializeValue(val) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;

    if (val.__idb_type) {
      switch (val.__idb_type) {
        case 'undefined': return undefined;
        case 'BigInt': return BigInt(val.value);
        case 'Date': return new Date(val.iso || val.time);
        case 'RegExp': return new RegExp(val.source, val.flags);
        case 'Map': return new Map(val.entries.map(([k, v]) => [deserializeValue(k), deserializeValue(v)]));
        case 'Set': return new Set(val.values.map(deserializeValue));
        case 'ArrayBuffer': return new ArrayBuffer(val.byteLength);
        case 'Blob':
          if (val.dataUrl) {
            // Reconstruct blob from data url if possible
            const parts = val.dataUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            return new Blob([u8arr], { type: mime });
          }
          return val;
        default: return val;
      }
    }

    if (Array.isArray(val)) {
      return val.map(deserializeValue);
    }

    const res = {};
    for (const key of Object.keys(val)) {
      res[key] = deserializeValue(val[key]);
    }
    return res;
  }

  // Open database with safety wrapper
  function openDatabase(name, version) {
    return new Promise((resolve, reject) => {
      const req = version ? window.indexedDB.open(name, version) : window.indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open database ' + name));
      req.onblocked = () => reject(new Error('Database open blocked by existing connection'));
    });
  }

  // Build IDBKeyRange from options
  function buildKeyRange(range) {
    if (!range) return null;
    const { type, value, lower, upper, lowerOpen, upperOpen } = range;
    if (type === 'only') {
      return IDBKeyRange.only(value);
    }
    if (type === 'lower') {
      return IDBKeyRange.lowerBound(lower, !!lowerOpen);
    }
    if (type === 'upper') {
      return IDBKeyRange.upperBound(upper, !!upperOpen);
    }
    if (type === 'bound') {
      return IDBKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
    }
    return null;
  }

  // Handlers for all actions
  const handlers = {
    ping: async () => {
      return {
        origin: window.location.origin,
        href: window.location.href,
        title: document.title,
        timestamp: Date.now()
      };
    },

    getStorageEstimate: async () => {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        return {
          usage: est.usage || 0,
          quota: est.quota || 0,
          percent: est.quota ? Math.round((est.usage / est.quota) * 10000) / 100 : 0
        };
      }
      return { usage: 0, quota: 0, percent: 0 };
    },

    listDatabases: async () => {
      let dbs = [];
      if (window.indexedDB && window.indexedDB.databases) {
        try {
          const list = await window.indexedDB.databases();
          dbs = list.map(db => ({
            name: db.name,
            version: db.version
          }));
        } catch (e) {
          console.warn('indexedDB.databases() failed:', e);
        }
      }

      // Merge with knownDatabases
      const dbMap = new Map(dbs.map(d => [d.name, d]));
      for (const known of knownDatabases) {
        if (!dbMap.has(known)) {
          try {
            const db = await openDatabase(known);
            dbMap.set(known, { name: db.name, version: db.version });
            db.close();
          } catch (e) {
            // Ignore
          }
        }
      }

      return Array.from(dbMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },

    registerDatabase: async ({ dbName }) => {
      if (!dbName) throw new Error('Database name is required');
      knownDatabases.add(dbName);
      const db = await openDatabase(dbName);
      const res = { name: db.name, version: db.version };
      db.close();
      return res;
    },

    getDatabaseDetails: async ({ dbName }) => {
      const db = await openDatabase(dbName);
      knownDatabases.add(dbName);
      try {
        const storeNames = Array.from(db.objectStoreNames);
        const stores = [];

        if (storeNames.length > 0) {
          const tx = db.transaction(storeNames, 'readonly');
          for (const name of storeNames) {
            const store = tx.objectStore(name);
            const countReq = store.count();
            const count = await promisifyRequest(countReq);

            const indexes = [];
            for (const idxName of Array.from(store.indexNames)) {
              const idx = store.index(idxName);
              indexes.push({
                name: idx.name,
                keyPath: idx.keyPath,
                unique: idx.unique,
                multiEntry: idx.multiEntry
              });
            }

            stores.push({
              name: store.name,
              keyPath: store.keyPath,
              autoIncrement: store.autoIncrement,
              count,
              indexes
            });
          }
        }

        return {
          name: db.name,
          version: db.version,
          stores: stores.sort((a, b) => a.name.localeCompare(b.name))
        };
      } finally {
        db.close();
      }
    },

    getRecords: async ({ dbName, storeName, indexName, direction = 'next', range, page = 1, pageSize = 50, search = '', filterPredicate = '' }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const target = indexName ? store.index(indexName) : store;
        const keyRange = buildKeyRange(range);

        // Compile custom filter function if provided
        let filterFn = null;
        if (filterPredicate && filterPredicate.trim()) {
          try {
            filterFn = new Function('item', 'key', 'primaryKey', `
              try {
                return !!(${filterPredicate});
              } catch(e) {
                return false;
              }
            `);
          } catch (e) {
            throw new Error('Invalid filter predicate: ' + e.message);
          }
        }

        const searchLower = search ? search.toLowerCase().trim() : '';

        // If there is no custom search/filter, we can use fast cursor advance
        const isFiltered = searchLower.length > 0 || filterFn !== null;

        const records = [];
        let totalMatching = 0;
        let hasAdvanced = false;
        const targetSkip = (page - 1) * pageSize;

        // Open cursor
        await new Promise((resolve, reject) => {
          const req = target.openCursor(keyRange, direction);
          req.onerror = () => reject(req.error || new Error('Cursor failed'));
          req.onsuccess = async (e) => {
            const cursor = e.target.result;
            if (!cursor) {
              return resolve();
            }

            // Fast path for unfiltered pagination: jump directly to page start
            if (!isFiltered && targetSkip > 0 && !hasAdvanced) {
              hasAdvanced = true;
              try {
                cursor.advance(targetSkip);
                return;
              } catch (advErr) {
                // If advance throws (e.g. targetSkip exceeds total entries), cursor reached end
                return resolve();
              }
            }

            const val = cursor.value;
            const key = cursor.key;
            const primaryKey = cursor.primaryKey;

            // Check match
            let matches = true;
            if (searchLower) {
              const text = JSON.stringify(val) + ' ' + JSON.stringify(key);
              matches = text.toLowerCase().includes(searchLower);
            }
            if (matches && filterFn) {
              matches = filterFn(val, key, primaryKey);
            }

            if (matches) {
              totalMatching++;

              if (isFiltered) {
                if (totalMatching > targetSkip && records.length < pageSize) {
                  const serializedValue = await serializeValueAsync(val);
                  records.push({
                    key: serializeValueSync(key),
                    primaryKey: serializeValueSync(primaryKey),
                    value: serializedValue
                  });
                }
              } else {
                if (records.length < pageSize) {
                  const serializedValue = await serializeValueAsync(val);
                  records.push({
                    key: serializeValueSync(key),
                    primaryKey: serializeValueSync(primaryKey),
                    value: serializedValue
                  });
                }
              }
            }

            // Stop iterating if we have all needed items and not filtered
            if (!isFiltered && records.length >= pageSize) {
              return resolve();
            }

            cursor.continue();
          };
        });

        // Get total count
        let totalCount = totalMatching;
        if (!isFiltered) {
          const countReq = target.count(keyRange);
          totalCount = await promisifyRequest(countReq);
        }

        return {
          records,
          totalCount,
          page,
          pageSize,
          keyPath: store.keyPath,
          autoIncrement: store.autoIncrement
        };
      } finally {
        db.close();
      }
    },

    getRecord: async ({ dbName, storeName, key }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const actualKey = deserializeValue(key);
        const req = store.get(actualKey);
        const result = await promisifyRequest(req);
        if (result === undefined) {
          throw new Error('Record not found');
        }
        return {
          key,
          value: await serializeValueAsync(result)
        };
      } finally {
        db.close();
      }
    },

    putRecord: async ({ dbName, storeName, key, value }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const actualValue = deserializeValue(value);
        let req;

        if (store.keyPath) {
          req = store.put(actualValue);
        } else {
          const actualKey = deserializeValue(key);
          req = store.put(actualValue, actualKey);
        }

        const resKey = await promisifyRequest(req);
        await promisifyTransaction(tx);
        return { success: true, key: serializeValueSync(resKey) };
      } finally {
        db.close();
      }
    },

    addRecord: async ({ dbName, storeName, key, value }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const actualValue = deserializeValue(value);
        let req;

        if (store.keyPath) {
          req = store.add(actualValue);
        } else {
          const actualKey = deserializeValue(key);
          req = store.add(actualValue, actualKey);
        }

        const resKey = await promisifyRequest(req);
        await promisifyTransaction(tx);
        return { success: true, key: serializeValueSync(resKey) };
      } finally {
        db.close();
      }
    },

    deleteRecord: async ({ dbName, storeName, key }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const actualKey = deserializeValue(key);
        const req = store.delete(actualKey);
        await promisifyRequest(req);
        await promisifyTransaction(tx);
        return { success: true };
      } finally {
        db.close();
      }
    },

    deleteRecords: async ({ dbName, storeName, keys }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const k of keys) {
          const actualKey = deserializeValue(k);
          store.delete(actualKey);
        }
        await promisifyTransaction(tx);
        return { success: true, count: keys.length };
      } finally {
        db.close();
      }
    },

    clearStore: async ({ dbName, storeName }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        await promisifyRequest(req);
        await promisifyTransaction(tx);
        return { success: true };
      } finally {
        db.close();
      }
    },

    createObjectStore: async ({ dbName, storeName, keyPath, autoIncrement }) => {
      // Step 1: get current version
      const currentDb = await openDatabase(dbName);
      const newVersion = currentDb.version + 1;
      currentDb.close();

      // Step 2: upgrade
      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbName, newVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          const options = { autoIncrement: !!autoIncrement };
          if (keyPath && keyPath.trim()) {
            options.keyPath = keyPath.trim();
          }
          db.createObjectStore(storeName, options);
        };
        req.onsuccess = () => {
          req.result.close();
          resolve({ success: true, version: newVersion });
        };
        req.onerror = () => reject(req.error || new Error('Failed to create object store'));
        req.onblocked = () => reject(new Error('Schema change blocked by open connection'));
      });
    },

    deleteObjectStore: async ({ dbName, storeName }) => {
      const currentDb = await openDatabase(dbName);
      const newVersion = currentDb.version + 1;
      currentDb.close();

      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbName, newVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (db.objectStoreNames.contains(storeName)) {
            db.deleteObjectStore(storeName);
          }
        };
        req.onsuccess = () => {
          req.result.close();
          resolve({ success: true, version: newVersion });
        };
        req.onerror = () => reject(req.error || new Error('Failed to delete object store'));
        req.onblocked = () => reject(new Error('Schema change blocked by open connection'));
      });
    },

    createIndex: async ({ dbName, storeName, indexName, keyPath, unique = false, multiEntry = false }) => {
      const currentDb = await openDatabase(dbName);
      const newVersion = currentDb.version + 1;
      currentDb.close();

      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbName, newVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          const tx = e.target.transaction;
          const store = tx.objectStore(storeName);
          store.createIndex(indexName, keyPath, { unique: !!unique, multiEntry: !!multiEntry });
        };
        req.onsuccess = () => {
          req.result.close();
          resolve({ success: true, version: newVersion });
        };
        req.onerror = () => reject(req.error || new Error('Failed to create index'));
        req.onblocked = () => reject(new Error('Schema change blocked by open connection'));
      });
    },

    deleteIndex: async ({ dbName, storeName, indexName }) => {
      const currentDb = await openDatabase(dbName);
      const newVersion = currentDb.version + 1;
      currentDb.close();

      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbName, newVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          const tx = e.target.transaction;
          const store = tx.objectStore(storeName);
          store.deleteIndex(indexName);
        };
        req.onsuccess = () => {
          req.result.close();
          resolve({ success: true, version: newVersion });
        };
        req.onerror = () => reject(req.error || new Error('Failed to delete index'));
        req.onblocked = () => reject(new Error('Schema change blocked by open connection'));
      });
    },

    createDatabase: async ({ dbName, initialStoreName = 'items', keyPath, autoIncrement }) => {
      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          const options = { autoIncrement: !!autoIncrement };
          if (keyPath && keyPath.trim()) {
            options.keyPath = keyPath.trim();
          }
          db.createObjectStore(initialStoreName, options);
        };
        req.onsuccess = () => {
          knownDatabases.add(dbName);
          req.result.close();
          resolve({ success: true, name: dbName });
        };
        req.onerror = () => reject(req.error || new Error('Failed to create database'));
        req.onblocked = () => reject(new Error('Create database blocked'));
      });
    },

    deleteDatabase: async ({ dbName }) => {
      return new Promise((resolve, reject) => {
        const req = window.indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => {
          knownDatabases.delete(dbName);
          resolve({ success: true });
        };
        req.onerror = () => reject(req.error || new Error('Failed to delete database ' + dbName));
        req.onblocked = () => reject(new Error('Database deletion blocked. Close any tabs using this DB.'));
      });
    },

    importRecords: async ({ dbName, storeName, records, mode = 'put' }) => {
      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        let count = 0;

        for (const item of records) {
          const deserialized = deserializeValue(item);
          if (mode === 'add') {
            store.add(deserialized);
          } else {
            store.put(deserialized);
          }
          count++;
        }

        await promisifyTransaction(tx);
        return { success: true, count };
      } finally {
        db.close();
      }
    },

    executeScript: async ({ dbName, storeName, code }) => {
      const startTime = performance.now();
      const logs = [];
      const originalConsoleLog = console.log;

      // Intercept logs for script run
      const captureLog = (...args) => {
        try {
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        } catch (e) {
          logs.push(String(args));
        }
      };

      const db = await openDatabase(dbName);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        // Helper methods wrapped with promises
        const helpers = {
          getAll: () => promisifyRequest(store.getAll()),
          getAllKeys: () => promisifyRequest(store.getAllKeys()),
          get: (k) => promisifyRequest(store.get(k)),
          put: (v, k) => promisifyRequest(store.put(v, k)),
          add: (v, k) => promisifyRequest(store.add(v, k)),
          delete: (k) => promisifyRequest(store.delete(k)),
          clear: () => promisifyRequest(store.clear()),
          count: (q) => promisifyRequest(store.count(q)),
          log: captureLog
        };

        const runner = new Function(
          'db',
          'store',
          'transaction',
          'indexedDB',
          'IDBKeyRange',
          'helpers',
          'log',
          `return (async () => {
            ${code}
          })();`
        );

        const rawResult = await runner(db, store, tx, window.indexedDB, window.IDBKeyRange, helpers, captureLog);
        await promisifyTransaction(tx);
        const durationMs = Math.round(performance.now() - startTime);

        return {
          success: true,
          durationMs,
          logs,
          result: await serializeValueAsync(rawResult)
        };
      } finally {
        db.close();
      }
    }
  };

  // Synchronous quick serializer for keys
  function serializeValueSync(val) {
    if (val === undefined) return { __idb_type: 'undefined' };
    if (val === null || typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
      return val;
    }
    if (typeof val === 'bigint') return { __idb_type: 'BigInt', value: val.toString() };
    if (val instanceof Date) return { __idb_type: 'Date', iso: val.toISOString(), time: val.getTime() };
    if (Array.isArray(val)) return val.map(serializeValueSync);
    return String(val);
  }

  // Public Bridge API
  const bridge = {
    version: '1.0.0',
    tasks,
    knownDatabases,

    dispatch: function(reqId, action, params = {}) {
      const handler = handlers[action];
      if (!handler) {
        return {
          immediate: true,
          success: false,
          error: 'Unknown bridge action: ' + action
        };
      }

      tasks.set(reqId, { status: 'pending' });

      handler(params)
        .then(result => {
          tasks.set(reqId, { status: 'resolved', result });
        })
        .catch(err => {
          tasks.set(reqId, { status: 'rejected', error: err.message || String(err) });
        });

      return { immediate: false, reqId };
    },

    poll: function(reqId) {
      if (!tasks.has(reqId)) {
        return null;
      }
      const task = tasks.get(reqId);
      if (task.status === 'pending') {
        return null;
      }
      tasks.delete(reqId);
      if (task.status === 'resolved') {
        return { success: true, data: task.result };
      } else {
        return { success: false, error: task.error };
      }
    },

    cleanup: function(reqId) {
      tasks.delete(reqId);
      return true;
    },

    getLastMutationTime: function() {
      return lastMutationTime;
    }
  };

  Object.defineProperty(window, '__IDB_BEACON__', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: bridge
  });
})();
