import axios, { AxiosInstance } from 'axios';
import { addRetryInterceptor, createApiKeyRefreshHandler } from '../utils/api-resilience.js';

// Environment variables
export const N8N_HOST = (process.env.N8N_HOST || 'http://localhost:5678').trim().replace(/\/$/, '');
export const N8N_API_KEY = process.env.N8N_API_KEY?.trim();

if (!N8N_API_KEY) {
  throw new Error("N8N_API_KEY environment variable is required");
}

// Size limits
const MAX_BODY_LENGTH = 50 * 1024 * 1024;     // 50MB
const MAX_CONTENT_LENGTH = 50 * 1024 * 1024;  // 50MB
const REQUEST_TIMEOUT = 30000;                 // 30 seconds

// n8n API client with authentication
export const n8nClient: AxiosInstance = axios.create({
  baseURL: `${N8N_HOST}/api/v1`,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: REQUEST_TIMEOUT,
  timeoutErrorMessage: 'Request timed out after 30 seconds',
  maxBodyLength: MAX_BODY_LENGTH,
  maxContentLength: MAX_CONTENT_LENGTH,
});

// Webhook client without authentication (simulates external requests)
export const webhookClient: AxiosInstance = axios.create({
  baseURL: N8N_HOST,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: REQUEST_TIMEOUT,
  timeoutErrorMessage: 'Request timed out after 30 seconds',
  maxBodyLength: MAX_BODY_LENGTH,
  maxContentLength: MAX_CONTENT_LENGTH,
});

// Add response interceptor for better error messages
n8nClient.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
      error.message = `Request body too large. Maximum size: ${MAX_BODY_LENGTH / 1024 / 1024}MB`;
    }
    if (error.code === 'ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED') {
      error.message = `Response body too large. Maximum size: ${MAX_CONTENT_LENGTH / 1024 / 1024}MB`;
    }
    return Promise.reject(error);
  }
);

// Add retry interceptor for resilience
addRetryInterceptor(n8nClient, {
  maxRetries: 3,
  baseDelayMs: 100,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
});

// Add API key refresh handler (for dynamic key rotation)
createApiKeyRefreshHandler(n8nClient, async () => {
  // Re-read from environment (supports .env reload)
  const newKey = process.env.N8N_API_KEY?.trim();
  if (newKey && newKey !== N8N_API_KEY) {
    console.log('Detected new API key in environment');
    return newKey;
  }
  return null;
});

// Export limits for external use
export const API_LIMITS = {
  MAX_BODY_LENGTH,
  MAX_CONTENT_LENGTH,
  REQUEST_TIMEOUT,
} as const;
