import { Action, ActionPanel, List, Icon, Color, getPreferenceValues, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { SkuEntity, Preferences } from "./types";

export default function SearchSupplyline() {
  const { showPrices } = getPreferenceValues<Preferences>();
  const [query, setQuery] = useState("");

  const { results, isLoading, error } = useAlgoliaSearch(query);

  const handleCopy = useCallback(async (item: SkuEntity) => {
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
  item: SkuEntity;
  showPrices: boolean;
  onCopy: (item: SkuEntity) => void;
}

function SearchResultItem({ item, showPrices, onCopy }: SearchResultItemProps) {
  const subtitle = getSubtitle(item, showPrices);
  const accessories = getAccessories(item);

  return (
    <List.Item
      icon={{ source: Icon.Tag, tintColor: Color.Green }}
      title={item.title || item.mno}
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

function getSubtitle(item: SkuEntity, showPrices: boolean): string {
  const parts = [item.brand];
  if (showPrices && item.price != null) {
    parts.push(`$${item.price.toFixed(2)}`);
  }
  return parts.join(" • ");
}

function getAccessories(item: SkuEntity): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];

  if (item.inStock != null) {
    accessories.push({
      tag: {
        value: item.inStock ? "In Stock" : "Out of Stock",
        color: item.inStock ? Color.Green : Color.Red,
      },
    });
  }

  return accessories;
}
