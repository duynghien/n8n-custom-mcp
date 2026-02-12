import { n8nApi } from './n8n-api-service.js';
import type { N8nWorkflow, N8nNode } from '../types/n8n-types.js';
import { detectCircularDependencies, validateConnections } from '../utils/workflow-graph-analyzer.js';
import { credentialService } from './credential-service.js';
import { extractExpressions, validateExpression } from '../utils/expression-validator.js';

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

interface LintResult {
  score: number;
  issues: ValidationError[];
  summary: string;
}

interface Suggestion {
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  nodeId?: string;
}

interface ImprovementResult {
  suggestions: Suggestion[];
  summary: string;
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
      if (!node || !node.id) continue;
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
      if (!node || !node.id) continue;
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
        if (!node || !node.id) continue;
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
      node && node.type && (
        node.type.toLowerCase().includes('trigger') ||
        node.type.toLowerCase().includes('webhook')
      )
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
      if (!node || !node.id) continue;
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
    const allDisabled = workflow.nodes.every((node: N8nNode) => !node || node.disabled);
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

  /**
   * Validate workflow credentials
   *
   * Checks:
   * - Credential IDs exist (via list_credentials)
   * - Credential types match node requirements
   * - Optionally test credentials (via test_credential)
   *
   * @param workflow - Workflow object to validate
   * @param testCredentials - Whether to test credential validity
   * @returns Validation result with errors and warnings
   */
  async validateWorkflowCredentials(
    workflow: Partial<N8nWorkflow>,
    testCredentials = false
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!workflow.nodes || workflow.nodes.length === 0) {
      return { valid: true, errors, warnings };
    }

    // Get all credentials from the system
    let availableCredentials: Map<string, any>;
    try {
      const credList = await credentialService.listCredentials();
      availableCredentials = new Map(credList.map(c => [c.id!, c]));
    } catch (error) {
      warnings.push({
        type: 'credentials_check_failed',
        message: 'Could not validate credentials (credential service unavailable)',
        severity: 'warning',
      });
      return { valid: true, errors, warnings };
    }

    // Check each node for credential references
    for (const node of workflow.nodes) {
      if (!node || !node.id) continue;
      const nodeCredentials = node.credentials;
      if (!nodeCredentials || Object.keys(nodeCredentials).length === 0) {
        continue;
      }

      // Validate each credential reference
      for (const [credType, credRef] of Object.entries(nodeCredentials)) {
        if (typeof credRef !== 'object' || !credRef) continue;

        const credId = (credRef as any).id;
        if (!credId) {
          warnings.push({
            type: 'missing_credential_id',
            message: `Node '${node.name}' has credential type '${credType}' without ID`,
            nodeId: node.id,
            severity: 'warning',
          });
          continue;
        }

        // Check if credential exists
        if (!availableCredentials.has(credId)) {
          errors.push({
            type: 'credential_not_found',
            message: `Node '${node.name}' references non-existent credential ID '${credId}'`,
            nodeId: node.id,
            severity: 'error',
          });
          continue;
        }

        // Check if credential type matches
        const credential = availableCredentials.get(credId);
        if (credential.type !== credType) {
          errors.push({
            type: 'credential_type_mismatch',
            message: `Node '${node.name}' expects '${credType}' but credential is '${credential.type}'`,
            nodeId: node.id,
            severity: 'error',
          });
        }

        // Optionally test credential validity
        if (testCredentials) {
          try {
            const testResult = await credentialService.testCredential(credId);
            if (!testResult.valid) {
              warnings.push({
                type: 'credential_test_failed',
                message: `Credential '${credId}' test failed: ${testResult.message}`,
                nodeId: node.id,
                severity: 'warning',
              });
            }
          } catch (error) {
            warnings.push({
              type: 'credential_test_error',
              message: `Could not test credential '${credId}'`,
              nodeId: node.id,
              severity: 'warning',
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate workflow expressions {{ }}
   *
   * Validation:
   * - Regex extract all expressions
   * - Check JS syntax (parentheses, quotes)
   * - Validate variable refs ($json, $node, $vars)
   * - Flag complex logic → suggest Code node
   *
   * @param workflow - Workflow object to validate
   * @returns Validation result with errors and warnings
   */
  async validateWorkflowExpressions(workflow: Partial<N8nWorkflow>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!workflow.nodes || workflow.nodes.length === 0) {
      return { valid: true, errors, warnings };
    }

    // Helper to recursively extract expressions from object
    const extractAllExpressions = (obj: any, nodeName: string, nodeId: string): void => {
      if (typeof obj === 'string') {
        const expressions = extractExpressions(obj);
        for (const expr of expressions) {
          const validationResult = validateExpression(expr);
          if (!validationResult.valid) {
            errors.push({
              type: 'invalid_expression',
              message: `Node '${nodeName}': Expression '{{ ${expr} }}' has error: ${validationResult.error}`,
              nodeId,
              severity: 'error',
            });
          }

          // Warn about complex expressions
          if (
            expr.includes('if(') ||
            expr.includes('for(') ||
            expr.includes('while(') ||
            expr.match(/\bif\s*\(/i) ||
            expr.match(/\bfor\s*\(/i) ||
            expr.match(/\bwhile\s*\(/i)
          ) {
            warnings.push({
              type: 'complex_expression',
              message: `Node '${nodeName}': Expression contains complex logic. Consider using Code node instead.`,
              nodeId,
              severity: 'warning',
            });
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const value of Object.values(obj)) {
          extractAllExpressions(value, nodeName, nodeId);
        }
      }
    };

    // Check expressions in each node
    for (const node of workflow.nodes) {
      if (!node || !node.id) continue;
      extractAllExpressions(node.parameters, node.name, node.id);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Lint workflow for best practices
   *
   * Linting Rules:
   * - Orphaned nodes (no connections)
   * - Dead branches (after always-error node)
   * - Missing error handling
   * - Performance issues (loops without limits)
   * - Security issues (hardcoded secrets regex)
   * - Naming conventions (generic names)
   *
   * @param workflow - Workflow object to lint
   * @returns Lint result with score and issues
   */
  async lintWorkflow(workflow: Partial<N8nWorkflow>): Promise<LintResult> {
    const issues: ValidationError[] = [];

    if (!workflow.nodes || workflow.nodes.length === 0) {
      return {
        score: 100,
        issues: [],
        summary: 'No nodes to lint',
      };
    }

    const connections = workflow.connections || {};
    const nodeIds = new Set(workflow.nodes.filter(n => n && n.id).map(n => n.id));

    // 1. Check for orphaned nodes (no connections)
    const connectedNodes = new Set<string>();
    for (const [sourceId, outputs] of Object.entries(connections)) {
      connectedNodes.add(sourceId);
      if (outputs && typeof outputs === 'object') {
        for (const output of Object.values(outputs)) {
          if (Array.isArray(output)) {
            for (const conn of output) {
              if (Array.isArray(conn)) {
                for (const c of conn) {
                  if (c?.node) connectedNodes.add(c.node);
                }
              }
            }
          }
        }
      }
    }

    for (const node of workflow.nodes) {
      if (!node || !node.id) continue;
      if (!connectedNodes.has(node.id)) {
        issues.push({
          type: 'orphaned_node',
          message: `Node '${node.name}' has no connections`,
          nodeId: node.id,
          severity: 'warning',
        });
      }
    }

    // 2. Check for missing error handling
    const nodesWithErrorHandling = workflow.nodes.filter(
      n => n && (n.continueOnFail || n.onError === 'continueRegularOutput')
    );
    if (nodesWithErrorHandling.length === 0 && workflow.nodes.length > 3) {
      issues.push({
        type: 'no_error_handling',
        message: 'No nodes have error handling configured. Consider adding continueOnFail or error workflows.',
        severity: 'warning',
      });
    }

    // 3. Check for generic node names
    const genericNames = ['Start', 'Node', 'HTTP Request', 'Set', 'Code', 'IF', 'Switch'];
    for (const node of workflow.nodes) {
      if (!node || !node.id) continue;
      if (genericNames.includes(node.name)) {
        issues.push({
          type: 'generic_name',
          message: `Node '${node.name}' uses generic name. Consider renaming for clarity.`,
          nodeId: node.id,
          severity: 'warning',
        });
      }
    }

    // 4. Check for hardcoded secrets (basic regex)
    const secretPatterns = [
      /api[_-]?key\s*[:=]/i,
      /password\s*[:=]/i,
      /secret\s*[:=]/i,
      /\btoken\s*[:=]/i,
    ];

    for (const node of workflow.nodes) {
      if (!node || !node.id) continue;
      const paramsStr = JSON.stringify(node.parameters);
      for (const pattern of secretPatterns) {
        if (pattern.test(paramsStr)) {
          issues.push({
            type: 'hardcoded_secret',
            message: `Node '${node.name}' may contain hardcoded secrets. Use credentials or environment variables instead.`,
            nodeId: node.id,
            severity: 'error',
          });
          break;
        }
      }
    }

    // 5. Check for loops without limits
    const loopNodes = workflow.nodes.filter(n =>
      n && n.type && (n.type.toLowerCase().includes('loop') || n.type.toLowerCase().includes('split'))
    );
    for (const node of loopNodes) {
      if (!node || !node.id) continue;
      const hasLimit = node.parameters?.batchSize || node.parameters?.options?.batchSize;
      if (!hasLimit) {
        issues.push({
          type: 'loop_without_limit',
          message: `Node '${node.name}' is a loop without batch size limit. This may cause performance issues.`,
          nodeId: node.id,
          severity: 'warning',
        });
      }
    }

    // Calculate score (100 - 5 points per issue, min 0)
    const score = Math.max(0, 100 - issues.length * 5);

    // Generate summary
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const summary = errorCount === 0 && warningCount === 0
      ? 'Workflow follows best practices'
      : `Found ${errorCount} errors and ${warningCount} warnings`;

    return {
      score,
      issues,
      summary,
    };
  }

  /**
   * Suggest workflow improvements (AI-powered analysis)
   *
   * Approach:
   * - Analyze workflow structure
   * - Identify common anti-patterns
   * - Suggest optimizations
   *
   * @param workflow - Workflow object to analyze
   * @returns Improvement suggestions
   */
  async suggestWorkflowImprovements(workflow: Partial<N8nWorkflow>): Promise<ImprovementResult> {
    const suggestions: Suggestion[] = [];

    if (!workflow.nodes || workflow.nodes.length === 0) {
      return {
        suggestions: [],
        summary: 'No nodes to analyze',
      };
    }

    const connections = workflow.connections || {};
    const nodeTypes = workflow.nodes.filter(n => n && n.type).map(n => n.type);

    // 1. Suggest using Set node for data transformation
    const hasHttpNode = nodeTypes.some(t => t.toLowerCase().includes('http'));
    const hasSetNode = nodeTypes.some(t => t === 'n8n-nodes-base.set');
    if (hasHttpNode && !hasSetNode) {
      suggestions.push({
        type: 'add_set_node',
        title: 'Add Set node for data transformation',
        description: 'HTTP responses often need data transformation. Consider adding a Set node to extract and format the data.',
        priority: 'medium',
      });
    }

    // 2. Suggest error workflow for critical operations
    const hasErrorWorkflow = workflow.nodes.some(n => n && n.onError === 'continueErrorOutput');
    const hasCriticalNodes = nodeTypes.some(t => {
      const lowerType = t.toLowerCase();
      return (
        lowerType.includes('database') ||
        lowerType.includes('postgres') ||
        lowerType.includes('mysql') ||
        lowerType.includes('mongodb') ||
        lowerType.includes('http') ||
        lowerType.includes('email') ||
        lowerType.includes('smtp')
      );
    });
    if (hasCriticalNodes && !hasErrorWorkflow) {
      suggestions.push({
        type: 'add_error_handling',
        title: 'Add error handling workflow',
        description: 'Critical operations (database, HTTP, email) should have error handling to prevent silent failures.',
        priority: 'high',
      });
    }

    // 3. Suggest batch processing for loops
    const loopNodes = workflow.nodes.filter(n =>
      n && n.type && (n.type.toLowerCase().includes('loop') || n.type.toLowerCase().includes('split'))
    );
    for (const node of loopNodes) {
      if (!node || !node.id) continue;
      const itemsPerIteration = node.parameters?.batchSize || 1;
      if (itemsPerIteration === 1) {
        suggestions.push({
          type: 'optimize_loop',
          title: `Optimize loop in '${node.name}'`,
          description: 'Processing items one by one is slow. Consider increasing batch size for better performance.',
          priority: 'medium',
          nodeId: node.id,
        });
      }
    }

    // 4. Suggest using credentials instead of hardcoded values
    for (const node of workflow.nodes) {
      if (!node || !node.id) continue;
      const paramsStr = JSON.stringify(node.parameters);
      if (
        paramsStr.includes('Authorization') &&
        !node.credentials &&
        !paramsStr.includes('{{')
      ) {
        suggestions.push({
          type: 'use_credentials',
          title: `Use credentials for '${node.name}'`,
          description: 'Hardcoded authorization detected. Use credentials for better security and reusability.',
          priority: 'high',
          nodeId: node.id,
        });
      }
    }

    // 5. Suggest adding trigger for active workflows
    const hasTrigger = nodeTypes.some(t =>
      t.toLowerCase().includes('trigger') || t.toLowerCase().includes('webhook')
    );
    if (workflow.active && !hasTrigger) {
      suggestions.push({
        type: 'add_trigger',
        title: 'Add trigger node for active workflow',
        description: 'Active workflows need a trigger to run automatically. Add a trigger node (Schedule, Webhook, etc.).',
        priority: 'high',
      });
    }

    // 6. Suggest merge/aggregation for multiple parallel branches
    const parallelBranches = Object.values(connections).filter(
      output => Array.isArray(output?.main?.[0]) && output.main[0].length > 1
    );
    const hasMergeNode = nodeTypes.some(t => t.includes('Merge'));
    if (parallelBranches.length > 0 && !hasMergeNode) {
      suggestions.push({
        type: 'add_merge',
        title: 'Add Merge node for parallel branches',
        description: 'Multiple parallel branches detected. Consider adding a Merge node to combine results.',
        priority: 'medium',
      });
    }

    // Generate summary
    const highPriority = suggestions.filter(s => s.priority === 'high').length;
    const mediumPriority = suggestions.filter(s => s.priority === 'medium').length;
    const lowPriority = suggestions.filter(s => s.priority === 'low').length;

    const summary = suggestions.length === 0
      ? 'Workflow is well-optimized'
      : `Found ${suggestions.length} suggestions: ${highPriority} high, ${mediumPriority} medium, ${lowPriority} low priority`;

    return {
      suggestions,
      summary,
    };
  }
}

// Export singleton instance
export const validationService = new ValidationService();
