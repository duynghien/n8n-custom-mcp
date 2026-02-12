# SSE Client Examples

Các example clients để test SSE transport của n8n-custom-mcp server.

## Files

### 1. sse-client.html
**Browser-based client** với UI đẹp mắt.

**Features**:
- Visual interface với quick actions
- Real-time output display
- Session management
- Custom request builder

**Usage**:
```bash
# Open trong browser
open examples/sse-client.html

# Hoặc serve với HTTP server
python3 -m http.server 8000
# Truy cập: http://localhost:8000/examples/sse-client.html
```

### 2. sse-client-simple.js
**Node.js client** đơn giản, dễ hiểu.

**Features**:
- Minimal dependencies (chỉ cần Node.js 18+)
- Clear example code
- Error handling
- Multiple test cases

**Usage**:
```bash
node examples/sse-client-simple.js
```

### 3. sse-client.js
**Node.js client** đầy đủ với streaming support.

**Features**:
- Full SSE streaming implementation
- Comprehensive API methods
- Can be used as module
- Production-ready error handling

**Usage**:
```bash
# Run as script
node examples/sse-client.js

# Use as module
import { MCPClient } from './examples/sse-client.js';
const client = new MCPClient('http://localhost:3000');
await client.listWorkflows();
```

## Requirements

- n8n-custom-mcp server running on `http://localhost:3000`
- Node.js 18+ (for Node.js examples)
- Modern browser (for HTML example)

## Quick Start

1. Start MCP server:
```bash
docker compose up -d
```

2. Test với browser client:
```bash
open examples/sse-client.html
```

3. Test với Node.js client:
```bash
node examples/sse-client-simple.js
```

## Documentation

- [SSE Integration Guide](../docs/sse-integration-guide.md) - Chi tiết về SSE integration
- [Troubleshooting SSE](../docs/troubleshooting-sse.md) - Xử lý lỗi thường gặp
- [System Architecture](../docs/system-architecture.md) - Kiến trúc SSE transport

## Common Issues

### CORS Errors
Nếu gặp CORS errors trong browser, verify server có `--cors` flag:
```bash
docker compose logs n8n-mcp | grep cors
```

### Connection Refused
Verify server đang chạy:
```bash
curl http://localhost:3000/health
```

### No Response
Check Accept header có đúng không:
```javascript
headers: {
  'Accept': 'application/json, text/event-stream',
}
```

Xem thêm: [Troubleshooting Guide](../docs/troubleshooting-sse.md)
