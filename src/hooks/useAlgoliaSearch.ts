import { useState, useEffect, useRef, useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import { SearchResult, StackItem, Scope } from "../types";
import { searchProducts, searchDocs, categorizeError, AlgoliaErrorType } from "../utils/algolia";

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
  scope?: Scope;
  stack?: StackItem[];
}

interface SearchError {
  message: string;
  type: AlgoliaErrorType;
}

export function useAlgoliaSearch(query: string, options: UseAlgoliaSearchOptions = {}) {
  const { debounceMs = 200, scope = "products", stack = [] } = options;
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | undefined>();
  const [retryCount, setRetryCount] = useState(0);

  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Serialize stack for dependency comparison
  const stackKey = JSON.stringify(stack);

  const performSearch = useCallback(
    async (trimmedQuery: string) => {
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
        setError(undefined);
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) return;

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
        }
      }
    },
    [scope, stack],
  );

  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmedQuery = debouncedQuery.trim();

    // Clear results if query is too short AND stack is empty
    // When inside a drill context (stack.length > 0), show children even with empty query
    if (trimmedQuery.length < 2 && stack.length === 0) {
      setResults([]);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    performSearch(trimmedQuery);

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [debouncedQuery, scope, stackKey, retryCount, performSearch]);

  // Retry function
  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { results, isLoading, error, retry };
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
