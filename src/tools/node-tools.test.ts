import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nodeTools, handleNodeTool } from '../tools/node-tools.js';
import { n8nApi } from '../services/n8n-api-service.js';

// Mock n8nApi
vi.mock('../services/n8n-api-service.js', () => ({
  n8nApi: {
    getNodeSchema: vi.fn(),
  },
}));

describe('nodeTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should define get_node_schema tool', () => {
    const tool = nodeTools.find(t => t.name === 'get_node_schema');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Get the parameter schema');
  });

  it('should handle get_node_schema call', async () => {
    const mockSchema = {
      displayName: 'Test Node',
      name: 'testNode',
      icon: 'fa:test',
      group: ['test'],
      version: 1,
      description: 'A test node',
      defaults: { name: 'Test Node' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Prop 1',
          name: 'prop1',
          type: 'string',
          displayOptions: { show: { prop2: [true] } }
        }
      ]
    };

    (n8nApi.getNodeSchema as any).mockResolvedValue(mockSchema);

    const result = await handleNodeTool('get_node_schema', { nodeName: 'testNode' });

    expect(n8nApi.getNodeSchema).toHaveBeenCalledWith('testNode');
    expect(result).toEqual({
      displayName: 'Test Node',
      name: 'testNode',
      description: 'A test node',
      properties: [
        {
          displayName: 'Prop 1',
          name: 'prop1',
          type: 'string',
        }
      ]
    });
  });

  it('should throw error for unknown tool', async () => {
    await expect(handleNodeTool('unknown_tool', {})).rejects.toThrow('Unknown node tool: unknown_tool');
  });
});
