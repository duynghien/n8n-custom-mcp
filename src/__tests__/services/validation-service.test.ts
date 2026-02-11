import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '../../services/validation-service.js';
import { n8nApi } from '../../services/n8n-api-service.js';

// Mock n8nApi
vi.mock('../../services/n8n-api-service.js', () => ({
  n8nApi: {
    listNodeTypes: vi.fn(),
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
});
