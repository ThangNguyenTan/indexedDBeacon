# IndexedDBeacon 🛰️

> **The modern, high-performance IndexedDB manager & inspector for Google Chrome with ZERO permissions.**

Chrome's built-in DevTools (under *Application &rarr; Storage &rarr; IndexedDB*) is notoriously frustrating: it cannot edit nested JSON records, cannot insert new records, doesn't refresh automatically when databases update, truncates Blobs and complex data types, and lacks flexible querying, sorting, and export/import tools.

**IndexedDBeacon** solves this by providing a dedicated, full-featured DevTools panel right inside Chrome Developer Tools with **ZERO extra permissions** (`permissions: []`).

---

## ⚡ Key Highlights

- 🔒 **Zero Permissions Required**: Operates strictly within the Chrome DevTools context (`devtools_page`). Requires **NO** host permissions (`<all_urls>`), **NO** tabs permissions, and **NO** background service workers. When installed, Chrome displays: *"It can: No permissions requested"*.
- 🪟 **Standalone Window ("Pop out")**: Run in a detached window (like Redux DevTools) to give your inspected web app 100% of the screen space.
- 📐 **Collapsible Sidebar & Flexible Docking**: Collapse the sidebar (`Ctrl+B`) and switch the record inspector between right and bottom docking to adapt to any screen size or DevTools orientation.
- ✏️ **Full CRUD In-Place**: Add new records, edit nested JSON values with live syntax validation and formatting, and delete individual or batch-selected records.
- 🔍 **Advanced Querying**: Query by Primary Key or any secondary Index, sort ascending or descending, filter by `IDBKeyRange` (exact, lower bound, upper bound, between), and perform live instant text search across all fields.
- 📦 **Complex Type Serialization**: First-class support for `Date`, `BigInt`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, and `Blob`/`File` (with inline image previews and download buttons!).
- 💻 **Interactive REPL Scratchpad**: Built-in JavaScript console with async helpers (`await store.getAll()`, `await store.put()`, `await helpers.log()`, etc.) and structured result inspection.
- 🔄 **Live Watch Mode**: Real-time polling updates when the website writes or modifies IndexedDB records.
- 📤 **Import & Export**: 1-click export of stores to JSON (values or key-value pairs) or CSV, and drag-and-drop JSON import.
- 🎨 **DevTools Theme Adaptive**: Seamlessly adapts to your Chrome DevTools Dark or Light mode or allows manual toggling.

---

## 📂 Project Architecture

```
indexedDBeacon/
├── manifest.json              # Manifest V3 (0 host permissions requested)
├── icons/                     # 16x16, 48x48, 128x128 icons + SVG
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
├── devtools/                  # DevTools Panel Entry & Core Logic
│   ├── devtools.html          # DevTools registration page
│   ├── devtools.js            # Registers the "IndexedDBeacon" panel
│   ├── panel.html             # Main DevTools panel interface
│   ├── panel.css              # Modern UI stylesheets (Dark/Light mode)
│   ├── panel.js               # Panel state controller & orchestrator
│   ├── bridge.js              # In-page executor (safe serialization & IDB operations)
│   ├── bridgeSource.js        # Bundled bridge source
│   ├── bridgeClient.js        # Promise-based DevTools-to-page communication client
│   └── components/
│       ├── databaseList.js    # Sidebar DB and store tree explorer
│       ├── recordTable.js     # Data grid with dynamic columns & multi-select
│       ├── recordInspector.js # Record detail view, JSON editor & media preview
│       ├── recordEditorModal.js # Add new record modal with templates
│       ├── schemaModal.js     # DB, Store, and Index creation/deletion modals
│       ├── scratchpadModal.js # Interactive JS query console
│       ├── importExportModal.js # JSON/CSV export and drag-and-drop import
│       ├── treeView.js        # Collapsible JSON tree viewer
│       ├── theme.js           # Theme manager (DevTools dark/light sync)
│       └── toast.js           # Notification toasts
├── popup/                     # Toolbar Action Popup
│   ├── popup.html             # Quick shortcut guide & status
│   ├── popup.css
│   └── popup.js
└── test/                      # Interactive Test & Demo Suite
    └── test-page.html         # Live playground with multi-store sample databases
```

---

## 📦 Cross-Browser Build Commands

IndexedDBeacon includes a zero-dependency build system that generates tailored distributions for **Chromium** (Chrome, Edge, Brave, Arc, Opera) and **Mozilla Firefox**.

### Build Everything (Chromium + Firefox)
```bash
# Using npm
npm run build

# Or directly with Node (no npm install required!)
node scripts/build.js
```

### Targeted Builds
```bash
# Build Chromium only (dist/chrome/ and dist/indexed-dbeacon-chrome-v1.0.0.zip)
npm run build:chrome
# or: node scripts/build.js --target=chrome

# Build Firefox only (dist/firefox/, .zip, and .xpi)
npm run build:firefox
# or: node scripts/build.js --target=firefox
```

### Build Outputs in `dist/`:
- `dist/chrome/`: Unpacked extension for Chrome, Edge, Brave, Opera, Arc.
- `dist/indexed-dbeacon-chrome-v1.0.0.zip`: Release zip ready for Chrome Web Store.
- `dist/firefox/`: Unpacked extension for Firefox (`about:debugging`).
- `dist/indexed-dbeacon-firefox-v1.0.0.zip` / `.xpi`: Release archive ready for Mozilla Add-ons (AMO).

---

## 🚀 How to Install & Run

### In Google Chrome / Chromium (Edge, Brave, Arc)
1. Run `npm run build:chrome` (or use the repository root).
2. Open `chrome://extensions` in the browser.
3. Turn on the **Developer mode** toggle (top-right).
4. Click **Load unpacked** and select `dist/chrome` (or project root).
5. Open any webpage, press `F12`, and switch to the **IndexedDBeacon** panel.

### In Mozilla Firefox
1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on...**.
4. Select `dist/firefox/manifest.json` (or `dist/indexed-dbeacon-firefox-v1.0.0.zip`).
5. Open any webpage, press `F12`, and switch to the **IndexedDBeacon** panel.

---

## 🎮 Testing with the Built-in Playground

We included an interactive test suite that creates multiple realistic IndexedDB stores (products, users, orders, Blobs, BigInts, live background event streams):

1. Click the **IndexedDBeacon** extension icon in your browser toolbar, then click **"Open Interactive Demo Page"** (or open `test/test-page.html` in Chrome).
2. Press `F12` (or `Ctrl+Shift+I` / `Cmd+Option+I`) to open Developer Tools.
3. In the top DevTools tab bar, select **IndexedDBeacon**.
4. You will see:
   - `ShopMart_v2` with `users`, `products`, and `orders`.
   - `AnalyticsStream` with real-time background events.
   - `MediaAndBinaryDB` with image Blobs and binary buffers.

---

## 🛠️ Features Walkthrough

### 1. Database & Store Tree
- Click any database to expand its stores and indexes.
- Hover over any database or store to reveal quick actions: `+ Store`, `+ Index`, `Clear Store`, `Delete`.
- Use the **Filter** box at the top of the sidebar to quickly filter across databases and stores.
- Connect to hidden or custom databases using the **"Connect DB Name"** button.

### 2. Native Chrome-Style Data Grid & Unified Toolbar
- **Native Key-Value Layout**: Defaults to the familiar `Key` and `Value` layout of Chrome DevTools, avoiding horizontal clutter.
- **Syntax Highlighted Previews**: Inline previews of objects (`{ id: 101, name: "Alice", ... }`), numbers in amber, booleans in purple, strings in green, Dates, and Blobs.
- **Layout Switcher**: Toggle with 1 click between **Key-Value** mode and **Multi-Column** mode.
- **Hover Row Quick Actions**: Instantly `Inspect (👁️)`, `Copy JSON (📋)`, `Edit (✏️)`, or `Delete (🗑️)` any record on hover.
- **Single 26px Unified Toolbar**: Replaced 4 stacked horizontal bars with a single 26px native-feeling DevTools toolbar, saving over 50px of vertical space for actual data.
- **Click Index to Filter**: Clicking any index in the sidebar tree immediately filters and sorts the table by that index, matching Chrome DevTools behavior.

### 3. Record Inspector & JSON Editor
- Click any row in the table to open the Inspector drawer on the right.
- **Tree View**: Interactive collapsible tree with type badges (`Date`, `BigInt`, `Blob`, `ArrayBuffer`, etc.) and path copy buttons.
- **Raw JSON**: Clean syntax formatted view.
- **Media & Blobs**: Renders live image previews (PNG, JPEG, SVG) and provides 1-click download buttons for stored Blobs and Files!
- **Editor Mode**: Edit JSON values directly, click *Prettify*, and hit *Save Changes* (or `Ctrl+Enter`) to persist directly back to IndexedDB.

### 4. Querying & Index Navigation
- Switch the **Index** dropdown from `(Primary Key)` to any secondary index (e.g. `by_email`, `by_category`).
- Toggle sorting direction between `Ascending` and `Descending`.
- Open **Key Range** to filter using `IDBKeyRange.only`, `lowerBound`, `upperBound`, or `bound`.
- Use the **Search** input for instant live substring filtering.

### 5. Interactive JS Scratchpad (Console)
- Click the **Console** button in the top navigation bar.
- Run arbitrary JavaScript queries and batch transformations with `await` support.
- Scoped variables: `store`, `db`, `window.indexedDB`, and `helpers`:
  ```javascript
  const records = await helpers.getAll();
  helpers.log('Total records:', records.length);
  return records.filter(r => r.active && r.price > 50);
  ```
- Press `Ctrl+Enter` to execute and view structured return values and execution duration.

### 6. Screen Space Optimization & Standalone Window (Redux DevTools-Style)
- 🪟 **Open in New Window ("Pop out")**: Click the **"Pop out"** button in the header toolbar to run IndexedDBeacon in a completely separate, dedicated OS window (identical to Redux DevTools). Your web app keeps 100% of its viewport space while you inspect and modify databases in the standalone window!
- ↩️ **Dock Back**: DevTools shows an active overlay while detached. Click **"Dock Back"** at any time to bring the inspector right back into the Chrome DevTools panel.
- 📐 **Collapsible Sidebar (`Ctrl+B`)**: Click the sidebar toggle icon or press `Ctrl+B` (or `Cmd+B`) to instantly hide/show the database sidebar, maximizing table width for wide datasets.
- 🔄 **Flexible Inspector Docking (Side vs Bottom)**: Click the dock button in the Inspector header to switch between **Right-Dock** (ideal for widescreen displays or bottom-docked DevTools) and **Bottom-Dock** (ideal for narrow or vertically split DevTools).
- 📏 **Smooth Resizers with Memory**: Drag the divider lines between panels to resize freely; your sidebar width and dock orientation are remembered across sessions in `localStorage`.

### 7. Passive Stale Data Notification & Infinite Scrolling
- **Zero Polling Overhead**: Hooks `IDBObjectStore` mutation methods to track changes without battery-draining polling loops.
- **Visual Alert**: Displays a subtle amber **"Data Stale · Refresh"** notification in the header when data in the page changes. Click it to refresh with one click.
- **Infinite Scrolling**: Smooth continuous scrolling through stores of any size without clumsy page buttons.

---

## 🛡️ Security & Privacy

IndexedDBeacon requires **0 host permissions** and **0 extension permissions**. It executes queries strictly within the context of the DevTools panel for the currently inspected tab, and never transmits or collects any user data.
