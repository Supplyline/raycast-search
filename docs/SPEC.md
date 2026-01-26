# Supplyline Raycast Extension — Specification

> **Version:** 2.0 (Multi-Index)
> **Status:** In Development
> **Repo:** `Supplyline/raycast-search`

## Overview

Native macOS search experience for Supplyline via Raycast. Enables product, SKU, and documentation search without opening a browser.

**Target users:**
- Engineers with Raycast installed
- Purchasing managers who live in Raycast
- Power users who want keyboard-first product lookup

**Key capabilities:**
- System-wide access (any app, any context)
- Faster cold start (no browser)
- Native macOS feel
- Clipboard integration for quick SKU sharing
- Stack-based hierarchical drill navigation

---

## Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-index support | Yes | Mirror web Command Menu architecture |
| Stack-based navigation | Yes | Same drill UX as web |
| MNO detection | Yes | Same two-mode search (exact vs fuzzy) |
| Scope switching | Via argument or dropdown | No chips in Raycast UI |
| Distribution | Private initially | Internal team use before store submission |

---

## Architecture

### Algolia Indices

Uses 3 Algolia indices (shared with web Command Menu):

| Index | Purpose | Est. Records |
|-------|---------|--------------|
| `supplyline_products_browse` | Series (L1) + Parent (L2) — drill targets | ~500 |
| `supplyline_products_sku` | Child (L3) + Sibling (L4) — terminal items | ~5,000 |
| `supplyline_docs` | Manuals, datasheets, IOMs | ~1,000 |

### State Model

```typescript
interface ExtensionState {
  scope: "products" | "docs";
  query: string;
  stack: StackItem[];
  results: SearchResult[];
  selectedIndex: number;
}

interface StackItem {
  type: "brand" | "series" | "parent";
  id: string;
  label: string;
}

type SearchResult = BrowseEntity | SkuEntity | DocEntity;
```

### Query Routing

```
scope = "products" + stack.length === 0 → federate products_browse + products_sku
scope = "products" + stack.length > 0  → products_sku only (filtered)
scope = "docs"                          → docs only
```

---

## Commands

### Primary: `search`

**Title:** Search Supplyline
**Mode:** view
**Subtitle:** Products, SKUs, and documentation

Behavior:
1. User types query
2. MNO detection determines search mode
3. Results show from appropriate index(es)
4. Enter on drill target → push stack, refetch
5. Enter on terminal → open URL in browser (or copy)

### Secondary: `search-docs`

**Title:** Search Supplyline Docs
**Mode:** view
**Subtitle:** Manuals and datasheets

Pre-filtered to docs index. Convenience command for documentation-only searches.

---

## User Flows

### Flow 1: Direct SKU Lookup

```
1. User invokes "Search Supplyline" (⌘+Space → "sup")
2. Types "PD051832NI"
3. MNO mode detected
4. Exact match appears at top
5. User presses Enter
6. Browser opens configurator: /configure/lmi/pd/pd05/pd051832ni
```

### Flow 2: Drill Navigation

```
1. User invokes "Search Supplyline"
2. Types "LMI"
3. Results show: LMI brand facet, LMI series
4. User selects "PD Series" and presses Enter
5. Stack: [brand:LMI, series:PD]
6. Breadcrumb shows: LMI > PD Series >
7. Results show PD models (PD05, PD06...)
8. User selects "PD05" and presses Enter
9. Stack: [brand:LMI, series:PD, parent:PD05]
10. Results show PD05 SKUs
11. User selects "PD051832NI" and presses Enter
12. Browser opens configurator
```

### Flow 3: Pop Navigation

```
1. User is at stack: [LMI, PD, PD05]
2. User presses Backspace (empty search box) or ⌘+←
3. Stack becomes: [LMI, PD]
4. Results refresh to show series-level items
```

### Flow 4: Documentation Search

```
1. User invokes "Search Supplyline Docs" (or uses scope argument)
2. Types "PD installation"
3. Results show matching manuals, datasheets
4. User presses Enter
5. Browser opens document URL (or QuickLook preview)
```

---

## UI Components

### List View Structure

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Search Supplyline                                    │
├─────────────────────────────────────────────────────────┤
│ [LMI > PD Series >] ← Breadcrumb (when stack.length > 0)│
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏭 PD05                                             │ │
│ │ LMI Milton Roy • 12 SKUs                            │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔧 PD051832NI                                       │ │
│ │ $1,245.00 • In Stock                                │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔧 PD051842SI                                       │ │
│ │ $1,312.00 • In Stock                                │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ↑↓ Navigate  ⏎ Select  ⌫ Back  ⌘K Copy                  │
└─────────────────────────────────────────────────────────┘
```

### Detail View (Preview Panel)

```
┌─────────────────────────────────────────────────────────┐
│ PD051832NI                                              │
│ LMI Milton Roy • PD Series                              │
├─────────────────────────────────────────────────────────┤
│ Price: $1,245.00                                        │
│ Stock: In Stock                                         │
│ Flow: 3.2 GPH                                           │
│ Pressure: 150 PSI                                       │
├─────────────────────────────────────────────────────────┤
│ [🛒 Shop]  [ℹ️ About]  [📋 Copy]                         │
└─────────────────────────────────────────────────────────┘
```

---

## Actions

### Primary Actions (Enter key)

| Item Type | Action | URL |
|-----------|--------|-----|
| Series (drill) | Push stack, refetch | — |
| Parent (drill) | Push stack, refetch | — |
| SKU (terminal) | Open in browser | `urlShop` |
| Doc (terminal) | Open in browser | `fileUrl` |

### Secondary Actions

| Shortcut | Action | Applies To |
|----------|--------|------------|
| ⌘+Enter | Open Shop URL | SKU only |
| ⌘+⇧+Enter | Open About URL | SKU only |
| ⌘+K | Copy to clipboard | All |
| ⌘+⇧+K | Copy as Markdown | All |
| ⌘+P | QuickLook preview | Docs only |
| ⌘+← | Pop stack | When stack > 0 |

### Clipboard Formats

**Copy (⌘+K):**
```
PD051832NI — $1,245.00
https://supplyline.com/configure/lmi/pd/pd05/pd051832ni
```

**Copy as Markdown (⌘+⇧+K):**
```markdown
[PD051832NI](https://supplyline.com/configure/lmi/pd/pd05/pd051832ni) — $1,245.00
```

---

## Preferences

### Required

| Key | Type | Description |
|-----|------|-------------|
| `algoliaAppId` | string | Algolia Application ID |
| `algoliaApiKey` | password | Algolia Search API Key |

### Optional

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultScope` | dropdown | "products" | Default search scope |
| `openAction` | dropdown | "shop" | What Enter does on SKU (shop/about) |
| `showPrices` | checkbox | true | Show prices in results |
| `showStock` | checkbox | true | Show stock status |

---

## Dependencies

```json
{
  "dependencies": {
    "@raycast/api": "^1.91.0",
    "@raycast/utils": "^1.17.0",
    "algoliasearch": "^4.24.0"
  },
  "devDependencies": {
    "@raycast/eslint-config": "^1.0.11",
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "typescript": "^5.x"
  }
}
```

---

## Related Documents

- [PLAN.md](./PLAN.md) — Implementation phases and tasks
- [ACCEPTANCE.md](./ACCEPTANCE.md) — Acceptance criteria
- [algolia-index-spec.md](./algolia-index-spec.md) — Index schemas
- [implementation-guide.md](./implementation-guide.md) — Full code reference

---

*Spec v2.0 — January 2026*
