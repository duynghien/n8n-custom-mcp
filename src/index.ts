#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';

const N8N_HOST = process.env.N8N_HOST || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error("Error: N8N_API_KEY environment variable is required");
  process.exit(1);
}

const n8n = axios.create({
  baseURL: `${N8N_HOST}/api/v1`,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
  },
});

const webhookClient = axios.create({
  baseURL: N8N_HOST,
  headers: {
    'Content-Type': 'application/json',
  },
});

const server = new Server(
  {
    name: 'n8n-custom-mcp',
    version: '1.3.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      /* WORKFLOW MANAGEMENT */
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

      /* EXECUTION & TESTING */
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
            test_mode: { type: 'boolean', description: 'Use /webhook-test/ endpoint if true' },
          },
          required: ['webhook_path'],
        },
      },

      /* DEBUGGING & MONITORING (NEW) */
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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    // --- WORKFLOW CRUD ---
    if (name === 'list_workflows') {
      const { active, limit, tags } = args as any;
      const response = await n8n.get('/workflows', { params: { active, limit, tags } });
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }] };
    }

    if (name === 'get_workflow') {
      const { id } = args as any;
      const response = await n8n.get(`/workflows/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }

    if (name === 'create_workflow') {
      const response = await n8n.post('/workflows', args);
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }

    if (name === 'update_workflow') {
      const { id, ...data } = args as any;
      const response = await n8n.put(`/workflows/${id}`, data);
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }

    if (name === 'delete_workflow') {
      const { id } = args as any;
      await n8n.delete(`/workflows/${id}`);
      return { content: [{ type: 'text', text: `Successfully deleted workflow ${id}` }] };
    }

    if (name === 'activate_workflow') {
      const { id, active } = args as any;
      const response = await n8n.post(`/workflows/${id}/${active ? 'activate' : 'deactivate'}`);
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }

    // --- EXECUTION ---
    if (name === 'execute_workflow') {
      const { id } = args as any;
      const response = await n8n.post(`/workflows/${id}/execute`);
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }

    if (name === 'trigger_webhook') {
      const { webhook_path, method = 'POST', body, test_mode } = args as any;
      const endpoint = test_mode ? '/webhook-test/' : '/webhook/';
      const url = `${endpoint}${webhook_path}`;
      
      try {
        const response = await webhookClient.request({
          method,
          url,
          data: body,
          validateStatus: () => true,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: response.status,
              statusText: response.statusText,
              data: response.data,
              url: `${N8N_HOST}${url}`
            }, null, 2)
          }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Webhook Error: ${err.message}` }] };
      }
    }

    // --- MONITORING (NEW) ---
    if (name === 'list_executions') {
      const response = await n8n.get('/executions', { params: args });
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }] };
    }

    if (name === 'get_execution') {
      const { id } = args as any;
      const response = await n8n.get(`/executions/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }

    if (name === 'list_node_types') {
      // Endpoint này trả về danh sách các node cài đặt
      const response = await n8n.get('/node-types');
      return { content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }] };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message;
    return { isError: true, content: [{ type: 'text', text: `N8N API Error: ${errorMsg}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
