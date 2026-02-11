import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { templateService } from '../services/template-service.js';
import { validateRequired } from '../utils/error-handler.js';

/**
 * Template management tools
 */
export const templateTools: Tool[] = [
  {
    name: 'search_templates',
    description: 'Search n8n.io template library for workflow templates',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "github slack", "customer onboarding")',
        },
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "Development", "Marketing")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_template_details',
    description: 'Get full workflow JSON for a template',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Template ID from search results',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'import_template',
    description: 'Import template as new workflow with dependency resolution',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'number',
          description: 'Template ID to import',
        },
        credentialMapping: {
          type: 'object',
          description: 'Map template credential IDs to existing credentials',
        },
        skipNodeValidation: {
          type: 'boolean',
          description: 'Skip checking if nodes exist (advanced)',
        },
        importInactive: {
          type: 'boolean',
          description: 'Import as inactive workflow (default: true)',
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'export_workflow_as_template',
    description: 'Export workflow as JSON template (safe for sharing)',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to export',
        },
        includeCredentials: {
          type: 'boolean',
          description: 'Include credential data (INSECURE - default: false)',
        },
        stripIds: {
          type: 'boolean',
          description: 'Remove n8n instance-specific IDs (default: true)',
        },
      },
      required: ['workflowId'],
    },
  },
];

/**
 * Handle template tool calls
 */
export async function handleTemplateTool(
  name: string,
  args: Record<string, any>
): Promise<any> {
  switch (name) {
    case 'search_templates':
      validateRequired(args, ['query']);
      return await templateService.searchTemplates(args.query, args.category);

    case 'get_template_details':
      validateRequired(args, ['id']);
      return await templateService.getTemplateDetails(args.id);

    case 'import_template':
      validateRequired(args, ['templateId']);
      return await templateService.importTemplate(args.templateId, {
        credentialMapping: args.credentialMapping,
        skipNodeValidation: args.skipNodeValidation,
        importInactive: args.importInactive !== false,
      });

    case 'export_workflow_as_template':
      validateRequired(args, ['workflowId']);
      return await templateService.exportWorkflow(args.workflowId, {
        includeCredentials: args.includeCredentials === true,
        stripIds: args.stripIds !== false,
      });

    default:
      throw new Error(`Unknown template tool: ${name}`);
  }
}
