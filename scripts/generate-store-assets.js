/**
 * Chrome Web Store Asset Generator
 * Generates promo tiles and 1280x800 screenshots with exact store specifications.
 * Uses local Google Chrome in headless mode for pixel-perfect rendering.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(ROOT_DIR, 'store-assets');
const TEMP_DIR = path.resolve(ROOT_DIR, '.temp-assets');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(CHROME_PATH)) {
  console.error('Google Chrome not found at:', CHROME_PATH);
  process.exit(1);
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Read icon base64
const icon128Base64 = fs.readFileSync(path.resolve(ROOT_DIR, 'icons/icon128.png')).toString('base64');
const iconSrc = `data:image/png;base64,${icon128Base64}`;

function captureHtml(html, outputPath, width, height) {
  const tempHtmlPath = path.resolve(TEMP_DIR, `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.html`);
  fs.writeFileSync(tempHtmlPath, html, 'utf8');

  try {
    execFileSync(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      `file://${tempHtmlPath}`
    ], { stdio: 'pipe' });
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

// Common styles for DevTools mockups
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: #0d0e12;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    overflow: hidden;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .browser-frame {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #141518;
  }
  .browser-top-bar {
    height: 38px;
    background: #1a1b1f;
    border-bottom: 1px solid #28292e;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
  }
  .tab-strip {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }
  .browser-tab {
    padding: 6px 14px;
    font-size: 11px;
    color: #9ca3af;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 4px 4px 0 0;
  }
  .browser-tab.active {
    background: #141518;
    color: #6366f1;
    font-weight: 600;
    border-top: 2px solid #6366f1;
  }
  .tag-badge {
    background: #312e81;
    color: #c7d2fe;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 9999px;
    font-weight: 600;
  }
  .feature-banner {
    background: linear-gradient(90deg, #1e1b4b 0%, #0f172a 100%);
    border-bottom: 1px solid #312e81;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .feature-banner-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .feature-banner-title {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }
  .feature-banner-desc {
    font-size: 12px;
    color: #a5b4fc;
  }
  .app-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .workspace-top {
    height: 300px;
    display: flex;
    border-bottom: 1px solid #28292e;
  }
  .sidebar {
    width: 250px;
    background: #18191d;
    border-right: 1px solid #28292e;
    display: flex;
    flex-direction: column;
  }
  .sidebar-header {
    padding: 8px 12px;
    border-bottom: 1px solid #28292e;
    font-weight: 600;
    font-size: 11px;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tree-node {
    padding: 5px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #d1d5db;
    cursor: pointer;
  }
  .tree-node.active {
    background: rgba(99, 102, 241, 0.16);
    color: #818cf8;
    font-weight: 600;
  }
  .tree-indent { margin-left: 18px; }
  .badge-count {
    margin-left: auto;
    font-size: 10px;
    color: #6b7280;
    font-family: ui-monospace, monospace;
  }
  .inspector {
    flex: 1;
    background: #141518;
    display: flex;
    flex-direction: column;
  }
  .inspector-header {
    height: 30px;
    padding: 0 12px;
    border-bottom: 1px solid #28292e;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #18191d;
  }
  .inspector-tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid #28292e;
    padding: 0 8px;
    background: #141518;
  }
  .tab-btn {
    padding: 4px 10px;
    font-size: 11px;
    color: #9ca3af;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
  }
  .tab-btn.active {
    color: #818cf8;
    border-color: #6366f1;
    font-weight: 600;
  }
  .inspector-body {
    flex: 1;
    padding: 12px;
    overflow: auto;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.5;
  }
  .json-key { color: #818cf8; font-weight: 600; }
  .json-str { color: #34d399; }
  .json-num { color: #fbbf24; }
  .json-bool { color: #c084fc; font-weight: 600; }
  .json-type-badge {
    background: #3730a3;
    color: #e0e7ff;
    padding: 0 4px;
    border-radius: 3px;
    font-size: 9px;
    margin-left: 4px;
  }
  .workspace-bottom {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #141518;
  }
  .toolbar {
    height: 30px;
    background: #18191d;
    border-bottom: 1px solid #28292e;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 6px;
  }
  .tool-btn {
    height: 22px;
    padding: 0 8px;
    font-size: 11px;
    background: #24252a;
    border: 1px solid #37383f;
    border-radius: 3px;
    color: #d1d5db;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .tool-btn.primary {
    background: #4f46e5;
    border-color: #4f46e5;
    color: #ffffff;
  }
  .table-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .grid-header {
    height: 24px;
    background: #1c1d22;
    border-bottom: 1px solid #28292e;
    display: flex;
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
  }
  .grid-row {
    height: 26px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid #1f2026;
    font-size: 11px;
  }
  .grid-row.selected {
    background: #25283b;
    border-left: 2px solid #6366f1;
  }
  .grid-cell {
    padding: 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .col-key { width: 180px; color: #818cf8; font-weight: 600; font-family: ui-monospace, monospace; }
  .col-val { flex: 1; font-family: ui-monospace, monospace; }
`;

console.log('🎨 Generating Chrome Web Store Graphic Assets (100% specification compliant)...\n');

// 1. Small Promo Tile (440x280)
const promoSmallHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 440px;
    height: 280px;
    background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0c0d12 85%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .glow {
    position: absolute;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, transparent 70%);
    top: 10px;
    left: 90px;
    z-index: 0;
  }
  .logo {
    width: 68px;
    height: 68px;
    position: relative;
    z-index: 1;
    filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.45));
    margin-bottom: 12px;
  }
  .title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 4px;
    position: relative;
    z-index: 1;
  }
  .subtitle {
    font-size: 13px;
    color: #a5b4fc;
    font-weight: 500;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }
  .badges {
    display: flex;
    gap: 8px;
    position: relative;
    z-index: 1;
  }
  .badge {
    background: rgba(49, 46, 129, 0.65);
    border: 1px solid rgba(129, 140, 248, 0.4);
    color: #e0e7ff;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 9999px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <img src="${iconSrc}" class="logo" alt="" />
  <h1 class="title">IndexedDBeacon</h1>
  <p class="subtitle">The Modern IndexedDB Manager for DevTools</p>
  <div class="badges">
    <span class="badge">🔒 Zero Permissions</span>
    <span class="badge">✏️ In-Place CRUD</span>
    <span class="badge">🪟 Popout Mode</span>
  </div>
</body>
</html>
`;

captureHtml(promoSmallHtml, path.resolve(ASSETS_DIR, 'promo-small-440x280.png'), 440, 280);
console.log('  ✓ Generated: store-assets/promo-small-440x280.png (440x280)');

// 2. Marquee Promo Tile (1400x560)
const promoMarqueeHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1400px;
    height: 560px;
    background: radial-gradient(circle at 75% 40%, #1e1b4b 0%, #090a0f 80%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    display: flex;
    align-items: center;
    padding: 0 80px;
    position: relative;
    overflow: hidden;
  }
  .glow-large {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
    right: 200px;
    top: -50px;
    z-index: 0;
  }
  .left-content {
    flex: 1;
    z-index: 1;
    max-width: 620px;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .logo {
    width: 72px;
    height: 72px;
    filter: drop-shadow(0 6px 16px rgba(99, 102, 241, 0.5));
  }
  .title {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: -1px;
    line-height: 1.1;
    background: linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .tagline {
    font-size: 22px;
    color: #c7d2fe;
    font-weight: 600;
    margin-bottom: 14px;
    line-height: 1.3;
  }
  .desc {
    font-size: 15px;
    color: #94a3b8;
    line-height: 1.6;
    margin-bottom: 26px;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .pill {
    background: rgba(30, 27, 75, 0.7);
    border: 1px solid rgba(129, 140, 248, 0.35);
    color: #e0e7ff;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
  }
  .right-preview {
    width: 540px;
    height: 380px;
    background: #141518;
    border: 1px solid #2d2e36;
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(99, 102, 241, 0.2);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 1;
  }
  .mock-header {
    height: 32px;
    background: #18191d;
    border-bottom: 1px solid #28292e;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 6px;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-red { background: #ef4444; }
  .dot-yellow { background: #f59e0b; }
  .dot-green { background: #10b981; }
  .mock-body {
    flex: 1;
    display: flex;
  }
  .mock-sidebar {
    width: 170px;
    background: #16171b;
    border-right: 1px solid #28292e;
    padding: 10px;
    font-size: 11px;
    color: #9ca3af;
  }
  .mock-main {
    flex: 1;
    padding: 12px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #e5e7eb;
  }
</style>
</head>
<body>
  <div class="glow-large"></div>
  <div class="left-content">
    <div class="brand-row">
      <img src="${iconSrc}" class="logo" alt="" />
      <div class="title">IndexedDBeacon</div>
    </div>
    <div class="tagline">The Modern IndexedDB Manager for Google Chrome</div>
    <p class="desc">
      Stop fighting Chrome's default Storage tab. Inspect, query, edit nested JSON, preview Blobs, export & import, and pop out into a dedicated window.
    </p>
    <div class="pills">
      <span class="pill">🔒 100% Local & 0 Permissions</span>
      <span class="pill">✏️ In-Place JSON Editing</span>
      <span class="pill">🪟 Standalone Window</span>
      <span class="pill">⚡ BigInt & Blob Previews</span>
    </div>
  </div>
  <div class="right-preview">
    <div class="mock-header">
      <div class="dot dot-red"></div>
      <div class="dot dot-yellow"></div>
      <div class="dot dot-green"></div>
      <span style="margin-left: 8px; font-size: 11px; color: #9ca3af; font-weight: 500;">IndexedDBeacon &mdash; DevTools</span>
    </div>
    <div class="mock-body">
      <div class="mock-sidebar">
        <div style="font-weight: 700; color: #818cf8; margin-bottom: 8px;">Databases (3)</div>
        <div style="color: #ffffff; font-weight: 600; margin-bottom: 4px;">▼ ShopMart_v2</div>
        <div style="padding-left: 10px; color: #a5b4fc;">● users <span style="float:right; font-size: 10px;">142</span></div>
        <div style="padding-left: 10px; color: #9ca3af;">● orders <span style="float:right; font-size: 10px;">89</span></div>
        <div style="margin-top: 8px; color: #9ca3af;">▶ SessionCache</div>
      </div>
      <div class="mock-main">
        <div style="color: #6b7280; margin-bottom: 4px;">// Record: usr_104928</div>
        <div>{</div>
        <div style="padding-left: 14px;"><span style="color:#818cf8;">"id"</span>: <span style="color:#fbbf24;">104928</span>,</div>
        <div style="padding-left: 14px;"><span style="color:#818cf8;">"name"</span>: <span style="color:#34d399;">"Sarah Jenkins"</span>,</div>
        <div style="padding-left: 14px;"><span style="color:#818cf8;">"balance"</span>: <span style="color:#fbbf24;">9450000000000n</span>,</div>
        <div style="padding-left: 14px;"><span style="color:#818cf8;">"avatar"</span>: <span style="color:#c084fc;">Blob(142.8 KB, "image/png")</span>,</div>
        <div style="padding-left: 14px;"><span style="color:#818cf8;">"active"</span>: <span style="color:#c084fc; font-weight:bold;">true</span></div>
        <div>}</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

captureHtml(promoMarqueeHtml, path.resolve(ASSETS_DIR, 'promo-marquee-1400x560.png'), 1400, 560);
console.log('  ✓ Generated: store-assets/promo-marquee-1400x560.png (1400x560)');

// 3. Screenshot 1: Overview & 3-Pane Developer Layout (1280x800)
const ss1Html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-top-bar">
      <div class="tab-strip">
        <div class="browser-tab">Elements</div>
        <div class="browser-tab">Console</div>
        <div class="browser-tab">Sources</div>
        <div class="browser-tab">Network</div>
        <div class="browser-tab active">
          <img src="${iconSrc}" width="14" height="14" alt="" />
          IndexedDBeacon
        </div>
        <div class="browser-tab">Application</div>
      </div>
    </div>
    <div class="feature-banner">
      <div class="feature-banner-left">
        <img src="${iconSrc}" width="28" height="28" alt="" />
        <div>
          <div class="feature-banner-title">1. High-Density 3-Pane Developer Workspace</div>
          <div class="feature-banner-desc">Full visibility: Database hierarchy, interactive record grid, and deep structural inspector simultaneously.</div>
        </div>
      </div>
      <span class="tag-badge">ZERO PERMISSIONS</span>
    </div>
    <div class="app-layout">
      <div class="workspace-top">
        <div class="sidebar">
          <div class="sidebar-header">
            <span>DATABASES (3)</span>
            <span class="mono">All Active</span>
          </div>
          <div class="tree-node active">
            <span>▼</span>
            <strong>ShopMart_v2</strong>
            <span class="badge-count">v2</span>
          </div>
          <div class="tree-node tree-indent active">
            <span>●</span>
            <span>users</span>
            <span class="badge-count">1,240</span>
          </div>
          <div class="tree-node tree-indent">
            <span>●</span>
            <span>products</span>
            <span class="badge-count">580</span>
          </div>
          <div class="tree-node tree-indent">
            <span>●</span>
            <span>orders</span>
            <span class="badge-count">3,920</span>
          </div>
          <div class="tree-node">
            <span>▶</span>
            <span>AppConfigDB</span>
            <span class="badge-count">v1</span>
          </div>
          <div class="tree-node">
            <span>▶</span>
            <span>BinaryAssetCache</span>
            <span class="badge-count">v4</span>
          </div>
        </div>
        <div class="inspector">
          <div class="inspector-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:#312e81; color:#c7d2fe; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:700;">RECORD</span>
              <span class="mono" style="font-weight:700; color:#818cf8;">usr_492019</span>
            </div>
            <div style="display:flex; gap:6px;">
              <span class="tool-btn">📋 Copy</span>
              <span class="tool-btn">Duplicate</span>
              <span class="tool-btn primary">✏️ Edit</span>
            </div>
          </div>
          <div class="inspector-tabs">
            <button class="tab-btn active">Tree View</button>
            <button class="tab-btn">Raw JSON</button>
            <button class="tab-btn">Media (1)</button>
            <button class="tab-btn">Editor</button>
          </div>
          <div class="inspector-body">
            <div>▼ <span class="json-key">id</span>: <span class="json-num">492019</span></div>
            <div>▼ <span class="json-key">name</span>: <span class="json-str">"Alexander Wright"</span></div>
            <div>▼ <span class="json-key">email</span>: <span class="json-str">"alex.wright@example.com"</span></div>
            <div>▼ <span class="json-key">role</span>: <span class="json-str">"team_admin"</span></div>
            <div>▼ <span class="json-key">balance</span>: <span class="json-num">1500000000000n</span> <span class="json-type-badge">BigInt</span></div>
            <div>▼ <span class="json-key">lastLogin</span>: <span class="json-str">"2026-10-27T08:15:00.000Z"</span> <span class="json-type-badge">Date</span></div>
            <div>▶ <span class="json-key">permissions</span>: <span style="color:#9ca3af;">Array(6)</span></div>
            <div>▶ <span class="json-key">preferences</span>: <span style="color:#9ca3af;">Object{8}</span></div>
          </div>
        </div>
      </div>
      <div class="workspace-bottom">
        <div class="toolbar">
          <button class="tool-btn">↻ Refresh</button>
          <button class="tool-btn primary">+ Insert Record</button>
          <button class="tool-btn">Clear Store</button>
          <div style="width:1px; height:16px; background:#28292e; margin:0 4px;"></div>
          <select style="background:#18191d; border:1px solid #37383f; color:#e5e7eb; height:22px; font-size:11px; border-radius:3px; padding:0 4px;">
            <option>(Primary Key: id)</option>
            <option>by_email</option>
            <option>by_role</option>
          </select>
          <button class="tool-btn">Sort: ASC ▲</button>
          <button class="tool-btn">Range Filter</button>
          <input type="text" value="" placeholder="Filter records (Ctrl+F)..." style="background:#18191d; border:1px solid #37383f; color:#e5e7eb; height:22px; font-size:11px; border-radius:3px; padding:0 8px; width:140px;" />
          <div style="margin-left:auto; display:flex; align-items:center; gap:8px;">
            <button class="tool-btn">Export (JSON / CSV)</button>
            <span class="mono" style="font-size:11px; color:#9ca3af;">1,240 records</span>
          </div>
        </div>
        <div class="table-grid">
          <div class="grid-header">
            <div class="grid-cell" style="width:30px;"><input type="checkbox"/></div>
            <div class="grid-cell col-key">Key (id)</div>
            <div class="grid-cell col-val">Value Preview</div>
            <div class="grid-cell" style="width:120px;">Actions</div>
          </div>
          <div class="grid-row selected">
            <div class="grid-cell" style="width:30px;"><input type="checkbox" checked/></div>
            <div class="grid-cell col-key">usr_492019</div>
            <div class="grid-cell col-val">{ id: 492019, name: "Alexander Wright", email: "alex.wright@example.com", role: "team_admin", balance: 1500000000000n }</div>
            <div class="grid-cell" style="width:120px; color:#818cf8;">👁️ 📋 ✏️ 🗑️</div>
          </div>
          <div class="grid-row">
            <div class="grid-cell" style="width:30px;"><input type="checkbox"/></div>
            <div class="grid-cell col-key">usr_492020</div>
            <div class="grid-cell col-val">{ id: 492020, name: "Elena Rostova", email: "elena@example.com", role: "developer", balance: 840000000000n }</div>
            <div class="grid-cell" style="width:120px; color:#818cf8;">👁️ 📋 ✏️ 🗑️</div>
          </div>
          <div class="grid-row">
            <div class="grid-cell" style="width:30px;"><input type="checkbox"/></div>
            <div class="grid-cell col-key">usr_492021</div>
            <div class="grid-cell col-val">{ id: 492021, name: "Marcus Chen", email: "marcus.chen@example.com", role: "analyst", balance: 220000000000n }</div>
            <div class="grid-cell" style="width:120px; color:#818cf8;">👁️ 📋 ✏️ 🗑️</div>
          </div>
          <div class="grid-row">
            <div class="grid-cell" style="width:30px;"><input type="checkbox"/></div>
            <div class="grid-cell col-key">usr_492022</div>
            <div class="grid-cell col-val">{ id: 492022, name: "Sophia Miller", email: "sophia.m@example.com", role: "designer", balance: 410000000000n }</div>
            <div class="grid-cell" style="width:120px; color:#818cf8;">👁️ 📋 ✏️ 🗑️</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

captureHtml(ss1Html, path.resolve(ASSETS_DIR, 'screenshot-1-overview.png'), 1280, 800);
console.log('  ✓ Generated: store-assets/screenshot-1-overview.png (1280x800)');

// 4. Screenshot 2: Real-time In-Place JSON Editor (1280x800)
const ss2Html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-top-bar">
      <div class="tab-strip">
        <div class="browser-tab">Elements</div>
        <div class="browser-tab">Console</div>
        <div class="browser-tab active">
          <img src="${iconSrc}" width="14" height="14" alt="" />
          IndexedDBeacon
        </div>
        <div class="browser-tab">Application</div>
      </div>
    </div>
    <div class="feature-banner">
      <div class="feature-banner-left">
        <img src="${iconSrc}" width="28" height="28" alt="" />
        <div>
          <div class="feature-banner-title">2. In-Place JSON Editing & Instant Validation</div>
          <div class="feature-banner-desc">Modify nested objects directly with automatic syntax linting, Prettify formatting, and Ctrl+Enter hotkey save.</div>
        </div>
      </div>
      <span class="tag-badge">IN-PLACE CRUD</span>
    </div>
    <div class="app-layout" style="padding: 20px;">
      <div style="background:#18191d; border:1px solid #37383f; border-radius:8px; height:100%; display:flex; flex-direction:column; overflow:hidden;">
        <div style="padding:12px 18px; border-bottom:1px solid #28292e; display:flex; align-items:center; justify-content:space-between; background:#1c1d22;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:14px; font-weight:700; color:#ffffff;">Editing Record: <code class="mono" style="color:#818cf8;">cfg_app_settings</code></span>
            <span style="background:#065f46; color:#6ee7b7; font-size:10px; font-weight:700; padding:2px 8px; border-radius:9999px;">● Valid JSON</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="tool-btn">Prettify JSON</button>
            <button class="tool-btn">Revert</button>
            <button class="tool-btn primary" style="font-weight:700; padding:0 14px;">Save Changes (Ctrl+Enter)</button>
          </div>
        </div>
        <div class="mono" style="flex:1; padding:20px; font-size:13px; line-height:1.7; background:#141518; color:#e5e7eb;">
          <div>{</div>
          <div style="padding-left: 20px;"><span style="color:#818cf8;">"theme"</span>: <span style="color:#34d399;">"system_dark"</span>,</div>
          <div style="padding-left: 20px;"><span style="color:#818cf8;">"notificationsEnabled"</span>: <span style="color:#c084fc; font-weight:bold;">true</span>,</div>
          <div style="padding-left: 20px;"><span style="color:#818cf8;">"refreshIntervalMs"</span>: <span style="color:#fbbf24;">4000</span>,</div>
          <div style="padding-left: 20px;"><span style="color:#818cf8;">"securityPolicy"</span>: {</div>
          <div style="padding-left: 40px;"><span style="color:#818cf8;">"enforceMfa"</span>: <span style="color:#c084fc; font-weight:bold;">true</span>,</div>
          <div style="padding-left: 40px;"><span style="color:#818cf8;">"sessionTimeoutHours"</span>: <span style="color:#fbbf24;">12</span>,</div>
          <div style="padding-left: 40px;"><span style="color:#818cf8;">"whitelistedIps"</span>: [ <span style="color:#34d399;">"192.168.1.1"</span>, <span style="color:#34d399;">"10.0.0.0/8"</span> ]</div>
          <div style="padding-left: 20px;">},</div>
          <div style="padding-left: 20px;"><span style="color:#818cf8;">"maxCacheSizeMb"</span>: <span style="color:#fbbf24;">512</span>,</div>
          <div style="padding-left: 20px;"><span style="color:#818cf8;">"lastModified"</span>: <span style="color:#34d399;">"2026-10-27T10:45:00.000Z"</span></div>
          <div>}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

captureHtml(ss2Html, path.resolve(ASSETS_DIR, 'screenshot-2-editor.png'), 1280, 800);
console.log('  ✓ Generated: store-assets/screenshot-2-editor.png (1280x800)');

// 5. Screenshot 3: Complex Type Serialization & Media (1280x800)
const ss3Html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-top-bar">
      <div class="tab-strip">
        <div class="browser-tab">Elements</div>
        <div class="browser-tab active">
          <img src="${iconSrc}" width="14" height="14" alt="" />
          IndexedDBeacon
        </div>
        <div class="browser-tab">Application</div>
      </div>
    </div>
    <div class="feature-banner">
      <div class="feature-banner-left">
        <img src="${iconSrc}" width="28" height="28" alt="" />
        <div>
          <div class="feature-banner-title">3. Complex Types & Binary Media Support</div>
          <div class="feature-banner-desc">First-class lossless serialization for Date, BigInt, RegExp, Set/Map, and inline image/audio Blob previews with download.</div>
        </div>
      </div>
      <span class="tag-badge">NATIVE IDB TYPES</span>
    </div>
    <div class="app-layout" style="flex-direction:row; padding:20px; gap:20px;">
      <div style="flex:1; background:#18191d; border:1px solid #37383f; border-radius:8px; padding:18px; display:flex; flex-direction:column;">
        <div style="font-size:14px; font-weight:700; color:#ffffff; margin-bottom:12px;">Stored Binary Blobs & Media Previews</div>
        <div style="border:1px solid #28292e; border-radius:6px; background:#141518; padding:14px; margin-bottom:14px; display:flex; gap:16px; align-items:center;">
          <div style="width:100px; height:80px; background:#24252a; border-radius:4px; display:flex; align-items:center; justify-content:center; border:1px solid #37383f;">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="#818cf8"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          </div>
          <div>
            <div class="mono" style="font-weight:700; color:#818cf8;">profile_avatar.png</div>
            <div style="font-size:11px; color:#9ca3af; margin:4px 0;">MIME: <code>image/png</code> &middot; Size: 184.2 KB</div>
            <button class="tool-btn primary" style="font-size:10px;">Download Blob File</button>
          </div>
        </div>
        <div style="border:1px solid #28292e; border-radius:6px; background:#141518; padding:14px; display:flex; gap:16px; align-items:center;">
          <div style="width:100px; height:80px; background:#24252a; border-radius:4px; display:flex; align-items:center; justify-content:center; border:1px solid #37383f;">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="#10b981"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <div>
            <div class="mono" style="font-weight:700; color:#10b981;">chime_alert.mp3</div>
            <div style="font-size:11px; color:#9ca3af; margin:4px 0;">MIME: <code>audio/mpeg</code> &middot; Size: 64.8 KB</div>
            <button class="tool-btn primary" style="font-size:10px;">Play & Download</button>
          </div>
        </div>
      </div>
      <div style="flex:1; background:#18191d; border:1px solid #37383f; border-radius:8px; padding:18px;">
        <div style="font-size:14px; font-weight:700; color:#ffffff; margin-bottom:12px;">Type Safety & Preservation</div>
        <div class="mono" style="background:#141518; padding:16px; border-radius:6px; border:1px solid #28292e; font-size:12px; line-height:1.7;">
          <div><span style="color:#9ca3af;">// BigInt preservation</span></div>
          <div><span style="color:#818cf8;">"cryptoBalance"</span>: <span style="color:#fbbf24;">9223372036854775807n</span></div>
          <br>
          <div><span style="color:#9ca3af;">// Real Date objects</span></div>
          <div><span style="color:#818cf8;">"expiresAt"</span>: <span style="color:#34d399;">Date(2028-12-31T23:59:59.000Z)</span></div>
          <br>
          <div><span style="color:#9ca3af;">// Map and Set collections</span></div>
          <div><span style="color:#818cf8;">"tags"</span>: <span style="color:#c084fc;">Set(["production", "verified", "active"])</span></div>
          <div><span style="color:#818cf8;">"meta"</span>: <span style="color:#c084fc;">Map([ ["tier", "enterprise"], ["region", "us-east"] ])</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

captureHtml(ss3Html, path.resolve(ASSETS_DIR, 'screenshot-3-complex-types.png'), 1280, 800);
console.log('  ✓ Generated: store-assets/screenshot-3-complex-types.png (1280x800)');

// 6. Screenshot 4: Popout Standalone Window (1280x800)
const ss4Html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="browser-frame" style="background:#090a0f; padding:40px; align-items:center; justify-content:center;">
    <div style="width:1120px; height:680px; background:#141518; border:1px solid #4338ca; border-radius:10px; box-shadow:0 25px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(99,102,241,0.3); display:flex; flex-direction:column; overflow:hidden;">
      <div style="height:38px; background:#1a1b22; border-bottom:1px solid #28292e; display:flex; align-items:center; padding:0 16px; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${iconSrc}" width="16" height="16" alt="" />
          <strong style="color:#ffffff; font-size:13px;">IndexedDBeacon &mdash; Detached Dedicated Window</strong>
          <span style="background:#1e1b4b; color:#a5b4fc; font-size:10px; padding:2px 8px; border-radius:4px; font-weight:600;">Standalone Mode</span>
        </div>
        <button class="tool-btn">Dock Back to DevTools</button>
      </div>
      <div style="flex:1; display:flex;">
        <div class="sidebar" style="width:280px;">
          <div class="sidebar-header">
            <span>TARGET: https://my-app.internal:3000</span>
          </div>
          <div class="tree-node active">
            <span>▼</span>
            <strong>CommerceDB</strong>
          </div>
          <div class="tree-node tree-indent active">
            <span>●</span>
            <span>products</span>
            <span class="badge-count">2,480</span>
          </div>
          <div class="tree-node tree-indent">
            <span>●</span>
            <span>shopping_cart</span>
            <span class="badge-count">4</span>
          </div>
          <div class="tree-node">
            <span>▶</span>
            <span>AuthTokens</span>
          </div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column;">
          <div class="toolbar">
            <button class="tool-btn">↻ Refresh</button>
            <button class="tool-btn primary">+ Insert Product</button>
            <input type="text" value="keyboard" placeholder="Search..." style="background:#18191d; border:1px solid #37383f; color:#e5e7eb; height:22px; font-size:11px; border-radius:3px; padding:0 8px; width:160px;" />
            <span class="mono" style="margin-left:auto; font-size:11px; color:#9ca3af;">Showing 2 of 2,480 matches</span>
          </div>
          <div class="table-grid" style="flex:1;">
            <div class="grid-header">
              <div class="grid-cell col-key">SKU</div>
              <div class="grid-cell col-val">Item Name</div>
              <div class="grid-cell" style="width:100px;">Price</div>
              <div class="grid-cell" style="width:100px;">Stock</div>
            </div>
            <div class="grid-row selected">
              <div class="grid-cell col-key">KB-MECH-RGB</div>
              <div class="grid-cell col-val">Pro Mechanical Keyboard (Cherry MX Blue)</div>
              <div class="grid-cell mono" style="width:100px; color:#fbbf24;">$149.99</div>
              <div class="grid-cell mono" style="width:100px; color:#10b981;">34 in stock</div>
            </div>
            <div class="grid-row">
              <div class="grid-cell col-key">KB-WIRELESS-SLIM</div>
              <div class="grid-cell col-val">Low-Profile Bluetooth Ergonomic Keyboard</div>
              <div class="grid-cell mono" style="width:100px; color:#fbbf24;">$99.00</div>
              <div class="grid-cell mono" style="width:100px; color:#10b981;">112 in stock</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

captureHtml(ss4Html, path.resolve(ASSETS_DIR, 'screenshot-4-popout.png'), 1280, 800);
console.log('  ✓ Generated: store-assets/screenshot-4-popout.png (1280x800)');

// 7. Screenshot 5: Export / Import Modal (1280x800)
const ss5Html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="browser-frame" style="background:#0b0c10; align-items:center; justify-content:center;">
    <div style="width:580px; background:#18191d; border:1px solid #37383f; border-radius:8px; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
      <div style="padding:14px 20px; background:#1f2026; border-bottom:1px solid #28292e; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-size:15px; font-weight:700; color:#ffffff;">Export Store: <span style="color:#818cf8;">products</span></div>
        <span style="color:#9ca3af; font-size:16px; cursor:pointer;">&times;</span>
      </div>
      <div style="padding:20px; font-size:12px;">
        <div style="margin-bottom:16px;">
          <label style="font-weight:700; color:#e5e7eb; display:block; margin-bottom:8px;">Export Scope</label>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:center; gap:8px; color:#d1d5db;">
              <input type="radio" name="scope" checked /> Current Filtered View (45 records)
            </label>
            <label style="display:flex; align-items:center; gap:8px; color:#d1d5db;">
              <input type="radio" name="scope" /> All Records in Store (2,480 records)
            </label>
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-weight:700; color:#e5e7eb; display:block; margin-bottom:8px;">Export Format</label>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:center; gap:8px; color:#d1d5db;">
              <input type="radio" name="fmt" checked /> JSON (Array of values)
            </label>
            <label style="display:flex; align-items:center; gap:8px; color:#d1d5db;">
              <input type="radio" name="fmt" /> JSON (Array of { key, value } pairs)
            </label>
            <label style="display:flex; align-items:center; gap:8px; color:#d1d5db;">
              <input type="radio" name="fmt" /> CSV (Flattened table format)
            </label>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="tool-btn" style="padding:4px 14px;">Cancel</button>
          <button class="tool-btn" style="padding:4px 14px;">Copy to Clipboard</button>
          <button class="tool-btn primary" style="padding:4px 18px; font-weight:700;">Download Export File</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

captureHtml(ss5Html, path.resolve(ASSETS_DIR, 'screenshot-5-export-import.png'), 1280, 800);
console.log('  ✓ Generated: store-assets/screenshot-5-export-import.png (1280x800)');

// Copy 128x128 store icon
fs.copyFileSync(path.resolve(ROOT_DIR, 'icons/icon128.png'), path.resolve(ASSETS_DIR, 'store-icon-128.png'));
console.log('  ✓ Copied: store-assets/store-icon-128.png (128x128)');

// Cleanup temp dir
fs.rmSync(TEMP_DIR, { recursive: true, force: true });

console.log('\n✨ All Chrome Web Store graphic assets successfully generated in store-assets/!\n');
