import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { n8nApi } from '../services/n8n-api-service.js';
import { validateRequired } from '../utils/error-handler.js';
import { N8N_HOST } from '../config/env.js';

/**
 * Define all 12 existing workflow management tools
 */
export const workflowTools: Tool[] = [
  // WORKFLOW MANAGEMENT
  {
    name: 'list_workflows',
    description: 'List all workflows in n8n',
    inputSchema: {
      type: 'object',
      properties: {
        active: { type: 'boolean', description: 'Filter by active status' },
        limit: { type: 'number', description: 'Limit number of results' },
        tags: { type: 'string', description: 'Filter by tags (comma separated)' },
      },
    },
  },
  {
    name: 'get_workflow',
    description: 'Get detailed information about a workflow (nodes, connections, settings)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The workflow ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_workflow',
    description: 'Create a new workflow',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the workflow' },
        nodes: { type: 'array', description: 'Array of node objects' },
        connections: { type: 'object', description: 'Object defining connections' },
        active: { type: 'boolean', description: 'Whether active' },
        settings: { type: 'object', description: 'Workflow settings' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_workflow',
    description: 'Update an existing workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
        name: { type: 'string' },
        nodes: { type: 'array' },
        connections: { type: 'object' },
        active: { type: 'boolean' },
        settings: { type: 'object' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_workflow',
    description: 'Delete a workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'activate_workflow',
    description: 'Activate or deactivate a workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
        active: { type: 'boolean', description: 'True to activate' },
      },
      required: ['id', 'active'],
    },
  },

  // EXECUTION & TESTING
  {
    name: 'execute_workflow',
    description: 'Manually trigger a workflow',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'trigger_webhook',
    description: 'Trigger a webhook endpoint for testing',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_path: { type: 'string', description: 'Webhook path/UUID' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'POST' },
        body: { type: 'object', description: 'JSON body payload' },
        headers: { type: 'object', description: 'Custom headers' },
        query_params: { type: 'object', description: 'Query parameters' },
        test_mode: { type: 'boolean', description: 'Use /webhook-test/ endpoint if true' },
      },
      required: ['webhook_path'],
    },
  },

  // DEBUGGING & MONITORING
  {
    name: 'list_executions',
    description: 'List recent workflow executions to check status',
    inputSchema: {
      type: 'object',
      properties: {
        includeData: { type: 'boolean', description: 'Include execution data' },
        status: { type: 'string', enum: ['error', 'success', 'waiting'] },
        limit: { type: 'number', default: 20 },
        workflowId: { type: 'string', description: 'Filter by workflow ID' },
      },
    },
  },
  {
    name: 'get_execution',
    description: 'Get full details of a specific execution for debugging',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Execution ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_node_types',
    description: 'List available node types in this n8n instance',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Handle execution of workflow tools
 */
export async function handleWorkflowTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'list_workflows':
      return await n8nApi.listWorkflows(args);

    case 'get_workflow':
      validateRequired(args, ['id']);
      return await n8nApi.getWorkflow(args.id);

    case 'create_workflow':
      validateRequired(args, ['name']);
      return await n8nApi.createWorkflow(args);

    case 'update_workflow':
      validateRequired(args, ['id']);
      const { id: updateId, ...updateData } = args;
      return await n8nApi.updateWorkflow(updateId, updateData);

    case 'delete_workflow':
      validateRequired(args, ['id']);
      await n8nApi.deleteWorkflow(args.id);
      return { success: true, message: `Workflow ${args.id} deleted` };

    case 'activate_workflow':
      validateRequired(args, ['id', 'active']);
      return await n8nApi.activateWorkflow(args.id, args.active);

    case 'execute_workflow':
      validateRequired(args, ['id']);
      return await n8nApi.executeWorkflow(args.id);

    case 'trigger_webhook':
      validateRequired(args, ['webhook_path']);
      const result = await n8nApi.triggerWebhook({
        path: args.webhook_path,
        method: args.method || 'POST',
        body: args.body,
        headers: args.headers,
        queryParams: args.query_params,
        testMode: args.test_mode,
      });

      // Add full URL to response for debugging
      const endpoint = args.test_mode ? 'webhook-test' : 'webhook';
      return {
        ...result,
        url: `${N8N_HOST}/${endpoint}/${args.webhook_path}`,
      };

    case 'list_executions':
      return await n8nApi.listExecutions(args);

    case 'get_execution':
      validateRequired(args, ['id']);
      return await n8nApi.getExecution(args.id);

    case 'list_node_types':
      return await n8nApi.listNodeTypes();

    default:
      throw new Error(`Unknown workflow tool: ${name}`);
  }
}
