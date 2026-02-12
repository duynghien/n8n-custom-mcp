import { describe, it, expect } from 'vitest';
import {
  detectCircularDependencies,
  validateConnections,
} from '../../utils/workflow-graph-analyzer.js';
import type { N8nNode } from '../../types/n8n-types.js';

describe('detectCircularDependencies', () => {
  const createNode = (id: string): N8nNode => ({
    id,
    name: `Node ${id}`,
    type: 'n8n-nodes-base.set',
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  });

  it('should return false for workflow without cycles', () => {
    const nodes = [createNode('1'), createNode('2'), createNode('3')];
    const connections = {
      '1': { main: [[{ node: '2', type: 'main', index: 0 }]] },
      '2': { main: [[{ node: '3', type: 'main', index: 0 }]] },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(false);
  });

  it('should detect simple circular dependency (A→B→A)', () => {
    const nodes = [createNode('1'), createNode('2')];
    const connections = {
      '1': { main: [[{ node: '2', type: 'main', index: 0 }]] },
      '2': { main: [[{ node: '1', type: 'main', index: 0 }]] },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(true);
  });

  it('should detect self-loop (node connects to itself)', () => {
    const nodes = [createNode('1')];
    const connections = {
      '1': { main: [[{ node: '1', type: 'main', index: 0 }]] },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(true);
  });

  it('should detect complex multi-path cycle (A→B→C→A)', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')];
    const connections = {
      A: { main: [[{ node: 'B', type: 'main', index: 0 }]] },
      B: { main: [[{ node: 'C', type: 'main', index: 0 }]] },
      C: { main: [[{ node: 'A', type: 'main', index: 0 }]] },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(true);
  });

  it('should detect cycle with multiple entry points', () => {
    const nodes = [
      createNode('1'),
      createNode('2'),
      createNode('3'),
      createNode('4'),
    ];
    const connections = {
      '1': { main: [[{ node: '3', type: 'main', index: 0 }]] },
      '2': { main: [[{ node: '3', type: 'main', index: 0 }]] },
      '3': { main: [[{ node: '4', type: 'main', index: 0 }]] },
      '4': { main: [[{ node: '3', type: 'main', index: 0 }]] }, // Cycle: 3→4→3
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(true);
  });

  it('should handle empty connections object', () => {
    const nodes = [createNode('1'), createNode('2')];
    const connections = {};

    expect(detectCircularDependencies(nodes, connections)).toBe(false);
  });

  it('should handle disconnected graph components', () => {
    const nodes = [
      createNode('1'),
      createNode('2'),
      createNode('3'),
      createNode('4'),
    ];
    const connections = {
      '1': { main: [[{ node: '2', type: 'main', index: 0 }]] },
      '3': { main: [[{ node: '4', type: 'main', index: 0 }]] },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(false);
  });

  it('should handle nodes with multiple outputs', () => {
    const nodes = [createNode('1'), createNode('2'), createNode('3')];
    const connections = {
      '1': {
        main: [
          [
            { node: '2', type: 'main', index: 0 },
            { node: '3', type: 'main', index: 0 },
          ],
        ],
      },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(false);
  });

  it('should throw error when exceeding max depth', () => {
    // Create a deep chain exceeding maxDepth
    const maxDepth = 5;
    const nodes = Array.from({ length: 10 }, (_, i) => createNode(`${i}`));
    const connections: Record<string, any> = {};

    // Create linear chain: 0→1→2→3→...→9
    for (let i = 0; i < 9; i++) {
      connections[`${i}`] = {
        main: [[{ node: `${i + 1}`, type: 'main', index: 0 }]],
      };
    }

    expect(() => detectCircularDependencies(nodes, connections, maxDepth)).toThrow(
      'Maximum graph depth'
    );
  });

  it('should handle invalid connection structure gracefully', () => {
    const nodes = [createNode('1'), createNode('2')];
    const connections = {
      '1': { main: [[{ node: null }]] }, // Invalid connection
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(false);
  });

  it('should handle diamond-shaped graph without cycle', () => {
    const nodes = [
      createNode('1'),
      createNode('2'),
      createNode('3'),
      createNode('4'),
    ];
    const connections = {
      '1': {
        main: [
          [
            { node: '2', type: 'main', index: 0 },
            { node: '3', type: 'main', index: 0 },
          ],
        ],
      },
      '2': { main: [[{ node: '4', type: 'main', index: 0 }]] },
      '3': { main: [[{ node: '4', type: 'main', index: 0 }]] },
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(false);
  });

  it('should detect cycle in complex graph with branches', () => {
    const nodes = [
      createNode('A'),
      createNode('B'),
      createNode('C'),
      createNode('D'),
      createNode('E'),
    ];
    const connections = {
      A: { main: [[{ node: 'B', type: 'main', index: 0 }]] },
      B: {
        main: [
          [
            { node: 'C', type: 'main', index: 0 },
            { node: 'D', type: 'main', index: 0 },
          ],
        ],
      },
      C: { main: [[{ node: 'E', type: 'main', index: 0 }]] },
      D: { main: [[{ node: 'E', type: 'main', index: 0 }]] },
      E: { main: [[{ node: 'B', type: 'main', index: 0 }]] }, // Cycle: B→...→E→B
    };

    expect(detectCircularDependencies(nodes, connections)).toBe(true);
  });
});

describe('validateConnections', () => {
  it('should return empty array for valid connections', () => {
    const nodeIds = new Set(['1', '2', '3']);
    const connections = {
      '1': { main: [[{ node: '2', type: 'main', index: 0 }]] },
      '2': { main: [[{ node: '3', type: 'main', index: 0 }]] },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(0);
  });

  it('should detect non-existent source node', () => {
    const nodeIds = new Set(['1', '2']);
    const connections = {
      '999': { main: [[{ node: '2', type: 'main', index: 0 }]] },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(1);
    expect(errors[0].sourceId).toBe('999');
    expect(errors[0].message).toContain('non-existent source node');
  });

  it('should detect non-existent target node', () => {
    const nodeIds = new Set(['1', '2']);
    const connections = {
      '1': { main: [[{ node: '999', type: 'main', index: 0 }]] },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(1);
    expect(errors[0].targetId).toBe('999');
    expect(errors[0].message).toContain('non-existent target node');
  });

  it('should handle null/undefined connections', () => {
    const nodeIds = new Set(['1']);
    const errors = validateConnections(null as any, nodeIds);
    expect(errors).toHaveLength(0);
  });

  it('should detect invalid connection structure', () => {
    const nodeIds = new Set(['1']);
    const connections = {
      '1': 'invalid', // Should be object
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Invalid connection structure');
  });

  it('should handle connections with multiple outputs', () => {
    const nodeIds = new Set(['1', '2', '3']);
    const connections = {
      '1': {
        main: [
          [
            { node: '2', type: 'main', index: 0 },
            { node: '3', type: 'main', index: 0 },
          ],
        ],
      },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(0);
  });

  it('should detect multiple invalid targets', () => {
    const nodeIds = new Set(['1']);
    const connections = {
      '1': {
        main: [
          [
            { node: '999', type: 'main', index: 0 },
            { node: '888', type: 'main', index: 0 },
          ],
        ],
      },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(2);
    expect(errors[0].targetId).toBe('999');
    expect(errors[1].targetId).toBe('888');
  });

  it('should handle empty connections object', () => {
    const nodeIds = new Set(['1', '2']);
    const connections = {};

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(0);
  });

  it('should detect invalid connection entries', () => {
    const nodeIds = new Set(['1', '2']);
    const connections = {
      '1': {
        main: [[{ node: null }, { node: '2', type: 'main', index: 0 }]],
      },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(1); // Should report invalid index (missing index field)
    expect(errors[0].message).toContain('Invalid connection index');
  });

  it('should validate complex nested connection structure', () => {
    const nodeIds = new Set(['1', '2', '3', '4']);
    const connections = {
      '1': {
        main: [
          [{ node: '2', type: 'main', index: 0 }],
          [{ node: '3', type: 'main', index: 0 }],
        ],
        ai: [[{ node: '4', type: 'ai', index: 0 }]],
      },
    };

    const errors = validateConnections(connections, nodeIds);
    expect(errors).toHaveLength(0);
  });
});
