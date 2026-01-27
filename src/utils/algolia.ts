import { algoliasearch } from "algoliasearch";
import { SkuEntity } from "../types";

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

// Search products_sku index
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
