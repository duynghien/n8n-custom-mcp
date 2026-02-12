import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
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

const allTools = [
  ...workflowTools,
  ...credentialTools,
  ...validationTools,
  ...templateTools,
  ...backupTools,
  ...nodeTools,
];

/**
 * Creates and configures a new MCP Server instance.
 */
function createMcpServer() {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('Handling tools/list request');
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`Calling tool: ${name}`);

    try {
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
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      console.error(`Tool error (${name}):`, error);
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function main() {
  const transportType = process.env.MCP_TRANSPORT || 'stdio';

  if (transportType === 'sse') {
    const app = express();
    const port = parseInt(process.env.PORT || '3000');

    app.use(cors());
    app.use(express.json());

    // Logging middleware
    app.use((req, res, next) => {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      if (req.method === 'POST') {
        console.error('Body:', JSON.stringify(req.body));
      }
      next();
    });

    const sessions = new Map<string, SSEServerTransport>();

    // Standard SSE GET handler
    app.get('/mcp', async (req, res) => {
      const server = createMcpServer();
      const transport = new SSEServerTransport('/message', res);
      await server.connect(transport);

      const sessionId = transport.sessionId;
      if (sessionId) {
        sessions.set(sessionId, transport);
        transport.onclose = () => sessions.delete(sessionId);
      }
    });

    // Standard Message handler
    app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = sessions.get(sessionId);
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(404).send('Session not found');
      }
    });

    // 🚀 Hybrid "Streamable HTTP" handler for LobeHub compatibility
    // Handles POST /mcp directly by returning a single-event SSE stream
    app.post('/mcp', async (req, res) => {
      const { method, id } = req.body;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      console.error(`Hybrid handler: ${method}`);

      if (method === 'tools/list' || method === 'list_tools') {
        const response = {
          jsonrpc: '2.0',
          id,
          result: { tools: allTools }
        };
        res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        res.end();
      } else if (method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'n8n-custom-mcp', version: packageJson.version }
          }
        };
        res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        res.end();
      } else {
        // For actual tool calls or other methods, use the server logic
        // This is a simplified fallback
        res.status(501).send('Method not implemented in hybrid mode');
      }
    });

    app.get('/', (req, res) => {
      res.json({
        status: 'running',
        transport: 'sse/hybrid',
        tools_count: allTools.length,
        endpoints: ['GET /mcp', 'POST /message', 'POST /mcp']
      });
    });

    app.listen(port, '0.0.0.0', () => {
      console.error(`n8n-custom-mcp server running on port ${port} (0.0.0.0)`);
    });
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('n8n-custom-mcp server running on stdio');
  }
}

main().catch(console.error);
