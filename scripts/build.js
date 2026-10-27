/**
 * Cross-Browser Build & Packaging Script for IndexedDBeacon
 * Generates tailored builds for Chromium (Chrome, Edge, Brave, Opera) and Mozilla Firefox.
 * 
 * Zero external dependencies (uses Node.js built-ins: fs, path, zlib).
 * 
 * Usage:
 *   node scripts/build.js                # Builds both Chromium & Firefox
 *   node scripts/build.js --target=chrome   # Builds Chromium only
 *   node scripts/build.js --target=firefox  # Builds Firefox only
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

// Read base manifest
const baseManifestPath = path.resolve(ROOT_DIR, 'manifest.json');
const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));

// Extension files and directories to copy into release packages
const INCLUDED_PATHS = [
  'devtools',
  'icons',
  'popup'
];

/**
 * Creates a valid ZIP buffer from an array of file records using Node.js built-in zlib.
 * @param {Array<{ name: string, content: Buffer }>} files 
 * @returns {Buffer}
 */
function createZipBuffer(files) {
  const localChunks = [];
  const cdChunks = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8');
    const uncompressed = file.content;
    const compressed = zlib.deflateRawSync(uncompressed);
    const crc = zlib.crc32(uncompressed);

    // Local Header (30 bytes)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8);          // compression method: deflate
    localHeader.writeUInt16LE(0x5678, 10);    // last mod time
    localHeader.writeUInt16LE(0x5678, 12);    // last mod date
    localHeader.writeUInt32LE(crc, 14);       // crc32
    localHeader.writeUInt32LE(compressed.length, 18);   // compressed size
    localHeader.writeUInt32LE(uncompressed.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);      // filename len
    localHeader.writeUInt16LE(0, 28);                   // extra len

    localChunks.push(localHeader, nameBuf, compressed);

    // Central Directory Entry (46 bytes)
    const cdEntry = Buffer.alloc(46);
    cdEntry.writeUInt32LE(0x02014b50, 0); // signature
    cdEntry.writeUInt16LE(20, 4);         // version made by
    cdEntry.writeUInt16LE(20, 6);         // version needed
    cdEntry.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    cdEntry.writeUInt16LE(8, 10);         // deflate
    cdEntry.writeUInt16LE(0x5678, 12);    // time
    cdEntry.writeUInt16LE(0x5678, 14);    // date
    cdEntry.writeUInt32LE(crc, 16);       // crc32
    cdEntry.writeUInt32LE(compressed.length, 20);   // compressed size
    cdEntry.writeUInt32LE(uncompressed.length, 24); // uncompressed size
    cdEntry.writeUInt16LE(nameBuf.length, 28);      // filename len
    cdEntry.writeUInt16LE(0, 30);         // extra len
    cdEntry.writeUInt16LE(0, 32);         // comment len
    cdEntry.writeUInt16LE(0, 34);         // disk start
    cdEntry.writeUInt16LE(0, 36);         // internal attrs
    cdEntry.writeUInt32LE(0x81a40000, 38);// external attrs (regular file 0644)
    cdEntry.writeUInt32LE(offset, 42);    // local header offset

    cdChunks.push(cdEntry, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const cdOffset = offset;
  const cdBuf = Buffer.concat(cdChunks);
  const cdSize = cdBuf.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // start disk
  eocd.writeUInt16LE(files.length, 8);   // entries on this disk
  eocd.writeUInt16LE(files.length, 10);  // total entries
  eocd.writeUInt32LE(cdSize, 12);        // central directory size
  eocd.writeUInt32LE(cdOffset, 16);      // central directory offset
  eocd.writeUInt16LE(0, 20);             // comment len

  return Buffer.concat([...localChunks, cdBuf, eocd]);
}

/**
 * Recursively copies a directory or file.
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

/**
 * Collects all files in a directory recursively for zip archiving.
 */
function collectFilesForZip(dir, baseDir = dir) {
  const list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list.push(...collectFilesForZip(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      list.push({
        name: relPath,
        content: fs.readFileSync(fullPath)
      });
    }
  }
  return list;
}

/**
 * Ensures bridgeSource.js is compiled and fresh before packaging.
 */
function ensureBridgeSource() {
  const bridgeJsPath = path.resolve(ROOT_DIR, 'devtools/bridge.js');
  const bridgeSourcePath = path.resolve(ROOT_DIR, 'devtools/bridgeSource.js');
  const bridgeJsContent = fs.readFileSync(bridgeJsPath, 'utf8');

  const fileContent = `/**
 * Pre-bundled Injected Bridge Script
 * AUTO-GENERATED from devtools/bridge.js by scripts/build.js
 */
export const BRIDGE_SOURCE = ${JSON.stringify(bridgeJsContent)};
`;

  fs.writeFileSync(bridgeSourcePath, fileContent, 'utf8');
}

/**
 * Builds a specific target ('chrome' or 'firefox').
 */
function buildTarget(target) {
  const isFirefox = target === 'firefox';
  const targetName = isFirefox ? 'Firefox' : 'Chromium';
  const outDir = path.resolve(DIST_DIR, isFirefox ? 'firefox' : 'chrome');
  const zipName = isFirefox ? `indexed-dbeacon-firefox-v${baseManifest.version}.zip` : `indexed-dbeacon-chrome-v${baseManifest.version}.zip`;
  const zipPath = path.resolve(DIST_DIR, zipName);

  console.log(`\n📦 Building ${targetName} distribution (v${baseManifest.version})...`);

  // Clean target directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Copy common resources
  for (const relPath of INCLUDED_PATHS) {
    const srcPath = path.resolve(ROOT_DIR, relPath);
    const destPath = path.resolve(outDir, relPath);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
    }
  }

  // 2. Build target-specific manifest
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  if (isFirefox) {
    // Firefox Gecko-specific settings (AMO compliant)
    manifest.browser_specific_settings = {
      gecko: {
        id: "indexed-dbeacon@thatnguyen.dev",
        strict_min_version: "142.0",
        data_collection_permissions: {
          required: ["none"]
        }
      }
    };
  } else {
    // Chromium-specific settings
    delete manifest.browser_specific_settings;
    manifest.minimum_chrome_version = "100";
  }

  const manifestPath = path.resolve(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // 3. Create zip package
  const filesToZip = collectFilesForZip(outDir);
  const zipBuffer = createZipBuffer(filesToZip);
  fs.writeFileSync(zipPath, zipBuffer);

  // If Firefox, also generate a .xpi alias
  if (isFirefox) {
    const xpiPath = path.resolve(DIST_DIR, `indexed-dbeacon-firefox-v${baseManifest.version}.xpi`);
    fs.copyFileSync(zipPath, xpiPath);
  }

  const zipKb = (zipBuffer.length / 1024).toFixed(1);
  console.log(`  ✓ Unpacked folder: dist/${isFirefox ? 'firefox' : 'chrome'}/ (${filesToZip.length} files)`);
  console.log(`  ✓ Release package: dist/${zipName} (${zipKb} KB)`);
  if (isFirefox) {
    console.log(`  ✓ Firefox Add-on:  dist/indexed-dbeacon-firefox-v${baseManifest.version}.xpi`);
  }
}

// Main execution
console.log('====================================================');
console.log('   IndexedDBeacon Cross-Browser Build Tool');
console.log('====================================================');

// Pre-build step
ensureBridgeSource();

// Parse CLI flags
const args = process.argv.slice(2);
let targetArg = 'all';

for (const arg of args) {
  if (arg.startsWith('--target=')) {
    targetArg = arg.split('=')[1].toLowerCase();
  }
}

fs.mkdirSync(DIST_DIR, { recursive: true });

if (targetArg === 'chrome' || targetArg === 'chromium') {
  buildTarget('chrome');
} else if (targetArg === 'firefox') {
  buildTarget('firefox');
} else {
  buildTarget('chrome');
  buildTarget('firefox');
}

console.log('\n✨ Build completed successfully!\n');
