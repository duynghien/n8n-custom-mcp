#!/usr/bin/env node

/**
 * n8n MCP SSE Client - Node.js Example (Simplified)
 *
 * Demonstrates how to connect to n8n-custom-mcp server using SSE transport
 * from a Node.js environment.
 *
 * Usage:
 *   node examples/sse-client-simple.js
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

    console.log(`\n📤 Request: ${method} (ID: ${this.requestId})`);

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

      // Read entire response body
      const text = await response.text();

      // Parse SSE format: "event: message\ndata: {...}\n\n"
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

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
            throw new Error(data.error.message);
          }

          console.log(`✅ Success`);
          return data.result;
        }
      }

      throw new Error('No data in response');
    } catch (error) {
      const errorContext = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        requestId: this.requestId,
        method,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
      console.error(`❌ Failed:`, errorContext);
      throw error;
    }
  }

  async listTools() {
    const result = await this.callMCP('tools/list');
    console.log(`   Found ${result.tools.length} tools`);
    return result.tools;
  }

  async listWorkflows(options = {}) {
    const result = await this.callMCP('tools/call', {
      name: 'list_workflows',
      arguments: options,
    });
    console.log(`   Response: ${result.content[0].text.substring(0, 100)}...`);
    return result;
  }

  async listCredentials() {
    const result = await this.callMCP('tools/call', {
      name: 'list_credentials',
      arguments: {},
    });
    console.log(`   Response: ${result.content[0].text.substring(0, 100)}...`);
    return result;
  }

  async listNodeTypes() {
    const result = await this.callMCP('tools/call', {
      name: 'list_node_types',
      arguments: {},
    });
    console.log(`   Response: ${result.content[0].text.substring(0, 100)}...`);
    return result;
  }
}

// Example usage
async function main() {
  console.log('🔌 n8n MCP SSE Client - Node.js Example\n');

  const client = new MCPClient('http://localhost:3000');

  try {
    console.log('='.repeat(60));
    console.log('Testing SSE Transport');
    console.log('='.repeat(60));

    // Test 1: List tools
    await client.listTools();

    // Test 2: List workflows
    await client.listWorkflows({ active: true });

    // Test 3: List credentials
    await client.listCredentials();

    // Test 4: List node types
    await client.listNodeTypes();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
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
