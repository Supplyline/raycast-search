import { useState, useCallback } from "react";
import { StackItem } from "../types";

export function useNavigationStack() {
  const [stack, setStack] = useState<StackItem[]>([]);

  // Accept StackItem directly - the caller is responsible for extracting the correct data
  const push = useCallback((item: StackItem) => {
    console.log("useNavigationStack.push called with:", item);
    setStack((prev) => {
      const newStack = [...prev, item];
      console.log("Stack updated to:", newStack);
      return newStack;
    });
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

