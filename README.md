# Supplyline Raycast Extension

Native macOS search for Supplyline products, SKUs, and documentation via Raycast.

> **Status:** In Development (Phase 1)
> **Repo:** `Supplyline/raycast-search`

## Overview

Search Supplyline's product catalog without opening a browser. Features stack-based drill navigation (Brand → Series → Parent → SKU) and MNO (model number) exact-match detection.

## Features

- **System-wide search** — Access from any app via Raycast hotkey
- **Stack navigation** — Drill into brand/series/parent hierarchy
- **MNO detection** — Alphanumeric queries trigger exact-match mode
- **Multi-index search** — Products, SKUs, and documentation
- **Clipboard integration** — Copy SKU/price/URL in plain or markdown format

## Commands

| Command | Description |
|---------|-------------|
| `Search Supplyline` | Search products and SKUs |
| `Search Supplyline Docs` | Search manuals and datasheets |

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Algolia credentials in Raycast preferences:
   - Algolia App ID
   - Algolia Search API Key (search-only, not admin)

3. Run in development:
   ```bash
   npm run dev
   ```

## Documentation

- [SPEC.md](./docs/SPEC.md) — Full specification
- [PLAN.md](./docs/PLAN.md) — Implementation phases
- [ACCEPTANCE.md](./docs/ACCEPTANCE.md) — Acceptance criteria
- [algolia-index-spec.md](./docs/algolia-index-spec.md) — Index schemas
- [implementation-guide.md](./docs/implementation-guide.md) — Code reference

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Drill down (series/parent) or open (SKU/doc) |
| ⌘+Enter | Open Shop URL |
| ⌘+⇧+Enter | Open About URL |
| ⌘+K | Copy to clipboard |
| ⌘+⇧+K | Copy as Markdown |
| ⌘+← | Go back (pop stack) |
| Backspace | Go back (when search is empty) |

## Development

```bash
npm install      # Install dependencies
npm run dev      # Run in development mode
npm run build    # Build for production
npm run lint     # Lint code
```

## Architecture

Uses 3 Algolia indices:
- `supplyline_products_browse` — Series + Parent (drill targets)
- `supplyline_products_sku` — Child + Sibling SKUs (terminal items)
- `supplyline_docs` — Manuals, datasheets, IOMs

## License

MIT
