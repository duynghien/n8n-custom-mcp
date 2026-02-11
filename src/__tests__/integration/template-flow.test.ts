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

import { handleTemplateTool } from '../../tools/template-tools.js';
import { templateService } from '../../services/template-service.js';
import { n8nApi } from '../../services/n8n-api-service.js';
import axios from 'axios';

// Create a local instance for the test or use the imported one but ensure it's properly initialized
// Since template-service.ts exports a singleton, we need to be careful with its internal axios instance

vi.mock('axios');
vi.mock('../../services/n8n-api-service.js');

describe('Template Flow Integration', () => {
  let mockAxios: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxios = {
      get: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxios);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    templateService.clearCache();
  });

  it('should complete full search-detail-import flow', async () => {
    // 1. Search templates
    const mockSearchResults = {
      data: {
        workflows: [{ id: 1, name: 'GitHub Integration' }],
        total: 1
      }
    };
    mockAxios.get.mockImplementation(async (url: string) => {
      if (url === '/templates/search') return mockSearchResults;
      if (url === '/templates/workflows/1') return {
        data: {
          id: 1,
          name: 'GitHub Integration',
          workflow: {
            nodes: [{ id: 'old-id', type: 'n8n-nodes-base.github', credentials: { githubApi: { id: 'template-cred' } } }],
            connections: {}
          }
        }
      };
      throw new Error('Not found');
    });

    // Re-initialize templateService to use the mocked axios
    (templateService as any).templateClient = mockAxios;

    const searchResult = await handleTemplateTool('search_templates', {
      query: 'github',
    });
    expect(searchResult.templates).toHaveLength(1);
    expect(searchResult.templates[0].id).toBe(1);

    // 2. Get template details - already handled by mockImplementation above

    const template = await handleTemplateTool('get_template_details', {
      id: 1,
    });
    expect(template.workflow.nodes).toHaveLength(1);

    // 3. Import template
    vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'n8n-nodes-base.github' }] as any);
    vi.mocked(n8nApi.createWorkflow).mockResolvedValue({ id: 'new-wf-123', name: 'GitHub Integration' } as any);

    const imported = await handleTemplateTool('import_template', {
      templateId: 1,
      credentialMapping: { 'template-cred': 'real-cred-id' }
    });

    expect(imported.id).toBe('new-wf-123');
    expect(n8nApi.createWorkflow).toHaveBeenCalled();
    const createdWf = vi.mocked(n8nApi.createWorkflow).mock.calls[0][0];
    expect(createdWf.nodes[0].credentials.githubApi.id).toBe('real-cred-id');
    expect(createdWf.nodes[0].id).not.toBe('old-id');
  });

  it('should handle export and potential re-import', async () => {
    // 1. Export workflow
    const mockWorkflow = {
      id: 'wf-123',
      name: 'My Workflow',
      nodes: [
        { id: 'n1', type: 'Set', credentials: { myCred: { id: 'c1' } } }
      ],
      staticData: { lastRun: '2023' }
    };
    vi.mocked(n8nApi.getWorkflow).mockResolvedValue(mockWorkflow as any);

    const exported = await handleTemplateTool('export_workflow_as_template', {
      workflowId: 'wf-123',
    });

    expect(exported.id).toBeUndefined();
    expect(exported.nodes[0].credentials).toBeUndefined();
    expect(exported.staticData).toBeUndefined();
    expect(exported.name).toBe('My Workflow');

    // 2. In a real scenario, this exported JSON would be used with create_workflow
    // We verify the exported format is compatible with n8n workflow structure
    expect(exported.nodes).toBeDefined();
    expect(Array.isArray(exported.nodes)).toBe(true);
  });

  it('should fail import if required nodes are missing', async () => {
    mockAxios.get.mockImplementation(async (url: string) => {
      if (url === '/templates/workflows/1') {
        return {
          data: {
            id: 1,
            workflow: { nodes: [{ type: 'missing.node' }] }
          }
        };
      }
      throw new Error('Not found');
    });
    (templateService as any).templateClient = mockAxios;
    vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'existing.node' }] as any);

    await expect(handleTemplateTool('import_template', {
      templateId: 1
    })).rejects.toThrow(/Missing nodes: missing.node/);
  });

  it('should use cache for subsequent requests in the flow', async () => {
    mockAxios.get.mockImplementation(async () => ({ data: { id: 1, workflow: { nodes: [] } } }));
    (templateService as any).templateClient = mockAxios;

    await handleTemplateTool('get_template_details', { id: 1 });
    await handleTemplateTool('get_template_details', { id: 1 });

    expect(mockAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should handle search results with no matches gracefully', async () => {
    mockAxios.get.mockImplementation(async () => ({ data: { workflows: [], total: 0 } }));
    (templateService as any).templateClient = mockAxios;

    const result = await handleTemplateTool('search_templates', { query: 'nothing' });
    expect(result.templates).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should properly map multiple credentials', async () => {
    const mockTemplate = {
      data: {
        id: 2,
        workflow: {
          nodes: [
            { type: 'n1', credentials: { c1: { id: 't1' } } },
            { type: 'n2', credentials: { c2: { id: 't2' } } }
          ]
        }
      }
    };
    mockAxios.get.mockImplementation(async (url: string) => {
      if (url === '/templates/workflows/2') return mockTemplate;
      throw new Error('Not found');
    });
    (templateService as any).templateClient = mockAxios;
    vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'n1' }, { name: 'n2' }] as any);
    vi.mocked(n8nApi.createWorkflow).mockResolvedValue({ id: 'imported' } as any);

    await handleTemplateTool('import_template', {
      templateId: 2,
      credentialMapping: { 't1': 'r1', 't2': 'r2' }
    });

    const created = vi.mocked(n8nApi.createWorkflow).mock.calls[0][0];
    expect(created.nodes[0].credentials.c1.id).toBe('r1');
    expect(created.nodes[1].credentials.c2.id).toBe('r2');
  });
});
