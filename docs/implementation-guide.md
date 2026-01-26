# Supplyline Raycast Extension — Implementation Guide

> Complete code reference for building the extension.
> See [SPEC.md](./SPEC.md) for requirements and [PLAN.md](./PLAN.md) for phases.

---

## Project Setup

### Initialize Extension

```bash
cd ~/Developer/raycast-search
npx create-raycast-extension --template list-detail
npm install algoliasearch
```

### Package.json Configuration

```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "supplyline-search",
  "title": "Search Supplyline",
  "description": "Search Supplyline products, SKUs, and documentation via Algolia",
  "icon": "extension-icon.png",
  "author": "supplyline",
  "license": "MIT",
  "commands": [
    {
      "name": "search",
      "title": "Search Supplyline",
      "subtitle": "Products, SKUs, and documentation",
      "description": "Search across all Supplyline indices",
      "mode": "view"
    },
    {
      "name": "search-docs",
      "title": "Search Supplyline Docs",
      "subtitle": "Manuals and datasheets",
      "description": "Search documentation only",
      "mode": "view"
    }
  ],
  "preferences": [
    {
      "name": "algoliaAppId",
      "title": "Algolia Application ID",
      "description": "Your Algolia Application ID",
      "type": "textfield",
      "required": true
    },
    {
      "name": "algoliaApiKey",
      "title": "Algolia Search API Key",
      "description": "Your Algolia Search-Only API Key",
      "type": "password",
      "required": true
    },
    {
      "name": "defaultScope",
      "title": "Default Search Scope",
      "description": "Which index to search by default",
      "type": "dropdown",
      "required": false,
      "default": "products",
      "data": [
        { "title": "Products", "value": "products" },
        { "title": "Docs", "value": "docs" }
      ]
    },
    {
      "name": "showPrices",
      "title": "Show Prices",
      "description": "Display prices in search results",
      "type": "checkbox",
      "required": false,
      "default": true,
      "label": "Show prices in results"
    }
  ],
  "dependencies": {
    "@raycast/api": "^1.91.0",
    "@raycast/utils": "^1.17.0",
    "algoliasearch": "^4.24.0"
  },
  "devDependencies": {
    "@raycast/eslint-config": "^1.0.11",
    "@types/node": "^20.11.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Type Definitions

### src/types.ts

```typescript
// Entity types matching algolia-index-spec.md

export type EntityType = "series" | "parent" | "sku" | "doc";
export type Scope = "products" | "docs";

export interface BaseEntity {
  objectID: string;
  entityType: EntityType;
  title: string;
  subtitle?: string;
  brand: string;
  primaryBehavior: "drill" | "open";
  urlShop?: string;
  urlAbout?: string;
  drillKey?: {
    brand?: string;
    series?: string;
    parent?: string;
  };
}

export interface BrowseEntity extends BaseEntity {
  entityType: "series" | "parent";
  primaryBehavior: "drill";
  childCount: number;
  hasConfigurator: boolean;
  seriesCode?: string;
  parentCode?: string;
}

export interface SkuEntity extends BaseEntity {
  entityType: "sku";
  primaryBehavior: "open";
  mno: string;
  price: number;
  inStock: boolean;
  imageUrl?: string;
  specs?: Record<string, string>;
}

export interface DocEntity extends BaseEntity {
  entityType: "doc";
  primaryBehavior: "open";
  docType: "manual" | "datasheet" | "iom" | "sds";
  fileUrl: string;
  fileSize?: number;
  seriesCode?: string;
}

export type SearchResult = BrowseEntity | SkuEntity | DocEntity;

export interface StackItem {
  type: "brand" | "series" | "parent";
  id: string;
  label: string;
}

export interface SearchState {
  scope: Scope;
  query: string;
  stack: StackItem[];
  results: SearchResult[];
  isLoading: boolean;
  error?: string;
}

export interface Preferences {
  algoliaAppId: string;
  algoliaApiKey: string;
  defaultScope: Scope;
  showPrices: boolean;
}
```

---

## Algolia Client

### src/utils/algolia.ts

```typescript
import algoliasearch, { SearchClient, SearchIndex } from "algoliasearch";
import { getPreferenceValues } from "@raycast/api";
import { Preferences, StackItem, SearchResult } from "../types";

const INDEX_NAMES = {
  browse: "supplyline_products_browse",
  sku: "supplyline_products_sku",
  docs: "supplyline_docs",
} as const;

let client: SearchClient | null = null;

export function getAlgoliaClient(): SearchClient {
  if (!client) {
    const { algoliaAppId, algoliaApiKey } = getPreferenceValues<Preferences>();
    client = algoliasearch(algoliaAppId, algoliaApiKey);
  }
  return client;
}

export function getIndex(name: keyof typeof INDEX_NAMES): SearchIndex {
  return getAlgoliaClient().initIndex(INDEX_NAMES[name]);
}

// MNO detection heuristic
export function isMnoQuery(query: string): boolean {
  if (query.length < 3) return false;

  const alphanumericRatio = (query.match(/[a-zA-Z0-9]/g)?.length || 0) / query.length;
  const hasDigits = /\d/.test(query);
  const hasLetters = /[a-zA-Z]/.test(query);
  const noSpaces = !query.includes(" ");

  return alphanumericRatio > 0.9 && hasDigits && hasLetters && noSpaces;
}

// Build Algolia filters from stack
export function buildFilters(stack: StackItem[]): string {
  const filters: string[] = [];

  for (const item of stack) {
    const escaped = item.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    if (item.type === "brand") {
      filters.push(`brandSlug:"${escaped}"`);
    } else if (item.type === "series") {
      filters.push(`drillKey.series:"${escaped}"`);
    } else if (item.type === "parent") {
      filters.push(`drillKey.parent:"${escaped}"`);
    }
  }

  return filters.join(" AND ");
}

// Search parameters for MNO mode
function getMnoSearchParams(query: string, filters: string) {
  return {
    query,
    filters,
    typoTolerance: "min" as const,
    restrictSearchableAttributes: ["mno", "title"],
    hitsPerPage: 20,
  };
}

// Search parameters for general mode
function getGeneralSearchParams(query: string, filters: string) {
  return {
    query,
    filters,
    typoTolerance: true,
    hitsPerPage: 20,
  };
}

// Federated search across products indices
export async function searchProducts(
  query: string,
  stack: StackItem[]
): Promise<SearchResult[]> {
  const filters = buildFilters(stack);
  const isMno = isMnoQuery(query);
  const params = isMno
    ? getMnoSearchParams(query, filters)
    : getGeneralSearchParams(query, filters);

  // If stack is empty, search both indices
  if (stack.length === 0) {
    const [browseResults, skuResults] = await Promise.all([
      getIndex("browse").search<SearchResult>(query, params),
      getIndex("sku").search<SearchResult>(query, params),
    ]);

    // Merge and sort by relevance
    const combined = [...browseResults.hits, ...skuResults.hits];

    // For MNO queries, boost exact matches
    if (isMno) {
      combined.sort((a, b) => {
        const aExact = "mno" in a && a.mno?.toLowerCase() === query.toLowerCase();
        const bExact = "mno" in b && b.mno?.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;
        return 0;
      });
    }

    return combined.slice(0, 20);
  }

  // If stack has items, search only SKU index (filtered)
  const results = await getIndex("sku").search<SearchResult>(query, params);
  return results.hits;
}

// Search docs index
export async function searchDocs(query: string): Promise<SearchResult[]> {
  const results = await getIndex("docs").search<SearchResult>(query, {
    hitsPerPage: 20,
  });
  return results.hits;
}
```

---

## Navigation Stack Hook

### src/hooks/useNavigationStack.ts

```typescript
import { useState, useCallback } from "react";
import { StackItem, SearchResult, BrowseEntity } from "../types";

export function useNavigationStack() {
  const [stack, setStack] = useState<StackItem[]>([]);

  const push = useCallback((item: SearchResult) => {
    if (item.primaryBehavior !== "drill") return false;

    const browseItem = item as BrowseEntity;
    let stackItem: StackItem;

    if (browseItem.entityType === "series") {
      stackItem = {
        type: "series",
        id: browseItem.drillKey?.series || browseItem.objectID,
        label: browseItem.title,
      };
    } else if (browseItem.entityType === "parent") {
      stackItem = {
        type: "parent",
        id: browseItem.drillKey?.parent || browseItem.objectID,
        label: browseItem.title,
      };
    } else {
      return false;
    }

    setStack((prev) => [...prev, stackItem]);
    return true;
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  const breadcrumb = stack.map((item) => item.label).join(" > ");

  return {
    stack,
    push,
    pop,
    clear,
    breadcrumb,
    canPop: stack.length > 0,
  };
}
```

---

## Search Hook

### src/hooks/useAlgoliaSearch.ts

```typescript
import { useState, useEffect, useRef } from "react";
import { showToast, Toast } from "@raycast/api";
import { useDebouncedValue } from "@raycast/utils";
import { SearchResult, StackItem, Scope } from "../types";
import { searchProducts, searchDocs } from "../utils/algolia";

interface UseAlgoliaSearchOptions {
  scope: Scope;
  stack: StackItem[];
  debounceMs?: number;
}

export function useAlgoliaSearch(
  query: string,
  options: UseAlgoliaSearchOptions
) {
  const { scope, stack, debounceMs = 200 } = options;
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmedQuery = debouncedQuery.trim();

    // Clear results if query is too short
    if (trimmedQuery.length < 2 && stack.length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(undefined);

    const performSearch = async () => {
      try {
        let searchResults: SearchResult[];

        if (scope === "docs") {
          searchResults = await searchDocs(trimmedQuery);
        } else {
          searchResults = await searchProducts(trimmedQuery, stack);
        }

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) return;

        setResults(searchResults);
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) return;

        const message = err instanceof Error ? err.message : "Search failed";
        setError(message);
        showToast({
          style: Toast.Style.Failure,
          title: "Search Error",
          message,
        });
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [debouncedQuery, scope, stack]);

  return { results, isLoading, error };
}
```

---

## Main Search Command

### src/index.tsx

```typescript
import {
  Action,
  ActionPanel,
  List,
  Icon,
  Color,
  getPreferenceValues,
  showToast,
  Toast,
  Clipboard,
} from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { useNavigationStack } from "./hooks/useNavigationStack";
import {
  SearchResult,
  SkuEntity,
  DocEntity,
  BrowseEntity,
  Preferences,
  Scope,
} from "./types";

export default function SearchSupplyline() {
  const { defaultScope, showPrices } = getPreferenceValues<Preferences>();
  const [query, setQuery] = useState("");
  const [scope] = useState<Scope>(defaultScope || "products");

  const { stack, push, pop, breadcrumb, canPop } = useNavigationStack();
  const { results, isLoading, error } = useAlgoliaSearch(query, { scope, stack });

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.primaryBehavior === "drill") {
        const pushed = push(item);
        if (pushed) {
          setQuery(""); // Clear query after drilling
        }
      }
    },
    [push]
  );

  const handlePop = useCallback(() => {
    if (canPop) {
      pop();
      setQuery("");
    }
  }, [canPop, pop]);

  const handleCopy = useCallback(async (item: SearchResult) => {
    let text: string;

    if ("mno" in item) {
      const sku = item as SkuEntity;
      text = `${sku.mno} — $${sku.price.toFixed(2)}\n${sku.urlShop || ""}`;
    } else if ("fileUrl" in item) {
      const doc = item as DocEntity;
      text = `${doc.title}\n${doc.fileUrl}`;
    } else {
      text = item.title;
    }

    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied" });
  }, []);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search products, SKUs, or docs..."
      searchText={query}
      onSearchTextChange={setQuery}
      navigationTitle={breadcrumb || "Search Supplyline"}
      throttle
    >
      {canPop && (
        <List.Section title="Navigation">
          <List.Item
            icon={Icon.ArrowLeft}
            title="Go Back"
            subtitle={`to ${stack[stack.length - 2]?.label || "top level"}`}
            actions={
              <ActionPanel>
                <Action title="Go Back" onAction={handlePop} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

      {results.length === 0 && query.length >= 2 && !isLoading && (
        <List.EmptyView
          title="No Results"
          description={error || `No matches for "${query}"`}
          icon={Icon.MagnifyingGlass}
        />
      )}

      {results.length > 0 && (
        <List.Section title="Results" subtitle={`${results.length} items`}>
          {results.map((item) => (
            <SearchResultItem
              key={item.objectID}
              item={item}
              showPrices={showPrices}
              onSelect={handleSelect}
              onCopy={handleCopy}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

// Result item component
interface SearchResultItemProps {
  item: SearchResult;
  showPrices: boolean;
  onSelect: (item: SearchResult) => void;
  onCopy: (item: SearchResult) => void;
}

function SearchResultItem({
  item,
  showPrices,
  onSelect,
  onCopy,
}: SearchResultItemProps) {
  const icon = getIconForEntity(item);
  const subtitle = getSubtitle(item, showPrices);
  const accessories = getAccessories(item);

  return (
    <List.Item
      icon={icon}
      title={item.title}
      subtitle={subtitle}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {item.primaryBehavior === "drill" ? (
              <Action
                title="Drill Down"
                icon={Icon.ArrowRight}
                onAction={() => onSelect(item)}
              />
            ) : (
              <>
                {item.urlShop && (
                  <Action.OpenInBrowser
                    title="Open Shop"
                    url={item.urlShop}
                    icon={Icon.Cart}
                  />
                )}
                {item.urlAbout && (
                  <Action.OpenInBrowser
                    title="Open About"
                    url={item.urlAbout}
                    icon={Icon.Info}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                  />
                )}
                {"fileUrl" in item && (
                  <Action.OpenInBrowser
                    title="Open Document"
                    url={(item as DocEntity).fileUrl}
                    icon={Icon.Document}
                  />
                )}
              </>
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Copy"
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["cmd"], key: "k" }}
              onAction={() => onCopy(item)}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

// Helper functions
function getIconForEntity(item: SearchResult): { source: Icon; tintColor?: Color } {
  switch (item.entityType) {
    case "series":
      return { source: Icon.Folder, tintColor: Color.Blue };
    case "parent":
      return { source: Icon.Box, tintColor: Color.Purple };
    case "sku":
      return { source: Icon.Tag, tintColor: Color.Green };
    case "doc":
      return { source: Icon.Document, tintColor: Color.Orange };
    default:
      return { source: Icon.Circle };
  }
}

function getSubtitle(item: SearchResult, showPrices: boolean): string {
  if ("mno" in item) {
    const sku = item as SkuEntity;
    const parts = [sku.brand];
    if (showPrices) {
      parts.push(`$${sku.price.toFixed(2)}`);
    }
    return parts.join(" • ");
  }

  if ("childCount" in item) {
    const browse = item as BrowseEntity;
    return `${browse.brand} • ${browse.childCount} items`;
  }

  if ("docType" in item) {
    const doc = item as DocEntity;
    return `${doc.brand} • ${doc.docType.toUpperCase()}`;
  }

  return item.subtitle || item.brand;
}

function getAccessories(item: SearchResult): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];

  if ("inStock" in item) {
    const sku = item as SkuEntity;
    accessories.push({
      tag: {
        value: sku.inStock ? "In Stock" : "Out of Stock",
        color: sku.inStock ? Color.Green : Color.Red,
      },
    });
  }

  if ("hasConfigurator" in item && (item as BrowseEntity).hasConfigurator) {
    accessories.push({
      icon: { source: Icon.Gear, tintColor: Color.SecondaryText },
      tooltip: "Has Configurator",
    });
  }

  if (item.primaryBehavior === "drill") {
    accessories.push({
      icon: Icon.ChevronRight,
    });
  }

  return accessories;
}
```

---

## Docs Search Command

### src/search-docs.tsx

```typescript
import {
  Action,
  ActionPanel,
  List,
  Icon,
  Color,
  Clipboard,
  showToast,
  Toast,
} from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { DocEntity, SearchResult } from "./types";

export default function SearchDocs() {
  const [query, setQuery] = useState("");

  const { results, isLoading, error } = useAlgoliaSearch(query, {
    scope: "docs",
    stack: [],
  });

  const handleCopy = useCallback(async (item: DocEntity) => {
    const text = `${item.title}\n${item.fileUrl}`;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied" });
  }, []);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search manuals, datasheets, IOMs..."
      searchText={query}
      onSearchTextChange={setQuery}
      throttle
    >
      {results.length === 0 && query.length >= 2 && !isLoading && (
        <List.EmptyView
          title="No Documents Found"
          description={error || `No matches for "${query}"`}
          icon={Icon.Document}
        />
      )}

      {results.map((item) => {
        const doc = item as DocEntity;
        return (
          <List.Item
            key={doc.objectID}
            icon={{ source: getDocIcon(doc.docType), tintColor: Color.Orange }}
            title={doc.title}
            subtitle={`${doc.brand} • ${doc.docType.toUpperCase()}`}
            accessories={[
              doc.fileSize
                ? { text: formatFileSize(doc.fileSize) }
                : undefined,
            ].filter(Boolean) as List.Item.Accessory[]}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser
                  title="Open Document"
                  url={doc.fileUrl}
                  icon={Icon.Globe}
                />
                <Action
                  title="Copy Link"
                  icon={Icon.Clipboard}
                  shortcut={{ modifiers: ["cmd"], key: "k" }}
                  onAction={() => handleCopy(doc)}
                />
                <Action.CopyToClipboard
                  title="Copy URL"
                  content={doc.fileUrl}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function getDocIcon(docType: string): Icon {
  switch (docType) {
    case "manual":
      return Icon.Book;
    case "datasheet":
      return Icon.Document;
    case "iom":
      return Icon.Wrench;
    case "sds":
      return Icon.ExclamationMark;
    default:
      return Icon.Document;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

---

## Clipboard Utilities

### src/utils/clipboard.ts

```typescript
import { Clipboard, showToast, Toast } from "@raycast/api";
import { SearchResult, SkuEntity, DocEntity, BrowseEntity } from "../types";

export async function copyPlainText(item: SearchResult): Promise<void> {
  let text: string;

  if ("mno" in item) {
    const sku = item as SkuEntity;
    text = `${sku.mno} — $${sku.price.toFixed(2)}`;
    if (sku.urlShop) {
      text += `\n${sku.urlShop}`;
    }
  } else if ("fileUrl" in item) {
    const doc = item as DocEntity;
    text = `${doc.title}\n${doc.fileUrl}`;
  } else {
    const browse = item as BrowseEntity;
    text = `${browse.title} (${browse.childCount} items)`;
  }

  await Clipboard.copy(text);
  await showToast({ style: Toast.Style.Success, title: "Copied" });
}

export async function copyMarkdown(item: SearchResult): Promise<void> {
  let markdown: string;

  if ("mno" in item) {
    const sku = item as SkuEntity;
    if (sku.urlShop) {
      markdown = `[${sku.mno}](${sku.urlShop}) — $${sku.price.toFixed(2)}`;
    } else {
      markdown = `**${sku.mno}** — $${sku.price.toFixed(2)}`;
    }
  } else if ("fileUrl" in item) {
    const doc = item as DocEntity;
    markdown = `[${doc.title}](${doc.fileUrl})`;
  } else {
    markdown = `**${item.title}**`;
  }

  await Clipboard.copy(markdown);
  await showToast({ style: Toast.Style.Success, title: "Copied as Markdown" });
}
```

---

## URL Builder

### src/utils/urls.ts

```typescript
const BASE_URL = "https://supplyline.com";

export function buildShopUrl(
  brand: string,
  series?: string,
  parent?: string,
  sku?: string
): string {
  const parts = [BASE_URL, "configure", brand.toLowerCase()];

  if (series) parts.push(series.toLowerCase());
  if (parent) parts.push(parent.toLowerCase());
  if (sku) parts.push(sku.toLowerCase());

  return parts.join("/");
}

export function buildAboutUrl(
  brand: string,
  series?: string,
  parent?: string,
  sku?: string
): string {
  const parts = [BASE_URL, "products", brand.toLowerCase()];

  if (series) parts.push(series.toLowerCase());
  if (parent) parts.push(parent.toLowerCase());
  if (sku) parts.push(sku.toLowerCase());

  return parts.join("/");
}
```

---

## Testing Checklist

### Setup
- [ ] Extension loads without errors
- [ ] Preferences are prompted on first run
- [ ] Algolia connection succeeds

### Search
- [ ] Empty state shows when no query
- [ ] Results appear within 300ms
- [ ] MNO query returns exact match first
- [ ] General query returns fuzzy matches

### Navigation
- [ ] Drill down on series works
- [ ] Drill down on parent works
- [ ] Back navigation works
- [ ] Breadcrumb updates correctly
- [ ] Query clears after drill

### Actions
- [ ] Open Shop opens correct URL
- [ ] Open About opens correct URL (⌘+⇧+Enter)
- [ ] Copy works (⌘+K)
- [ ] Copy as Markdown works (⌘+⇧+K)

### Docs Command
- [ ] search-docs command appears
- [ ] Docs search returns results
- [ ] Document opens in browser

### Error Handling
- [ ] Network error shows toast
- [ ] Invalid API key shows error
- [ ] Empty results show appropriate message

---

*Implementation Guide v1.0 — January 2026*
