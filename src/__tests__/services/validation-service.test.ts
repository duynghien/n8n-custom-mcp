import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '../../services/validation-service.js';
import { n8nApi } from '../../services/n8n-api-service.js';
import { credentialService } from '../../services/credential-service.js';

// Mock n8nApi and credentialService
vi.mock('../../services/n8n-api-service.js', () => ({
  n8nApi: {
    listNodeTypes: vi.fn(),
  },
}));

vi.mock('../../services/credential-service.js', () => ({
  credentialService: {
    listCredentials: vi.fn(),
    testCredential: vi.fn(),
  },
}));

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
    vi.clearAllMocks();
  });

  describe('validateWorkflowStructure()', () => {
    const validNode = {
      id: 'node-1',
      name: 'Start Node',
      type: 'n8n-nodes-base.start',
      position: [100, 100],
      parameters: {},
    };

    it('should pass a valid workflow', async () => {
      vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'n8n-nodes-base.start' }] as any);

      const workflow = {
        name: 'Valid Workflow',
        nodes: [validNode],
        connections: {},
      };

      const result = await service.validateWorkflowStructure(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const workflow = {
        // missing name
        nodes: [], // missing nodes
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_field')).toBe(true);
      expect(result.errors.some(e => e.type === 'empty_workflow')).toBe(true);
    });

    it('should detect duplicate node IDs', async () => {
      const workflow = {
        name: 'Duplicate IDs',
        nodes: [
          { ...validNode, id: 'node-1', name: 'Node 1' },
          { ...validNode, id: 'node-1', name: 'Node 2' },
        ],
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_id')).toBe(true);
    });

    it('should detect duplicate node names', async () => {
      const workflow = {
        name: 'Duplicate Names',
        nodes: [
          { ...validNode, id: 'node-1', name: 'Same Name' },
          { ...validNode, id: 'node-2', name: 'Same Name' },
        ],
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_name')).toBe(true);
    });

    it('should detect invalid node types', async () => {
      vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'n8n-nodes-base.start' }] as any);

      const workflow = {
        name: 'Invalid Type',
        nodes: [
          { ...validNode, type: 'non-existent-type' },
        ],
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_node_type')).toBe(true);
    });

    it('should detect invalid connections (source)', async () => {
      const workflow = {
        name: 'Invalid Source',
        nodes: [validNode],
        connections: {
          'non-existent-node': {
            main: [[]],
          },
        },
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_connection')).toBe(true);
    });

    it('should detect invalid connections (target)', async () => {
      const workflow = {
        name: 'Invalid Target',
        nodes: [validNode],
        connections: {
          'node-1': {
            main: [
              [
                { node: 'non-existent-node', type: 'main', index: 0 },
              ],
            ],
          },
        },
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_connection')).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const workflow = {
        name: 'Circular',
        nodes: [
          { ...validNode, id: 'node-1', name: 'Node 1' },
          { ...validNode, id: 'node-2', name: 'Node 2' },
        ],
        connections: {
          'node-1': {
            main: [[{ node: 'node-2', type: 'main', index: 0 }]],
          },
          'node-2': {
            main: [[{ node: 'node-1', type: 'main', index: 0 }]],
          },
        },
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'circular_dependency')).toBe(true);
    });

    it('should warn about missing trigger in active workflow', async () => {
      vi.mocked(n8nApi.listNodeTypes).mockResolvedValue([{ name: 'n8n-nodes-base.set' }] as any);

      const workflow = {
        name: 'No Trigger Active',
        active: true,
        nodes: [{ ...validNode, type: 'n8n-nodes-base.set' }],
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.warnings.some(w => w.type === 'missing_trigger')).toBe(true);
    });

    it('should warn about disabled nodes with connections', async () => {
      const workflow = {
        name: 'Disabled Node',
        nodes: [
          { ...validNode, id: 'node-1', name: 'Node 1', disabled: true },
          { ...validNode, id: 'node-2', name: 'Node 2' },
        ],
        connections: {
          'node-1': {
            main: [[{ node: 'node-2', type: 'main', index: 0 }]],
          },
        },
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.warnings.some(w => w.type === 'disabled_node')).toBe(true);
    });

    it('should warn if all nodes are disabled', async () => {
      const workflow = {
        name: 'All Disabled',
        nodes: [
          { ...validNode, id: 'node-1', disabled: true },
          { ...validNode, id: 'node-2', disabled: true },
        ],
      };

      const result = await service.validateWorkflowStructure(workflow as any);

      expect(result.warnings.some(w => w.type === 'all_nodes_disabled')).toBe(true);
    });
  });

  describe('validateWorkflowCredentials()', () => {
    const validNode = {
      id: 'node-1',
      name: 'HTTP Node',
      type: 'n8n-nodes-base.httpRequest',
      position: [100, 100],
      parameters: {},
      credentials: {
        httpBasicAuth: { id: 'cred-1' },
      },
    };

    it('should pass when all credentials exist', async () => {
      vi.mocked(credentialService.listCredentials).mockResolvedValue([
        { id: 'cred-1', name: 'Test Cred', type: 'httpBasicAuth' },
      ] as any);

      const workflow = {
        name: 'Valid Credentials',
        nodes: [validNode],
      };

      const result = await service.validateWorkflowCredentials(workflow as any);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect non-existent credential', async () => {
      vi.mocked(credentialService.listCredentials).mockResolvedValue([]);

      const workflow = {
        name: 'Missing Credential',
        nodes: [validNode],
      };

      const result = await service.validateWorkflowCredentials(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'credential_not_found')).toBe(true);
    });

    it('should detect credential type mismatch', async () => {
      vi.mocked(credentialService.listCredentials).mockResolvedValue([
        { id: 'cred-1', name: 'Test Cred', type: 'wrongType' },
      ] as any);

      const workflow = {
        name: 'Type Mismatch',
        nodes: [validNode],
      };

      const result = await service.validateWorkflowCredentials(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'credential_type_mismatch')).toBe(true);
    });

    it('should warn on failed credential test', async () => {
      vi.mocked(credentialService.listCredentials).mockResolvedValue([
        { id: 'cred-1', name: 'Test Cred', type: 'httpBasicAuth' },
      ] as any);
      vi.mocked(credentialService.testCredential).mockResolvedValue({
        valid: false,
        message: 'Connection failed',
        testedAt: new Date().toISOString(),
      });

      const workflow = {
        name: 'Test Credentials',
        nodes: [validNode],
      };

      const result = await service.validateWorkflowCredentials(workflow as any, true);

      expect(result.warnings.some(w => w.type === 'credential_test_failed')).toBe(true);
    });
  });

  describe('validateWorkflowExpressions()', () => {
    it('should pass valid expressions', async () => {
      const workflow = {
        name: 'Valid Expressions',
        nodes: [
          {
            id: 'node-1',
            name: 'Set Node',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {
              value: '{{ $json.name }}',
            },
          },
        ],
      };

      const result = await service.validateWorkflowExpressions(workflow as any);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect syntax errors in expressions', async () => {
      const workflow = {
        name: 'Invalid Expressions',
        nodes: [
          {
            id: 'node-1',
            name: 'Set Node',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {
              value: '{{ (1 + 2 }}', // unbalanced parentheses
            },
          },
        ],
      };

      const result = await service.validateWorkflowExpressions(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_expression' && e.message.includes('Unbalanced parentheses'))).toBe(true);
    });

    it('should detect JS syntax errors', async () => {
      const workflow = {
        name: 'JS Syntax Errors',
        nodes: [
          {
            id: 'node-1',
            name: 'Set Node',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {
              value: '{{ $json.name. }}', // trailing dot
            },
          },
        ],
      };

      const result = await service.validateWorkflowExpressions(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_expression' && e.message.includes('Syntax error'))).toBe(true);
    });

    it('should detect invalid variable references', async () => {
      const workflow = {
        name: 'Invalid Variables',
        nodes: [
          {
            id: 'node-1',
            name: 'Set Node',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {
              value: '{{ $jsn.name }}', // typo in $json
            },
          },
        ],
      };

      const result = await service.validateWorkflowExpressions(workflow as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_expression' && e.message.includes('Invalid variable reference'))).toBe(true);
    });

    it('should warn about complex expressions', async () => {
      const workflow = {
        name: 'Complex Expressions',
        nodes: [
          {
            id: 'node-1',
            name: 'Set Node',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {
              value: '{{ if($json.status === "active") { return "yes" } }}',
            },
          },
        ],
      };

      const result = await service.validateWorkflowExpressions(workflow as any);

      expect(result.warnings.some(w => w.type === 'complex_expression')).toBe(true);
    });
  });

  describe('lintWorkflow()', () => {
    it('should give perfect score for good workflow', async () => {
      const workflow = {
        name: 'Good Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Meaningful Name',
            type: 'n8n-nodes-base.httpRequest',
            position: [100, 100],
            parameters: {},
            continueOnFail: true,
          },
        ],
        connections: {},
      };

      const result = await service.lintWorkflow(workflow as any);

      expect(result.score).toBeGreaterThan(80);
    });

    it('should detect orphaned nodes', async () => {
      const workflow = {
        name: 'Orphaned Node',
        nodes: [
          {
            id: 'node-1',
            name: 'Orphaned',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {},
          },
        ],
        connections: {},
      };

      const result = await service.lintWorkflow(workflow as any);

      expect(result.issues.some(i => i.type === 'orphaned_node')).toBe(true);
    });

    it('should warn about generic node names', async () => {
      const workflow = {
        name: 'Generic Names',
        nodes: [
          {
            id: 'node-1',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            position: [100, 100],
            parameters: {},
          },
        ],
      };

      const result = await service.lintWorkflow(workflow as any);

      expect(result.issues.some(i => i.type === 'generic_name')).toBe(true);
    });

    it('should detect hardcoded secrets', async () => {
      const workflow = {
        name: 'Hardcoded Secrets',
        nodes: [
          {
            id: 'node-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [100, 100],
            parameters: {
              headerParameters: {
                parameters: [
                  { name: 'Authorization', value: 'api_key="secret123"' },
                ],
              },
            },
          },
        ],
      };

      const result = await service.lintWorkflow(workflow as any);

      expect(result.issues.some(i => i.type === 'hardcoded_secret')).toBe(true);
      expect(result.issues.some(i => i.severity === 'error')).toBe(true);
    });
  });

  describe('suggestWorkflowImprovements()', () => {
    it('should suggest Set node for HTTP requests', async () => {
      const workflow = {
        name: 'HTTP Without Set',
        nodes: [
          {
            id: 'node-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [100, 100],
            parameters: {},
          },
        ],
      };

      const result = await service.suggestWorkflowImprovements(workflow as any);

      expect(result.suggestions.some(s => s.type === 'add_set_node')).toBe(true);
    });

    it('should suggest error handling for critical nodes', async () => {
      const workflow = {
        name: 'No Error Handling',
        nodes: [
          {
            id: 'node-1',
            name: 'Database Query',
            type: 'n8n-nodes-base.postgres',
            position: [100, 100],
            parameters: {},
          },
        ],
      };

      const result = await service.suggestWorkflowImprovements(workflow as any);

      expect(result.suggestions.some(s => s.type === 'add_error_handling')).toBe(true);
      expect(result.suggestions.some(s => s.priority === 'high')).toBe(true);
    });

    it('should suggest trigger for active workflow', async () => {
      const workflow = {
        name: 'Active Without Trigger',
        active: true,
        nodes: [
          {
            id: 'node-1',
            name: 'Set',
            type: 'n8n-nodes-base.set',
            position: [100, 100],
            parameters: {},
          },
        ],
      };

      const result = await service.suggestWorkflowImprovements(workflow as any);

      expect(result.suggestions.some(s => s.type === 'add_trigger')).toBe(true);
    });

    it('should return empty suggestions for optimal workflow', async () => {
      const workflow = {
        name: 'Optimal Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Schedule Trigger',
            type: 'n8n-nodes-base.scheduleTrigger',
            position: [100, 100],
            parameters: {},
          },
          {
            id: 'node-2',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [200, 100],
            parameters: {},
            credentials: { httpBasicAuth: { id: 'cred-1' } },
            onError: 'continueErrorOutput',
          },
          {
            id: 'node-3',
            name: 'Transform Data',
            type: 'n8n-nodes-base.set',
            position: [300, 100],
            parameters: {},
          },
        ],
        connections: {
          'node-1': { main: [[{ node: 'node-2', type: 'main', index: 0 }]] },
          'node-2': { main: [[{ node: 'node-3', type: 'main', index: 0 }]] },
        },
      };

      const result = await service.suggestWorkflowImprovements(workflow as any);

      expect(result.suggestions).toHaveLength(0);
      expect(result.summary).toContain('well-optimized');
    });
  });
});
