import { Action, ActionPanel, List, Icon, Color, getPreferenceValues, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useCallback, useEffect } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { useNavigationStack } from "./hooks/useNavigationStack";
import { buildBreadcrumb } from "./components/Breadcrumb";
import { fetchBrandsWithFallback, BrandItem, categorizeError } from "./utils/algolia";
import { SearchResult, Preferences, SkuEntity, DocEntity, BrowseEntity, Scope, StackItem } from "./types";

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
  const { defaultScope } = getPreferenceValues<Preferences>();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(defaultScope || "products");
  const { stack, pushMultiple, push, pop, hasType, canPop } = useNavigationStack();

  // Brands for initial view
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsStale, setBrandsStale] = useState(false);

  // Brands error state
  const [brandsError, setBrandsError] = useState<{ message: string; type: ErrorType } | undefined>();

  // Fetch brands on mount
  const loadBrands = useCallback(() => {
    setBrandsLoading(true);
    setBrandsError(undefined);
    setBrandsStale(false);
    fetchBrandsWithFallback()
      .then(({ brands: fetchedBrands, isStale }) => {
        setBrands(fetchedBrands);
        setBrandsStale(isStale);
        if (isStale) {
          showToast({
            style: Toast.Style.Animated,
            title: "Offline Mode",
            message: "Showing cached brands",
          });
        }
      })
      .catch((err) => {
        const algoliaError = categorizeError(err);
        setBrandsError({ message: algoliaError.message, type: algoliaError.type });
        showToast({
          style: Toast.Style.Failure,
          title: getErrorTitle(algoliaError.type),
          message: algoliaError.message,
        });
      })
      .finally(() => setBrandsLoading(false));
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Show brands when: no query, no stack, products scope
  const showBrands = query.trim() === "" && stack.length === 0 && scope === "products";

  const { results, isLoading, error, retry } = useAlgoliaSearch(query, { stack, scope });

  // Handle brand selection
  const handleBrandSelect = useCallback(
    (brand: BrandItem) => {
      push({ type: "brand", id: brand.id, label: brand.name });
      setQuery("");
    },
    [push],
  );

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

  const handleCopyMarkdown = useCallback(async (item: SearchResult) => {
    let markdown: string;
    const url = item.urlShop || item.urlAbout || "";

    if (item.entityType === "doc") {
      const doc = item as DocEntity;
      markdown = `[${doc.title}](${doc.downloadUrl}) `;
    } else if (item.entityType === "sku") {
      const sku = item as SkuEntity;
      const price = sku.price ? ` — $${sku.price.toFixed(2)}` : "";
      markdown = url ? `[${sku.mno}](${url})${price}` : `**${sku.mno}**${price}`;
    } else {
      markdown = url ? `[${item.title}](${url}) ` : `**${item.title}** `;
    }
    await Clipboard.copy(markdown);
    await showToast({ style: Toast.Style.Success, title: "Copied as Markdown" });
  }, []);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.primaryBehavior === "drill") {
        // Use drillKey values directly from Algolia record
        const brandKey = item["drillKey.brand"];
        const seriesKey = item["drillKey.series"];
        const parentKey = item["drillKey.parent"];

        // Build items to push - always include brand first if not already in stack
        const itemsToPush: StackItem[] = [];

        // Always add brand first if not already present
        if (brandKey && !hasType("brand")) {
          itemsToPush.push({ type: "brand", id: brandKey, label: item.brand });
        }

        // Series: use drillKey.series directly (series items have this field)
        if (item.entityType === "series" && seriesKey) {
          if (!hasType("series")) {
            itemsToPush.push({ type: "series", id: seriesKey, label: item.title });
          }
        }
        // Parent: add series (if not present) + parent
        else if (item.entityType === "parent" && parentKey) {
          // If drilling into parent, also add series if not present
          if (seriesKey && !hasType("series")) {
            itemsToPush.push({ type: "series", id: seriesKey, label: seriesKey.toUpperCase() });
          }
          itemsToPush.push({ type: "parent", id: parentKey, label: item.title });
        }

        if (itemsToPush.length > 0) {
          pushMultiple(itemsToPush);
          setQuery("");
        }
      } else if (item.primaryBehavior === "open" && item.urlShop) {
        open(item.urlShop);
      }
    },
    [pushMultiple, hasType],
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
    [query, canPop, handlePop],
  );

  const getPlaceholder = () => {
    if (canPop) return `Search in ${stack[stack.length - 1]?.label}...`;
    if (scope === "docs") return "Search manuals, datasheets, IOMs...";
    return "Search products and SKUs...";
  };

  const getNavigationTitle = () => {
    if (scope === "docs") return "Search Supplyline Docs";
    return "Search Supplyline";
  };

  // Show detail panel only for SKU items
  const hasSkuResults = results.some((r) => r.entityType === "sku");
  const showDetailPanel = !showBrands && hasSkuResults;

  return (
    <List
      isLoading={showBrands ? brandsLoading : isLoading}
      isShowingDetail={showDetailPanel}
      navigationTitle={getNavigationTitle()}
      searchBarPlaceholder={getPlaceholder()}
      searchText={query}
      onSearchTextChange={handleSearchTextChange}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Search Scope" value={scope} onChange={(newValue) => setScope(newValue as Scope)}>
          <List.Dropdown.Item title="Products" value="products" />
          <List.Dropdown.Item title="Docs" value="docs" />
        </List.Dropdown>
      }
    >
      {/* Initial brands list - Error state */}
      {showBrands && brandsError && !brandsLoading && (
        <List.EmptyView
          title={getErrorTitle(brandsError.type)}
          description={brandsError.message}
          icon={getErrorIcon(brandsError.type)}
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={loadBrands} />
            </ActionPanel>
          }
        />
      )}

      {/* Initial brands list */}
      {showBrands && !brandsError && brands.length > 0 && (
        <List.Section
          title="Brands"
          subtitle={brandsStale ? `${brands.length} brands (cached)` : `${brands.length} brands`}
        >
          {brands.map((brand) => {
            const brandIconName = brand.name.toLowerCase().replace(/\s+/g, "_");
            return (
              <List.Item
                key={brand.id}
                icon={{
                  source: `brands/${brandIconName}.png`,
                  fallback: { source: Icon.Building, tintColor: Color.Blue },
                }}
                title={brand.name}
                subtitle={`${brand.seriesCount} series`}
                accessories={[{ icon: Icon.ChevronRight }]}
                actions={
                  <ActionPanel>
                    <Action title="Browse Series" icon={Icon.ChevronRight} onAction={() => handleBrandSelect(brand)} />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}

      {/* Search results - Error state */}
      {!showBrands && error && !isLoading && (
        <List.EmptyView
          title={getErrorTitle(error.type)}
          description={error.message}
          icon={getErrorIcon(error.type)}
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={retry} />
            </ActionPanel>
          }
        />
      )}

      {/* Search results - Empty state */}
      {!showBrands && !error && results.length === 0 && query.length >= 2 && !isLoading && (
        <List.EmptyView title="No Results" description={`No matches for "${query}"`} icon={Icon.MagnifyingGlass} />
      )}

      {!showBrands && results.length > 0 && (
        <List.Section title={canPop ? buildBreadcrumb(stack) : "Results"} subtitle={`${results.length} items`}>
          {results.map((item) => (
            <SearchResultItem
              key={item.objectID}
              item={item}
              onCopy={handleCopy}
              onCopyMarkdown={handleCopyMarkdown}
              onSelect={handleSelect}
              onPop={handlePop}
              canPop={canPop}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

interface SearchResultItemProps {
  item: SearchResult;
  onCopy: (item: SearchResult) => void;
  onCopyMarkdown: (item: SearchResult) => void;
  onSelect: (item: SearchResult) => void;
  onPop?: () => void;
  canPop?: boolean;
}

function SearchResultItem({ item, onCopy, onCopyMarkdown, onSelect, onPop, canPop }: SearchResultItemProps) {
  const icon = getIconForEntity(item);
  const title = item.entityType === "sku" ? (item as SkuEntity).mno : item.title;
  const isDoc = item.entityType === "doc";
  const doc = isDoc ? (item as DocEntity) : null;
  const isSku = item.entityType === "sku";
  const isParent = item.entityType === "parent";
  const isSeries = item.entityType === "series";

  // Subtitle based on item type
  let subtitle: string | undefined;
  if (isParent || isSeries) {
    const browse = item as BrowseEntity;
    subtitle = `${browse.brand} • ${browse.childCount} SKUs`;
  } else if (isSku) {
    const sku = item as SkuEntity;
    const priceStr = sku.price != null ? `$${sku.price.toFixed(2)}` : "N/A";
    const stockStr = sku.inStock ? "In Stock" : "Out of Stock";
    subtitle = `${priceStr} • ${stockStr}`;
  }

  return (
    <List.Item
      icon={icon}
      title={title}
      subtitle={subtitle}
      detail={isSku ? <ItemDetail item={item} /> : undefined}
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
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              onAction={() => onCopy(item)}
            />
            <Action
              title="Copy as Markdown"
              icon={Icon.Link}
              shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
              onAction={() => onCopyMarkdown(item)}
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

function ItemDetail({ item }: { item: SearchResult }) {
  // Only render for SKU items
  if (item.entityType !== "sku") return null;

  const sku = item as SkuEntity;

  const seriesName = sku["drillKey.series"]?.toUpperCase() || "";
  const subtitle = seriesName ? `${sku.brand} • ${seriesName} Series` : sku.brand;
  const priceText = sku.price != null ? `$${sku.price.toFixed(2)}` : "N/A";
  const brandIconName = sku.brand.toLowerCase().replace(/\s+/g, "_");
  const brandIcon = { source: `brands/${brandIconName}.png`, fallback: Icon.Building };

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title={sku.mno} />
          <List.Item.Detail.Metadata.Label title={subtitle} icon={brandIcon} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.TagList title="Price">
            <List.Item.Detail.Metadata.TagList.Item text={priceText} color={Color.Blue} />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.TagList title="Stock">
            <List.Item.Detail.Metadata.TagList.Item
              text={sku.inStock ? "In Stock" : "Out of Stock"}
              color={sku.inStock ? Color.Green : Color.Red}
            />
          </List.Item.Detail.Metadata.TagList>
          {sku.specs && Object.keys(sku.specs).length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              {Object.entries(sku.specs).map(([key, value]) => (
                <List.Item.Detail.Metadata.Label key={key} title={key} text={value} />
              ))}
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
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

// Error handling helpers
type ErrorType = "network" | "auth" | "rate_limit" | "not_found" | "unknown";

function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case "network":
      return "Connection Error";
    case "auth":
      return "Authentication Error";
    case "rate_limit":
      return "Too Many Requests";
    case "not_found":
      return "Not Found";
    default:
      return "Search Error";
  }
}

function getErrorIcon(type: ErrorType): Icon {
  switch (type) {
    case "network":
      return Icon.Wifi;
    case "auth":
      return Icon.Lock;
    case "rate_limit":
      return Icon.Clock;
    case "not_found":
      return Icon.QuestionMark;
    default:
      return Icon.ExclamationMark;
  }
}
