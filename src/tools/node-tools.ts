import { z } from 'zod';
import { n8nApi } from '../services/n8n-api-service.js';
import { cleanNodeSchema } from '../utils/schema-cleaner.js';

export const nodeTools = [
  {
    name: 'get_node_schema',
    description: 'Get the parameter schema for a specific n8n node type. Use this to understand what inputs/options a node accepts.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeName: {
          type: 'string',
          description: 'The internal name of the node (e.g., "n8n-nodes-base.httpRequest", "n8n-nodes-base.googleSheets")',
        },
      },
      required: ['nodeName'],
    },
  },
];

export async function handleNodeTool(name: string, args: any) {
  switch (name) {
    case 'get_node_schema':
      const rawSchema = await n8nApi.getNodeSchema(args.nodeName);
      return cleanNodeSchema(rawSchema);
    default:
      throw new Error(`Unknown node tool: ${name}`);
  }
}
