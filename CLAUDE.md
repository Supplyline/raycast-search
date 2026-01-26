# Supplyline Raycast Extension — Claude Context

## Project Overview

Native Raycast extension for searching Supplyline products, SKUs, and documentation via Algolia. This is a clean-slate implementation replacing the original local file search extension.

## Status

- **Phase:** 1 (Single-Index MVP)
- **Spec:** Complete — see `docs/SPEC.md`
- **Implementation:** Not started

## Key Files

```
raycast-search/
├── docs/
│   ├── SPEC.md                  # Full specification
│   ├── PLAN.md                  # Implementation phases
│   ├── ACCEPTANCE.md            # Acceptance criteria
│   ├── algolia-index-spec.md    # Algolia index schemas
│   └── implementation-guide.md  # Complete code reference
├── src/                         # (To be created)
│   ├── index.tsx                # Main search command
│   ├── search-docs.tsx          # Docs-only command
│   ├── hooks/                   # React hooks
│   ├── utils/                   # Utility functions
│   └── types.ts                 # TypeScript types
└── package.json                 # (To be configured)
```

## Architecture Summary

- **3 Algolia indices:** `supplyline_products_browse`, `supplyline_products_sku`, `supplyline_docs`
- **Stack-based navigation:** Push on drill, pop on backspace/⌘+←
- **MNO detection:** Alphanumeric no-space queries use exact-match mode
- **Federated search:** Empty stack searches browse + sku indices together

## Implementation Notes

### MNO Detection Heuristic

```typescript
function isMnoQuery(query: string): boolean {
  if (query.length < 3) return false;
  const alphanumericRatio = (query.match(/[a-zA-Z0-9]/g)?.length || 0) / query.length;
  const hasDigits = /\d/.test(query);
  const hasLetters = /[a-zA-Z]/.test(query);
  const noSpaces = !query.includes(" ");
  return alphanumericRatio > 0.9 && hasDigits && hasLetters && noSpaces;
}
```

### Stack Filter Building

```typescript
function buildFilters(stack: StackItem[]): string {
  return stack.map(item => {
    if (item.type === "brand") return `brandSlug:"${item.id}"`;
    if (item.type === "series") return `drillKey.series:"${item.id}"`;
    if (item.type === "parent") return `drillKey.parent:"${item.id}"`;
  }).join(" AND ");
}
```

## Related Projects

- `supplyline-search` — Web Command Menu specs (source of this spec)
- `supplyline-etl` — Plytix → Algolia sync pipeline
- `supplyline-sync` — DAM asset processing

## Credentials Required

| Credential | Source |
|------------|--------|
| Algolia App ID | Supplyline Algolia dashboard |
| Algolia Search API Key | Algolia dashboard (search-only) |

## Next Steps

1. Initialize Raycast extension with `npx create-raycast-extension`
2. Configure package.json with commands and preferences
3. Implement Phase 1: Single-Index MVP (see `docs/PLAN.md`)

---

*Last updated: January 2026*
