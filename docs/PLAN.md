# Supplyline Raycast Extension — Implementation Plan

> Phased implementation from MVP to full feature parity with web Command Menu.

## Project Structure

```
raycast-search/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx              # Main search command
│   ├── search-docs.tsx        # Docs-only command
│   ├── hooks/
│   │   ├── useAlgoliaSearch.ts    # Multi-index search
│   │   ├── useNavigationStack.ts  # Stack push/pop
│   │   └── useMnoDetection.ts     # MNO vs general mode
│   ├── components/
│   │   ├── SearchResultItem.tsx   # List item renderer
│   │   ├── ResultDetail.tsx       # Preview panel
│   │   └── Breadcrumb.tsx         # Stack visualization
│   ├── utils/
│   │   ├── algolia.ts             # Client setup
│   │   ├── clipboard.ts           # Copy formatting
│   │   └── urls.ts                # URL building
│   └── types.ts                   # Shared types
├── assets/
│   ├── extension-icon.png
│   ├── brand-icon.png
│   ├── product-icon.png
│   ├── sku-icon.png
│   └── doc-icon.png
├── docs/
│   ├── SPEC.md
│   ├── PLAN.md (this file)
│   ├── ACCEPTANCE.md
│   ├── algolia-index-spec.md
│   └── implementation-guide.md
└── README.md
```

---

## Phase 1: Single-Index MVP

**Goal:** Basic SKU search working end-to-end

### Tasks

- [x] Initialize Raycast extension (`npx create-raycast-extension`)
- [x] Configure package.json with commands and preferences
- [x] Create `src/types.ts` with entity types
- [x] Create `src/utils/algolia.ts` with client setup
- [x] Implement MNO detection heuristic
- [x] Create `src/hooks/useAlgoliaSearch.ts` (single index)
- [x] Create `src/index.tsx` main search command
- [x] Implement basic list rendering
- [x] Add "Open in Browser" action
- [x] Add "Copy" action (⌘+K)
- [x] Test with live Algolia credentials

### Deliverable

Search `products_sku` index, open SKU in browser.

---

## Phase 2: Multi-Index Federation

**Goal:** Search both browse and SKU indices

### Tasks

- [x] Update `useAlgoliaSearch.ts` for multi-index queries
- [x] Implement result merging logic
- [x] Add MNO boost (exact matches first)
- [x] Update list to show entity type icons
- [x] Add "drill" indicator for browse items
- [x] Test federated search behavior

### Deliverable

Empty stack searches both indices; results show series, parents, and SKUs.

---

## Phase 3: Stack Navigation

**Goal:** Full drill-down navigation

### Tasks

- [x] Create `src/hooks/useNavigationStack.ts`
- [x] Implement push (drill into series/parent)
- [x] Implement pop (backspace or ⌘+←)
- [x] Create `src/components/Breadcrumb.tsx`
- [x] Add breadcrumb to list header
- [x] Update search to filter by stack
- [x] Clear query on drill
- [x] Test navigation flows

### Deliverable

Can drill: LMI → PD Series → PD05 → SKUs. Backspace pops.

---

## Phase 4: Docs Index

**Goal:** Documentation search support

### Tasks

- [x] Create `src/search-docs.tsx` command
- [x] Add scope argument to main search (optional)
- [x] Update `useAlgoliaSearch.ts` for docs index
- [x] Add doc-specific list item rendering
- [x] Add QuickLook preview action (⌘+P)
- [x] Test docs search

### Deliverable

`search-docs` command searches manuals/datasheets; main search can switch scope.

---

## Phase 5: Polish

**Goal:** Production-ready quality

### Tasks

- [ ] Add entity-specific icons (series, parent, SKU, doc)
- [x] Implement detail view with full metadata
- [x] Add "Copy as Markdown" action (⌘+⇧+K)
- [x] Add error handling (network, auth, empty results)
- [x] Add TTL caching with offline fallback
- [x] Add loading states
- [x] Optimize search debouncing
- [x] Add stock status badges
- [x] Test all keyboard shortcuts
- [x] Write README with setup instructions

### Deliverable

Polished extension ready for team distribution.

---

## Development Commands

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Fix lint issues
npm run lint -- --fix

# Publish to Raycast Store (when ready)
npm run publish
```

---

## Configuration

### Environment Setup

1. Get Algolia credentials from Supplyline dashboard
2. Install extension in dev mode: `npm run dev`
3. Open Raycast → Extensions → Search Supplyline
4. Enter Algolia App ID and Search API Key in preferences

### Credentials Required

| Credential | Source |
|------------|--------|
| Algolia App ID | Algolia dashboard |
| Algolia Search API Key | Algolia dashboard (search-only, not admin) |

---

## Open Questions

1. **Distribution:** Private extension (team-only) or submit to Raycast Store?
2. **Icons:** Use generic icons or create Supplyline-branded set?
3. ~~**Offline:** Cache recent results for offline access?~~ ✅ Implemented with TTL caching
4. **Analytics:** Track searches for Algolia Analytics?

---

## Timeline Estimate

| Phase | Scope |
|-------|-------|
| Phase 1 | MVP - basic search |
| Phase 2 | Multi-index |
| Phase 3 | Navigation |
| Phase 4 | Docs |
| Phase 5 | Polish |

---

*Plan v1.0 — January 2026*
