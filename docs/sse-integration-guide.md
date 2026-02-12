# SSE Integration Guide

**Version**: 2.2.0
**Last Updated**: 2026-02-12

---

## Overview

n8n-custom-mcp hỗ trợ **Native Server-Sent Events (SSE)** tích hợp sẵn, cho phép browser và HTTP clients kết nối trực tiếp mà không cần công cụ trung gian. Guide này hướng dẫn cách tích hợp SSE clients với MCP server.

---

## Table of Contents

1. [SSE Basics](#sse-basics)
2. [Browser Integration](#browser-integration)
3. [Node.js Integration](#nodejs-integration)
4. [Python Integration](#python-integration)
5. [Advanced Usage](#advanced-usage)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## SSE Basics

### What is SSE?

Server-Sent Events (SSE) là một web standard cho phép server push real-time updates đến client qua HTTP connection. Khác với WebSocket (bidirectional), SSE là unidirectional (server → client).

### Why SSE for MCP?

- ✅ **Browser native**: Không cần WebSocket libraries
- ✅ **HTTP-based**: Hoạt động qua firewalls và proxies
- ✅ **Automatic reconnection**: Browser tự động reconnect khi mất kết nối
- ✅ **Simple protocol**: Dễ debug với curl/browser DevTools

### SSE Event Format

```
event: message
data: {"jsonrpc":"2.0","result":{"tools":[...]},"id":1}

```

**Structure**:
- `event:` - Event type (luôn là `message` cho MCP responses)
- `data:` - JSON-RPC 2.0 response object
- Empty line (`\n\n`) - Event delimiter

---

## Browser Integration

### Method 1: Fetch API with ReadableStream (Recommended)

**Advantages**:
- Hỗ trợ POST requests
- Full control over headers
- Modern và performant

**Example**:

```javascript
class MCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.requestId = 0;
  }

  async callTool(method, params = {}) {
    this.requestId++;

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

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
          return data; // Return first complete response
        }
      }
    }

    throw new Error('No response received');
  }

  async listWorkflows(options = {}) {
    return await this.callTool('tools/call', {
      name: 'list_workflows',
      arguments: options,
    });
  }

  async createWorkflow(workflow) {
    return await this.callTool('tools/call', {
      name: 'create_workflow',
      arguments: workflow,
    });
  }

  async getWorkflow(id) {
    return await this.callTool('tools/call', {
      name: 'get_workflow',
      arguments: { id },
    });
  }
}

// Usage
const client = new MCPClient();

try {
  const response = await client.listWorkflows({ active: true });
  console.log('Workflows:', response.result);
} catch (error) {
  console.error('Error:', error);
}
```

### Method 2: EventSource API (GET only)

**Limitations**:
- Chỉ hỗ trợ GET requests
- Không thể gửi JSON-RPC payload trong body
- Không phù hợp cho MCP (cần POST)

**Not recommended for MCP**, nhưng có thể dùng cho health checks:

```javascript
const eventSource = new EventSource('http://localhost:3000/health');

eventSource.onmessage = (event) => {
  console.log('Health status:', JSON.parse(event.data));
};

eventSource.onerror = (error) => {
  console.error('Connection error:', error);
  eventSource.close();
};
```

### Method 3: Using @microsoft/fetch-event-source

**Advantages**:
- Handles SSE parsing automatically
- Supports POST requests
- Automatic reconnection
- Better error handling

**Installation**:
```bash
npm install @microsoft/fetch-event-source
```

**Example**:

```javascript
import { fetchEventSource } from '@microsoft/fetch-event-source';

class MCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.requestId = 0;
  }

  async callTool(method, params = {}) {
    this.requestId++;

    return new Promise((resolve, reject) => {
      let result = null;

      fetchEventSource(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: this.requestId,
        }),
        onmessage(event) {
          const data = JSON.parse(event.data);
          result = data;
        },
        onclose() {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Connection closed without response'));
          }
        },
        onerror(error) {
          reject(error);
          throw error; // Stop reconnection
        },
      });
    });
  }
}

// Usage
const client = new MCPClient();
const response = await client.callTool('tools/list');
console.log('Tools:', response.result.tools);
```

---

## Node.js Integration

### Method 1: Native fetch() (Node.js 18+)

**Example**:

```javascript
const fetch = require('node-fetch'); // or use native fetch in Node 18+

class MCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.requestId = 0;
  }

  async callTool(method, params = {}) {
    this.requestId++;

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse SSE stream
    let buffer = '';

    for await (const chunk of response.body) {
      buffer += chunk.toString();

      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const event of events) {
        if (!event.trim()) continue;

        const lines = event.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            return JSON.parse(line.slice(6));
          }
        }
      }
    }

    throw new Error('No response received');
  }

  async listWorkflows(options = {}) {
    const response = await this.callTool('tools/call', {
      name: 'list_workflows',
      arguments: options,
    });
    return response.result;
  }

  async executeWorkflow(id) {
    const response = await this.callTool('tools/call', {
      name: 'execute_workflow',
      arguments: { id },
    });
    return response.result;
  }
}

// Usage
(async () => {
  const client = new MCPClient();

  try {
    const workflows = await client.listWorkflows({ active: true });
    console.log('Active workflows:', workflows);

    if (workflows.length > 0) {
      const execution = await client.executeWorkflow(workflows[0].id);
      console.log('Execution started:', execution);
    }
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

### Method 2: Using eventsource package

**Installation**:
```bash
npm install eventsource
```

**Limitation**: EventSource chỉ hỗ trợ GET, không phù hợp cho MCP POST requests.

**Alternative**: Dùng `fetch()` như Method 1.

---

## Python Integration

### Using httpx with SSE support

**Installation**:
```bash
pip install httpx httpx-sse
```

**Example**:

```python
import httpx
from httpx_sse import connect_sse
import json

class MCPClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.request_id = 0

    def call_tool(self, method, params=None):
        self.request_id += 1
        params = params or {}

        payload = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params,
            'id': self.request_id,
        }

        with httpx.Client() as client:
            with connect_sse(
                client,
                'POST',
                f'{self.base_url}/mcp',
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                },
                json=payload,
            ) as event_source:
                for sse in event_source.iter_sse():
                    if sse.event == 'message':
                        return json.loads(sse.data)

        raise Exception('No response received')

    def list_workflows(self, **options):
        response = self.call_tool('tools/call', {
            'name': 'list_workflows',
            'arguments': options,
        })
        return response['result']

    def create_workflow(self, workflow):
        response = self.call_tool('tools/call', {
            'name': 'create_workflow',
            'arguments': workflow,
        })
        return response['result']

# Usage
if __name__ == '__main__':
    client = MCPClient()

    try:
        workflows = client.list_workflows(active=True)
        print(f'Found {len(workflows)} active workflows')

        for wf in workflows:
            print(f'- {wf["name"]} (ID: {wf["id"]})')
    except Exception as e:
        print(f'Error: {e}')
```

---

## Advanced Usage

### Session Management

Sử dụng custom headers để track sessions:

```javascript
class MCPClient {
  constructor(baseUrl, sessionId = null) {
    this.baseUrl = baseUrl;
    this.sessionId = sessionId || `session-${Date.now()}`;
    this.requestId = 0;
  }

  async callTool(method, params = {}) {
    this.requestId++;

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Session-Id': this.sessionId, // Custom session header
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId,
      }),
    });

    // ... parse response
  }
}
```

### Error Handling

```javascript
async function callToolWithRetry(client, method, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.callTool(method, params);
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

// Usage
try {
  const response = await callToolWithRetry(client, 'tools/list', {}, 3);
  console.log('Success:', response);
} catch (error) {
  console.error('All retries failed:', error);
}
```

### Timeout Handling

```javascript
async function callToolWithTimeout(client, method, params, timeoutMs = 30000) {
  return Promise.race([
    client.callTool(method, params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

// Usage
try {
  const response = await callToolWithTimeout(client, 'execute_workflow', { id: '123' }, 60000);
  console.log('Execution result:', response);
} catch (error) {
  if (error.message === 'Request timeout') {
    console.error('Workflow execution took too long');
  } else {
    console.error('Error:', error);
  }
}
```

### Batch Requests

```javascript
async function batchCallTools(client, requests) {
  const promises = requests.map(({ method, params }) =>
    client.callTool(method, params).catch(error => ({ error: error.message }))
  );

  return await Promise.all(promises);
}

// Usage
const results = await batchCallTools(client, [
  { method: 'tools/call', params: { name: 'list_workflows', arguments: {} } },
  { method: 'tools/call', params: { name: 'list_credentials', arguments: {} } },
  { method: 'tools/call', params: { name: 'list_node_types', arguments: {} } },
]);

console.log('Workflows:', results[0].result);
console.log('Credentials:', results[1].result);
console.log('Node types:', results[2].result);
```

---

## Best Practices

### 1. Connection Management

**DO**:
- Reuse client instances cho multiple requests
- Implement connection pooling cho high-traffic applications
- Close connections khi không còn cần thiết

**DON'T**:
- Tạo new client cho mỗi request
- Giữ connections open vô thời hạn
- Ignore connection errors

### 2. Error Handling

**DO**:
- Implement retry logic với exponential backoff
- Log errors với context (request ID, method, params)
- Handle network errors riêng biệt với application errors

**DON'T**:
- Swallow errors without logging
- Retry indefinitely
- Expose sensitive error details đến end users

### 3. Performance

**DO**:
- Batch requests khi có thể
- Implement caching cho frequently accessed data
- Use timeouts để prevent hanging requests

**DON'T**:
- Make sequential requests khi có thể parallel
- Fetch large datasets without pagination
- Ignore response times

### 4. Security

**DO**:
- Use HTTPS trong production
- Validate responses trước khi sử dụng
- Implement rate limiting ở client-side

**DON'T**:
- Expose MCP endpoint publicly without authentication
- Trust user input without validation
- Log sensitive data (credentials, API keys)

---

## Troubleshooting

### Common Issues

#### 1. "Not Acceptable" Error

**Error**:
```json
{"error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"}}
```

**Solution**: Thêm cả 2 content types vào Accept header:
```javascript
headers: {
  'Accept': 'application/json, text/event-stream',
}
```

#### 2. CORS Errors (Browser)

**Error**: `Access-Control-Allow-Origin` missing

**Solution**: Supergateway đã enable CORS với `--cors` flag. Nếu vẫn gặp lỗi, check:
- Server có đang chạy không?
- Port mapping đúng chưa? (3000 → 3000)
- Browser có block requests không? (check DevTools Console)

#### 3. Connection Timeout

**Error**: Request hangs indefinitely

**Solution**:
- Implement timeout logic (see [Timeout Handling](#timeout-handling))
- Check network connectivity
- Verify server health: `curl http://localhost:3000/health`

#### 4. Incomplete SSE Events

**Error**: Parsing fails với incomplete JSON

**Solution**: Buffer events đúng cách:
```javascript
let buffer = '';

for await (const chunk of response.body) {
  buffer += chunk.toString();

  const events = buffer.split('\n\n');
  buffer = events.pop(); // Keep incomplete event

  // Process complete events...
}
```

### Debug Tips

**1. Test với curl**:
```bash
curl -v -N -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**2. Check response headers**:
```javascript
console.log('Content-Type:', response.headers.get('content-type'));
console.log('Status:', response.status);
```

**3. Log raw SSE data**:
```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  console.log('Raw SSE chunk:', chunk);
}
```

---

## Examples

Xem thêm working examples tại:
- [examples/sse-client.html](../examples/sse-client.html) - Browser client
- [examples/sse-client.js](../examples/sse-client.js) - Node.js client

---

## References

- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [MDN: Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
