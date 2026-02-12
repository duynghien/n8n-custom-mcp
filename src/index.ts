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
import { safeStringify } from './utils/safe-json.js';
import { limitResponse, RESPONSE_LIMITS } from './utils/response-limiter.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// JSON-RPC 2.0 request interface
interface JsonRpcRequest {
  jsonrpc?: string;
  method: string;
  params?: any;
  id?: string | number | null;
}

// Type guard for JSON-RPC request
function isValidJsonRpcRequest(body: any): body is JsonRpcRequest {
  return (
    body &&
    typeof body === 'object' &&
    typeof body.method === 'string' &&
    (body.id === undefined || typeof body.id === 'string' || typeof body.id === 'number' || body.id === null)
  );
}

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

      // Apply response size limiting
      const limited = limitResponse(result, RESPONSE_LIMITS.MAX_RESPONSE_SIZE);

      if (limited.truncated) {
        console.warn(
          `Response truncated for tool ${name}: ` +
          `${Math.round(limited.originalSize / 1024)}KB → ${Math.round(limited.truncatedSize / 1024)}KB`
        );
      }

      // Build response with pagination info if truncated
      const responseData = limited.truncated
        ? {
            ...limited.data,
            _meta: {
              truncated: true,
              originalSize: limited.originalSize,
              pagination: limited.pagination,
            },
          }
        : limited.data;

      return {
        content: [{ type: 'text', text: safeStringify(responseData) }],
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

    // JSON parsing error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof SyntaxError && 'body' in err) {
        console.error('JSON parsing error:', err.message);
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error: Invalid JSON'
          },
          id: null
        });
      }
      next();
    });

    // Logging middleware
    app.use((req, res, next) => {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      if (req.method === 'POST') {
        console.error('Body:', JSON.stringify(req.body));
      }
      next();
    });

    const sessions = new Map<string, SSEServerTransport>();

    // Session metrics for monitoring
    const sessionMetrics = {
      totalSessions: 0,
      collisions: 0,
      activeSessions: () => sessions.size
    };

    // Standard SSE GET handler
    app.get('/mcp', async (req, res) => {
      const server = createMcpServer();
      const transport = new SSEServerTransport('/message', res);
      await server.connect(transport);

      const sessionId = transport.sessionId;
      if (sessionId) {
        // Check for session collision
        if (sessions.has(sessionId)) {
          sessionMetrics.collisions++;
          console.error(`⚠️ Session ID collision detected: ${sessionId} (total collisions: ${sessionMetrics.collisions})`);

          // Force cleanup of old session
          const oldTransport = sessions.get(sessionId);
          if (oldTransport) {
            try {
              oldTransport.close();
            } catch (err) {
              console.error('Error closing old transport:', err);
            }
          }
          sessions.delete(sessionId);

          // Log security event with timestamp
          console.error(`[SECURITY] ${new Date().toISOString()} - Session ${sessionId} replaced. Old session terminated.`);
        }

        sessionMetrics.totalSessions++;
        sessions.set(sessionId, transport);
        transport.onclose = () => {
          sessions.delete(sessionId);
          console.error(`Session ${sessionId} closed`);
        };
      }
    });

    // Standard Message handler
    app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId as string;

      // Validate sessionId format (UUID v4)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!sessionId || !uuidRegex.test(sessionId)) {
        console.error(`Invalid session ID format: ${sessionId}`);
        return res.status(400).json({
          error: 'Invalid session ID format'
        });
      }

      const transport = sessions.get(sessionId);
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        console.error(`Session not found: ${sessionId}`);
        res.status(404).json({
          error: 'Session not found or expired'
        });
      }
    });

    // 🚀 Hybrid "Streamable HTTP" handler for LobeHub compatibility
    // Handles POST /mcp directly by returning a single-event SSE stream
    app.post('/mcp', async (req, res) => {
      // Validate JSON-RPC request format
      if (!isValidJsonRpcRequest(req.body)) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request: Request must be a valid JSON-RPC 2.0 object'
          },
          id: null
        });
      }

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

    app.get('/metrics', (req, res) => {
      res.json({
        sessions: {
          active: sessionMetrics.activeSessions(),
          total: sessionMetrics.totalSessions,
          collisions: sessionMetrics.collisions
        },
        uptime: process.uptime(),
        memory: process.memoryUsage()
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
