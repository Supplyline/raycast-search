import { Action, ActionPanel, List, Detail, Icon, Color, getPreferenceValues, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { useNavigationStack } from "./hooks/useNavigationStack";
import { SearchResult, Preferences, SkuEntity, DocEntity, Scope } from "./types";

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
  const { showPrices, defaultScope } = getPreferenceValues<Preferences>();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(defaultScope || "products");
  const { stack, push, pop, breadcrumb, canPop } = useNavigationStack();

  const { results, isLoading, error } = useAlgoliaSearch(query, { stack, scope });

  const handleCopy = useCallback(async (item: SearchResult) => {
    let text: string;
    if (item.entityType === "doc") {
      const doc = item as DocEntity;
      text = `${doc.title}\n${doc.downloadUrl}`;
    } else if (item.entityType === "sku") {
      const sku = item as SkuEntity;
      text = `${sku.mno} — $${sku.price?.toFixed(2) || "N/A"}\n${sku.urlShop || ""}`;
    } else {
      text = `${item.title}\n${item.urlShop || item.urlAbout || ""}`;
    }
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

  const getPlaceholder = () => {
    if (canPop) return `Search in ${stack[stack.length - 1]?.label}...`;
    if (scope === "docs") return "Search manuals, datasheets, IOMs...";
    return "Search products and SKUs...";
  };

  const getNavigationTitle = () => {
    if (breadcrumb) return breadcrumb;
    if (scope === "docs") return "Search Supplyline Docs";
    return "Search Supplyline";
  };

  return (
    <List
      isLoading={isLoading}
      navigationTitle={getNavigationTitle()}
      searchBarPlaceholder={getPlaceholder()}
      searchText={query}
      onSearchTextChange={handleSearchTextChange}
      throttle
      searchBarAccessory={
        <List.Dropdown
          tooltip="Search Scope"
          value={scope}
          onChange={(newValue) => setScope(newValue as Scope)}
        >
          <List.Dropdown.Item title="Products" value="products" />
          <List.Dropdown.Item title="Docs" value="docs" />
        </List.Dropdown>
      }
    >
      {canPop && (
        <List.Item
          icon={Icon.ArrowLeft}
          title="Go Back"
          subtitle={stack.length > 1 ? `Return to ${stack[stack.length - 2]?.label}` : "Return to Search"}
          actions={
            <ActionPanel>
              <Action title="Go Back" icon={Icon.ArrowLeft} shortcut={{ modifiers: ["cmd"], key: "arrowLeft" }} onAction={handlePop} />
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
            <SearchResultItem key={item.objectID} item={item} showPrices={showPrices} onCopy={handleCopy} onSelect={handleSelect} onPop={handlePop} canPop={canPop} />
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
  onPop?: () => void;
  canPop?: boolean;
}

function SearchResultItem({ item, showPrices, onCopy, onSelect, onPop, canPop }: SearchResultItemProps) {
  const subtitle = getSubtitle(item, showPrices);
  const accessories = getAccessories(item);
  const icon = getIconForEntity(item);
  const title = item.entityType === "sku" ? (item as SkuEntity).mno : item.title;
  const isDoc = item.entityType === "doc";
  const doc = isDoc ? (item as DocEntity) : null;

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
            {isDoc && doc?.downloadUrl && (
              <Action.OpenInBrowser title="Open Document" url={doc.downloadUrl} icon={Icon.Globe} />
            )}
            {isDoc && doc?.downloadUrl && (
              <Action.Push
                title="Quick Look"
                icon={Icon.Eye}
                shortcut={{ modifiers: ["cmd"], key: "p" }}
                target={<DocQuickLook doc={doc} />}
              />
            )}
            {!isDoc && item.urlShop && <Action.OpenInBrowser title="Open Shop" url={item.urlShop} icon={Icon.Cart} />}
            {!isDoc && item.urlAbout && (
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
          {canPop && onPop && (
            <ActionPanel.Section>
              <Action
                title="Go Back"
                icon={Icon.ArrowLeft}
                shortcut={{ modifiers: ["cmd"], key: "arrowLeft" }}
                onAction={onPop}
              />
            </ActionPanel.Section>
          )}
        </ActionPanel>
      }
    />
  );
}

function getSubtitle(item: SearchResult, showPrices: boolean): string {
  const parts = [item.brand];
  if (item.entityType === "sku" && showPrices && (item as SkuEntity).price != null) {
    parts.push(`$${(item as SkuEntity).price!.toFixed(2)}`);
  }
  if (item.entityType === "doc") {
    const doc = item as DocEntity;
    if (doc.docType) {
      parts.push(doc.docType.toUpperCase());
    }
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

  // Doc type tag
  if (item.entityType === "doc") {
    const doc = item as DocEntity;
    accessories.push({
      tag: {
        value: doc.docType?.toUpperCase() || "DOC",
        color: Color.Blue,
      },
    });
  }

  return accessories;
}

function DocQuickLook({ doc }: { doc: DocEntity }) {
  const markdown = `# ${doc.title}

**Brand:** ${doc.brand}
**Type:** ${doc.docType?.toUpperCase() || "Document"}

[Open in Browser](${doc.downloadUrl})
`;

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Brand" text={doc.brand} />
          <Detail.Metadata.Label title="Type" text={doc.docType?.toUpperCase() || "DOC"} />
          {doc.fileSize && <Detail.Metadata.Label title="Size" text={formatFileSize(doc.fileSize)} />}
          <Detail.Metadata.Link title="URL" target={doc.downloadUrl} text="Open Document" />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open Document" url={doc.downloadUrl} icon={Icon.Globe} />
          <Action.CopyToClipboard title="Copy URL" content={doc.downloadUrl} />
        </ActionPanel>
      }
    />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
