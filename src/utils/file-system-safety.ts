import { promises as fs } from 'fs';
import path from 'path';

/**
 * Validate path is not a symlink and is within allowed directory
 */
export async function validateSafePath(
  targetPath: string,
  allowedRoot: string
): Promise<{ safe: boolean; reason?: string }> {
  try {
    // Resolve to absolute path
    const resolvedPath = path.resolve(targetPath);
    const resolvedRoot = path.resolve(allowedRoot);

    // Check path is within allowed root (prevent traversal)
    if (!resolvedPath.startsWith(resolvedRoot)) {
      return { safe: false, reason: 'Path outside allowed directory' };
    }

    // Check if path exists
    try {
      const stats = await fs.lstat(targetPath);

      // Reject symlinks
      if (stats.isSymbolicLink()) {
        return { safe: false, reason: 'Symlinks are not allowed' };
      }

      // If exists, must be file or directory
      if (!stats.isFile() && !stats.isDirectory()) {
        return { safe: false, reason: 'Path is not a regular file or directory' };
      }
    } catch (err: any) {
      // Path doesn't exist yet - OK for new files
      if (err.code !== 'ENOENT') {
        return { safe: false, reason: `Cannot access path: ${err.message}` };
      }
    }

    // Check parent directory for symlinks
    const parentDir = path.dirname(resolvedPath);
    try {
      const parentStats = await fs.lstat(parentDir);
      if (parentStats.isSymbolicLink()) {
        return { safe: false, reason: 'Parent directory is a symlink' };
      }
    } catch {
      // Parent doesn't exist - will be created
    }

    return { safe: true };
  } catch (error: any) {
    return { safe: false, reason: `Validation error: ${error.message}` };
  }
}

/**
 * Estimate object size in bytes (fast approximation)
 */
export function estimateJsonSize(obj: any): number {
  // Fast estimation using JSON sampling
  const sample = JSON.stringify(obj).slice(0, 10000);
  const sampleSize = Buffer.byteLength(sample, 'utf8');

  // Estimate total based on sample ratio
  if (sample.length < 10000) {
    return sampleSize;
  }

  // For large objects, estimate based on structure
  const keys = countKeys(obj);
  return sampleSize * Math.ceil(keys / 100);
}

function countKeys(obj: any, depth = 0): number {
  if (depth > 10 || typeof obj !== 'object' || obj === null) {
    return 0;
  }

  let count = Object.keys(obj).length;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      count += countKeys(value, depth + 1);
    }
  }
  return count;
}

/**
 * Size limits for workflow operations
 */
export const SIZE_LIMITS = {
  WARN_THRESHOLD: 50 * 1024 * 1024,   // 50MB - warning
  HARD_LIMIT: 500 * 1024 * 1024,      // 500MB - reject
  STREAM_THRESHOLD: 10 * 1024 * 1024, // 10MB - use streaming
} as const;
