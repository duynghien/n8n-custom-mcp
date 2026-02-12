import axios, { AxiosInstance } from 'axios';

// Environment variables
export const N8N_HOST = (process.env.N8N_HOST || 'http://localhost:5678').trim().replace(/\/$/, '');
export const N8N_API_KEY = process.env.N8N_API_KEY?.trim();

if (!N8N_API_KEY) {
  throw new Error("N8N_API_KEY environment variable is required");
}

// n8n API client with authentication
export const n8nClient: AxiosInstance = axios.create({
  baseURL: `${N8N_HOST}/api/v1`,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
  },
  timeout: 30000,
  timeoutErrorMessage: 'Request timed out after 30 seconds',
});

// Webhook client without authentication (simulates external requests)
export const webhookClient: AxiosInstance = axios.create({
  baseURL: N8N_HOST,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  timeoutErrorMessage: 'Request timed out after 30 seconds',
});
