import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validationService } from '../services/validation-service.js';
import { validateRequired } from '../utils/error-handler.js';

/**
 * Define validation tools for workflow structure checking
 */
export const validationTools: Tool[] = [
  {
    name: 'validate_workflow_structure',
    description: 'Validate workflow structure before creation/deployment to catch errors early. Checks for: required fields, unique node IDs/names, valid node types, valid connections, circular dependencies, trigger nodes, and disabled node warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'Workflow object to validate',
          properties: {
            name: { type: 'string', description: 'Workflow name' },
            nodes: {
              type: 'array',
              description: 'Array of node objects',
              items: { type: 'object' }
            },
            connections: {
              type: 'object',
              description: 'Connections between nodes'
            },
            active: {
              type: 'boolean',
              description: 'Whether workflow should be active'
            },
          },
          required: ['name', 'nodes'],
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'validate_workflow_credentials',
    description: 'Validate workflow credentials before deployment. Checks: credential IDs exist, credential types match node requirements, and optionally tests credential validity.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'Workflow object to validate',
          properties: {
            name: { type: 'string' },
            nodes: {
              type: 'array',
              items: { type: 'object' }
            },
          },
          required: ['name', 'nodes'],
        },
        testCredentials: {
          type: 'boolean',
          description: 'Whether to test credential validity (default: false)',
          default: false,
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'validate_workflow_expressions',
    description: 'Validate n8n expressions {{ }} in workflow. Checks: syntax errors in expressions, valid variable references ($json, $node, $vars), and warns about complex logic that should use Code node.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'Workflow object to validate',
          properties: {
            name: { type: 'string' },
            nodes: {
              type: 'array',
              items: { type: 'object' }
            },
          },
          required: ['name', 'nodes'],
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'lint_workflow',
    description: 'Lint workflow for best practices. Checks: orphaned nodes, missing error handling, generic node names, hardcoded secrets, and loops without limits. Returns score (0-100) and list of issues.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'Workflow object to lint',
          properties: {
            name: { type: 'string' },
            nodes: {
              type: 'array',
              items: { type: 'object' }
            },
            connections: { type: 'object' },
          },
          required: ['name', 'nodes'],
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'suggest_workflow_improvements',
    description: 'Analyze workflow and suggest improvements. Identifies: missing Set nodes for data transformation, missing error handling, slow loops, hardcoded values that should use credentials, missing triggers, and opportunities for merge nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'Workflow object to analyze',
          properties: {
            name: { type: 'string' },
            nodes: {
              type: 'array',
              items: { type: 'object' }
            },
            connections: { type: 'object' },
            active: { type: 'boolean' },
          },
          required: ['name', 'nodes'],
        },
      },
      required: ['workflow'],
    },
  },
];

/**
 * Handle validation tool invocations
 *
 * @param name - Tool name
 * @param args - Tool arguments
 * @returns Validation result with errors and warnings
 */
export async function handleValidationTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'validate_workflow_structure':
      validateRequired(args, ['workflow']);
      return await validationService.validateWorkflowStructure(args.workflow);

    case 'validate_workflow_credentials':
      validateRequired(args, ['workflow']);
      return await validationService.validateWorkflowCredentials(
        args.workflow,
        args.testCredentials || false
      );

    case 'validate_workflow_expressions':
      validateRequired(args, ['workflow']);
      return await validationService.validateWorkflowExpressions(args.workflow);

    case 'lint_workflow':
      validateRequired(args, ['workflow']);
      return await validationService.lintWorkflow(args.workflow);

    case 'suggest_workflow_improvements':
      validateRequired(args, ['workflow']);
      return await validationService.suggestWorkflowImprovements(args.workflow);

    default:
      throw new Error(`Unknown validation tool: ${name}`);
  }
}
