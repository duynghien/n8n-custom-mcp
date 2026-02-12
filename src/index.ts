#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { workflowTools, handleWorkflowTool } from './tools/workflow-tools.js';
import { credentialTools, handleCredentialTool } from './tools/credential-tools.js';
import { validationTools, handleValidationTool } from './tools/validation-tools.js';
import { templateTools, handleTemplateTool } from './tools/template-tools.js';
import { backupTools, handleBackupTool } from './tools/backup-tools.js';
import { nodeTools, handleNodeTool } from './tools/node-tools.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const server = new Server(
  {
    name: 'n8n-custom-mcp',
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...workflowTools,
      ...credentialTools,
      ...validationTools,
      ...templateTools,
      ...backupTools,
      ...nodeTools,
    ],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Route to appropriate handler
    let result: any;

    if (workflowTools.some(t => t.name === name)) {
      result = await handleWorkflowTool(name, args || {});
    } else if (credentialTools.some(t => t.name === name)) {
      result = await handleCredentialTool(name, args || {});
    } else if (validationTools.some(t => t.name === name)) {
      result = await handleValidationTool(name, args || {});
    } else if (templateTools.some(t => t.name === name)) {
      result = await handleTemplateTool(name, args || {});
    } else if (backupTools.some(t => t.name === name)) {
      result = await handleBackupTool(name, args || {});
    } else if (nodeTools.some(t => t.name === name)) {
      result = await handleNodeTool(name, args || {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('n8n-custom-mcp server running on stdio');
}

main().catch(console.error);
