import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AxiosError } from 'axios';

/**
 * Convert axios error to standardized MCP error
 */
export function handleApiError(error: unknown, context: string): McpError {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

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
  const missing = required.filter(key => !params[key]);
  if (missing.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Missing required parameters: ${missing.join(', ')}`
    );
  }
}
