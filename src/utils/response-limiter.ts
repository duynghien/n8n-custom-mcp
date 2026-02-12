/**
 * Response size limits
 */
export const RESPONSE_LIMITS = {
  MAX_RESPONSE_SIZE: 1 * 1024 * 1024,      // 1MB
  WARN_THRESHOLD: 512 * 1024,              // 512KB
  MAX_ITEMS_PER_PAGE: 100,                 // Pagination limit
} as const;

/**
 * Result of limiting a response
 */
interface LimitedResponse {
  data: any;
  truncated: boolean;
  originalSize: number;
  truncatedSize: number;
  pagination?: {
    total: number;
    returned: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * Estimate JSON size without full serialization
 */
function estimateSize(data: any): number {
  if (typeof data === 'string') {
    return data.length;
  }

  // Quick estimate based on JSON stringify of sample
  const sample = JSON.stringify(data);
  return Buffer.byteLength(sample, 'utf8');
}

/**
 * Truncate array to fit size limit
 */
function truncateArray(
  arr: any[],
  maxSize: number
): { items: any[]; truncated: boolean; originalCount: number } {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { items: arr, truncated: false, originalCount: 0 };
  }

  const originalCount = arr.length;
  let currentSize = 2; // []
  const items: any[] = [];

  for (const item of arr) {
    const itemSize = estimateSize(item) + 1; // +1 for comma

    if (currentSize + itemSize > maxSize && items.length > 0) {
      // Would exceed limit
      return {
        items,
        truncated: true,
        originalCount,
      };
    }

    items.push(item);
    currentSize += itemSize;
  }

  return {
    items,
    truncated: false,
    originalCount,
  };
}

/**
 * Limit response size for SSE transport
 */
export function limitResponse(
  data: any,
  maxSize: number = RESPONSE_LIMITS.MAX_RESPONSE_SIZE
): LimitedResponse {
  const originalSize = estimateSize(data);

  // Small enough, return as-is
  if (originalSize <= maxSize) {
    return {
      data,
      truncated: false,
      originalSize,
      truncatedSize: originalSize,
    };
  }

  // Handle array responses (common for list operations)
  if (Array.isArray(data)) {
    const truncated = truncateArray(data, maxSize);
    const newData = truncated.items;

    return {
      data: newData,
      truncated: truncated.truncated,
      originalSize,
      truncatedSize: estimateSize(newData),
      pagination: truncated.truncated
        ? {
            total: truncated.originalCount,
            returned: truncated.items.length,
            hasMore: true,
          }
        : undefined,
    };
  }

  // Handle object with 'data' array (n8n API style)
  if (data && typeof data === 'object' && Array.isArray(data.data)) {
    const truncated = truncateArray(data.data, maxSize - 100); // Reserve 100 bytes for wrapper
    const newData = {
      ...data,
      data: truncated.items,
    };

    return {
      data: newData,
      truncated: truncated.truncated,
      originalSize,
      truncatedSize: estimateSize(newData),
      pagination: truncated.truncated
        ? {
            total: truncated.originalCount,
            returned: truncated.items.length,
            hasMore: true,
          }
        : undefined,
    };
  }

  // Handle object with other structures - truncate at string level
  const jsonString = JSON.stringify(data);
  if (jsonString.length > maxSize) {
    // Can't intelligently truncate, return error indicator
    return {
      data: {
        error: 'Response too large',
        message: `Response size (${Math.round(originalSize / 1024)}KB) exceeds limit (${Math.round(maxSize / 1024)}KB)`,
        suggestion: 'Use pagination or filters to reduce response size',
      },
      truncated: true,
      originalSize,
      truncatedSize: 200, // Error message size
    };
  }

  return {
    data,
    truncated: false,
    originalSize,
    truncatedSize: originalSize,
  };
}

/**
 * Create paginated response helper
 */
export function paginateArray<T>(
  items: T[],
  page: number = 0,
  pageSize: number = RESPONSE_LIMITS.MAX_ITEMS_PER_PAGE
): {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
} {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0,
    },
  };
}

/**
 * Add size warning to response if needed
 */
export function addSizeWarning(data: any): any {
  const size = estimateSize(data);

  if (size > RESPONSE_LIMITS.WARN_THRESHOLD) {
    console.warn(
      `Large response: ${Math.round(size / 1024)}KB ` +
      `(warning threshold: ${RESPONSE_LIMITS.WARN_THRESHOLD / 1024}KB)`
    );
  }

  return data;
}
