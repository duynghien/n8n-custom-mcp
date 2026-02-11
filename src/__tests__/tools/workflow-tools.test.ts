import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workflowTools, handleWorkflowTool } from '../../tools/workflow-tools.js';
import { n8nApi } from '../../services/n8n-api-service.js';

// Mock config/env.ts BEFORE importing anything else
vi.mock('../../config/env.js', () => ({
  N8N_HOST: 'http://localhost:5678',
  N8N_API_KEY: 'test-api-key',
  n8nClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  webhookClient: {
    request: vi.fn(),
  },
}));

// Mock n8n API service
vi.mock('../../services/n8n-api-service.js', () => ({
  n8nApi: {
    listWorkflows: vi.fn(),
    getWorkflow: vi.fn(),
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    activateWorkflow: vi.fn(),
    executeWorkflow: vi.fn(),
    triggerWebhook: vi.fn(),
    listExecutions: vi.fn(),
    getExecution: vi.fn(),
    listNodeTypes: vi.fn(),
  },
}));

describe('Workflow Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Definitions', () => {
    it('should export 11 workflow tools', () => {
      expect(workflowTools).toHaveLength(11);
    });

    it('should have valid tool schemas', () => {
      workflowTools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      });
    });
  });

  describe('Workflow Management Tools', () => {
    it('should handle list_workflows', async () => {
      const mockResult = { data: [{ id: '1', name: 'Test' }] };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockResult);

      const result = await handleWorkflowTool('list_workflows', { limit: 10 });

      expect(n8nApi.listWorkflows).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual(mockResult);
    });

    it('should handle get_workflow', async () => {
      const mockWorkflow = { id: '123', name: 'Test' };
      vi.mocked(n8nApi.getWorkflow).mockResolvedValue(mockWorkflow);

      const result = await handleWorkflowTool('get_workflow', { id: '123' });

      expect(n8nApi.getWorkflow).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockWorkflow);
    });

    it('should validate required params for get_workflow', async () => {
      await expect(handleWorkflowTool('get_workflow', {})).rejects.toThrow(
        'Missing required parameters: id'
      );
    });

    it('should handle create_workflow', async () => {
      const mockWorkflow = { name: 'New Workflow' };
      const mockResult = { id: '456', ...mockWorkflow };
      vi.mocked(n8nApi.createWorkflow).mockResolvedValue(mockResult);

      const result = await handleWorkflowTool('create_workflow', mockWorkflow);

      expect(n8nApi.createWorkflow).toHaveBeenCalledWith(mockWorkflow);
      expect(result).toEqual(mockResult);
    });

    it('should handle update_workflow', async () => {
      const mockUpdate = { id: '123', name: 'Updated' };
      const mockResult = { id: '123', name: 'Updated' };
      vi.mocked(n8nApi.updateWorkflow).mockResolvedValue(mockResult);

      const result = await handleWorkflowTool('update_workflow', mockUpdate);

      expect(n8nApi.updateWorkflow).toHaveBeenCalledWith('123', { name: 'Updated' });
      expect(result).toEqual(mockResult);
    });

    it('should handle delete_workflow', async () => {
      vi.mocked(n8nApi.deleteWorkflow).mockResolvedValue();

      const result = await handleWorkflowTool('delete_workflow', { id: '123' });

      expect(n8nApi.deleteWorkflow).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        success: true,
        message: 'Workflow 123 deleted',
      });
    });

    it('should handle activate_workflow', async () => {
      const mockResult = { id: '123', active: true };
      vi.mocked(n8nApi.activateWorkflow).mockResolvedValue(mockResult);

      const result = await handleWorkflowTool('activate_workflow', {
        id: '123',
        active: true,
      });

      expect(n8nApi.activateWorkflow).toHaveBeenCalledWith('123', true);
      expect(result).toEqual(mockResult);
    });
  });

  describe('Execution Tools', () => {
    it('should handle execute_workflow', async () => {
      const mockExecution = { id: 'exec1', workflowId: '123' };
      vi.mocked(n8nApi.executeWorkflow).mockResolvedValue(mockExecution);

      const result = await handleWorkflowTool('execute_workflow', { id: '123' });

      expect(n8nApi.executeWorkflow).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockExecution);
    });

    it('should handle trigger_webhook', async () => {
      const mockResult = { status: 200, data: { success: true } };
      vi.mocked(n8nApi.triggerWebhook).mockResolvedValue(mockResult);

      const result = await handleWorkflowTool('trigger_webhook', {
        webhook_path: 'test-hook',
        method: 'POST',
        body: { test: 'data' },
      });

      expect(n8nApi.triggerWebhook).toHaveBeenCalledWith({
        path: 'test-hook',
        method: 'POST',
        body: { test: 'data' },
        headers: undefined,
        queryParams: undefined,
        testMode: undefined,
      });
      expect(result).toHaveProperty('url');
    });

    it('should handle list_executions', async () => {
      const mockResult = { data: [{ id: 'exec1', finished: true }] };
      vi.mocked(n8nApi.listExecutions).mockResolvedValue(mockResult);

      const result = await handleWorkflowTool('list_executions', { limit: 10 });

      expect(n8nApi.listExecutions).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual(mockResult);
    });

    it('should handle get_execution', async () => {
      const mockExecution = { id: 'exec1', finished: true };
      vi.mocked(n8nApi.getExecution).mockResolvedValue(mockExecution);

      const result = await handleWorkflowTool('get_execution', { id: 'exec1' });

      expect(n8nApi.getExecution).toHaveBeenCalledWith('exec1');
      expect(result).toEqual(mockExecution);
    });
  });

  describe('Discovery Tools', () => {
    it('should handle list_node_types', async () => {
      const mockTypes = [{ name: 'Webhook', type: 'n8n-nodes-base.webhook' }];
      vi.mocked(n8nApi.listNodeTypes).mockResolvedValue(mockTypes);

      const result = await handleWorkflowTool('list_node_types', {});

      expect(n8nApi.listNodeTypes).toHaveBeenCalled();
      expect(result).toEqual(mockTypes);
    });
  });

  describe('Error Handling', () => {
    it('should throw on unknown tool', async () => {
      await expect(
        handleWorkflowTool('unknown_tool', {})
      ).rejects.toThrow('Unknown workflow tool: unknown_tool');
    });
  });
});
