import type { N8nNode, N8nConnection } from '../types/n8n-types.js';

/**
 * Graph analysis utilities for workflow validation
 * Handles circular dependency detection and connection validation
 */

/**
 * Node types that can accept multiple inputs to same index
 * These are merge-capable nodes in n8n
 */
const MULTI_INPUT_NODES = new Set([
  'n8n-nodes-base.merge',
  'n8n-nodes-base.aggregate',
  'n8n-nodes-base.summarize',
  'n8n-nodes-base.itemLists',
  'n8n-nodes-base.compareDatasets',
]);

/**
 * Valid connection types in n8n
 */
const VALID_CONNECTION_TYPES = new Set([
  'main',
  'ai_agent',
  'ai_chain',
  'ai_document',
  'ai_embedding',
  'ai_languageModel',
  'ai_memory',
  'ai_outputParser',
  'ai_retriever',
  'ai_textSplitter',
  'ai_tool',
  'ai_vectorStore',
]);

/**
 * Type guard to check if a value is a valid N8nConnection
 * Enhanced with index validation
 */
function isValidConnection(value: any): value is N8nConnection {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.node === 'string' &&
    value.node.length > 0 &&              // Non-empty node ID
    typeof value.type === 'string' &&
    typeof value.index === 'number' &&
    value.index >= 0 &&                   // Non-negative index
    Number.isInteger(value.index)         // Integer check
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
          if (!connection || typeof connection !== 'object') {
            errors.push({
              sourceId,
              message: `Invalid connection object in output[${i}]`,
            });
            continue;
          }

          // Check for self-loop
          if (connection.node === sourceId) {
            errors.push({
              sourceId,
              targetId: sourceId,
              message: `Self-loop detected: node '${sourceId}' connects to itself`,
            });
            continue;
          }

          // Validate index is non-negative integer
          if (typeof connection.index !== 'number' || connection.index < 0) {
            errors.push({
              sourceId,
              targetId: connection.node,
              message: `Invalid connection index: ${connection.index} (must be >= 0)`,
            });
            continue;
          }

          if (!Number.isInteger(connection.index)) {
            errors.push({
              sourceId,
              targetId: connection.node,
              message: `Connection index must be integer, got: ${connection.index}`,
            });
            continue;
          }

          // Validate using enhanced type guard
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

/**
 * Detect self-loop connections in workflow
 * Returns array of node IDs that have self-loops
 */
export function detectSelfLoops(
  connections: Record<string, any>
): string[] {
  const selfLoops: string[] = [];

  if (!connections) return selfLoops;

  for (const [sourceId, outputs] of Object.entries(connections)) {
    if (!outputs || typeof outputs !== 'object') continue;

    for (const inputTypeValue of Object.values(outputs)) {
      if (!Array.isArray(inputTypeValue)) continue;

      for (const outputIndex of inputTypeValue) {
        if (!Array.isArray(outputIndex)) continue;

        for (const connection of outputIndex) {
          if (connection?.node === sourceId) {
            selfLoops.push(sourceId);
            break;
          }
        }
      }
    }
  }

  return [...new Set(selfLoops)]; // Deduplicate
}

/**
 * Validate all connection indices are non-negative integers
 * Returns array of invalid connections
 */
export function validateConnectionIndices(
  connections: Record<string, any>
): Array<{ sourceId: string; targetId: string; index: any }> {
  const invalid: Array<{ sourceId: string; targetId: string; index: any }> = [];

  if (!connections) return invalid;

  for (const [sourceId, outputs] of Object.entries(connections)) {
    if (!outputs || typeof outputs !== 'object') continue;

    for (const inputTypeValue of Object.values(outputs)) {
      if (!Array.isArray(inputTypeValue)) continue;

      for (const outputIndex of inputTypeValue) {
        if (!Array.isArray(outputIndex)) continue;

        for (const connection of outputIndex) {
          if (!connection || typeof connection !== 'object') continue;

          const index = connection.index;
          if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
            invalid.push({
              sourceId,
              targetId: connection.node || 'unknown',
              index,
            });
          }
        }
      }
    }
  }

  return invalid;
}

/**
 * Detect multiple connections to same input slot
 * Returns warnings for nodes that might have data overwrites
 */
export function detectMultipleInputConnections(
  connections: Record<string, any>,
  nodeTypes: Map<string, string> // nodeId -> nodeType
): Array<{
  targetId: string;
  inputType: string;
  inputIndex: number;
  connectionCount: number;
  sources: string[];
}> {
  const warnings: Array<{
    targetId: string;
    inputType: string;
    inputIndex: number;
    connectionCount: number;
    sources: string[];
  }> = [];

  // Track: targetId:inputType:inputIndex -> [sourceIds]
  const inputConnections = new Map<string, string[]>();

  if (!connections) return warnings;

  for (const [sourceId, outputs] of Object.entries(connections)) {
    if (!outputs || typeof outputs !== 'object') continue;

    for (const [outputType, outputIndices] of Object.entries(outputs)) {
      if (!Array.isArray(outputIndices)) continue;

      for (const outputIndex of outputIndices) {
        if (!Array.isArray(outputIndex)) continue;

        for (const connection of outputIndex) {
          if (!connection?.node || typeof connection.index !== 'number') continue;

          const targetId = connection.node;
          const inputType = connection.type || 'main';
          const inputIndex = connection.index;

          const key = `${targetId}:${inputType}:${inputIndex}`;

          if (!inputConnections.has(key)) {
            inputConnections.set(key, []);
          }
          inputConnections.get(key)!.push(sourceId);
        }
      }
    }
  }

  // Check for multiple connections
  for (const [key, sources] of inputConnections) {
    if (sources.length > 1) {
      const [targetId, inputType, inputIndexStr] = key.split(':');
      const inputIndex = parseInt(inputIndexStr, 10);

      // Check if target node allows multiple inputs
      const nodeType = nodeTypes.get(targetId);
      if (nodeType && MULTI_INPUT_NODES.has(nodeType)) {
        continue; // Skip merge-capable nodes
      }

      warnings.push({
        targetId,
        inputType,
        inputIndex,
        connectionCount: sources.length,
        sources,
      });
    }
  }

  return warnings;
}

/**
 * Validate connection types are valid n8n types
 */
export function validateConnectionTypes(
  connections: Record<string, any>
): Array<{
  sourceId: string;
  targetId: string;
  invalidType: string;
}> {
  const errors: Array<{
    sourceId: string;
    targetId: string;
    invalidType: string;
  }> = [];

  if (!connections) return errors;

  for (const [sourceId, outputs] of Object.entries(connections)) {
    if (!outputs || typeof outputs !== 'object') continue;

    // Check output type keys
    for (const [outputType, outputIndices] of Object.entries(outputs)) {
      if (!VALID_CONNECTION_TYPES.has(outputType)) {
        errors.push({
          sourceId,
          targetId: 'unknown',
          invalidType: `output type '${outputType}'`,
        });
        continue;
      }

      if (!Array.isArray(outputIndices)) continue;

      for (const outputIndex of outputIndices) {
        if (!Array.isArray(outputIndex)) continue;

        for (const connection of outputIndex) {
          if (!connection) continue;

          // Check connection.type
          const connType = connection.type || 'main';
          if (!VALID_CONNECTION_TYPES.has(connType)) {
            errors.push({
              sourceId,
              targetId: connection.node || 'unknown',
              invalidType: `connection type '${connType}'`,
            });
          }
        }
      }
    }
  }

  return errors;
}
