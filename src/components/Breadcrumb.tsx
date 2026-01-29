import { StackItem } from "../types";

/**
 * Format a breadcrumb segment based on drillKey type
 * Uses the drillKey value (id) in uppercase, with type-specific suffixes
 * - brand: "lmi" → "LMI"
 * - series: "pd" → "PD Series"
 * - parent: "pd05" → "PD05"
 */
export function formatBreadcrumbSegment(item: StackItem): string {
  const value = item.id.toUpperCase();

  switch (item.type) {
    case "series":
      return `${value} Series`;
    case "brand":
    case "parent":
    default:
      return value;
  }
}

/**
 * Build breadcrumb string from stack items
 * Format: "LMI > PD Series > PD05 >" (with trailing chevron indicating drill context)
 */
export function buildBreadcrumb(stack: StackItem[]): string {
  if (stack.length === 0) return "";
  return stack.map(formatBreadcrumbSegment).join(" > ") + " >";
}
