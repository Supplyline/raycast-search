import { Action, ActionPanel, List, Icon } from "@raycast/api";
import { StackItem } from "../types";

/**
 * Format a breadcrumb segment based on drillKey type
 * Uses the drillKey value (id) in uppercase, with type-specific suffixes
 * - brand: "lmi" → "LMI"
 * - series: "pd" → "PD Series"
 * - parent: "pd05" → "PD05"
 */
function formatBreadcrumbSegment(item: StackItem): string {
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

interface BreadcrumbSectionProps {
  stack: StackItem[];
  onPop: () => void;
}

/**
 * Breadcrumb section component for displaying navigation path
 * Shows the current drill path based on drillKey values
 */
export function BreadcrumbSection({ stack, onPop }: BreadcrumbSectionProps) {
  if (stack.length === 0) return null;

  const breadcrumb = buildBreadcrumb(stack);
  const previousItem = stack.length > 1 ? stack[stack.length - 2] : null;
  const returnLabel = previousItem
    ? `Return to ${formatBreadcrumbSegment(previousItem)}`
    : "Return to Search";

  return (
    <List.Section title={breadcrumb}>
      <List.Item
        icon={Icon.ArrowLeft}
        title="Go Back"
        subtitle={returnLabel}
        actions={
          <ActionPanel>
            <Action
              title="Go Back"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["cmd"], key: "arrowLeft" }}
              onAction={onPop}
            />
          </ActionPanel>
        }
      />
    </List.Section>
  );
}
