# Privacy Policy for IndexedDBeacon

**Last updated:** October 27, 2026

IndexedDBeacon ("the Extension") is an open-source, developer-focused Chrome DevTools extension designed to inspect, query, edit, and manage IndexedDB databases on the user's active browser tabs.

---

## 1. Zero Data Collection
IndexedDBeacon operates on a strict **zero-data collection** principle:
- **No Personal Information:** We do not collect, store, transmit, or process any personal data, usernames, email addresses, IP addresses, or device identifiers.
- **No Browsing History:** The Extension does not monitor, track, or record your browsing history or visited URLs.
- **No Analytics or Telemetry:** There are zero third-party analytics SDKs, trackers, error-reporting services, or beacons included in the Extension.
- **No Remote Network Requests:** The Extension does not communicate with any external servers or remote endpoints. All operations are executed 100% locally on your machine.

---

## 2. Permissions & Scope
IndexedDBeacon requests **zero extension permissions** in its `manifest.json`:
- **No Host Permissions:** The Extension has no access to network requests or websites across the web (`<all_urls>` is not requested).
- **No Background Workers:** The Extension contains no background service workers or persistent processes.
- **Local DevTools Execution:** Database inspection queries are dispatched strictly through the standard Chrome DevTools API (`chrome.devtools.inspectedWindow.eval`) only when the developer actively opens the DevTools panel for the inspected tab.

---

## 3. Local Data Handling
Any database records, schema definitions, or export files generated through the Extension:
- Remain strictly within your local browser's memory and IndexedDB storage.
- Are exported only when you explicitly click "Download Export File" or "Copy to Clipboard".

---

## 4. Open Source & Transparency
IndexedDBeacon's complete source code is public and transparent. You can audit the entire codebase and its zero-permission manifest at any time.

---

## 5. Contact & Support
If you have questions about this Privacy Policy or need support, please open an issue on the project's GitHub repository.
