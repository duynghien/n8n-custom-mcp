import { describe, it, expect, vi, beforeEach } from 'vitest';
import { N8nApiService } from '../../services/n8n-api-service.js';
import { n8nClient, webhookClient } from '../../config/env.js';

// Mock axios clients
vi.mock('../../config/env.js', () => ({
  n8nClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  webhookClient: {
    request: vi.fn(),
  },
  N8N_HOST: 'http://localhost:5678',
  N8N_API_KEY: 'test-key',
}));

describe('N8nApiService', () => {
  let service: N8nApiService;

  beforeEach(() => {
    service = new N8nApiService();
    vi.clearAllMocks();
  });

  describe('Workflow Operations', () => {
    it('should list workflows successfully', async () => {
      const mockData = { data: [{ id: '1', name: 'Test Workflow' }] };
      vi.mocked(n8nClient.get).mockResolvedValue({ data: mockData });

      const result = await service.listWorkflows();

      expect(n8nClient.get).toHaveBeenCalledWith('/workflows', { params: undefined });
      expect(result).toEqual(mockData);
    });

    it('should get workflow by id', async () => {
      const mockWorkflow = { id: '123', name: 'Test' };
      vi.mocked(n8nClient.get).mockResolvedValue({ data: mockWorkflow });

      const result = await service.getWorkflow('123');

      expect(n8nClient.get).toHaveBeenCalledWith('/workflows/123');
      expect(result).toEqual(mockWorkflow);
    });

    it('should create workflow', async () => {
      const mockWorkflow = { name: 'New Workflow' };
      const mockResponse = { id: '456', ...mockWorkflow };
      vi.mocked(n8nClient.post).mockResolvedValue({ data: mockResponse });

      const result = await service.createWorkflow(mockWorkflow);

      expect(n8nClient.post).toHaveBeenCalledWith('/workflows', mockWorkflow);
      expect(result).toEqual(mockResponse);
    });

    it('should update workflow', async () => {
      const mockUpdate = { name: 'Updated' };
      const mockResponse = { id: '123', ...mockUpdate };
      vi.mocked(n8nClient.put).mockResolvedValue({ data: mockResponse });

      const result = await service.updateWorkflow('123', mockUpdate);

      expect(n8nClient.put).toHaveBeenCalledWith('/workflows/123', mockUpdate);
      expect(result).toEqual(mockResponse);
    });

    it('should delete workflow', async () => {
      vi.mocked(n8nClient.delete).mockResolvedValue({ data: {} });

      await service.deleteWorkflow('123');

      expect(n8nClient.delete).toHaveBeenCalledWith('/workflows/123');
    });

    it('should activate workflow', async () => {
      const mockResponse = { id: '123', active: true };
      vi.mocked(n8nClient.post).mockResolvedValue({ data: mockResponse });

      const result = await service.activateWorkflow('123', true);

      expect(n8nClient.post).toHaveBeenCalledWith('/workflows/123/activate');
      expect(result).toEqual(mockResponse);
    });

    it('should deactivate workflow', async () => {
      const mockResponse = { id: '123', active: false };
      vi.mocked(n8nClient.post).mockResolvedValue({ data: mockResponse });

      const result = await service.activateWorkflow('123', false);

      expect(n8nClient.post).toHaveBeenCalledWith('/workflows/123/deactivate');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Execution Operations', () => {
    it('should list executions', async () => {
      const mockData = { data: [{ id: 'exec1', finished: true }] };
      vi.mocked(n8nClient.get).mockResolvedValue({ data: mockData });

      const result = await service.listExecutions({ limit: 10 });

      expect(n8nClient.get).toHaveBeenCalledWith('/executions', {
        params: { limit: 10 }
      });
      expect(result).toEqual(mockData);
    });

    it('should get execution by id', async () => {
      const mockExecution = { id: 'exec1', finished: true };
      vi.mocked(n8nClient.get).mockResolvedValue({ data: mockExecution });

      const result = await service.getExecution('exec1');

      expect(n8nClient.get).toHaveBeenCalledWith('/executions/exec1');
      expect(result).toEqual(mockExecution);
    });

    it('should execute workflow', async () => {
      const mockExecution = { id: 'exec2', workflowId: '123' };
      vi.mocked(n8nClient.post).mockResolvedValue({ data: mockExecution });

      const result = await service.executeWorkflow('123');

      expect(n8nClient.post).toHaveBeenCalledWith('/workflows/123/execute');
      expect(result).toEqual(mockExecution);
    });
  });

  describe('Webhook Operations', () => {
    it('should trigger webhook in production mode', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
      };
      vi.mocked(webhookClient.request).mockResolvedValue(mockResponse);

      const result = await service.triggerWebhook({
        path: 'test-webhook',
        method: 'POST',
        body: { test: 'data' },
        testMode: false,
      });

      expect(webhookClient.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/webhook/test-webhook',
        data: { test: 'data' },
        headers: undefined,
        params: undefined,
        validateStatus: expect.any(Function),
      });
      expect(result).toEqual({
        status: 200,
        statusText: 'OK',
        data: { success: true },
      });
    });

    it('should trigger webhook in test mode', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { success: true },
      };
      vi.mocked(webhookClient.request).mockResolvedValue(mockResponse);

      await service.triggerWebhook({
        path: 'test-webhook',
        method: 'GET',
        testMode: true,
      });

      expect(webhookClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/webhook-test/test-webhook',
        })
      );
    });
  });

  describe('Node Types', () => {
    it('should list node types', async () => {
      const mockData = { data: [{ name: 'Webhook', type: 'n8n-nodes-base.webhook' }] };
      vi.mocked(n8nClient.get).mockResolvedValue({ data: mockData });

      const result = await service.listNodeTypes();

      expect(n8nClient.get).toHaveBeenCalledWith('/node-types');
      expect(result).toEqual(mockData.data);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(n8nClient.get).mockRejectedValue(new Error('Network error'));

      await expect(service.listWorkflows()).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      const axiosError = {
        response: {
          status: 404,
          data: { message: 'Workflow not found' },
        },
        message: 'Request failed',
      };
      vi.mocked(n8nClient.get).mockRejectedValue(axiosError);

      await expect(service.getWorkflow('999')).rejects.toThrow();
    });
  });
});
