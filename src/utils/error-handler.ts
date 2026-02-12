import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AxiosError } from 'axios';

/**
 * Convert axios error to standardized MCP error
 * Sanitizes error message to prevent sensitive data leakage
 */
export function handleApiError(error: unknown, context: string): McpError {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    let message = error.response?.data?.message || error.message;

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
  const missing = required.filter(key => params[key] === undefined || params[key] === null);
  if (missing.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Missing required parameters: ${missing.join(', ')}`
    );
  }
}
