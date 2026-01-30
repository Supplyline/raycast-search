import { Action, ActionPanel, List, Icon, Color, Clipboard, showToast, Toast } from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { downloadToCache, openInPreview } from "./utils/preview-cache";
import { DocEntity } from "./types";

export default function SearchDocs() {
  const [query, setQuery] = useState("");

  const { results, isLoading, error, retry, hasSearched } = useAlgoliaSearch(query, {
    scope: "docs",
    stack: [],
  });

  const handleCopy = useCallback(async (item: DocEntity) => {
    const text = `${item.title}\n${item.downloadUrl}`;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied" });
  }, []);

  const handleCopyMarkdown = useCallback(async (item: DocEntity) => {
    const text = `[${item.title}](${item.downloadUrl}) `;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied as Markdown" });
  }, []);

  const handlePreview = useCallback(async (doc: DocEntity) => {
    if (!doc.downloadUrl) {
      await showToast({ style: Toast.Style.Failure, title: "No document URL" });
      return;
    }

    await showToast({ style: Toast.Style.Animated, title: "Downloading..." });

    try {
      // Generate filename from URL or title
      const urlParts = doc.downloadUrl.split("/");
      const filename = urlParts[urlParts.length - 1] || `${doc.objectID}.pdf`;

      const localPath = await downloadToCache(doc.downloadUrl, filename);
      openInPreview(localPath);

      await showToast({ style: Toast.Style.Success, title: "Opening in Preview" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      await showToast({ style: Toast.Style.Failure, title: "Preview failed", message });
    }
  }, []);

  const showDetailPanel = results.length > 0;

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showDetailPanel}
      searchBarPlaceholder="Search manuals, datasheets, IOMs..."
      searchText={query}
      onSearchTextChange={setQuery}
      throttle
    >
      {/* Error state */}
      {error && !isLoading && (
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

      {/* Loading state with placeholder */}
      {!error && results.length === 0 && query.length >= 2 && (isLoading || !hasSearched) && (
        <List.Section title="Searching...">
          <List.Item icon={Icon.CircleProgress} title="Loading..." subtitle="Please wait" />
        </List.Section>
      )}

      {/* Empty state (only after search completed) */}
      {!error && results.length === 0 && query.length >= 2 && !isLoading && hasSearched && (
        <List.EmptyView title="No Documents Found" description={`No matches for "${query}"`} icon={Icon.Document} />
      )}

      <List.Section title="Documents" subtitle={results.length > 0 ? `${results.length} items` : undefined}>
        {results.map((item) => {
          const doc = item as DocEntity;
          return (
            <List.Item
              key={doc.objectID}
              icon={{ source: getDocIcon(doc.docType), tintColor: Color.Orange }}
              title={doc.title}
              detail={<DocDetail doc={doc} />}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    {doc.downloadUrl && (
                      <Action.OpenInBrowser title="Open Document" url={doc.downloadUrl} icon={Icon.Globe} />
                    )}
                    {doc.downloadUrl && (
                      <Action
                        title="Preview"
                        icon={Icon.Eye}
                        shortcut={{ modifiers: ["cmd"], key: "p" }}
                        onAction={() => handlePreview(doc)}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Copy"
                      icon={Icon.Clipboard}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      onAction={() => handleCopy(doc)}
                    />
                    <Action
                      title="Copy as Markdown"
                      icon={Icon.Link}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
                      onAction={() => handleCopyMarkdown(doc)}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

// Detail panel for document items
function DocDetail({ doc }: { doc: DocEntity }) {
  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title={doc.title} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Brand" text={doc.brand} />
          <List.Item.Detail.Metadata.Label title="Type" text={doc.docType?.toUpperCase() || "Document"} />
          {doc.fileSize && <List.Item.Detail.Metadata.Label title="Size" text={formatFileSize(doc.fileSize)} />}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Link title="Document URL" target={doc.downloadUrl} text="Open in Browser" />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function getDocIcon(docType?: string): Icon {
  switch (docType?.toLowerCase()) {
    case "manual":
      return Icon.Book;
    case "datasheet":
    case "cut":
      return Icon.Document;
    case "iom":
      return Icon.Hammer;
    case "sds":
      return Icon.Warning;
    case "idc":
      return Icon.List;
    case "bro":
      return Icon.Megaphone;
    default:
      return Icon.Document;
  }
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
