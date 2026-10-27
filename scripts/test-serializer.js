// Test serializer and deserializer logic
import { inspect } from 'util';

function serializeValue(val, seen = new WeakSet(), depth = 0) {
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
  if (typeof Blob !== 'undefined' && val instanceof Blob) {
    return { __idb_type: 'Blob', size: val.size, mime: val.type, name: val.name || null };
  }
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
  if (val instanceof Map) {
    const entries = [];
    val.forEach((v, k) => {
      entries.push([serializeValue(k, seen, depth + 1), serializeValue(v, seen, depth + 1)]);
    });
    return { __idb_type: 'Map', entries };
  }
  if (val instanceof Set) {
    const values = [];
    val.forEach(v => {
      values.push(serializeValue(v, seen, depth + 1));
    });
    return { __idb_type: 'Set', values };
  }

  if (typeof val === 'object') {
    if (seen.has(val)) {
      return { __idb_type: 'Circular' };
    }
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map(item => serializeValue(item, seen, depth + 1));
    }

    const res = {};
    for (const key of Object.keys(val)) {
      res[key] = serializeValue(val[key], seen, depth + 1);
    }
    return res;
  }

  return String(val);
}

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

// Test sample object
const sample = {
  id: 101,
  name: "Alice",
  balance: 4500000000000n,
  joinedAt: new Date("2026-01-15T10:00:00Z"),
  pattern: /^[a-z0-9]+$/i,
  tags: new Set(["admin", "developer"]),
  metadata: new Map([["theme", "dark"], ["locale", "en-US"]]),
  binary: new Uint8Array([1, 2, 3, 255, 128]),
  extra: undefined
};

const serialized = serializeValue(sample);
console.log("Serialized:", JSON.stringify(serialized, null, 2));

const deserialized = deserializeValue(serialized);
console.log("Deserialized balance type:", typeof deserialized.balance, deserialized.balance.toString());
console.log("Deserialized joinedAt instanceof Date:", deserialized.joinedAt instanceof Date, deserialized.joinedAt.toISOString());
console.log("Deserialized pattern instanceof RegExp:", deserialized.pattern instanceof RegExp);
console.log("Deserialized tags instanceof Set:", deserialized.tags instanceof Set, Array.from(deserialized.tags));
console.log("Deserialized metadata instanceof Map:", deserialized.metadata instanceof Map, Array.from(deserialized.metadata.entries()));
console.log("Deserialized extra is undefined:", deserialized.extra === undefined);
