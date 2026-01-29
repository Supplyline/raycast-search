import { useState, useCallback } from "react";
import { StackItem } from "../types";

export function useNavigationStack() {
  const [stack, setStack] = useState<StackItem[]>([]);

  /**
   * Push a single item to the stack
   */
  const push = useCallback((item: StackItem) => {
    setStack((prev) => [...prev, item]);
  }, []);

  /**
   * Push multiple items to the stack at once
   * Used when drilling requires adding brand + series/parent together
   */
  const pushMultiple = useCallback((items: StackItem[]) => {
    setStack((prev) => [...prev, ...items]);
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

  /**
   * Check if a specific type already exists in the stack
   */
  const hasType = useCallback(
    (type: StackItem["type"]) => stack.some((item) => item.type === type),
    [stack]
  );

  return {
    stack,
    push,
    pushMultiple,
    pop,
    clear,
    hasType,
    canPop: stack.length > 0,
  };
}

