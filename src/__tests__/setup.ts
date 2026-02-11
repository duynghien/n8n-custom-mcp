import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Setup test environment variables
  process.env.N8N_HOST = 'http://localhost:5678';
  process.env.N8N_API_KEY = 'test-api-key';
});

afterAll(() => {
  // Cleanup
});
