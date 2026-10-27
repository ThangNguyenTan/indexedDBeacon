if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
  globalThis.chrome = globalThis.browser;
}

import { BRIDGE_SOURCE } from './bridgeSource.js';

class BridgeClient {
  constructor() {
    this.injected = false;
  }

  /**
   * Dispatches an action to the inspected page and polls for the result.
   */
  async call(action, params = {}, timeout = 20000) {
    // Check if running in a popout window
    const isStandaloneWindow = typeof chrome === 'undefined' ||
      !chrome.devtools ||
      !chrome.devtools.inspectedWindow ||
      new URLSearchParams(window.location.search).get('mode') === 'window';
    if (isStandaloneWindow) {
      if (window.opener && window.opener.bridgeClient) {
        return window.opener.bridgeClient.call(action, params, timeout);
      }
      throw new Error('Disconnected from inspected tab. Re-open from Chrome DevTools.');
    }

    const reqId = 'req_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();

    // Prepare dispatch code
    const escapedParams = JSON.stringify(params);
    const dispatchCode = `
      (function() {
        try {
          if (!window.__IDB_BEACON__) {
            ${BRIDGE_SOURCE}
          }
          return window.__IDB_BEACON__.dispatch(${JSON.stringify(reqId)}, ${JSON.stringify(action)}, ${escapedParams});
        } catch (err) {
          return { immediate: true, success: false, error: err.message || String(err) };
        }
      })()
    `;

    return new Promise((resolve, reject) => {
      // Step 1: Dispatch
      chrome.devtools.inspectedWindow.eval(dispatchCode, (dispatchResult, exception) => {
        if (exception) {
          const errText = exception.value || exception.description || 'DevTools eval error';
          return reject(new Error(errText));
        }

        if (!dispatchResult) {
          return reject(new Error('No response from bridge'));
        }

        if (dispatchResult.immediate) {
          if (dispatchResult.success) {
            return resolve(dispatchResult.data);
          } else {
            return reject(new Error(dispatchResult.error || 'Operation failed'));
          }
        }

        // Step 2: Poll for result
        const startTime = Date.now();
        const pollCode = `window.__IDB_BEACON__ ? window.__IDB_BEACON__.poll(${JSON.stringify(reqId)}) : null`;

        const pollTimer = setInterval(() => {
          chrome.devtools.inspectedWindow.eval(pollCode, (pollResult, pollErr) => {
            if (pollErr) {
              clearInterval(pollTimer);
              return reject(new Error(pollErr.value || pollErr.description || 'Polling error'));
            }

            if (pollResult) {
              clearInterval(pollTimer);
              if (pollResult.success) {
                resolve(pollResult.data);
              } else {
                reject(new Error(pollResult.error || 'Operation failed in inspected page'));
              }
            } else if (Date.now() - startTime > timeout) {
              clearInterval(pollTimer);
              // Attempt cleanup
              chrome.devtools.inspectedWindow.eval(`window.__IDB_BEACON__ && window.__IDB_BEACON__.cleanup(${JSON.stringify(reqId)})`);
              reject(new Error(`Operation '${action}' timed out after ${timeout}ms`));
            }
          });
        }, 25);
      });
    });
  }

  // High-level API methods
  ping() {
    return this.call('ping');
  }

  getStorageEstimate() {
    return this.call('getStorageEstimate');
  }

  listDatabases() {
    return this.call('listDatabases');
  }

  registerDatabase(dbName) {
    return this.call('registerDatabase', { dbName });
  }

  getDatabaseDetails(dbName) {
    return this.call('getDatabaseDetails', { dbName });
  }

  getRecords(options) {
    return this.call('getRecords', options);
  }

  getRecord(dbName, storeName, key) {
    return this.call('getRecord', { dbName, storeName, key });
  }

  putRecord(dbName, storeName, key, value) {
    return this.call('putRecord', { dbName, storeName, key, value });
  }

  addRecord(dbName, storeName, key, value) {
    return this.call('addRecord', { dbName, storeName, key, value });
  }

  deleteRecord(dbName, storeName, key) {
    return this.call('deleteRecord', { dbName, storeName, key });
  }

  deleteRecords(dbName, storeName, keys) {
    return this.call('deleteRecords', { dbName, storeName, keys });
  }

  clearStore(dbName, storeName) {
    return this.call('clearStore', { dbName, storeName });
  }

  createObjectStore(dbName, storeName, keyPath, autoIncrement) {
    return this.call('createObjectStore', { dbName, storeName, keyPath, autoIncrement });
  }

  deleteObjectStore(dbName, storeName) {
    return this.call('deleteObjectStore', { dbName, storeName });
  }

  createIndex(dbName, storeName, indexName, keyPath, unique, multiEntry) {
    return this.call('createIndex', { dbName, storeName, indexName, keyPath, unique, multiEntry });
  }

  deleteIndex(dbName, storeName, indexName) {
    return this.call('deleteIndex', { dbName, storeName, indexName });
  }

  createDatabase(dbName, initialStoreName, keyPath, autoIncrement) {
    return this.call('createDatabase', { dbName, initialStoreName, keyPath, autoIncrement });
  }

  deleteDatabase(dbName) {
    return this.call('deleteDatabase', { dbName });
  }

  importRecords(dbName, storeName, records, mode = 'put') {
    return this.call('importRecords', { dbName, storeName, records, mode });
  }

  executeScript(dbName, storeName, code) {
    return this.call('executeScript', { dbName, storeName, code });
  }

  async getLastMutation() {
    try {
      const code = `(function() { return window.__IDB_BEACON__ ? window.__IDB_BEACON__.getLastMutationTime() : 0; })()`;
      return new Promise(resolve => {
        if (typeof chrome === 'undefined' || !chrome.devtools || !chrome.devtools.inspectedWindow) {
          return resolve(0);
        }
        chrome.devtools.inspectedWindow.eval(code, (res) => resolve(res || 0));
      });
    } catch (e) {
      return 0;
    }
  }
}

export const bridgeClient = new BridgeClient();
if (typeof window !== 'undefined') {
  window.bridgeClient = bridgeClient; // Expose on window for popout windows
}
