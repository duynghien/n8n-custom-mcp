import { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Simple mutex for serializing write operations
 */
class ResourceMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(resourceKey: string, timeoutMs = 5000): Promise<() => void> {
    const startTime = Date.now();

    // Wait for existing lock
    while (this.locks.has(resourceKey)) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Mutex timeout for resource: ${resourceKey}`);
      }
      await this.locks.get(resourceKey);
    }

    // Create new lock
    let release: () => void = () => {};
    const lockPromise = new Promise<void>(resolve => {
      release = resolve;
    });

    this.locks.set(resourceKey, lockPromise);

    return () => {
      this.locks.delete(resourceKey);
      release();
    };
  }

  isLocked(resourceKey: string): boolean {
    return this.locks.has(resourceKey);
  }
}

export const resourceMutex = new ResourceMutex();

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Add retry interceptor to axios instance
 */
export function addRetryInterceptor(
  client: AxiosInstance,
  config: Partial<RetryConfig> = {}
): void {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  client.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const originalConfig = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

      if (!originalConfig) {
        return Promise.reject(error);
      }

      // Initialize retry count
      originalConfig._retryCount = originalConfig._retryCount ?? 0;

      // Check if should retry
      const status = error.response?.status;
      const isRetryable = status && retryConfig.retryableStatuses.includes(status);
      const hasRetriesLeft = originalConfig._retryCount < retryConfig.maxRetries;

      if (!isRetryable || !hasRetriesLeft) {
        return Promise.reject(error);
      }

      // Increment retry count
      originalConfig._retryCount++;

      // Calculate delay
      const delay = getBackoffDelay(originalConfig._retryCount - 1, retryConfig);

      console.warn(
        `Retry ${originalConfig._retryCount}/${retryConfig.maxRetries} ` +
        `for ${originalConfig.method?.toUpperCase()} ${originalConfig.url} ` +
        `after ${delay}ms (status: ${status})`
      );

      await sleep(delay);

      return client.request(originalConfig);
    }
  );
}

/**
 * API key refresh handler
 */
export function createApiKeyRefreshHandler(
  client: AxiosInstance,
  getNewApiKey: () => Promise<string | null>
): void {
  let isRefreshing = false;
  let refreshPromise: Promise<string | null> | null = null;

  client.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const originalConfig = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

      // Only handle 401 errors once
      if (error.response?.status !== 401 || originalConfig?._retried) {
        return Promise.reject(error);
      }

      // Prevent concurrent refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = getNewApiKey();
      }

      try {
        const newKey = await refreshPromise;

        if (newKey && originalConfig) {
          // Update client headers
          client.defaults.headers.common['X-N8N-API-KEY'] = newKey;

          // Retry with new key
          originalConfig._retried = true;
          originalConfig.headers.set('X-N8N-API-KEY', newKey);

          console.log('API key refreshed, retrying request');
          return client.request(originalConfig);
        }
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }

      return Promise.reject(error);
    }
  );
}

/**
 * Execute operation with mutex lock
 */
export async function withMutex<T>(
  resourceKey: string,
  operation: () => Promise<T>,
  timeoutMs = 5000
): Promise<T> {
  const release = await resourceMutex.acquire(resourceKey, timeoutMs);
  try {
    return await operation();
  } finally {
    release();
  }
}
