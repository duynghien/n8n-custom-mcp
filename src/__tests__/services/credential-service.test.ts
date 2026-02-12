import { describe, it, expect, vi, beforeEach } from 'vitest';
import { credentialService } from '../../services/credential-service.js';
import { n8nApi } from '../../services/n8n-api-service.js';

// Mock child_process BEFORE importing credential service
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    // Simulate database not accessible
    callback(new Error('Database not accessible'), '', '');
  }),
  execFile: vi.fn((cmd, args, options, callback) => {
    // Simulate database not accessible
    if (typeof options === 'function') {
      options(new Error('Database not accessible'), '', '');
    } else if (callback) {
      callback(new Error('Database not accessible'), '', '');
    }
  }),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => {
    return async (...args: any[]) => {
      return new Promise((resolve, reject) => {
        reject(new Error('Database not accessible'));
      });
    };
  }),
}));

// Mock n8n API service
vi.mock('../../services/n8n-api-service.js', () => ({
  n8nApi: {
    getCredentialSchema: vi.fn(),
    listWorkflows: vi.fn(),
    createCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    executeWorkflow: vi.fn(),
    getExecution: vi.fn(),
    createWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
  },
}));

// Mock credential test service
vi.mock('../../services/credential-test-service.js', () => ({
  credentialTestService: {
    testCredential: vi.fn(),
  },
}));

describe('CredentialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    credentialService.clearCache();
  });

  describe('getSchema', () => {
    it('should get credential schema from API', async () => {
      const mockSchema = {
        type: 'githubApi',
        displayName: 'GitHub API',
        properties: [
          { name: 'accessToken', type: 'string', required: true },
        ],
      };
      vi.mocked(n8nApi.getCredentialSchema).mockResolvedValue(mockSchema);

      const result = await credentialService.getSchema('githubApi');

      expect(n8nApi.getCredentialSchema).toHaveBeenCalledWith('githubApi');
      expect(result).toEqual(mockSchema);
    });

    it('should handle schema not found error', async () => {
      vi.mocked(n8nApi.getCredentialSchema).mockRejectedValue(
        new Error('Schema not found')
      );

      await expect(credentialService.getSchema('invalidType')).rejects.toThrow();
    });
  });

  describe('listFromWorkflows', () => {
    it('should parse credentials from workflows', async () => {
      const mockWorkflows = {
        data: [
          {
            id: '1',
            name: 'Test Workflow',
            nodes: [
              {
                id: 'node1',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: {
                    id: 'cred1',
                    name: 'GitHub Account',
                  },
                },
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);

      const result = await credentialService.listCredentials();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'cred1',
        name: 'GitHub Account',
        type: 'githubApi',
      });
    });

    it('should handle workflows without credentials', async () => {
      const mockWorkflows = {
        data: [
          {
            id: '1',
            name: 'Test Workflow',
            nodes: [
              {
                id: 'node1',
                name: 'Set',
                type: 'n8n-nodes-base.set',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);

      const result = await credentialService.listCredentials();

      expect(result).toHaveLength(0);
    });

    it('should deduplicate credentials', async () => {
      const mockWorkflows = {
        data: [
          {
            id: '1',
            name: 'Workflow 1',
            nodes: [
              {
                id: 'node1',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: { id: 'cred1', name: 'GitHub' },
                },
              },
            ],
          },
          {
            id: '2',
            name: 'Workflow 2',
            nodes: [
              {
                id: 'node2',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: { id: 'cred1', name: 'GitHub' },
                },
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);

      const result = await credentialService.listCredentials();

      expect(result).toHaveLength(1);
    });

    it('should filter credentials by type', async () => {
      const mockWorkflows = {
        data: [
          {
            id: '1',
            name: 'Test',
            nodes: [
              {
                id: 'node1',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: { id: 'cred1', name: 'GitHub' },
                },
              },
              {
                id: 'node2',
                name: 'Slack',
                type: 'n8n-nodes-base.slack',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  slackApi: { id: 'cred2', name: 'Slack' },
                },
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);

      const result = await credentialService.listCredentials('githubApi');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('githubApi');
    });
  });

  describe('validateCredentialData', () => {
    it('should validate required fields', async () => {
      const mockSchema = {
        type: 'githubApi',
        displayName: 'GitHub API',
        properties: [
          { name: 'accessToken', type: 'string', required: true },
        ],
      };
      vi.mocked(n8nApi.getCredentialSchema).mockResolvedValue(mockSchema);

      const result = await credentialService.validateCredentialData('githubApi', {
        accessToken: 'test_token',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const mockSchema = {
        type: 'githubApi',
        displayName: 'GitHub API',
        properties: [
          { name: 'accessToken', type: 'string', required: true },
        ],
      };
      vi.mocked(n8nApi.getCredentialSchema).mockResolvedValue(mockSchema);

      const result = await credentialService.validateCredentialData('githubApi', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: accessToken');
    });

    it('should validate field types', async () => {
      const mockSchema = {
        type: 'testApi',
        displayName: 'Test API',
        properties: [
          { name: 'token', type: 'string', required: false },
          { name: 'port', type: 'number', required: false },
        ],
      };
      vi.mocked(n8nApi.getCredentialSchema).mockResolvedValue(mockSchema);

      const result = await credentialService.validateCredentialData('testApi', {
        token: 123, // Wrong type
        port: '8080', // Wrong type
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field token must be a string');
      expect(result.errors).toContain('Field port must be a number');
    });
  });

  describe('createCredential', () => {
    it('should create credential with validation', async () => {
      const mockSchema = {
        type: 'githubApi',
        displayName: 'GitHub API',
        properties: [
          { name: 'accessToken', type: 'string', required: true },
        ],
      };
      const mockCreated = {
        id: '123',
        name: 'Test GitHub',
        type: 'githubApi',
        data: { accessToken: 'test_token' },
      };

      vi.mocked(n8nApi.getCredentialSchema).mockResolvedValue(mockSchema);
      // Mock listWorkflows for duplicate check (called by listCredentials)
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue({ data: [] });
      vi.mocked(n8nApi.createCredential).mockResolvedValue(mockCreated);

      const result = await credentialService.createCredential({
        name: 'Test GitHub',
        type: 'githubApi',
        data: { accessToken: 'test_token' },
      });

      expect(n8nApi.createCredential).toHaveBeenCalled();
      expect(result).toEqual(mockCreated);
    });

    it('should reject invalid credential data', async () => {
      const mockSchema = {
        type: 'githubApi',
        displayName: 'GitHub API',
        properties: [
          { name: 'accessToken', type: 'string', required: true },
        ],
      };

      vi.mocked(n8nApi.getCredentialSchema).mockResolvedValue(mockSchema);
      // Mock listWorkflows to avoid database call
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue({ data: [] });

      await expect(
        credentialService.createCredential({
          name: 'Test',
          type: 'githubApi',
          data: {}, // Missing required field
        })
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('getCredentialUsage', () => {
    it('should find workflows using credential', async () => {
      const mockWorkflows = {
        data: [
          {
            id: 'wf1',
            name: 'Workflow 1',
            nodes: [
              {
                id: 'node1',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: { id: 'cred1', name: 'GitHub' },
                },
              },
            ],
          },
          {
            id: 'wf2',
            name: 'Workflow 2',
            nodes: [
              {
                id: 'node2',
                name: 'Slack',
                type: 'n8n-nodes-base.slack',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  slackApi: { id: 'cred2', name: 'Slack' },
                },
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);

      const result = await credentialService.getCredentialUsage('cred1');

      expect(result).toEqual(['wf1']);
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential when not in use', async () => {
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue({ data: [] });
      vi.mocked(n8nApi.deleteCredential).mockResolvedValue(undefined);

      await credentialService.deleteCredential('cred1');

      expect(n8nApi.deleteCredential).toHaveBeenCalledWith('cred1');
    });

    it('should block delete if credential in use', async () => {
      const mockWorkflows = {
        data: [
          {
            id: 'wf1',
            name: 'Workflow 1',
            nodes: [
              {
                id: 'node1',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: { id: 'cred1', name: 'GitHub' },
                },
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);

      await expect(
        credentialService.deleteCredential('cred1', false)
      ).rejects.toThrow('Credential is used by');
    });

    it('should force delete if requested', async () => {
      const mockWorkflows = {
        data: [
          {
            id: 'wf1',
            name: 'Workflow 1',
            nodes: [
              {
                id: 'node1',
                name: 'GitHub',
                type: 'n8n-nodes-base.github',
                typeVersion: 1,
                position: [0, 0],
                parameters: {},
                credentials: {
                  githubApi: { id: 'cred1', name: 'GitHub' },
                },
              },
            ],
          },
        ],
      };
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue(mockWorkflows);
      vi.mocked(n8nApi.deleteCredential).mockResolvedValue(undefined);

      await credentialService.deleteCredential('cred1', true);

      expect(n8nApi.deleteCredential).toHaveBeenCalledWith('cred1');
    });
  });

  describe('updateCredential', () => {
    it('should update credential', async () => {
      // Mock listWorkflows to return existing credential
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue({
        data: [
          {
            id: 'wf1',
            name: 'Test Workflow',
            nodes: [
              {
                id: 'node1',
                name: 'Test Node',
                type: 'n8n-nodes-base.github',
                credentials: {
                  githubApi: { id: '123', name: 'GitHub Cred' },
                },
              },
            ],
          },
        ],
      });

      const mockUpdated = {
        id: '123',
        name: 'Updated Name',
        type: 'githubApi',
      };
      vi.mocked(n8nApi.updateCredential).mockResolvedValue(mockUpdated);

      const result = await credentialService.updateCredential('123', {
        name: 'Updated Name',
      });

      expect(n8nApi.updateCredential).toHaveBeenCalledWith('123', {
        name: 'Updated Name',
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should throw error if credential not found', async () => {
      // Clear cache to ensure fresh listCredentials call
      credentialService.clearCache();

      // Mock listWorkflows to return empty (no credentials)
      vi.mocked(n8nApi.listWorkflows).mockResolvedValue({
        data: [],
      });

      await expect(
        credentialService.updateCredential('nonexistent', { name: 'New Name' })
      ).rejects.toThrow('Credential nonexistent not found');
    });
  });
});
