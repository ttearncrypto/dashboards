# F9XR's TTEarnCrypto: iCryptos Dashboards
Official client-side dashboards for F9XR's TTEarnCrypto: iCryptos.

This repository contains a browser-only Single Page Application (SPA) that fetches and displays posts from Google Blogger feeds. It is designed to run entirely in the user’s browser (no backend required). The UI supports searching, tag filtering, sorting, bookmarking (watchlist), and exporting saved items.

**Quick highlights:**
- **Client-side only:** No server code required; open `index.html` or serve the folder with a static server.
- **Data sources:** Uses Blogger JSONP feeds to avoid CORS restrictions.
- **Themes included:** See the `themes/` folder for optional templates.

**Supported themes (in `themes/`):**
- `blue.html`
- `gray.html`
- `green.html`
- `old.html`
- `pill.html`
- `purple.html`

**Contents of this README:**
- Project overview
- Quick start (how to run locally)
- How the dashboard works (key components)
- Configuration and customization
- Development notes and troubleshooting
- Contribution

---

**Project Overview**

The dashboard loads post data from Blogger feeds using JSONP, normalizes entries, and renders them as cards with search, tag filters, sorting, pagination, and a watchlist persisted to `localStorage`.

**Quick Start**

- Open the project folder and serve it with any static server. For example, using Python 3 run:

```bash
python3 -m http.server 8000

# Then open http://localhost:8000/ in your browser and navigate to `index.html` or any theme page.
```

- Alternatively, double-click `index.html` to open it in a browser, but a local server is recommended for consistent behavior.

**Usage (end users)**

- Use the search box to find posts by title or tag.
- Click tag buttons to filter by category.
- Change the sort dropdown to reorder results (Newest, Oldest, A–Z).
- Click "Load More" to paginate additional items.
- Click the bookmark icon on a card to add/remove it from your watchlist (saved in `localStorage`).
- Use the UI export button to download your watchlist as a CSV file.

---

**How the Dashboard Works (Key Components)**

- **JSONP Data Fetcher (`fetchSource`)**: Creates a temporary `<script>` tag with a `?callback=` parameter. Blogger returns data wrapped in that callback which the app executes to capture feed data (avoids CORS issues).
- **Data Normalization (`processEntry`)**: Converts Blogger's nested entry format (eg. `entry.title.$t`) into a compact object with `id`, `title`, `url`, `tags`, and `date`.
- **Application State (`CONFIG` and `state`)**:
  - `CONFIG`: Static configuration (feed URLs, icons, `itemsPerLoad`, etc.).
  - `state`: Runtime state including `rawData`, `filteredData`, `watchlist`, and `activeTag`.
- **Filtering & Sorting (`applyFilters`)**: Applies search text, active tag, and sort order to produce `filteredData` which the UI renders.
- **Rendering (`renderGrid` / `createCard`)**: Generates card HTML with badges and bookmark states. Pagination is handled by slicing `filteredData` using `itemsPerLoad`.
- **Watchlist & Persistence**: `toggleSave` updates `state.watchlist` and persists it via `localStorage.setItem`. Export to CSV is provided in the UI.

---

**Configuration & Customization**

- To add or change a feed, update the feed list in the app configuration (search for `CONFIG` inside the app script in `index.html` or the theme file you are using).
- To change items per page, edit `CONFIG.itemsPerLoad`.
- To add/remove UI themes, modify or add files under the `themes/` folder. Each theme is a complete HTML page using the same client-side script.

**Files & Structure**

- `index.html` — Default dashboard entry point.
- `m-index.html` — Mobile or alternative entry (if present).
- `themes/` — Theme variants (see list above).
- `assets/` — Static assets (icons, manifests).
- `newshub/` — Alternative layouts or example pages.

---

**Development Notes & Troubleshooting**

- If posts don’t appear, check the browser console for JSONP callback errors or network errors. JSONP responses must execute the expected callback name.
- If watchlist changes don’t persist, verify `localStorage` is enabled and not cleared by privacy settings or extensions.
- When editing feed URLs, ensure the Blogger feed supports JSONP (append `?alt=json-in-script&callback=<fn>`).

---

**Contributing**

- Improvements, bug fixes, and theme contributions are welcome. Open a PR or submit a patch with a short description.
- Please keep UI changes scoped to theme files and avoid breaking other theme layouts.

## Enjoy exploring the dashboards!