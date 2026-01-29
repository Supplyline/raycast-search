import { algoliasearch } from "algoliasearch";
import { SkuEntity, BrowseEntity, DocEntity, StackItem, SearchResult } from "../types";

// Algolia credentials (Search-Only API Key - safe to expose in client code)
const ALGOLIA_APP_ID = "93ZW4STL69";
const ALGOLIA_API_KEY = "b038eef0b9904896a2a0986ba6ec7816";

const INDEX_NAMES = {
  browse: "dev_products_browse",
  sku: "dev_products_sku",
  docs: "dev_docs",
} as const;

let client: ReturnType<typeof algoliasearch> | null = null;

export function getAlgoliaClient() {
  if (!client) {
    client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
  }
  return client;
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

// Search parameters for MNO mode - SKU index (has mno field)
function getMnoSearchParamsSku(query: string, filters: string) {
  return {
    query,
    filters: filters || undefined,
    typoTolerance: "min" as const,
    restrictSearchableAttributes: ["mno", "title"],
    hitsPerPage: 20,
  };
}

// Search parameters for MNO mode - Browse index (no mno field)
function getMnoSearchParamsBrowse(query: string, filters: string) {
  return {
    query,
    filters: filters || undefined,
    typoTolerance: "min" as const,
    restrictSearchableAttributes: ["title"],
    hitsPerPage: 20,
  };
}

// Search parameters for general mode
function getGeneralSearchParams(query: string, filters: string) {
  return {
    query,
    filters: filters || undefined,
    typoTolerance: true as const,
    hitsPerPage: 20,
  };
}

// Federated search across products indices
export async function searchProducts(
  query: string,
  stack: StackItem[]
): Promise<SearchResult[]> {
  const client = getAlgoliaClient();
  const filters = buildFilters(stack);
  const isMno = isMnoQuery(query);

  // Use different search params for each index (browse doesn't have mno field)
  const browseSearchParams = isMno
    ? getMnoSearchParamsBrowse(query, filters)
    : getGeneralSearchParams(query, filters);
  const skuSearchParams = isMno
    ? getMnoSearchParamsSku(query, filters)
    : getGeneralSearchParams(query, filters);

  // If stack is empty, search both indices
  if (stack.length === 0) {
    const [browseResponse, skuResponse] = await Promise.all([
      client.searchSingleIndex<BrowseEntity>({
        indexName: INDEX_NAMES.browse,
        searchParams: {
          ...browseSearchParams,
          attributesToRetrieve: ["*"],
        },
      }),
      client.searchSingleIndex<SkuEntity>({
        indexName: INDEX_NAMES.sku,
        searchParams: {
          ...skuSearchParams,
          attributesToRetrieve: ["*"],
        },
      }),
    ]);

    // Transform hits to add primaryBehavior
    const browseResults: SearchResult[] = browseResponse.hits.map((hit) => ({
      ...hit,
      primaryBehavior: "drill" as const,
    }));
    const skuResults: SearchResult[] = skuResponse.hits.map((hit) => ({
      ...hit,
      primaryBehavior: "open" as const,
    }));

    // Merge and sort by relevance
    const combined: SearchResult[] = [...browseResults, ...skuResults];

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

  // If stack has items, determine which index to search based on stack depth
  const lastStackItem = stack[stack.length - 1];

  // Brand level → search browse index for Series items of that brand
  if (lastStackItem.type === "brand") {
    const seriesFilters = filters
      ? `${filters} AND entityType:"series"`
      : `entityType:"series"`;
    const response = await client.searchSingleIndex<BrowseEntity>({
      indexName: INDEX_NAMES.browse,
      searchParams: {
        ...browseSearchParams,
        filters: seriesFilters,
        attributesToRetrieve: ["*"],
      },
    });
    return response.hits.map((hit) => ({
      ...hit,
      primaryBehavior: "drill" as const,
    }));
  }

  // Series level → search browse index for Parent items
  if (lastStackItem.type === "series") {
    // Add entityType:"parent" filter to only get Parent items, not the Series itself
    const parentFilters = filters
      ? `${filters} AND entityType:"parent"`
      : `entityType:"parent"`;
    const response = await client.searchSingleIndex<BrowseEntity>({
      indexName: INDEX_NAMES.browse,
      searchParams: {
        ...browseSearchParams,
        filters: parentFilters,
        attributesToRetrieve: ["*"],
      },
    });
    return response.hits.map((hit) => ({
      ...hit,
      primaryBehavior: "drill" as const,
    }));
  }

  // Parent level → search SKU index
  const response = await client.searchSingleIndex<SkuEntity>({
    indexName: INDEX_NAMES.sku,
    searchParams: skuSearchParams,
  });
  return response.hits.map((hit) => ({
    ...hit,
    primaryBehavior: "open" as const,
  }));
}

// Brand item for initial browse view
export interface BrandItem {
  id: string;       // brandSlug (e.g., "lmi")
  name: string;     // brand display name (e.g., "LMI")
  seriesCount: number;
}

// Fetch unique brands from series items in browse index
export async function fetchBrands(): Promise<BrandItem[]> {
  const client = getAlgoliaClient();
  
  // Search for all series items (they have brand info)
  const response = await client.searchSingleIndex<BrowseEntity>({
    indexName: INDEX_NAMES.browse,
    searchParams: {
      query: "",
      filters: 'entityType:"series"',
      hitsPerPage: 1000, // Get all series to extract brands
      attributesToRetrieve: ["brand", "brandSlug"],
    },
  });

  // Extract unique brands and count series per brand
  const brandMap = new Map<string, { name: string; count: number }>();
  
  for (const hit of response.hits) {
    const slug = hit.brandSlug || hit.brand?.toLowerCase().replace(/\s+/g, "-");
    const name = hit.brand;
    
    if (slug && name) {
      const existing = brandMap.get(slug);
      if (existing) {
        existing.count++;
      } else {
        brandMap.set(slug, { name, count: 1 });
      }
    }
  }

  // Convert to array and sort alphabetically
  const brands: BrandItem[] = Array.from(brandMap.entries())
    .map(([id, { name, count }]) => ({
      id,
      name,
      seriesCount: count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return brands;
}

// Search docs index
export async function searchDocs(query: string): Promise<SearchResult[]> {
  const client = getAlgoliaClient();
  const response = await client.searchSingleIndex<DocEntity>({
    indexName: INDEX_NAMES.docs,
    searchParams: {
      query,
      hitsPerPage: 20,
    },
  });
  return response.hits.map((hit) => ({
    ...hit,
    primaryBehavior: "open" as const,
  }));
}

// Legacy: Search products_sku index only (kept for backwards compatibility)
export async function searchSkus(query: string): Promise<SkuEntity[]> {
  const client = getAlgoliaClient();
  const isMno = isMnoQuery(query);

  const searchParams = isMno
    ? {
        query,
        typoTolerance: "min" as const,
        restrictSearchableAttributes: ["mno", "title"],
        hitsPerPage: 20,
      }
    : {
        query,
        typoTolerance: true as const,
        hitsPerPage: 20,
      };

  const response = await client.searchSingleIndex<SkuEntity>({
    indexName: INDEX_NAMES.sku,
    searchParams,
  });

  let results = response.hits;

  // For MNO queries, boost exact matches to top
  if (isMno) {
    results = results.sort((a, b) => {
      const aExact = a.mno?.toLowerCase() === query.toLowerCase();
      const bExact = b.mno?.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      return 0;
    });
  }

  return results;
}
