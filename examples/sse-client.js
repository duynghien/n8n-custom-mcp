#!/usr/bin/env node

/**
 * n8n MCP SSE Client - Node.js Example
 *
 * Demonstrates how to connect to n8n-custom-mcp server using SSE transport
 * from a Node.js environment.
 *
 * Usage:
 *   node examples/sse-client.js
 *
 * Requirements:
 *   Node.js 18+ (native fetch support)
 */

class MCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.requestId = 0;
    this.sessionId = `session-${Date.now()}`;
  }

  /**
   * Call MCP method via SSE transport
   * @param {string} method - JSON-RPC method name
   * @param {object} params - Method parameters
   * @returns {Promise<object>} JSON-RPC response
   */
  async callMCP(method, params = {}) {
    this.requestId++;

    console.log(`\n📤 Sending request: ${method}`);
    console.log(`   Request ID: ${this.requestId}`);
    console.log(`   Session ID: ${this.sessionId}`);

    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Session-Id': this.sessionId,
          'MCP-Protocol-Version': '2024-11-05',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: this.requestId,
        }),
      });

      if (!response.ok) {
        const errorContext = {
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
          requestId: this.requestId,
          method,
          httpStatus: response.status,
          httpStatusText: response.statusText,
        };
        console.error('❌ HTTP Error:', errorContext);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse SSE stream
      let buffer = '';
      let foundResponse = false;

      for await (const chunk of response.body) {
        buffer += chunk.toString();

        // Split by double newline (SSE event delimiter)
        const events = buffer.split('\n\n');
        buffer = events.pop(); // Keep incomplete event in buffer

        for (const event of events) {
          if (!event.trim()) continue;

          const lines = event.split('\n');
          let eventType = 'message';
          let data = null;

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              data = JSON.parse(line.slice(6));
            }
          }

          if (data) {
            foundResponse = true;
            console.log(`✅ Response received (${eventType})`);

            if (data.error) {
              const errorContext = {
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId,
                requestId: this.requestId,
                method,
                error: data.error,
              };
              console.error(`❌ Error: ${data.error.message}`);
              console.error('Error context:', errorContext);
              console.error(JSON.stringify(data.error, null, 2));
              throw new Error(data.error.message);
            }

            return data.result;
          }
        }
      }

      if (!foundResponse) {
        const errorContext = {
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
          requestId: this.requestId,
          method,
          error: 'No response received from server',
        };
        console.error('❌ No response error:', errorContext);
        throw new Error('No response received');
      }
    } catch (error) {
      const errorContext = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        requestId: this.requestId,
        method,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
      console.error(`❌ Request failed:`, errorContext);
      throw error;
    }
  }

  /**
   * List all available MCP tools
   */
  async listTools() {
    const result = await this.callMCP('tools/list');
    console.log(`\n📋 Available tools: ${result.tools.length}`);
    result.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
    });
    return result.tools;
  }

  /**
   * List all workflows
   */
  async listWorkflows(options = {}) {
    const result = await this.callMCP('tools/call', {
      name: 'list_workflows',
      arguments: options,
    });
    console.log(`\n📊 Workflows found: ${result.content[0].text}`);
    return result;
  }

  /**
   * Get workflow details
   */
  async getWorkflow(id) {
    const result = await this.callMCP('tools/call', {
      name: 'get_workflow',
      arguments: { id },
    });
    console.log(`\n📄 Workflow details retrieved`);
    return result;
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow) {
    const result = await this.callMCP('tools/call', {
      name: 'create_workflow',
      arguments: workflow,
    });
    console.log(`\n✨ Workflow created successfully`);
    return result;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(id) {
    const result = await this.callMCP('tools/call', {
      name: 'execute_workflow',
      arguments: { id },
    });
    console.log(`\n🚀 Workflow execution started`);
    return result;
  }

  /**
   * List credentials
   */
  async listCredentials(options = {}) {
    const result = await this.callMCP('tools/call', {
      name: 'list_credentials',
      arguments: options,
    });
    console.log(`\n🔐 Credentials retrieved`);
    return result;
  }

  /**
   * List node types
   */
  async listNodeTypes() {
    const result = await this.callMCP('tools/call', {
      name: 'list_node_types',
      arguments: {},
    });
    console.log(`\n🧩 Node types retrieved`);
    return result;
  }

  /**
   * Validate workflow structure
   */
  async validateWorkflow(workflow) {
    const result = await this.callMCP('tools/call', {
      name: 'validate_workflow_structure',
      arguments: { workflow },
    });
    console.log(`\n✅ Workflow validation complete`);
    return result;
  }
}

// Example usage
async function main() {
  console.log('🔌 n8n MCP SSE Client - Node.js Example\n');
  console.log('Connecting to MCP server...');

  const client = new MCPClient('http://localhost:3000');

  try {
    // Example 1: List all tools
    console.log('\n' + '='.repeat(60));
    console.log('Example 1: List all available tools');
    console.log('='.repeat(60));
    await client.listTools();

    // Example 2: List workflows
    console.log('\n' + '='.repeat(60));
    console.log('Example 2: List all workflows');
    console.log('='.repeat(60));
    await client.listWorkflows({ active: true });

    // Example 3: List credentials
    console.log('\n' + '='.repeat(60));
    console.log('Example 3: List credentials');
    console.log('='.repeat(60));
    await client.listCredentials();

    // Example 4: List node types
    console.log('\n' + '='.repeat(60));
    console.log('Example 4: List node types');
    console.log('='.repeat(60));
    await client.listNodeTypes();

    // Example 5: Create a simple workflow
    console.log('\n' + '='.repeat(60));
    console.log('Example 5: Create a test workflow');
    console.log('='.repeat(60));

    const testWorkflow = {
      name: 'SSE Test Workflow',
      nodes: [
        {
          id: 'start-node',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          position: [250, 300],
          parameters: {},
        },
        {
          id: 'set-node',
          name: 'Set Data',
          type: 'n8n-nodes-base.set',
          position: [450, 300],
          parameters: {
            values: {
              string: [
                {
                  name: 'message',
                  value: 'Hello from SSE client!',
                },
              ],
            },
          },
        },
      ],
      connections: {
        'Start': {
          main: [[{ node: 'Set Data', type: 'main', index: 0 }]],
        },
      },
      active: false,
      settings: {},
    };

    // Validate before creating
    console.log('\n🔍 Validating workflow structure...');
    const validation = await client.validateWorkflow(testWorkflow);
    console.log('Validation result:', JSON.stringify(validation, null, 2));

    if (validation.content[0].text.includes('"valid":true')) {
      console.log('\n✅ Validation passed, creating workflow...');
      const created = await client.createWorkflow(testWorkflow);
      console.log('Created workflow:', created.content[0].text);
    } else {
      console.log('\n⚠️  Validation failed, skipping creation');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All examples completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error during execution:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as module
export { MCPClient };
