/**
 * Patterns that indicate sensitive field names
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /jwt/i,
  /session/i,
  /cookie/i,
];

/**
 * Exact field names that are always sensitive
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'accessKey',
  'access_key',
  'secretKey',
  'secret_key',
  'authorization',
  'bearer',
  'jwt',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'clientSecret',
  'client_secret',
]);

/**
 * Default redaction string
 */
const REDACTED = '[REDACTED]';

/**
 * Check if field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  // Check exact match
  if (SENSITIVE_FIELDS.has(fieldName)) {
    return true;
  }

  // Check patterns
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Configuration for sanitization
 */
interface SanitizeConfig {
  maxDepth: number;
  redactionString: string;
  preserveStructure: boolean;
  additionalPatterns?: RegExp[];
  additionalFields?: string[];
}

const DEFAULT_CONFIG: SanitizeConfig = {
  maxDepth: 20,
  redactionString: REDACTED,
  preserveStructure: true,
};

/**
 * Deep sanitize object, redacting sensitive data
 */
export function sanitizeCredentialData(
  data: any,
  config: Partial<SanitizeConfig> = {}
): any {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Track seen objects for circular reference handling
  const seen = new WeakSet();

  function sanitize(value: any, depth: number, currentKey: string): any {
    // Prevent infinite recursion
    if (depth > fullConfig.maxDepth) {
      return fullConfig.redactionString;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      // Check if current key is sensitive
      if (isSensitiveField(currentKey)) {
        return fullConfig.redactionString;
      }
      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        sanitize(item, depth + 1, `${currentKey}[${index}]`)
      );
    }

    // Handle objects
    const sanitized: Record<string, any> = {};

    for (const [key, val] of Object.entries(value)) {
      // Skip dangerous prototype keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      // Check if key indicates sensitive data
      if (isSensitiveField(key)) {
        sanitized[key] = fullConfig.preserveStructure
          ? fullConfig.redactionString
          : undefined;
      } else {
        sanitized[key] = sanitize(val, depth + 1, key);
      }
    }

    return sanitized;
  }

  return sanitize(data, 0, '');
}

/**
 * Sanitize error object for logging
 */
export function sanitizeErrorData(error: any): any {
  if (!error) return error;

  // Create copy to avoid mutation
  const sanitized: any = {};

  // Safe properties to keep
  const safeProps = ['message', 'name', 'code', 'status', 'statusCode'];

  for (const prop of safeProps) {
    if (error[prop] !== undefined) {
      sanitized[prop] = error[prop];
    }
  }

  // Sanitize stack trace (remove file paths if needed)
  if (error.stack) {
    sanitized.stack = error.stack;
  }

  // Sanitize response data if present
  if (error.response?.data) {
    sanitized.responseData = sanitizeCredentialData(error.response.data);
  }

  // Sanitize config (axios error)
  if (error.config) {
    sanitized.config = {
      url: error.config.url,
      method: error.config.method,
      // Redact headers that might contain auth
      headers: sanitizeCredentialData(error.config.headers || {}),
    };
  }

  return sanitized;
}

/**
 * Check if value might contain sensitive data
 */
export function mightContainSensitiveData(value: any): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const str = JSON.stringify(value);

  // Quick pattern check on stringified data
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Create custom sanitizer with additional patterns
 */
export function createSanitizer(
  additionalPatterns: RegExp[] = [],
  additionalFields: string[] = []
): (data: any) => any {
  // Add to global sets (for this sanitizer instance)
  const patterns = [...SENSITIVE_PATTERNS, ...additionalPatterns];
  const fields = new Set([...SENSITIVE_FIELDS, ...additionalFields]);

  return (data: any) => {
    return sanitizeCredentialData(data, {
      additionalPatterns: patterns,
      additionalFields: [...fields],
    });
  };
}
