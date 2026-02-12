# SSE Troubleshooting Guide

**Version**: 2.2.0
**Last Updated**: 2026-02-12

---

## Common Issues & Solutions

### 1. Connection Errors

#### Issue: "Failed to fetch" / "Network request failed"

**Symptoms**:
- Browser console shows CORS error
- Request fails immediately
- No response from server

**Possible Causes**:
1. Server không chạy
2. Wrong URL/port
3. CORS configuration issue
4. Firewall blocking connection

**Solutions**:

**A. Verify server is running**:
```bash
docker compose ps
# Should show n8n-mcp container as "Up" and "healthy"
```

**B. Check server health**:
```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy","timestamp":"..."}
```

**C. Verify port mapping**:
```bash
docker compose ps
# Check PORTS column: 0.0.0.0:3000->3000/tcp
```

**D. Test with curl**:
```bash
curl -N -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**E. Check CORS headers**:
```bash
curl -v -X OPTIONS http://localhost:3000/mcp
# Should include: Access-Control-Allow-Origin: *
```

---

### 2. "Not Acceptable" Error

#### Issue: Server returns 406 Not Acceptable

**Error Message**:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Not Acceptable: Client must accept both application/json and text/event-stream"
  },
  "id": null
}
```

**Cause**: Missing hoặc incorrect Accept header

**Solution**: Thêm cả 2 content types vào Accept header:

```javascript
// ❌ Wrong
headers: {
  'Accept': 'text/event-stream',
}

// ✅ Correct
headers: {
  'Accept': 'application/json, text/event-stream',
}
```

---

### 3. CORS Errors (Browser Only)

#### Issue: "Access to fetch blocked by CORS policy"

**Error in Console**:
```
Access to fetch at 'http://localhost:3000/mcp' from origin 'http://localhost:5173'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Possible Causes**:
1. Server không có `--cors` flag
2. Browser blocking localhost requests
3. HTTPS/HTTP mixed content

**Solutions**:

**A. Verify CORS is enabled**:
Server mặc định cho phép CORS cho tất cả các origin (*). Kiểm tra trong `src/index.ts` để cấu hình chi tiết hơn nếu cần.

**B. Restart server**:
```bash
docker compose down
docker compose up -d --build
```

**C. Test CORS headers**:
```bash
curl -v -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://localhost:3000/mcp

# Expected headers:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, OPTIONS
```

**D. Browser workaround** (development only):
- Chrome: Launch với `--disable-web-security --user-data-dir=/tmp/chrome-dev`
- Firefox: Set `security.fileuri.strict_origin_policy` = false trong about:config

**⚠️ Warning**: Disable CORS chỉ dùng cho development, KHÔNG dùng trong production!

---

### 4. Incomplete/Malformed SSE Events

#### Issue: JSON parsing fails với "Unexpected end of input"

**Symptoms**:
- `JSON.parse()` throws error
- Events bị cắt giữa chừng
- Response không complete

**Cause**: Không buffer events đúng cách

**Solution**: Implement proper event buffering:

```javascript
// ❌ Wrong - không buffer
for await (const chunk of response.body) {
  const text = chunk.toString();
  const data = JSON.parse(text); // May fail if chunk is incomplete
}

// ✅ Correct - với buffering
let buffer = '';

for await (const chunk of response.body) {
  buffer += chunk.toString();

  // Split by double newline (SSE delimiter)
  const events = buffer.split('\n\n');
  buffer = events.pop(); // Keep incomplete event in buffer

  for (const event of events) {
    if (!event.trim()) continue;

    // Parse complete event
    const lines = event.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        console.log('Parsed:', data);
      }
    }
  }
}
```

---

### 5. Request Timeout

#### Issue: Request hangs indefinitely

**Symptoms**:
- No response after long wait
- Browser tab freezes
- No error message

**Possible Causes**:
1. Server processing quá lâu
2. Network issue
3. No timeout configured

**Solutions**:

**A. Implement timeout**:
```javascript
async function callWithTimeout(promise, timeoutMs = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

// Usage
try {
  const result = await callWithTimeout(
    client.callMCP('execute_workflow', { id: '123' }),
    60000 // 60 seconds
  );
} catch (error) {
  if (error.message === 'Request timeout') {
    console.error('Workflow execution took too long');
  }
}
```

**B. Check server logs**:
```bash
docker compose logs -f n8n-mcp
# Look for errors or slow operations
```

**C. Test với simple request**:
```bash
# Should respond quickly
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  --max-time 5
```

---

### 6. "Method not allowed" Error

#### Issue: GET requests fail với "Method not allowed"

**Error**:
```json
{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}
```

**Cause**: MCP endpoint chỉ accept POST requests

**Solution**: Dùng POST thay vì GET:

```javascript
// ❌ Wrong - EventSource chỉ hỗ trợ GET
const eventSource = new EventSource('http://localhost:3000/mcp');

// ✅ Correct - Dùng fetch với POST
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1,
  }),
});
```

---

### 7. n8n API Errors

#### Issue: "Unauthorized" / "API key invalid"

**Error**:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "n8n API error: 401 Unauthorized"
  },
  "id": 1
}
```

**Possible Causes**:
1. N8N_API_KEY không đúng
2. n8n instance không chạy
3. Network issue giữa MCP server và n8n

**Solutions**:

**A. Verify API key**:
```bash
# Check .env file
cat .env | grep N8N_API_KEY

# Test API key directly
curl -H "X-N8N-API-KEY: your-key-here" \
     http://localhost:5678/api/v1/workflows
```

**B. Check n8n is running**:
```bash
docker compose ps
# n8n container should be "Up"

curl http://localhost:5678/healthz
# Should return 200 OK
```

**C. Verify network connectivity**:
```bash
# From MCP container
docker compose exec n8n-mcp curl http://n8n:5678/healthz
# Should succeed
```

**D. Check environment variables**:
```bash
docker compose exec n8n-mcp env | grep N8N
# Should show N8N_HOST and N8N_API_KEY
```

---

### 8. Workflow Validation Errors

#### Issue: "Invalid workflow structure"

**Error**:
```json
{
  "valid": false,
  "errors": [
    "Duplicate node ID: node-1",
    "Invalid connection: node-2 -> node-3"
  ]
}
```

**Cause**: Workflow JSON không đúng format

**Solutions**:

**A. Validate trước khi create**:
```javascript
// Always validate first
const validation = await client.callMCP('tools/call', {
  name: 'validate_workflow_structure',
  arguments: { workflow: myWorkflow },
});

if (!validation.result.valid) {
  console.error('Validation errors:', validation.result.errors);
  return;
}

// Only create if valid
await client.callMCP('tools/call', {
  name: 'create_workflow',
  arguments: myWorkflow,
});
```

**B. Check common issues**:
- Node IDs phải unique
- Node names phải unique
- Connections phải reference existing nodes
- Node types phải tồn tại trong n8n instance

**C. Use linter**:
```javascript
const lintResult = await client.callMCP('tools/call', {
  name: 'lint_workflow',
  arguments: { workflow: myWorkflow },
});

console.log('Lint score:', lintResult.result.score);
console.log('Issues:', lintResult.result.issues);
```

---

### 9. Memory/Performance Issues

#### Issue: Browser tab crashes hoặc slow performance

**Symptoms**:
- High memory usage
- Browser becomes unresponsive
- Slow response times

**Possible Causes**:
1. Large responses không được cleanup
2. Too many concurrent requests
3. Memory leaks trong client code

**Solutions**:

**A. Limit response size**:
```javascript
// Add pagination
const workflows = await client.callMCP('tools/call', {
  name: 'list_workflows',
  arguments: { limit: 50 }, // Limit results
});
```

**B. Cleanup resources**:
```javascript
// Close readers when done
const reader = response.body.getReader();
try {
  // ... process stream
} finally {
  reader.releaseLock();
}
```

**C. Implement request queue**:
```javascript
class RequestQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async add(fn) {
    while (this.running >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
    }
  }
}

// Usage
const queue = new RequestQueue(3);
const results = await Promise.all([
  queue.add(() => client.listWorkflows()),
  queue.add(() => client.listCredentials()),
  queue.add(() => client.listNodeTypes()),
]);
```

---

### 10. Docker/Container Issues

#### Issue: Container không start hoặc unhealthy

**Symptoms**:
- `docker compose ps` shows "Exited" hoặc "Unhealthy"
- Healthcheck fails
- Container restarts repeatedly

**Solutions**:

**A. Check container logs**:
```bash
docker compose logs n8n-mcp
# Look for error messages
```

**B. Verify build**:
```bash
docker compose build --no-cache n8n-mcp
docker compose up -d n8n-mcp
```

**C. Check healthcheck**:
```bash
docker compose exec n8n-mcp curl -f http://localhost:3000/health
# Should return {"status":"healthy"}
```

**D. Verify dependencies**:
```bash
# Check if n8n is running first
docker compose ps n8n
# n8n must be up before MCP server
```

**E. Check resource limits**:
```bash
docker stats
# Verify container has enough memory/CPU
```

---

## Debugging Tips

### 1. Enable Verbose Logging

**Browser DevTools**:
```javascript
// Add logging to client
class MCPClient {
  async callMCP(method, params) {
    console.log('Request:', { method, params });

    const response = await fetch(/* ... */);

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    // ... rest of code
  }
}
```

**Server Logs**:
```bash
# Follow logs in real-time
docker compose logs -f n8n-mcp

# Filter for errors
docker compose logs n8n-mcp | grep -i error
```

### 2. Test with curl

**Basic test**:
```bash
curl -v -N -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**Save response to file**:
```bash
curl -N -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  > response.txt
```

**Test with timeout**:
```bash
curl --max-time 10 -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"list_workflows","id":1}'
```

### 3. Browser DevTools Network Tab

**Steps**:
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Make request from client
5. Click on request to see:
   - Request headers
   - Response headers
   - Response body
   - Timing information

**Look for**:
- Status code (should be 200)
- Content-Type header (should be `text/event-stream`)
- Response body (should show SSE events)

### 4. Verify SSE Format

**Expected format**:
```
event: message
data: {"jsonrpc":"2.0","result":{...},"id":1}

```

**Common mistakes**:
- Missing double newline at end
- Wrong event type
- Invalid JSON in data field
- Missing `data:` prefix

### 5. Test Individual Components

**Test n8n API directly**:
```bash
curl -H "X-N8N-API-KEY: your-key" \
     http://localhost:5678/api/v1/workflows
```

**Test server health**:
```bash
curl http://localhost:3000/health
```

**Test MCP server (stdio)**:
```bash
docker compose exec n8n-mcp node dist/index.js
# Should start MCP server on stdio
```

---

## Performance Optimization

### 1. Reduce Response Size

```javascript
// Use pagination
const workflows = await client.listWorkflows({ limit: 20 });

// Filter results
const activeWorkflows = await client.listWorkflows({ active: true });

// Request specific fields only (if supported)
const workflow = await client.getWorkflow(id);
```

### 2. Implement Caching

```javascript
class CachedMCPClient extends MCPClient {
  constructor(baseUrl) {
    super(baseUrl);
    this.cache = new Map();
    this.cacheTTL = 60000; // 1 minute
  }

  async callMCP(method, params) {
    const cacheKey = `${method}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('Cache hit:', cacheKey);
      return cached.data;
    }

    const result = await super.callMCP(method, params);

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }
}
```

### 3. Batch Requests

```javascript
// Instead of sequential requests
const workflows = await client.listWorkflows();
const credentials = await client.listCredentials();
const nodeTypes = await client.listNodeTypes();

// Use parallel requests
const [workflows, credentials, nodeTypes] = await Promise.all([
  client.listWorkflows(),
  client.listCredentials(),
  client.listNodeTypes(),
]);
```

---

## Security Best Practices

### 1. Never Expose API Keys

```javascript
// ❌ Wrong - API key in client code
const client = new MCPClient('http://localhost:3000', 'my-api-key');

// ✅ Correct - API key stored server-side
const client = new MCPClient('http://localhost:3000');
// Server handles n8n API key internally
```

### 2. Validate User Input

```javascript
function sanitizeWorkflowName(name) {
  // Remove special characters
  return name.replace(/[^a-zA-Z0-9\s-_]/g, '');
}

const workflow = {
  name: sanitizeWorkflowName(userInput),
  // ... rest of workflow
};
```

### 3. Implement Rate Limiting

```javascript
class RateLimitedClient extends MCPClient {
  constructor(baseUrl, maxRequestsPerMinute = 60) {
    super(baseUrl);
    this.maxRequests = maxRequestsPerMinute;
    this.requests = [];
  }

  async callMCP(method, params) {
    // Remove old requests
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < 60000);

    // Check rate limit
    if (this.requests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded');
    }

    this.requests.push(now);
    return await super.callMCP(method, params);
  }
}
```

---

## Getting Help

### 1. Check Documentation

- [SSE Integration Guide](sse-integration-guide.md)
- [System Architecture](system-architecture.md)
- [API Reference](API.md)

### 2. Search Issues

- GitHub Issues: Check for similar problems
- Stack Overflow: Search for SSE/MCP related questions

### 3. Provide Debug Information

When reporting issues, include:
- Error message (full stack trace)
- Request/response details
- Server logs (`docker compose logs n8n-mcp`)
- Environment info (OS, Node version, browser)
- Steps to reproduce

### 4. Test Environment

```bash
# System info
uname -a
node --version
docker --version

# Container status
docker compose ps

# Server health
curl http://localhost:3000/health

# Test request
curl -v -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## FAQ

**Q: SSE có hoạt động với HTTPS không?**
A: Có, SSE hoạt động tốt với HTTPS. Chỉ cần đảm bảo certificate hợp lệ.

**Q: Có thể dùng SSE với authentication không?**
A: Có, thêm authentication headers vào fetch request. n8n API key được handle server-side.

**Q: SSE có support binary data không?**
A: Không, SSE chỉ support text. Dùng base64 encoding cho binary data.

**Q: Làm sao để handle connection drops?**
A: Implement retry logic với exponential backoff. Browser EventSource tự động reconnect.

**Q: SSE có tốn nhiều bandwidth không?**
A: Không, SSE chỉ gửi data khi có updates. Overhead minimal so với polling.

**Q: Có thể dùng SSE cho production không?**
A: Có, nhưng cần thêm authentication, rate limiting, và monitoring.
