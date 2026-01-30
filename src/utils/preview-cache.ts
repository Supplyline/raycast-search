import { environment } from "@raycast/api";
import { exec } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

// Directory for caching downloaded documents
const PREVIEW_CACHE_DIR = join(environment.supportPath, "preview-cache");

// Cache configuration
const CACHE_CONFIG = {
  MAX_AGE_DAYS: 7, // Delete files older than 7 days
  MAX_SIZE_MB: 100, // Maximum cache size in MB
} as const;

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!existsSync(PREVIEW_CACHE_DIR)) {
    mkdirSync(PREVIEW_CACHE_DIR, { recursive: true });
  }
}

// Get all files in cache with their stats
function getCacheFiles(): Array<{ path: string; size: number; mtime: Date }> {
  ensureCacheDir();

  try {
    const files = readdirSync(PREVIEW_CACHE_DIR);
    return files
      .map((filename) => {
        const filePath = join(PREVIEW_CACHE_DIR, filename);
        try {
          const stats = statSync(filePath);
          if (stats.isFile()) {
            return { path: filePath, size: stats.size, mtime: stats.mtime };
          }
        } catch {
          // File might have been deleted, skip it
        }
        return null;
      })
      .filter((f): f is { path: string; size: number; mtime: Date } => f !== null);
  } catch {
    return [];
  }
}

// Clean up old files (older than MAX_AGE_DAYS)
function cleanupOldFiles(): number {
  const maxAge = CACHE_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert to ms
  const now = Date.now();
  let deletedCount = 0;

  const files = getCacheFiles();
  for (const file of files) {
    if (now - file.mtime.getTime() > maxAge) {
      try {
        unlinkSync(file.path);
        deletedCount++;
      } catch {
        // Ignore deletion errors
      }
    }
  }

  return deletedCount;
}

// Clean up files if cache exceeds MAX_SIZE_MB (delete oldest first)
function cleanupBySize(): number {
  const maxSize = CACHE_CONFIG.MAX_SIZE_MB * 1024 * 1024; // Convert to bytes
  let deletedCount = 0;

  const files = getCacheFiles();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  if (totalSize <= maxSize) {
    return 0;
  }

  // Sort by modification time (oldest first)
  files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  let currentSize = totalSize;
  for (const file of files) {
    if (currentSize <= maxSize) break;

    try {
      unlinkSync(file.path);
      currentSize -= file.size;
      deletedCount++;
    } catch {
      // Ignore deletion errors
    }
  }

  return deletedCount;
}

/**
 * Run cache cleanup (call this periodically, e.g., on extension load)
 * Returns the number of files deleted
 */
export function cleanupPreviewCache(): number {
  const oldDeleted = cleanupOldFiles();
  const sizeDeleted = cleanupBySize();
  return oldDeleted + sizeDeleted;
}

/**
 * Download a file from URL to local cache
 * Returns the local file path
 */
export async function downloadToCache(url: string, filename: string): Promise<string> {
  ensureCacheDir();

  // Run cleanup in background (don't await)
  setTimeout(() => cleanupPreviewCache(), 100);

  // Sanitize filename
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const localPath = join(PREVIEW_CACHE_DIR, safeFilename);

  // Return cached file if it exists
  if (existsSync(localPath)) {
    return localPath;
  }

  // Download the file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const writeStream = createWriteStream(localPath);

  return new Promise((resolve, reject) => {
    writeStream.write(Buffer.from(buffer), (err) => {
      if (err) {
        reject(err);
      } else {
        writeStream.end(() => resolve(localPath));
      }
    });
  });
}

/**
 * Open file in Preview.app (default viewer for PDFs/images)
 */
export function openInPreview(filePath: string): void {
  const escapedPath = filePath.replace(/"/g, '\\"');
  exec(`open "${escapedPath}"`, (error) => {
    if (error) {
      console.error("Failed to open file:", error);
    }
  });
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { fileCount: number; totalSizeMB: number } {
  const files = getCacheFiles();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return {
    fileCount: files.length,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
  };
}
