import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env config before other imports
vi.mock('../../config/env.js', () => ({
  N8N_HOST: 'http://localhost:5678',
  N8N_API_KEY: 'test-key',
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

import { TemplateService } from '../../services/template-service.js';
import { n8nApi } from '../../services/n8n-api-service.js';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');
vi.mock('../../services/n8n-api-service.js');

describe('TemplateService', () => {
  let templateService: TemplateService;
  let mockAxios: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup axios mock
    mockAxios = {
      get: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxios);

    templateService = new TemplateService();
    (templateService as any).templateClient = mockAxios;
    templateService.clearCache();
  });

  describe('searchTemplates', () => {
    it('should search templates by query', async () => {
      const mockResponse = {
        data: {
          workflows: [
            { id: 1, name: 'GitHub to Slack', nodes: 5 },
          ],
          total: 1,
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await templateService.searchTemplates('github slack');

      expect(mockAxios.get).toHaveBeenCalledWith('/templates/search', {
        params: { q: 'github slack', category: undefined },
      });
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe('GitHub to Slack');
      expect(result.total).toBe(1);
    });

    it('should handle category filter', async () => {
      mockAxios.get.mockResolvedValue({ data: { workflows: [], total: 0 } });
      await templateService.searchTemplates('test', 'Utility');
      expect(mockAxios.get).toHaveBeenCalledWith('/templates/search', {
        params: { q: 'test', category: 'Utility' },
      });
    });

    it('should return empty result on 404', async () => {
      mockAxios.get.mockImplementation(async () => {
        const err: any = new Error('Not Found');
        err.isAxiosError = true;
        err.response = { status: 404 };
        throw err;
      });

      // We need to mock axios.isAxiosError because the service uses it
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const result = await templateService.searchTemplates('nonexistent');
      expect(result.templates).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should cache search results', async () => {
      mockAxios.get.mockResolvedValue({ data: { workflows: [{ id: 1 }], total: 1 } });

      // First call
      await templateService.searchTemplates('query');
      // Second call (should use cache)
      await templateService.searchTemplates('query');

      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error for other failures', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network Error'));
      await expect(templateService.searchTemplates('test')).rejects.toThrow('Failed to search templates: Network Error');
    });
  });

  describe('getTemplateDetails', () => {
    it('should fetch template details', async () => {
      const mockTemplate = { id: 1, workflow: { nodes: [] } };
      mockAxios.get.mockResolvedValue({ data: mockTemplate });

      const result = await templateService.getTemplateDetails(1);

      expect(mockAxios.get).toHaveBeenCalledWith('/templates/workflows/1');
      expect(result).toEqual(mockTemplate);
    });

    it('should cache template details', async () => {
      mockAxios.get.mockResolvedValue({ data: { id: 1 } });

      await templateService.getTemplateDetails(1);
      await templateService.getTemplateDetails(1);

      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error when template not found', async () => {
      mockAxios.get.mockRejectedValue(new Error('404'));
      await expect(templateService.getTemplateDetails(1)).rejects.toThrow('Template 1 not found or unavailable');
    });
  });

  describe('importTemplate', () => {
    it('should import template with credential mapping', async () => {
      const mockTemplate = {
        id: 1,
        workflow: {
          nodes: [
            { id: '1', type: 'GitHub', credentials: { githubApi: { id: 'temp-1' } } },
          ],
        },
      };

      mockAxios.get.mockResolvedValue({ data: mockTemplate });
      vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'GitHub' }] as any);
      vi.mocked(n8nApi.createWorkflow).mockResolvedValue({ id: '999' } as any);

      const result = await templateService.importTemplate(1, {
        credentialMapping: { 'temp-1': 'cred-real-123' },
      });

      expect(result.id).toBe('999');
      expect(n8nApi.createWorkflow).toHaveBeenCalled();
      const createdWorkflow = vi.mocked(n8nApi.createWorkflow).mock.calls[0][0];
      expect(createdWorkflow.nodes[0].credentials.githubApi.id).toBe('cred-real-123');
    });

    it('should throw error for missing nodes', async () => {
      const mockTemplate = {
        id: 1,
        workflow: {
          nodes: [{ id: '1', type: 'CustomNode' }],
        },
      };

      mockAxios.get.mockResolvedValue({ data: mockTemplate });
      vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'Set' }] as any);

      await expect(templateService.importTemplate(1)).rejects.toThrow(
        'Missing nodes: CustomNode'
      );
    });

    it('should skip node validation if requested', async () => {
      const mockTemplate = { id: 1, workflow: { nodes: [] } };
      mockAxios.get.mockResolvedValue({ data: mockTemplate });
      vi.mocked(n8nApi.createWorkflow).mockResolvedValue({ id: '999' } as any);

      await templateService.importTemplate(1, { skipNodeValidation: true });

      expect(n8nApi.listNodeTypes).not.toHaveBeenCalled();
    });

    it('should handle importInactive option', async () => {
      const mockTemplate = { id: 1, workflow: { nodes: [], active: true } };
      mockAxios.get.mockResolvedValue({ data: mockTemplate });
      vi.mocked(n8nApi.createWorkflow).mockResolvedValue({ id: '999' } as any);

      // Default is importInactive: undefined -> workflow.active = options.importInactive === false -> false
      await templateService.importTemplate(1);
      expect(vi.mocked(n8nApi.createWorkflow).mock.calls[0][0].active).toBe(false);

      // importInactive: true -> false
      await templateService.importTemplate(1, { importInactive: true });
      expect(vi.mocked(n8nApi.createWorkflow).mock.calls[1][0].active).toBe(false);

      // importInactive: false -> true
      await templateService.importTemplate(1, { importInactive: false });
      expect(vi.mocked(n8nApi.createWorkflow).mock.calls[2][0].active).toBe(true);
    });
  });

  describe('exportWorkflow', () => {
    it('should export workflow safely by default', async () => {
      const mockWorkflow = {
        id: '123',
        nodes: [
          { id: '1', type: 'GitHub', credentials: { githubApi: { id: 'c1' } } }
        ],
        staticData: { lastRun: 'now' }
      };

      vi.mocked(n8nApi.getWorkflow).mockResolvedValue(mockWorkflow as any);

      const result = await templateService.exportWorkflow('123');

      expect(result.id).toBeUndefined();
      expect(result.nodes[0].credentials).toBeUndefined();
      expect(result.staticData).toBeUndefined();
    });

    it('should include credentials if requested', async () => {
      const mockWorkflow = {
        nodes: [{ credentials: { a: 1 } }]
      };
      vi.mocked(n8nApi.getWorkflow).mockResolvedValue(mockWorkflow as any);

      const result = await templateService.exportWorkflow('123', { includeCredentials: true });
      expect(result.nodes[0].credentials).toEqual({ a: 1 });
    });

    it('should include execution data if requested', async () => {
      const mockWorkflow = {
        staticData: { x: 1 },
        pinData: { y: 2 },
        nodes: []
      };
      vi.mocked(n8nApi.getWorkflow).mockResolvedValue(mockWorkflow as any);

      const result = await templateService.exportWorkflow('123', { includeExecutionData: true });
      expect(result.staticData).toEqual({ x: 1 });
      expect(result.pinData).toEqual({ y: 2 });
    });
  });
});
