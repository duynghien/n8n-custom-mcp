import { describe, it, expect } from 'vitest';
import {
  cleanWorkflowForImport,
  stripCredentialsFromWorkflow,
  stripSensitiveFields,
} from '../../utils/workflow-cleaner.js';

describe('workflow-cleaner', () => {
  describe('cleanWorkflowForImport', () => {
    it('should remove old IDs', () => {
      const workflow = { id: '123', name: 'Test', nodes: [] };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.id).toBeUndefined();
    });

    it('should set active to false', () => {
      const workflow = { active: true, nodes: [] };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.active).toBe(false);
    });

    it('should generate new node IDs', () => {
      const workflow = {
        nodes: [{ id: 'old-1', type: 'Set' }, { id: 'old-2', type: 'HTTP' }],
      };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.nodes[0].id).not.toBe('old-1');
      expect(cleaned.nodes[1].id).not.toBe('old-2');
      expect(cleaned.nodes[0].id).toMatch(/^node-/);
    });

    it('should remove versionId, staticData, pinData', () => {
      const workflow = {
        versionId: 'v1',
        staticData: { lastRun: '2023' },
        pinData: { node: [{ data: {} }] },
        nodes: []
      };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.versionId).toBeUndefined();
      expect(cleaned.staticData).toBeUndefined();
      expect(cleaned.pinData).toBeUndefined();
    });

    it('should remove timestamps', () => {
      const workflow = {
        createdAt: '2023-01-01',
        updatedAt: '2023-01-02',
        nodes: []
      };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.createdAt).toBeUndefined();
      expect(cleaned.updatedAt).toBeUndefined();
    });

    it('should handle empty workflow', () => {
      const cleaned = cleanWorkflowForImport(null);
      expect(cleaned.name).toBe('Untitled');
      expect(cleaned.nodes).toEqual([]);
    });

    it('should preserve connections if they exist', () => {
      const workflow = {
        nodes: [],
        connections: { 'node-1': { main: [[]] } }
      };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.connections).toEqual(workflow.connections);
    });

    it('should handle undefined nodes/connections', () => {
      const workflow = { name: 'Test' };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.nodes).toEqual([]);
    });

    it('should produce unique IDs for each node even with same input IDs', () => {
      const workflow = {
        nodes: [{ id: 'a', type: 'Set' }, { id: 'a', type: 'Set' }]
      };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.nodes[0].id).not.toBe(cleaned.nodes[1].id);
    });

    it('should maintain node types and parameters', () => {
      const workflow = {
        nodes: [{ id: '1', type: 'n8n-nodes-base.set', parameters: { values: {} } }]
      };
      const cleaned = cleanWorkflowForImport(workflow);
      expect(cleaned.nodes[0].type).toBe('n8n-nodes-base.set');
      expect(cleaned.nodes[0].parameters).toEqual({ values: {} });
    });
  });

  describe('stripCredentialsFromWorkflow', () => {
    it('should remove credentials from nodes', () => {
      const workflow = {
        nodes: [
          { id: '1', type: 'GitHub', credentials: { githubApi: { id: 'cred-1' } } },
          { id: '2', type: 'NoCred' }
        ],
      };
      const cleaned = stripCredentialsFromWorkflow(workflow);
      expect(cleaned.nodes[0].credentials).toBeUndefined();
      expect(cleaned.nodes[1].credentials).toBeUndefined();
    });

    it('should handle null workflow', () => {
      expect(stripCredentialsFromWorkflow(null)).toBeNull();
    });

    it('should handle workflow without nodes', () => {
      const workflow = { name: 'Empty' };
      const cleaned = stripCredentialsFromWorkflow(workflow);
      expect(cleaned.nodes).toEqual([]);
    });

    it('should not affect other node properties', () => {
      const workflow = {
        nodes: [{ id: '1', type: 'Set', parameters: { x: 1 }, credentials: { a: 1 } }]
      };
      const cleaned = stripCredentialsFromWorkflow(workflow);
      expect(cleaned.nodes[0].parameters).toEqual({ x: 1 });
      expect(cleaned.nodes[0].id).toBe('1');
    });
  });

  describe('stripSensitiveFields', () => {
    it('should remove execution and instance data', () => {
      const workflow = {
        id: '123',
        versionId: 'v1',
        staticData: {},
        pinData: {},
        createdAt: '2023',
        updatedAt: '2023'
      };
      const cleaned = stripSensitiveFields(workflow);
      expect(cleaned.id).toBeUndefined();
      expect(cleaned.versionId).toBeUndefined();
      expect(cleaned.staticData).toBeUndefined();
      expect(cleaned.pinData).toBeUndefined();
      expect(cleaned.createdAt).toBeUndefined();
      expect(cleaned.updatedAt).toBeUndefined();
    });

    it('should remove webhookId from nodes', () => {
      const workflow = {
        nodes: [
          { id: '1', type: 'Webhook', webhookId: 'secret-uuid' },
          { id: '2', type: 'Set' }
        ]
      };
      const cleaned = stripSensitiveFields(workflow);
      expect(cleaned.nodes[0].webhookId).toBeUndefined();
      expect(cleaned.nodes[1].webhookId).toBeUndefined();
    });

    it('should handle null workflow', () => {
      expect(stripSensitiveFields(null)).toBeNull();
    });
  });
});
