import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AxiosError } from 'axios';

/**
 * Convert axios error to standardized MCP error
 * Sanitizes error message to prevent sensitive data leakage
 */
/**
 * Extract error message from API response
 * Handles both JSON and HTML responses (e.g., from reverse proxies)
 */
function extractErrorMessage(data: unknown, fallbackMessage: string): string {
  // Handle JSON response with message property
  if (data && typeof data === 'object' && 'message' in data) {
    return String(data.message);
  }

  // Handle HTML response (e.g., 502/503 from reverse proxy)
  if (typeof data === 'string') {
    // Try to extract <title> tag for a cleaner message
    const titleMatch = data.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return `${titleMatch[1].trim()} (HTML response)`;
    }
    // Return truncated HTML if no title found
    const truncated = data.slice(0, 100).replace(/\s+/g, ' ').trim();
    return truncated.length > 0 ? `${truncated}... (HTML response)` : 'Server returned HTML error page';
  }

  return fallbackMessage;
}

export function handleApiError(error: unknown, context: string): McpError {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    let message = extractErrorMessage(error.response?.data, error.message);

    // Basic sanitization: remove potential tokens/keys from message
    message = message.replace(/([a-zA-Z0-9]{32,})/g, '[REDACTED]');
    message = message.replace(/(x-n8n-api-key|authorization|token|password|secret)=[^&\s]+/gi, '$1=[REDACTED]');
    message = message.replace(/bearer\s+\S+/gi, 'bearer [REDACTED]');
    message = message.replace(/basic\s+\S+/gi, 'basic [REDACTED]');

    // Sanitize Authorization headers from error.config if present
    if (error.config?.headers) {
      const headers = error.config.headers;
      if (headers.Authorization) {
        headers.Authorization = '[REDACTED]';
      }
      if (headers.authorization) {
        headers.authorization = '[REDACTED]';
      }
    }

    // Map HTTP status to MCP error codes
    if (status === 401 || status === 403) {
      return new McpError(
        ErrorCode.InvalidRequest,
        `Authentication failed: ${message}`
      );
    }

    if (status === 404) {
      return new McpError(
        ErrorCode.InvalidRequest,
        `Resource not found: ${message}`
      );
    }

    if (status === 400) {
      return new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${message}`
      );
    }

    if (status === 429) {
      return new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded: ${message}`
      );
    }

    return new McpError(
      ErrorCode.InternalError,
      `${context}: ${message}`
    );
  }

  return new McpError(
    ErrorCode.InternalError,
    `${context}: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}

/**
 * Validate required parameters exist
 */
export function validateRequired(
  params: Record<string, any>,
  required: string[]
): void {
  // Protect against prototype pollution
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameter key: ${key}`
      );
    }
  }

  // Use hasOwnProperty to safely check for required keys
  const missing = required.filter(key =>
    !Object.prototype.hasOwnProperty.call(params, key) ||
    params[key] === undefined ||
    params[key] === null
  );

  if (missing.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Missing required parameters: ${missing.join(', ')}`
    );
  }
}

/**
 * Create a safe object without prototype chain
 * Use for user-provided data to prevent prototype pollution
 */
export function createSafeObject<T = any>(data: Record<string, any>): T {
  const safe = Object.create(null);
  for (const [key, value] of Object.entries(data)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue; // Skip dangerous keys
    }
    safe[key] = value;
  }
  return safe;
}
