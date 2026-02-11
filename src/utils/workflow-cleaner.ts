/**
 * Utility functions for cleaning and sanitizing workflow data
 * Used for template imports/exports
 */

import { randomUUID } from 'crypto';

/**
 * Generate unique node ID using UUID
 */
function generateNodeId(): string {
  return `node-${randomUUID()}`;
}

/**
 * Clean workflow for fresh import
 * Removes old IDs, cached data, pin data
 */
export function cleanWorkflowForImport(workflow: any): any {
  if (!workflow) {
    return { name: 'Untitled', nodes: [], connections: {} };
  }

  return {
    ...workflow,
    id: undefined,
    active: false,
    staticData: undefined,
    pinData: undefined,
    versionId: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    nodes: workflow.nodes?.map((node: any) => ({
      ...node,
      id: generateNodeId(),
    })) || [],
  };
}

/**
 * Strip credentials from workflow for secure export
 * Removes all credential references
 */
export function stripCredentialsFromWorkflow(workflow: any): any {
  if (!workflow) {
    return workflow;
  }

  return {
    ...workflow,
    nodes: workflow.nodes?.map((node: any) => ({
      ...node,
      credentials: undefined,
    })) || [],
  };
}

/**
 * Strip sensitive fields from workflow
 * Removes execution history, webhook URLs, instance-specific data
 */
export function stripSensitiveFields(workflow: any): any {
  if (!workflow) {
    return workflow;
  }

  const cleaned = { ...workflow };

  // Remove execution data
  delete cleaned.staticData;
  delete cleaned.pinData;

  // Remove n8n instance-specific data
  delete cleaned.id;
  delete cleaned.versionId;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;

  // Remove webhook URLs and instance-specific node data
  if (cleaned.nodes) {
    cleaned.nodes = cleaned.nodes.map((node: any) => {
      const cleanNode = { ...node };
      if (node.webhookId) {
        delete cleanNode.webhookId;
      }
      return cleanNode;
    });
  }

  return cleaned;
}
