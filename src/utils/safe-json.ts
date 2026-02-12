/**
 * Safe JSON serialization with handling for:
 * - Circular references → [Circular]
 * - BigInt → string with 'n' suffix
 * - Symbol → [Symbol: description]
 */
export function safeStringify(obj: any, indent: number = 2): string {
  const seen = new WeakSet();

  return JSON.stringify(obj, (key, value) => {
    // Handle BigInt
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }

    // Handle Symbol
    if (typeof value === 'symbol') {
      return `[Symbol: ${value.description || 'unnamed'}]`;
    }

    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }

    return value;
  }, indent);
}

/**
 * Safe JSON parse with BigInt revival
 */
export function safeParse(json: string): any {
  return JSON.parse(json, (key, value) => {
    // Revive BigInt strings
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  });
}

/**
 * Check if object has circular references
 */
export function hasCircularReference(obj: any): boolean {
  const seen = new WeakSet();

  function detect(value: any): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    if (seen.has(value)) {
      return true;
    }

    seen.add(value);

    for (const v of Object.values(value)) {
      if (detect(v)) {
        return true;
      }
    }

    return false;
  }

  return detect(obj);
}
