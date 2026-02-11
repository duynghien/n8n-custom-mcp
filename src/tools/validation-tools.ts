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

    default:
      throw new Error(`Unknown validation tool: ${name}`);
  }
}
