import { Action, ActionPanel, List, Icon, Color, getPreferenceValues, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
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

  const { results, isLoading, error } = useAlgoliaSearch(query);

  const handleCopy = useCallback(async (item: SearchResult) => {
    const text = `${item.mno} — $${item.price?.toFixed(2) || "N/A"}\n${item.urlShop || ""}`;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied" });
  }, []);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search products and SKUs..."
      searchText={query}
      onSearchTextChange={setQuery}
      throttle
    >
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
            <SearchResultItem key={item.objectID} item={item} showPrices={showPrices} onCopy={handleCopy} />
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
}

function SearchResultItem({ item, showPrices, onCopy }: SearchResultItemProps) {
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
