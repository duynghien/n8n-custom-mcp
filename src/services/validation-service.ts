import { n8nApi } from './n8n-api-service.js';
import type { N8nWorkflow, N8nNode } from '../types/n8n-types.js';
import { detectCircularDependencies, validateConnections } from '../utils/workflow-graph-analyzer.js';

interface ValidationError {
  type: string;
  message: string;
  severity: 'error' | 'warning';
  nodeId?: string;
  nodeIds?: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Service for validating workflow structures before deployment
 * Catches errors early to prevent broken workflows
 */
export class ValidationService {
  /**
   * Validate workflow structure with comprehensive checks
   *
   * Performs 8 validation checks:
   * 1. Required fields (name, nodes)
   * 2. Node ID uniqueness
   * 3. Node name uniqueness (n8n requirement)
   * 4. Node types validity (via list_node_types)
   * 5. Connections reference valid node IDs
   * 6. Trigger node check (for active workflows)
   * 7. Circular dependencies (DAG validation)
   * 8. Disabled nodes with connections (warning)
   *
   * @param workflow - Workflow object to validate
   * @returns Validation result with errors and warnings
   */
  async validateWorkflowStructure(workflow: Partial<N8nWorkflow>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. Required fields check
    if (!workflow.name) {
      errors.push({
        type: 'missing_field',
        message: 'Workflow name is required',
        severity: 'error',
      });
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push({
        type: 'empty_workflow',
        message: 'Workflow must have at least one node',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // 2. Node ID uniqueness
    const nodeIds = new Set<string>();
    const duplicateIds: string[] = [];
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        duplicateIds.push(node.id);
      }
      nodeIds.add(node.id);
    }
    if (duplicateIds.length > 0) {
      errors.push({
        type: 'duplicate_id',
        message: `Duplicate node IDs found: ${duplicateIds.join(', ')}`,
        severity: 'error',
      });
    }

    // 3. Node name uniqueness (n8n requirement)
    const nodeNames = new Map<string, string[]>();
    for (const node of workflow.nodes) {
      if (!nodeNames.has(node.name)) {
        nodeNames.set(node.name, []);
      }
      nodeNames.get(node.name)!.push(node.id);
    }

    for (const [name, ids] of nodeNames.entries()) {
      if (ids.length > 1) {
        errors.push({
          type: 'duplicate_name',
          message: `Node name '${name}' is duplicated`,
          nodeIds: ids,
          severity: 'error',
        });
      }
    }

    // 4. Node types validation
    try {
      const nodeTypes = await n8nApi.listNodeTypes();
      const validTypes = new Set(nodeTypes.map((t: any) => t.name));

      for (const node of workflow.nodes) {
        if (!validTypes.has(node.type)) {
          errors.push({
            type: 'invalid_node_type',
            message: `Node type '${node.type}' not found on this n8n instance`,
            nodeId: node.id,
            severity: 'error',
          });
        }
      }
    } catch (error) {
      warnings.push({
        type: 'node_types_check_failed',
        message: 'Could not validate node types (n8n API unavailable)',
        severity: 'warning',
      });
    }

    // 5. Connections validation
    if (workflow.connections) {
      const connectionErrors = validateConnections(workflow.connections, nodeIds);
      errors.push(...connectionErrors.map(err => ({
        type: 'invalid_connection',
        message: err.message,
        severity: 'error' as const,
        nodeId: err.sourceId,
      })));
    }

    // 6. Trigger node check (for active workflows)
    const hasTrigger = workflow.nodes.some((node: N8nNode) =>
      node.type.toLowerCase().includes('trigger') ||
      node.type.toLowerCase().includes('webhook')
    );

    if (!hasTrigger && workflow.active) {
      warnings.push({
        type: 'missing_trigger',
        message: 'Workflow needs at least one trigger node to be activated',
        severity: 'warning',
      });
    }

    // 7. Circular dependency check (basic DAG validation)
    try {
      const circular = detectCircularDependencies(workflow.nodes, workflow.connections || {});
      if (circular) {
        errors.push({
          type: 'circular_dependency',
          message: 'Circular dependency detected in workflow connections',
          severity: 'error',
        });
      }
    } catch (error) {
      errors.push({
        type: 'graph_too_deep',
        message: error instanceof Error ? error.message : 'Graph analysis failed',
        severity: 'error',
      });
    }

    // 8. Disabled nodes with connections (warning)
    for (const node of workflow.nodes) {
      if (node.disabled && workflow.connections?.[node.id]) {
        warnings.push({
          type: 'disabled_node',
          message: `Node '${node.name}' is disabled but has connections`,
          nodeId: node.id,
          severity: 'warning',
        });
      }
    }

    // Check if all nodes are disabled
    const allDisabled = workflow.nodes.every((node: N8nNode) => node.disabled);
    if (allDisabled && workflow.nodes.length > 0) {
      warnings.push({
        type: 'all_nodes_disabled',
        message: 'All nodes are disabled - workflow won\'t execute',
        severity: 'warning',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Export singleton instance
export const validationService = new ValidationService();
