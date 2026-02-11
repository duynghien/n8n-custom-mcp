import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { credentialService } from '../services/credential-service.js';
import { validateRequired } from '../utils/error-handler.js';

/**
 * Define all 6 credential management tools
 */
export const credentialTools: Tool[] = [
  {
    name: 'get_credential_schema',
    description: 'Get required fields and structure for a credential type before creating it',
    inputSchema: {
      type: 'object',
      properties: {
        credentialType: {
          type: 'string',
          description: 'Credential type name (e.g., "githubApi", "slackApi", "googleSheetsOAuth2Api")',
        },
      },
      required: ['credentialType'],
    },
  },
  {
    name: 'list_credentials',
    description: 'List all credentials available in n8n (parsed from workflows + database fallback)',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Optional: Filter by credential type (e.g., "githubApi")',
        },
      },
    },
  },
  {
    name: 'create_credential',
    description: 'Create a new credential with automatic validation against schema',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Friendly name for the credential (e.g., "My GitHub Account")',
        },
        type: {
          type: 'string',
          description: 'Credential type (use get_credential_schema to see required fields)',
        },
        data: {
          type: 'object',
          description: 'Credential data - fields depend on type schema (e.g., {"accessToken": "ghp_..."})',
        },
        nodesAccess: {
          type: 'array',
          description: 'Optional: Restrict credential to specific node types',
          items: {
            type: 'object',
            properties: {
              nodeType: { type: 'string' },
            },
          },
        },
      },
      required: ['name', 'type', 'data'],
    },
  },
  {
    name: 'update_credential',
    description: 'Update an existing credential (name, data, or node access)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Credential ID to update',
        },
        name: {
          type: 'string',
          description: 'New name for the credential',
        },
        data: {
          type: 'object',
          description: 'Updated credential data (partial update supported)',
        },
        nodesAccess: {
          type: 'array',
          description: 'Updated node access restrictions',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_credential',
    description: 'Delete a credential with safety checks (blocks if in use unless forced)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Credential ID to delete',
        },
        force: {
          type: 'boolean',
          description: 'Force delete even if used by workflows (default: false)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'test_credential',
    description: 'Test credential validity by creating a temporary workflow (heavy operation - use sparingly)',
    inputSchema: {
      type: 'object',
      properties: {
        credentialId: {
          type: 'string',
          description: 'Credential ID to test',
        },
      },
      required: ['credentialId'],
    },
  },
];

/**
 * Handle credential tool requests
 * Routes to appropriate credential service methods
 */
export async function handleCredentialTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'get_credential_schema':
      validateRequired(args, ['credentialType']);
      return await credentialService.getSchema(args.credentialType);

    case 'list_credentials':
      return await credentialService.listCredentials(args.type);

    case 'create_credential':
      validateRequired(args, ['name', 'type', 'data']);
      return await credentialService.createCredential(args);

    case 'update_credential':
      validateRequired(args, ['id']);
      const { id, ...updateData } = args;
      return await credentialService.updateCredential(id, updateData);

    case 'delete_credential':
      validateRequired(args, ['id']);
      await credentialService.deleteCredential(args.id, args.force || false);
      return {
        success: true,
        message: `Credential ${args.id} deleted successfully`,
      };

    case 'test_credential':
      validateRequired(args, ['credentialId']);
      return await credentialService.testCredential(args.credentialId);

    default:
      throw new Error(`Unknown credential tool: ${name}`);
  }
}
