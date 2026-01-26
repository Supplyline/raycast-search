# Algolia Index Spec — Supplyline Search

## Overview

Three indices supporting stack-based hierarchical navigation:

| Index | Purpose | Source | Est. Records |
|-------|---------|--------|--------------|
| `supplyline_products_browse` | Series (L1) + Parent (L2) | Plytix | ~500 |
| `supplyline_products_sku` | Child (L3) + Sibling (L4) | Plytix | ~5,000 |
| `supplyline_docs` | Manuals, datasheets, IOMs | DAM | ~1,000 |

---

## Index: `supplyline_products_browse`

### Purpose
Browsable product hierarchy for drill-down navigation. Contains Series and Parent level records.

### Schema

| Field | Type | Searchable | Facet | Description |
|-------|------|------------|-------|-------------|
| `objectID` | string | - | - | Unique ID: `series-{brand}-{slug}` or `parent-{brand}-{series}-{slug}` |
| `entityType` | string | - | Yes | `"series"` or `"parent"` |
| `title` | string | Yes | - | Display name (e.g., "PD Series", "PD05") |
| `subtitle` | string | Yes | - | Short description |
| `brand` | string | Yes | Yes | Brand name (e.g., "LMI", "Blue-White") |
| `brandSlug` | string | - | Yes | URL-safe brand (e.g., "lmi", "blue-white") |
| `primaryBehavior` | string | - | - | Always `"drill"` |
| `urlShop` | string | - | - | `/configure/{brand}/{series}/{parent?}` |
| `urlAbout` | string | - | - | `/products/{brand}/{series}/{parent?}` |
| `drillKey.brand` | string | - | Yes | Brand for filtering children |
| `drillKey.series` | string | - | Yes | Series slug for filtering children |
| `drillKey.parent` | string | - | Yes | Parent slug (null for series) |
| `childCount` | number | - | - | Number of child items |
| `hasConfigurator` | boolean | - | Yes | Has interactive configurator |
| `imageUrl` | string | - | - | Thumbnail URL |
| `popularity` | number | - | - | Ranking signal (higher = more popular) |
| `searchableText` | string | Yes | - | Concatenated searchable content |

### Sample Record

```json
{
  "objectID": "series-lmi-pd",
  "entityType": "series",
  "title": "PD Series",
  "subtitle": "Solenoid-driven diaphragm metering pumps",
  "brand": "LMI",
  "brandSlug": "lmi",
  "primaryBehavior": "drill",
  "urlShop": "/configure/lmi/pd",
  "urlAbout": "/products/lmi/pd",
  "drillKey": {
    "brand": "LMI"
  },
  "childCount": 12,
  "hasConfigurator": true,
  "imageUrl": "https://cdn.supplyline.com/series/lmi-pd.jpg",
  "popularity": 95,
  "searchableText": "PD Series LMI metering pump diaphragm solenoid chemical feed"
}
```

---

## Index: `supplyline_products_sku`

### Purpose
Transactional SKU records for purchase. Contains Child (L3) and Sibling (L4) level records.

### Schema

| Field | Type | Searchable | Facet | Description |
|-------|------|------------|-------|-------------|
| `objectID` | string | - | - | Unique ID: `sku-{mno}` |
| `entityType` | string | - | Yes | Always `"sku"` |
| `skuLevel` | number | - | Yes | `3` (Child) or `4` (Sibling) |
| `title` | string | Yes | - | Product name |
| `subtitle` | string | Yes | - | Short specs summary |
| `brand` | string | Yes | Yes | Brand name |
| `brandSlug` | string | - | Yes | URL-safe brand |
| `mno` | string | Yes | - | Part number / SKU (highest search priority) |
| `primaryBehavior` | string | - | - | Always `"open"` |
| `urlShop` | string | - | - | `/configure/{brand}/{series}/{parent}/{sku}` |
| `urlAbout` | string | - | - | `/products/{brand}/{series}/{parent}/{sku}` |
| `drillKey.brand` | string | - | Yes | Brand for filtering |
| `drillKey.series` | string | - | Yes | Series slug |
| `drillKey.parent` | string | - | Yes | Parent slug |
| `price` | number | - | Yes | List price USD |
| `inStock` | boolean | - | Yes | Stock availability |
| `imageUrl` | string | - | - | Product image URL |
| `searchableText` | string | Yes | - | Extended searchable content |

### Sample Record

```json
{
  "objectID": "sku-pd051832ni",
  "entityType": "sku",
  "skuLevel": 3,
  "title": "PD Series Metering Pump - 0.5 GPH, 150 PSI, PVDF",
  "subtitle": "Solenoid diaphragm pump for chemical feed",
  "brand": "LMI",
  "brandSlug": "lmi",
  "mno": "PD051832NI",
  "primaryBehavior": "open",
  "urlShop": "/configure/lmi/pd/pd05/pd051832ni",
  "urlAbout": "/products/lmi/pd/pd05/pd051832ni",
  "drillKey": {
    "brand": "LMI",
    "series": "pd",
    "parent": "pd05"
  },
  "price": 675.00,
  "inStock": true,
  "imageUrl": "https://cdn.supplyline.com/products/pd051832ni.jpg",
  "searchableText": "PD051832NI LMI PD Series PD05 metering pump 0.5 GPH 150 PSI PVDF solenoid diaphragm"
}
```

---

## Index: `supplyline_docs`

### Purpose
Documentation (manuals, datasheets, IOMs, SDS) from the Supplyline DAM.

### Schema

| Field | Type | Searchable | Facet | Description |
|-------|------|------------|-------|-------------|
| `objectID` | string | - | - | DAM asset ID |
| `entityType` | string | - | Yes | Always `"doc"` |
| `docType` | string | - | Yes | `"manual"`, `"datasheet"`, `"iom"`, `"sds"` |
| `title` | string | Yes | - | Document title |
| `subtitle` | string | Yes | - | Document description |
| `brand` | string | Yes | Yes | Associated brand |
| `brandSlug` | string | - | Yes | URL-safe brand |
| `primaryBehavior` | string | - | - | Always `"open"` |
| `urlShop` | string | - | - | null (docs don't have shop page) |
| `urlAbout` | string | - | - | Document detail page |
| `downloadUrl` | string | - | - | Protected download endpoint |
| `fileSize` | number | - | - | File size in bytes |
| `fileType` | string | - | Yes | `"pdf"`, `"dwg"`, etc. |
| `series` | string | Yes | Yes | Associated series (if any) |
| `searchableText` | string | Yes | - | Extracted document text |
| `updatedAt` | number | - | - | Unix timestamp for recency |

### Sample Record

```json
{
  "objectID": "doc-lmi-pd-iom",
  "entityType": "doc",
  "docType": "iom",
  "title": "PD Series Installation & Operation Manual",
  "subtitle": "Complete installation, operation, and maintenance guide",
  "brand": "LMI",
  "brandSlug": "lmi",
  "primaryBehavior": "open",
  "urlShop": null,
  "urlAbout": "/docs/lmi/pd/iom",
  "downloadUrl": "/api/docs/download/doc-lmi-pd-iom",
  "fileSize": 2456789,
  "fileType": "pdf",
  "series": "pd",
  "searchableText": "PD Series installation operation maintenance manual LMI metering pump...",
  "updatedAt": 1704067200
}
```

---

## Query Routing

### Products Scope (default)

```typescript
// Stack depth determines index priority
if (stackDepth >= 2) {
  // Deep in hierarchy: SKUs more relevant
  indices = ['supplyline_products_sku', 'supplyline_products_browse'];
} else {
  // Top level: browse items more relevant
  indices = ['supplyline_products_browse', 'supplyline_products_sku'];
}
```

### Docs Scope

```typescript
indices = ['supplyline_docs'];
```

### MNO Mode

When MNO-like query detected (alphanumeric, no spaces, has digits + letters):

```typescript
params = {
  typoTolerance: 'min',
  restrictSearchableAttributes: ['mno', 'title'],
};
```

---

## Filtering

### Stack-Based Context Filtering

```typescript
function escapeAlgoliaFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildFilters(stack: StackItem[]): string {
  const filters: string[] = [];

  for (const item of stack) {
    if (item.type === 'brand') {
      filters.push(`brandSlug:"${escapeAlgoliaFilterValue(item.id)}"`);
    } else if (item.type === 'series') {
      filters.push(`drillKey.series:"${escapeAlgoliaFilterValue(item.id)}"`);
    } else if (item.type === 'parent') {
      filters.push(`drillKey.parent:"${escapeAlgoliaFilterValue(item.id)}"`);
    }
  }

  return filters.join(' AND ');
}
```

### Example Filter Chains

| Stack | Filter String |
|-------|--------------|
| `[{type: brand, id: lmi}]` | `brandSlug:"lmi"` |
| `[{...}, {type: series, id: pd}]` | `brandSlug:"lmi" AND drillKey.series:"pd"` |
| `[{...}, {...}, {type: parent, id: pd05}]` | `brandSlug:"lmi" AND drillKey.series:"pd" AND drillKey.parent:"pd05"` |

---

## Index Settings

### products_browse

```json
{
  "searchableAttributes": ["title", "brand", "subtitle", "searchableText"],
  "attributesForFaceting": [
    "filterOnly(entityType)",
    "filterOnly(brand)",
    "filterOnly(brandSlug)",
    "filterOnly(drillKey.brand)",
    "filterOnly(drillKey.series)",
    "filterOnly(hasConfigurator)"
  ],
  "customRanking": ["desc(popularity)", "desc(childCount)"],
  "typoTolerance": true,
  "hitsPerPage": 10
}
```

### products_sku

```json
{
  "searchableAttributes": ["mno", "title", "brand", "subtitle", "searchableText"],
  "attributesForFaceting": [
    "filterOnly(entityType)",
    "filterOnly(skuLevel)",
    "filterOnly(brand)",
    "filterOnly(brandSlug)",
    "filterOnly(drillKey.brand)",
    "filterOnly(drillKey.series)",
    "filterOnly(drillKey.parent)",
    "filterOnly(inStock)"
  ],
  "customRanking": ["desc(inStock)", "asc(price)"],
  "typoTolerance": true,
  "hitsPerPage": 10
}
```

### docs

```json
{
  "searchableAttributes": ["title", "brand", "series", "subtitle", "searchableText"],
  "attributesForFaceting": [
    "filterOnly(entityType)",
    "filterOnly(docType)",
    "filterOnly(brand)",
    "filterOnly(brandSlug)",
    "filterOnly(series)",
    "filterOnly(fileType)"
  ],
  "customRanking": ["desc(updatedAt)"],
  "typoTolerance": true,
  "hitsPerPage": 10
}
```

---

## Test Queries

| Query | Index | Expected | Notes |
|-------|-------|----------|-------|
| `PD051832NI` | products_sku | Exact SKU first | MNO mode |
| `PD Series` | products_browse | LMI PD Series first | General mode |
| `metering pump` | both | Mix of browse + SKU | General mode |
| `installation manual` | docs | IOM docs | Docs scope |

---

*Algolia Index Spec v1.0 — January 2026*
