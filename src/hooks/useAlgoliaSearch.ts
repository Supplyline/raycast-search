import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { showToast, Toast } from "@raycast/api";
import { SearchResult, StackItem, Scope } from "../types";
import { searchProducts, searchDocs, categorizeError, AlgoliaErrorType, isMnoQuery } from "../utils/algolia";
import { getFromCache, setInCache, getFromCacheStale, getSearchCacheKey, TTL } from "../utils/cache";

// Adaptive debounce delays (in ms)
const DEBOUNCE = {
  MNO: 50, // Part numbers - near-instant search
  SHORT: 300, // Short queries (< 4 chars) - wait longer
  LONG: 100, // Long specific queries (> 6 chars) - faster
  DEFAULT: 200, // Standard debounce
} as const;

// Determine optimal debounce time based on query characteristics
function getAdaptiveDebounceMs(query: string): number {
  const trimmed = query.trim();

  // Empty or very short - use default
  if (trimmed.length < 2) return DEBOUNCE.DEFAULT;

  // MNO pattern detected - near-instant search
  if (isMnoQuery(trimmed)) return DEBOUNCE.MNO;

  // Short queries - wait longer for user to finish typing
  if (trimmed.length < 4) return DEBOUNCE.SHORT;

  // Long specific queries - can search faster
  if (trimmed.length > 6) return DEBOUNCE.LONG;

  return DEBOUNCE.DEFAULT;
}

// Custom debounce hook with adaptive delay
function useAdaptiveDebouncedValue(value: string): string {
  const [debouncedValue, setDebouncedValue] = useState<string>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Calculate adaptive delay based on current query
    const delay = getAdaptiveDebounceMs(value);

    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value]);

  return debouncedValue;
}

interface UseAlgoliaSearchOptions {
  scope?: Scope;
  stack?: StackItem[];
}

interface SearchError {
  message: string;
  type: AlgoliaErrorType;
}

export function useAlgoliaSearch(query: string, options: UseAlgoliaSearchOptions = {}) {
  const { scope = "products", stack = [] } = options;
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Use adaptive debouncing: MNO queries get near-instant search, short queries wait longer
  const debouncedQuery = useAdaptiveDebouncedValue(query);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Serialize stack for dependency comparison
  const stackKey = JSON.stringify(stack);

  // Memoize stack to prevent unnecessary re-renders when array reference changes but content is same
  const stableStack = useMemo(
    () => stack,
    // Using stackKey (serialized stack) as dependency ensures stability while tracking actual changes
    // eslint-disable-next-line
    [stackKey],
  );

  const performSearch = useCallback(
    async (trimmedQuery: string) => {
      const cacheKey = getSearchCacheKey(trimmedQuery, scope, stackKey);
      const ttl = scope === "docs" ? TTL.DOCS : TTL.SEARCH_RESULTS;

      // Try to get from cache first (for instant results)
      const cached = getFromCache<SearchResult[]>(cacheKey);
      if (cached) {
        setResults(cached);
        setIsLoading(false);
        setError(undefined);
        setHasSearched(true);
        // Still fetch fresh data in background (stale-while-revalidate)
        fetchFreshData(trimmedQuery, cacheKey, ttl);
        return;
      }

      try {
        let searchResults: SearchResult[];

        if (scope === "docs") {
          searchResults = await searchDocs(trimmedQuery);
        } else {
          searchResults = await searchProducts(trimmedQuery, stableStack);
        }

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) return;

        setResults(searchResults);
        setError(undefined);

        // Save to cache
        setInCache(cacheKey, searchResults, ttl);
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) return;

        // Try to get stale data for offline fallback
        const stale = getFromCacheStale<SearchResult[]>(cacheKey);
        if (stale) {
          setResults(stale.data);
          setIsStale(true);
          showToast({
            style: Toast.Style.Animated,
            title: "Offline Mode",
            message: "Showing cached results",
          });
          return;
        }

        const algoliaError = categorizeError(err);
        setError({ message: algoliaError.message, type: algoliaError.type });

        // Show toast with appropriate style
        const toastTitle = getErrorTitle(algoliaError.type);
        showToast({
          style: Toast.Style.Failure,
          title: toastTitle,
          message: algoliaError.message,
        });
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsLoading(false);
          setHasSearched(true);
        }
      }
    },
    [scope, stableStack, stackKey],
  );

  // Fetch fresh data in background (stale-while-revalidate)
  const fetchFreshData = useCallback(
    async (trimmedQuery: string, cacheKey: string, ttl: number) => {
      try {
        let searchResults: SearchResult[];

        if (scope === "docs") {
          searchResults = await searchDocs(trimmedQuery);
        } else {
          searchResults = await searchProducts(trimmedQuery, stableStack);
        }

        if (abortControllerRef.current?.signal.aborted) return;

        // Update results if they changed
        setResults(searchResults);
        setInCache(cacheKey, searchResults, ttl);
      } catch {
        // Silently fail on background refresh - we already have cached data
      }
    },
    [scope, stableStack],
  );

  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmedQuery = debouncedQuery.trim();

    // Clear results if query is too short AND stack is empty
    // When inside a drill context (stack.length > 0), show children even with empty query
    if (trimmedQuery.length < 2 && stableStack.length === 0) {
      setResults([]);
      setIsLoading(false);
      setError(undefined);
      setIsStale(false);
      setHasSearched(false); // Reset so next search shows loading state
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setIsStale(false);
    setHasSearched(false);

    performSearch(trimmedQuery);

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [debouncedQuery, scope, stackKey, retryCount, performSearch]);

  // Retry function
  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { results, isLoading, error, retry, isStale, hasSearched };
}

// Get user-friendly error title based on error type
function getErrorTitle(type: AlgoliaErrorType): string {
  switch (type) {
    case "network":
      return "Connection Error";
    case "auth":
      return "Authentication Error";
    case "rate_limit":
      return "Rate Limited";
    case "not_found":
      return "Not Found";
    default:
      return "Search Error";
  }
}
