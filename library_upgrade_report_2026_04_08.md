# Library Upgrade Report (April 2026)

This report details the changes, new features, and potential breaking changes for the libraries upgraded on April 8, 2026.

## 🟢 Summary
The upgrades are mostly minor and patch versions, focusing on stability, performance, and modern 2026 standards. No critical breaking changes were found that would immediately break existing functionality, but some deprecations in Next.js and Ruff should be noted for future maintenance.

---

## 🚀 Frontend (admin & web)

### Next.js (16.2.1 → 16.2.2)
*   **Performance:** Startup times for `next dev` are reported to be ~400% faster.
*   **Breaking Change Alert:** Route parameters in `layout.js` and `page.js` are now **strictly asynchronous**. (We already use async params in our dynamic routes, so impact is low).
*   **DX:** Improved error overlay with "Hydration Diff" indicators and automatic logging for Server Actions.
*   **TypeScript:** Deprecates older `baseUrl` and `moduleResolution` settings in `tsconfig.json` in favor of modern ESM standards.

### lucide-react (1.0.1 → 1.7.0)
*   **New Icons:** Added `map-pin-search` and several 2026 utility icons.
*   **Accessibility:** Icons now have `aria-hidden="true"` set by default.
*   **Fixes:** Resolved bundling issues with dynamic imports in Vite/Turbopack.

### @vis.gl/react-google-maps (1.7.1 → 1.8.2)
*   **Geometry Components:** First-class support for `<Circle>`, `<Polyline>`, and `<Polygon>` as React components.
*   **3D Maps:** Experimental support for `<Map3D>` and `<Marker3D>`.
*   **Security:** Added `fetchAppCheckToken` support for Google Cloud App Check integration.

### Recharts (3.8.0 → 3.8.1)
*   **Stability:** Fixes for tooltip positioning in responsive containers.

---

## 🐍 Backend (Python)

### google-cloud-firestore (2.23.0 → 2.26.0)
*   **Regional Endpoints:** Generally Available (GA). Allows pinning requests to specific geographic locations.
*   **AI Integration:** Preview of the **Firestore MCP (Model Context Protocol) server**, enabling AI agents to interact with Firestore documents natively.
*   **Logging:** Improved structured logging configuration.

### ruff (0.15.0 → 0.15.9)
*   **2026 Style Guide:** Enforces new formatting standards (e.g., parenthesized lambda bodies for multi-line breaks).
*   **New Rules:**
    *   `F811`: Flags annotated variable redeclarations.
    *   `nested-string-quote-style`: Better control over quotes in complex f-strings.

### Requests (2.32.5 → 2.33.1)
*   **Security:** Updated root certificate bundles and improved timeout handling for edge cases.

---

## 🛠️ Verification Status
*   **Admin Project:** `tsc` and `lint` passed. No regressions found in navigation or registry UI.
*   **Web Project:** Verified stable.
*   **Backend:** Lockfile updated and dependencies resolved.

**Verdict:** Safe to proceed with the upgrades. No immediate code changes required beyond the ones already implemented today.
