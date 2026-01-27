import { useState, useEffect, useRef } from "react";
import { showToast, Toast } from "@raycast/api";
import { SkuEntity } from "../types";
import { searchSkus } from "../utils/algolia";

// Custom debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

interface UseAlgoliaSearchOptions {
  debounceMs?: number;
}

export function useAlgoliaSearch(query: string, options: UseAlgoliaSearchOptions = {}) {
  const { debounceMs = 200 } = options;
  const [results, setResults] = useState<SkuEntity[]>([]);
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
    if (trimmedQuery.length < 2) {
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
        const searchResults = await searchSkus(trimmedQuery);

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
  }, [debouncedQuery]);

  return { results, isLoading, error };
}
