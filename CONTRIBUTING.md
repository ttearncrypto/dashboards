# Contributing to F9XR TTEarnCrypto — iCryptos Dashboards

Thanks for helping improve the dashboards. This document explains how to run the project locally, make changes, and submit a clean pull request.

**Quick checklist**
- Fork the repo and create a branch: `feature/<short-desc>` or `fix/<short-desc>`.
- Keep changes small and focused.
- Test your changes in a browser and include screenshots when appropriate.

---

## Run locally

The app is a static, client-side SPA. Serve the repository folder with a simple static server and open it in your browser.

Using Python 3:

```bash
cd /path/to/dashboards
python3 -m http.server 8000
# Open http://localhost:8000/ in your browser
```

Or using Node (optional):

```bash
npx http-server -p 8000
# or
npm install -g http-server
http-server -p 8000
```

Open `index.html` or any file under `themes/` to preview a theme.

---

## What to test

- Verify posts load in the UI and cards render correctly.
- Check the browser console for JSONP callback issues or network errors.
- Test search, tag filters, sort order, "Load More", and bookmark (watchlist) functionality.
- Verify `localStorage` persistence for the watchlist and export-to-CSV behavior.

When editing feed URLs, ensure the feed supports JSONP (append `?alt=json-in-script&callback=<fn>` as needed).

---

## Code style & scope

- Keep changes localized: update a single theme or the shared script only if you understand the impact on other themes.
- Avoid large refactors in the same PR — open an issue first for design/architecture discussions.
- Minimize external dependencies; this project is intentionally client-only.

HTML/CSS/JS notes:
- Use semantic HTML where possible.
- Keep JavaScript changes readable and avoid global collisions (follow existing patterns such as `CONFIG` and `state`).
- If adding new configuration keys, document them in `README.md`.

---

## Submitting a PR

1. Fork the repository.
2. Create a descriptive branch: `feature/add-theme`, `fix/jsonp-callback`, etc.
3. Commit with clear messages (imperative tense). Example: `Add gray theme layout`.
4. Push your branch and open a pull request against `main`.
5. In the PR description include:
   - What you changed and why.
   - How to test (steps and expected results).
   - Screenshots if the change affects UI.

Maintainers will review and may request small changes before merging.

---

## Reporting issues

- Open a GitHub issue with a clear title and description.
- Include steps to reproduce, browser console output (if applicable), and screenshots.
