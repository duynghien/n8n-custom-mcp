import axios, { AxiosInstance } from 'axios';

// Environment variables
export const N8N_HOST = process.env.N8N_HOST || 'http://localhost:5678';
export const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error("Error: N8N_API_KEY environment variable is required");
  process.exit(1);
}

// n8n API client with authentication
export const n8nClient: AxiosInstance = axios.create({
  baseURL: `${N8N_HOST}/api/v1`,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
  },
});

// Webhook client without authentication (simulates external requests)
export const webhookClient: AxiosInstance = axios.create({
  baseURL: N8N_HOST,
  headers: {
    'Content-Type': 'application/json',
  },
});
