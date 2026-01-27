import { Action, ActionPanel, List, Icon, Color, getPreferenceValues, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { useNavigationStack } from "./hooks/useNavigationStack";
import { SearchResult, Preferences, SkuEntity, DocEntity } from "./types";

function getIconForEntity(result: SearchResult): { source: Icon; tintColor: Color } {
  switch (result.entityType) {
    case "series":
      return { source: Icon.Folder, tintColor: Color.Blue };
    case "parent":
      return { source: Icon.Box, tintColor: Color.Purple };
    case "sku":
      return { source: Icon.Tag, tintColor: Color.Green };
    case "doc":
      return { source: Icon.Document, tintColor: Color.Orange };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

export default function SearchSupplyline() {
  const { showPrices } = getPreferenceValues<Preferences>();
  const [query, setQuery] = useState("");
  const { stack, push, pop, breadcrumb, canPop } = useNavigationStack();

  const { results, isLoading, error } = useAlgoliaSearch(query, { stack });

  const handleCopy = useCallback(async (item: SearchResult) => {
    const text = `${item.mno} — $${item.price?.toFixed(2) || "N/A"}\n${item.urlShop || ""}`;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied" });
  }, []);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.primaryBehavior === "drill") {
        // Series: use drillKey.series (flat key) to filter children
        const seriesKey = item["drillKey.series"];
        if (item.entityType === "series" && seriesKey) {
          push({ type: "series", id: seriesKey, label: item.title });
          setQuery("");
        }
        // Parent: use drillKey.parent (flat key) to filter children
        else if (item.entityType === "parent" && item["drillKey.parent"]) {
          push({ type: "parent", id: item["drillKey.parent"], label: item.title });
          setQuery("");
        }
      } else if (item.primaryBehavior === "open" && item.urlShop) {
        open(item.urlShop);
      }
    },
    [push]
  );

  const handlePop = useCallback(() => {
    if (canPop) {
      pop();
      setQuery("");
    }
  }, [canPop, pop]);

  const handleSearchTextChange = useCallback(
    (text: string) => {
      // Pop on backspace when query is empty
      if (text === "" && query === "" && canPop) {
        handlePop();
      } else {
        setQuery(text);
      }
    },
    [query, canPop, handlePop]
  );

  return (
    <List
      isLoading={isLoading}
      navigationTitle={breadcrumb || "Search Supplyline"}
      searchBarPlaceholder={canPop ? `Search in ${stack[stack.length - 1]?.label}...` : "Search products and SKUs..."}
      searchText={query}
      onSearchTextChange={handleSearchTextChange}
      throttle
    >
      {canPop && (
        <List.Item
          icon={Icon.ArrowLeft}
          title="Go Back"
          subtitle={stack.length > 1 ? `Return to ${stack[stack.length - 2]?.label}` : "Return to Search"}
          actions={
            <ActionPanel>
              <Action title="Go Back" icon={Icon.ArrowLeft} onAction={handlePop} />
            </ActionPanel>
          }
        />
      )}

      {results.length === 0 && query.length >= 2 && !isLoading && (
        <List.EmptyView
          title="No Results"
          description={error || `No matches for "${query}"`}
          icon={Icon.MagnifyingGlass}
        />
      )}

      {results.length > 0 && (
        <List.Section title="Results" subtitle={`${results.length} items`}>
          {results.map((item) => (
            <SearchResultItem key={item.objectID} item={item} showPrices={showPrices} onCopy={handleCopy} onSelect={handleSelect} />
          ))}
        </List.Section>
      )}
    </List>
  );
}

interface SearchResultItemProps {
  item: SearchResult;
  showPrices: boolean;
  onCopy: (item: SearchResult) => void;
  onSelect: (item: SearchResult) => void;
}

function SearchResultItem({ item, showPrices, onCopy, onSelect }: SearchResultItemProps) {
  const subtitle = getSubtitle(item, showPrices);
  const accessories = getAccessories(item);
  const icon = getIconForEntity(item);
  const title = item.entityType === "sku" ? (item as SkuEntity).mno : item.title;

  return (
    <List.Item
      icon={icon}
      title={title}
      subtitle={subtitle}
      accessories={accessories}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {item.primaryBehavior === "drill" && (
              <Action title="Drill Down" icon={Icon.ChevronRight} onAction={() => onSelect(item)} />
            )}
            {item.urlShop && <Action.OpenInBrowser title="Open Shop" url={item.urlShop} icon={Icon.Cart} />}
            {item.urlAbout && (
              <Action.OpenInBrowser
                title="Open About"
                url={item.urlAbout}
                icon={Icon.Info}
                shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Copy"
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["cmd"], key: "k" }}
              onAction={() => onCopy(item)}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function getSubtitle(item: SearchResult, showPrices: boolean): string {
  const parts = [item.brand];
  if (item.entityType === "sku" && showPrices && (item as SkuEntity).price != null) {
    parts.push(`$${item.price.toFixed(2)}`);
  }
  return parts.join(" • ");
}

function getAccessories(item: SearchResult): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];

  // Drill indicator for browse items (series, parent)
  if (item.entityType === "series" || item.entityType === "parent") {
    accessories.push({ icon: Icon.ChevronRight });
  }

  // Stock status for SKUs
  if (item.entityType === "sku") {
    const sku = item as SkuEntity;
    if (sku.inStock != null) {
      accessories.push({
        tag: {
          value: sku.inStock ? "In Stock" : "Out of Stock",
          color: sku.inStock ? Color.Green : Color.Red,
        },
      });
    }
  }

  return accessories;
}
