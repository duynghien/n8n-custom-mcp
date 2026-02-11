import type { N8nNode, N8nConnection } from '../types/n8n-types.js';

/**
 * Graph analysis utilities for workflow validation
 * Handles circular dependency detection and connection validation
 */

/**
 * Type guard to check if a value is a valid N8nConnection
 */
function isValidConnection(value: any): value is N8nConnection {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.node === 'string' &&
    typeof value.type === 'string' &&
    typeof value.index === 'number'
  );
}

/**
 * Detect circular dependencies in workflow graph using Depth-First Search
 *
 * @param nodes - Array of workflow nodes
 * @param connections - Workflow connections object
 * @param maxDepth - Maximum recursion depth (default: 1000)
 * @returns True if circular dependency detected
 *
 * @example
 * const hasCycle = detectCircularDependencies(
 *   [{ id: '1', ... }, { id: '2', ... }],
 *   { '1': { main: [[{ node: '2', ... }]] } }
 * );
 */
export function detectCircularDependencies(
  nodes: N8nNode[],
  connections: Record<string, any>,
  maxDepth: number = 1000
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string, depth: number = 0): boolean => {
    // Prevent stack overflow on very large graphs
    if (depth > maxDepth) {
      throw new Error(`Maximum graph depth (${maxDepth}) exceeded - possible infinite loop`);
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outputs = connections[nodeId];
    if (outputs) {
      for (const inputType of Object.values(outputs)) {
        if (Array.isArray(inputType)) {
          for (const outputIndex of inputType) {
            if (Array.isArray(outputIndex)) {
              for (const connection of outputIndex) {
                // Validate connection has required node field
                if (isValidConnection(connection)) {
                  const targetId = connection.node;

                  if (!visited.has(targetId)) {
                    if (dfs(targetId, depth + 1)) return true;
                  } else if (recursionStack.has(targetId)) {
                    return true; // Cycle detected
                  }
                }
              }
            }
          }
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Validate workflow connections structure
 *
 * @param connections - Workflow connections object
 * @param nodeIds - Set of valid node IDs
 * @returns Array of invalid connection errors
 */
export function validateConnections(
  connections: Record<string, any>,
  nodeIds: Set<string>
): Array<{ sourceId?: string; targetId?: string; message: string }> {
  const errors: Array<{ sourceId?: string; targetId?: string; message: string }> = [];

  if (!connections) return errors;

  for (const [sourceId, outputs] of Object.entries(connections)) {
    // Check source node exists
    if (!nodeIds.has(sourceId)) {
      errors.push({
        sourceId,
        message: `Connection references non-existent source node: ${sourceId}`,
      });
      continue;
    }

    // Check connection structure is valid before traversing
    if (!outputs || typeof outputs !== 'object') {
      errors.push({
        sourceId,
        message: `Invalid connection structure for node: ${sourceId}`,
      });
      continue;
    }

    // Check target nodes exist and validate connection structure
    for (const [outputType, inputTypeValue] of Object.entries(outputs)) {
      if (!Array.isArray(inputTypeValue)) {
        errors.push({
          sourceId,
          message: `Connection output type '${outputType}' must be an array`,
        });
        continue;
      }

      for (let i = 0; i < inputTypeValue.length; i++) {
        const outputIndex = inputTypeValue[i];

        if (!Array.isArray(outputIndex)) {
          errors.push({
            sourceId,
            message: `Connection output[${i}] for type '${outputType}' must be an array`,
          });
          continue;
        }

        for (const connection of outputIndex) {
          // Validate connection object structure
          if (!isValidConnection(connection)) {
            errors.push({
              sourceId,
              message: `Invalid connection structure in output[${i}]: missing required fields (node, type, index)`,
            });
            continue;
          }

          // Validate target node exists
          if (!nodeIds.has(connection.node)) {
            errors.push({
              sourceId,
              targetId: connection.node,
              message: `Connection references non-existent target node: ${connection.node}`,
            });
          }
        }
      }
    }
  }

  return errors;
}
