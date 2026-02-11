import type { TemplateCacheEntry } from '../types/n8n-types.js';

/**
 * Simple in-memory cache with TTL support
 */
export class TemplateCache {
  private cache: Map<string, TemplateCacheEntry> = new Map();
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_CACHE_SIZE = 100; // Prevent memory leak

  /**
   * Get data from cache if not expired
   */
  get(key: string): any | null {
    if (!key || typeof key !== 'string') {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with TTL
   */
  set(key: string, data: any): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key must be a non-empty string');
    }

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
}
