import { describe, it, expect, vi, beforeEach } from 'vitest';
import { credentialTools, handleCredentialTool } from '../../tools/credential-tools.js';
import { credentialService } from '../../services/credential-service.js';

// Mock credential service
vi.mock('../../services/credential-service.js', () => ({
  credentialService: {
    getSchema: vi.fn(),
    listCredentials: vi.fn(),
    createCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    testCredential: vi.fn(),
    validateCredentialData: vi.fn(),
    getCredentialUsage: vi.fn(),
  },
}));

// Mock credential test service
vi.mock('../../services/credential-test-service.js', () => ({
  credentialTestService: {
    testCredential: vi.fn(),
  },
}));

describe('Credential Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Definitions', () => {
    it('should export 6 credential tools', () => {
      expect(credentialTools).toHaveLength(6);
    });

    it('should have valid tool schemas', () => {
      credentialTools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      });
    });

    it('should include all expected credential tools', () => {
      const toolNames = credentialTools.map(t => t.name);
      expect(toolNames).toContain('get_credential_schema');
      expect(toolNames).toContain('list_credentials');
      expect(toolNames).toContain('create_credential');
      expect(toolNames).toContain('update_credential');
      expect(toolNames).toContain('delete_credential');
      expect(toolNames).toContain('test_credential');
    });
  });

  describe('get_credential_schema', () => {
    it('should get credential schema', async () => {
      const mockSchema = {
        type: 'githubApi',
        displayName: 'GitHub API',
        properties: [
          {
            name: 'accessToken',
            type: 'string',
            required: true,
            description: 'GitHub Personal Access Token',
          },
        ],
      };
      vi.mocked(credentialService.getSchema).mockResolvedValue(mockSchema);

      const result = await handleCredentialTool('get_credential_schema', {
        credentialType: 'githubApi',
      });

      expect(credentialService.getSchema).toHaveBeenCalledWith('githubApi');
      expect(result).toEqual(mockSchema);
    });

    it('should validate required credentialType parameter', async () => {
      await expect(
        handleCredentialTool('get_credential_schema', {})
      ).rejects.toThrow('Missing required parameters: credentialType');
    });
  });

  describe('list_credentials', () => {
    it('should list all credentials', async () => {
      const mockCredentials = [
        { id: '1', name: 'GitHub Account', type: 'githubApi' },
        { id: '2', name: 'Slack Workspace', type: 'slackApi' },
      ];
      vi.mocked(credentialService.listCredentials).mockResolvedValue(mockCredentials);

      const result = await handleCredentialTool('list_credentials', {});

      expect(credentialService.listCredentials).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockCredentials);
    });

    it('should filter credentials by type', async () => {
      const mockCredentials = [
        { id: '1', name: 'GitHub Account', type: 'githubApi' },
      ];
      vi.mocked(credentialService.listCredentials).mockResolvedValue(mockCredentials);

      const result = await handleCredentialTool('list_credentials', {
        type: 'githubApi',
      });

      expect(credentialService.listCredentials).toHaveBeenCalledWith('githubApi');
      expect(result).toEqual(mockCredentials);
    });
  });

  describe('create_credential', () => {
    it('should create credential with validation', async () => {
      const mockCredential = {
        id: '123',
        name: 'Test GitHub',
        type: 'githubApi',
        data: { accessToken: 'test_token' },
      };
      vi.mocked(credentialService.createCredential).mockResolvedValue(mockCredential);

      const result = await handleCredentialTool('create_credential', {
        name: 'Test GitHub',
        type: 'githubApi',
        data: { accessToken: 'test_token' },
      });

      expect(credentialService.createCredential).toHaveBeenCalledWith({
        name: 'Test GitHub',
        type: 'githubApi',
        data: { accessToken: 'test_token' },
      });
      expect(result).toEqual(mockCredential);
    });

    it('should validate required parameters', async () => {
      await expect(
        handleCredentialTool('create_credential', { name: 'Test' })
      ).rejects.toThrow('Missing required parameters');
    });

    it('should handle validation errors', async () => {
      vi.mocked(credentialService.createCredential).mockRejectedValue(
        new Error('Validation failed: Missing required field: accessToken')
      );

      await expect(
        handleCredentialTool('create_credential', {
          name: 'Incomplete',
          type: 'githubApi',
          data: {},
        })
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('update_credential', () => {
    it('should update credential', async () => {
      const mockUpdated = {
        id: '123',
        name: 'Updated GitHub',
        type: 'githubApi',
      };
      vi.mocked(credentialService.updateCredential).mockResolvedValue(mockUpdated);

      const result = await handleCredentialTool('update_credential', {
        id: '123',
        name: 'Updated GitHub',
      });

      expect(credentialService.updateCredential).toHaveBeenCalledWith('123', {
        name: 'Updated GitHub',
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should validate required id parameter', async () => {
      await expect(
        handleCredentialTool('update_credential', { name: 'Test' })
      ).rejects.toThrow('Missing required parameters: id');
    });
  });

  describe('delete_credential', () => {
    it('should delete credential', async () => {
      vi.mocked(credentialService.deleteCredential).mockResolvedValue(undefined);

      const result = await handleCredentialTool('delete_credential', {
        id: '123',
      });

      expect(credentialService.deleteCredential).toHaveBeenCalledWith('123', false);
      expect(result).toEqual({
        success: true,
        message: 'Credential 123 deleted successfully',
      });
    });

    it('should support force delete', async () => {
      vi.mocked(credentialService.deleteCredential).mockResolvedValue(undefined);

      await handleCredentialTool('delete_credential', {
        id: '123',
        force: true,
      });

      expect(credentialService.deleteCredential).toHaveBeenCalledWith('123', true);
    });

    it('should handle in-use credential error', async () => {
      vi.mocked(credentialService.deleteCredential).mockRejectedValue(
        new Error('Credential is used by 2 workflow(s): 1, 2. Use force=true to delete anyway.')
      );

      await expect(
        handleCredentialTool('delete_credential', { id: '123' })
      ).rejects.toThrow('Credential is used by');
    });

    it('should validate required id parameter', async () => {
      await expect(
        handleCredentialTool('delete_credential', {})
      ).rejects.toThrow('Missing required parameters: id');
    });
  });

  describe('test_credential', () => {
    it('should test credential validity', async () => {
      const mockTestResult = {
        valid: true,
        message: 'Successfully connected to githubApi',
        testedAt: '2026-02-11T06:00:00.000Z',
      };
      vi.mocked(credentialService.testCredential).mockResolvedValue(mockTestResult);

      const result = await handleCredentialTool('test_credential', {
        credentialId: '123',
      });

      expect(credentialService.testCredential).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockTestResult);
    });

    it('should handle failed credential test', async () => {
      const mockTestResult = {
        valid: false,
        message: 'Connection failed: Invalid token',
        testedAt: '2026-02-11T06:00:00.000Z',
      };
      vi.mocked(credentialService.testCredential).mockResolvedValue(mockTestResult);

      const result = await handleCredentialTool('test_credential', {
        credentialId: '123',
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('failed');
    });

    it('should validate required credentialId parameter', async () => {
      await expect(
        handleCredentialTool('test_credential', {})
      ).rejects.toThrow('Missing required parameters: credentialId');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown tool', async () => {
      await expect(
        handleCredentialTool('unknown_tool', {})
      ).rejects.toThrow('Unknown credential tool: unknown_tool');
    });

    it('should propagate service errors', async () => {
      vi.mocked(credentialService.getSchema).mockRejectedValue(
        new Error('Schema not found for invalidType')
      );

      await expect(
        handleCredentialTool('get_credential_schema', {
          credentialType: 'invalidType',
        })
      ).rejects.toThrow('Schema not found');
    });
  });
});
