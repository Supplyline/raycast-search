import { Cache } from "@raycast/api";

// Cache instance
const cache = new Cache();

// TTL constants (in milliseconds)
export const TTL = {
  BRANDS: 24 * 60 * 60 * 1000, // 24 hours
  SEARCH_RESULTS: 3 * 60 * 60 * 1000, // 3 hours
  DOCS: 12 * 60 * 60 * 1000, // 12 hours
} as const;

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Get data from cache if not expired
 */
export function getFromCache<T>(key: string): T | undefined {
  const raw = cache.get(key);
  if (!raw) return undefined;

  try {
    const cached: CachedData<T> = JSON.parse(raw);
    const isExpired = Date.now() - cached.timestamp > cached.ttl;

    if (isExpired) {
      cache.remove(key);
      return undefined;
    }

    return cached.data;
  } catch {
    cache.remove(key);
    return undefined;
  }
}

/**
 * Save data to cache with TTL
 */
export function setInCache<T>(key: string, data: T, ttl: number): void {
  const cached: CachedData<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  };
  cache.set(key, JSON.stringify(cached));
}

/**
 * Get data from cache even if expired (for offline fallback)
 */
export function getFromCacheStale<T>(key: string): { data: T; isStale: boolean } | undefined {
  const raw = cache.get(key);
  if (!raw) return undefined;

  try {
    const cached: CachedData<T> = JSON.parse(raw);
    const isStale = Date.now() - cached.timestamp > cached.ttl;
    return { data: cached.data, isStale };
  } catch {
    return undefined;
  }
}

/**
 * Generate cache key for search queries
 */
export function getSearchCacheKey(query: string, scope: string, stackKey: string): string {
  return `search:${scope}:${stackKey}:${query}`;
}

/**
 * Clear all search cache
 */
export function clearSearchCache(): void {
  cache.clear();
}
