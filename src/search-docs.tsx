import { Action, ActionPanel, List, Detail, Icon, Color, Clipboard, showToast, Toast } from "@raycast/api";
import { useState, useCallback } from "react";
import { useAlgoliaSearch } from "./hooks/useAlgoliaSearch";
import { DocEntity } from "./types";

export default function SearchDocs() {
  const [query, setQuery] = useState("");

  const { results, isLoading, error } = useAlgoliaSearch(query, {
    scope: "docs",
    stack: [],
  });

  const handleCopy = useCallback(async (item: DocEntity) => {
    const text = `${item.title}\n${item.downloadUrl}`;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied" });
  }, []);

  const handleCopyMarkdown = useCallback(async (item: DocEntity) => {
    const text = `[${item.title}](${item.downloadUrl})`;
    await Clipboard.copy(text);
    await showToast({ style: Toast.Style.Success, title: "Copied as Markdown" });
  }, []);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search manuals, datasheets, IOMs..."
      searchText={query}
      onSearchTextChange={setQuery}
      throttle
    >
      {results.length === 0 && query.length >= 2 && !isLoading && (
        <List.EmptyView
          title="No Documents Found"
          description={error || `No matches for "${query}"`}
          icon={Icon.Document}
        />
      )}

      <List.Section title="Documents" subtitle={results.length > 0 ? `${results.length} items` : undefined}>
        {results.map((item) => {
          const doc = item as DocEntity;
          return (
            <List.Item
              key={doc.objectID}
              icon={{ source: getDocIcon(doc.docType), tintColor: Color.Orange }}
              title={doc.title}
              subtitle={`${doc.brand} • ${doc.docType?.toUpperCase() || "DOC"}`}
              accessories={[
                doc.fileSize ? { text: formatFileSize(doc.fileSize) } : undefined,
              ].filter(Boolean) as List.Item.Accessory[]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    {doc.downloadUrl && (
                      <Action.OpenInBrowser title="Open Document" url={doc.downloadUrl} icon={Icon.Globe} />
                    )}
                    {doc.downloadUrl && (
                      <Action.Push
                        title="Quick Look"
                        icon={Icon.Eye}
                        shortcut={{ modifiers: ["cmd"], key: "p" }}
                        target={<QuickLookPreview doc={doc} />}
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

// QuickLook preview component using Detail view
function QuickLookPreview({ doc }: { doc: DocEntity }) {
  const markdown = `# ${doc.title}

**Brand:** ${doc.brand}
**Type:** ${doc.docType?.toUpperCase() || "Document"}
${doc.fileSize ? `**Size:** ${formatFileSize(doc.fileSize)}` : ""}

---

[📄 Open Document](${doc.downloadUrl})
`;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={doc.title}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Brand" text={doc.brand} />
          <Detail.Metadata.Label title="Type" text={doc.docType?.toUpperCase() || "Document"} />
          {doc.fileSize && <Detail.Metadata.Label title="Size" text={formatFileSize(doc.fileSize)} />}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Link title="Document URL" target={doc.downloadUrl} text="Open in Browser" />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open Document" url={doc.downloadUrl} icon={Icon.Globe} />
          <Action
            title="Copy"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            onAction={async () => {
              const text = `${doc.title}\n${doc.downloadUrl}`;
              await Clipboard.copy(text);
              await showToast({ style: Toast.Style.Success, title: "Copied" });
            }}
          />
          <Action
            title="Copy as Markdown"
            icon={Icon.Link}
            shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
            onAction={async () => {
              const text = `[${doc.title}](${doc.downloadUrl})`;
              await Clipboard.copy(text);
              await showToast({ style: Toast.Style.Success, title: "Copied as Markdown" });
            }}
          />
        </ActionPanel>
      }
    />
  );
}

function getDocIcon(docType?: string): Icon {
  switch (docType) {
    case "manual":
      return Icon.Book;
    case "datasheet":
      return Icon.Document;
    case "iom":
      return Icon.Wrench;
    case "sds":
      return Icon.ExclamationMark;
    default:
      return Icon.Document;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

