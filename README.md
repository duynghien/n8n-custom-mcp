# 🔌 n8n-custom-mcp v2.2.1

**Full-power MCP Server cho n8n — Dành cho AI Agent thực sự muốn _làm chủ_ workflow.**

[![Version](https://img.shields.io/badge/version-2.2.1-blue.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-229%20passed-success.svg)](src/__tests__/)
[![Coverage](https://img.shields.io/badge/coverage-82%25-green.svg)](plans/reports/tester-260211-2000-system-validation.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)
[![n8n](https://img.shields.io/badge/n8n-API%20v1-orange.svg)](https://docs.n8n.io/api/)

[Tính năng](#-tính-năng) · [Cài đặt](#-cài-đặt-nhanh) · [Cấu hình](#%EF%B8%8F-cấu-hình) · [Sử dụng](#-sử-dụng) · [Đóng góp](#-đóng-góp)

---

<img src="https://raw.githubusercontent.com/duynghien/n8n-custom-mcp/main/docs/architecture.png" alt="Architecture" width="700" />

## ❓ Tại sao cần repo này?

Các MCP Server hiện tại cho n8n (ví dụ [`czlonkowski/n8n-mcp`](https://github.com/czlonkowski/n8n-mcp)) chỉ hỗ trợ **đọc và chạy** workflow. Bạn không thể tạo mới, chỉnh sửa, xoá, hay test webhook từ AI agent.

**n8n-custom-mcp** giải quyết triệt để vấn đề này bằng cách cung cấp **31 tools** bao phủ toàn bộ vòng đời quản lý workflow và credentials:

| Khả năng | MCP Server khác | n8n-custom-mcp |
|:---------|:---:|:---:|
| Liệt kê & Xem workflow | ✅ | ✅ |
| Chạy workflow | ✅ | ✅ |
| Bật / Tắt workflow | ✅ | ✅ |
| **Tạo mới workflow** | ❌ | ✅ |
| **Sửa workflow** | ❌ | ✅ |
| **Xoá workflow** | ❌ | ✅ |
| **Test Webhook** (kể cả test mode) | ❌ | ✅ |
| **Xem lịch sử execution** | ❌ | ✅ |
| **Debug chi tiết execution** | ❌ | ✅ |
| **Liệt kê node types** | ❌ | ✅ |
| **Quản lý Credentials** | ❌ | ✅ |

## 🚀 Tính năng

### 📋 Workflow CRUD
Tạo, đọc, sửa, xoá workflow hoàn toàn qua MCP — AI agent có thể tự xây dựng workflow từ đầu bằng ngôn ngữ tự nhiên.

### 🔐 Credentials Management (NEW in v2.0)
Quản lý credentials hoàn toàn tự động:
- Tạo, cập nhật, xoá credentials với validation schema.
- Liệt kê credentials từ workflows và database fallback.
- Test credential validity trực tiếp từ MCP.
- Safety checks ngăn chặn xoá credentials đang được sử dụng bởi workflows.

### ✅ Workflow Validation & Linting (NEW in v2.0)
Hệ thống kiểm tra thông minh giúp AI agent tự tin hơn khi deploy:
- **Structure**: Kiểm tra JSON, duplicate IDs, connections và circular loops.
- **Credentials**: Xác thực mapping credentials và yêu cầu của node.
- **Expressions**: Validate cú pháp JavaScript và biến trong biểu thức `{{ }}`.
- **Linter**: Phát hiện orphaned nodes, hardcoded secrets và đặt tên không rõ ràng.
- **Suggestions**: Gợi ý tối ưu hóa cấu trúc (Set nodes, Error handling, Batching).

### 💾 Backup & Versioning (NEW in v2.0)
An toàn tuyệt đối cho workflow của bạn:
- **Auto-backup**: Tự động lưu bản sao trước khi thực hiện các thay đổi quan trọng.
- **Versioning**: Lưu trữ tối đa 10 phiên bản cục bộ cho mỗi workflow.
- **Restore**: Khôi phục nhanh chóng về bất kỳ phiên bản nào trong lịch sử.
- **Diff**: So sánh sự khác biệt cấu trúc giữa các phiên bản.

### 🎯 Webhook Testing
Tool `trigger_webhook` hỗ trợ:
- Gọi webhook với đầy đủ HTTP methods (GET/POST/PUT/DELETE).
- **Test mode** (`/webhook-test/`) để hiển thị dữ liệu trực quan trên n8n Editor.
- **Production mode** (`/webhook/`) cho các webhook đã active.
- Custom headers & query parameters.

### 🔍 Execution Debugging
Theo dõi và khắc phục lỗi thời gian thực:
- Liệt kê lịch sử chạy, lọc theo trạng thái (success/error/waiting).
- Xem chi tiết input/output data của từng node cụ thể.
- Đọc thông báo lỗi chi tiết để AI có thể tự sửa lỗi logic.

### 🐳 Docker-Ready
Đóng gói tối ưu với:
- Multi-stage build (Node 20 Alpine).
- Tích hợp `postgresql-client` cho DB fallback.
- Healthcheck tự động giám sát trạng thái server.
- **Native SSE & Hybrid Support**: Tự động hỗ trợ các client LobeHub, Claude Desktop và Browser.

## 📦 Cài đặt nhanh

### Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- n8n instance đang chạy (hoặc chạy cùng docker-compose)
- [n8n API Key](https://docs.n8n.io/api/authentication/)

### Bước 1: Clone

```bash
git clone https://github.com/duynghien/n8n-custom-mcp.git
cd n8n-custom-mcp
```

### Bước 2: Cấu hình biến môi trường

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
N8N_HOST=http://n8n:5678       # URL nội bộ Docker
N8N_API_KEY=your_api_key_here  # Tạo tại n8n → Settings → API
```

### Bước 3: Chạy

**Standalone (chỉ MCP server):**

```bash
docker compose up -d --build
```

**Tích hợp vào n8n stack có sẵn:**

Thêm service sau vào file `docker-compose.yml` của bạn:

```yaml
n8n-mcp:
  build:
    context: ./n8n-custom-mcp
  restart: always
  ports:
    - "3000:3000"
  environment:
    - N8N_HOST=http://n8n:5678
    - N8N_API_KEY=${N8N_API_KEY}
    - MCP_TRANSPORT=sse
    - PORT=3000
```

### Bước 4: Kết nối LobeHub/OpenClaw

Trong phần cấu hình MCP Plugin:

| Trường | Giá trị |
|:-------|:--------|
| Type | MCP (Streamable HTTP) |
| URL | `http://<IP-máy-chủ>:3000/mcp` |

Sau khi kết nối, bạn sẽ thấy **31 tools** xuất hiện. ✅

### Bước 5: Setup MCP cho Coding Agents (Claude Code, Codex, Antigravity, Cursor)

Server này hỗ trợ tốt nhất qua **Streamable HTTP**:

- URL: `http://localhost:3000/mcp`
- Method: `POST`
- Header gợi ý: `Accept: application/json, text/event-stream`

Nếu agent của bạn hỗ trợ MCP dạng JSON `mcpServers`, dùng mẫu chung sau:

```json
{
  "mcpServers": {
    "n8n-custom-mcp": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

#### Claude Code

1. Mở phần cấu hình MCP của Claude Code.
2. Thêm server `n8n-custom-mcp` theo mẫu trên.
3. Reload session, chạy `tools/list` để verify đã thấy đầy đủ tools.

#### Codex

1. Mở MCP config của Codex.
2. Khai báo `n8n-custom-mcp` với `type=streamable-http`, `url=http://localhost:3000/mcp`.
3. Reload agent rồi test bằng call `list_workflows`.

#### Antigravity

1. Vào phần MCP/Tools integration.
2. Thêm MCP endpoint `http://localhost:3000/mcp` theo mẫu `mcpServers`.
3. Kết nối lại agent và kiểm tra tool `tools/list`.

#### Cursor

1. Mở MCP config trong Cursor.
2. Thêm `n8n-custom-mcp` với `type: "streamable-http"` và URL như trên.
3. Reload Cursor rồi thử gọi `get_workflow` hoặc `list_workflows`.

#### Fallback: stdio (khi agent không hỗ trợ streamable-http)

Build trước:

```bash
npm run build
```

Mẫu cấu hình stdio:

```json
{
  "mcpServers": {
    "n8n-custom-mcp-stdio": {
      "command": "node",
      "args": ["/absolute/path/to/n8n-custom-mcp/dist/index.js"],
      "env": {
        "N8N_HOST": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## ⚙️ Cấu hình

### Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|:-----|:--------:|:---------|:------|
| `N8N_HOST` | ✅ | `http://localhost:5678` | URL đến n8n instance |
| `N8N_API_KEY` | ✅ | — | API Key từ n8n Settings |
| `PORT` | ❌ | `3000` | Port cho MCP HTTP endpoint |

> **Ghi chú cho DB Fallback**: Để sử dụng tính năng liệt kê credentials từ database khi API bị hạn chế, hãy đảm bảo container MCP có quyền truy cập vào mạng của Postgres và cấu hình các biến `DB_POSTGRESDB_*` tương ứng.

### Persistence

Để lưu trữ các bản backup workflow bền vững qua các lần khởi động lại Docker, hãy mount volume cho thư mục `/app/backups`:

```yaml
volumes:
  - ./backups:/app/backups
```

### Native Transport (NEW)

Từ v2.2.0, server chạy native SSE trực tiếp. Không cần cài đặt thêm `supergateway`.

## 💡 Sử dụng

### Danh sách 31 Tools

#### Workflow Management (12 tools)

| Tool | Mô tả |
|:-----|:------|
| `list_workflows` | Liệt kê workflows (lọc theo active, limit, tags) |
| `get_workflow` | Xem chi tiết JSON của workflow |
| `create_workflow` | Tạo workflow mới từ JSON definition |
| `update_workflow` | Cập nhật workflow (tên, nodes, connections...) |
| `delete_workflow` | Xoá workflow |
| `activate_workflow` | Bật hoặc tắt workflow |
| `execute_workflow` | Chạy workflow theo ID |
| `trigger_webhook` | Gọi webhook endpoint (hỗ trợ test mode) |
| `list_executions` | Xem lịch sử chạy, lọc theo status/workflow |
| `get_execution` | Xem chi tiết execution (data, errors) |
| `list_node_types` | Liệt kê các node types đang cài |
| `validate_workflow_structure` | Kiểm tra lỗi cấu trúc workflow trước khi deploy |

#### Credentials Management (6 tools)

| Tool | Mô tả |
|:-----|:------|
| `get_credential_schema` | Lấy schema (required fields) của credential type |
| `list_credentials` | Liệt kê credentials (từ workflows + database) |
| `create_credential` | Tạo credential mới với validation |
| `update_credential` | Cập nhật credential existing |
| `delete_credential` | Xoá credential (có safety check) |
| `test_credential` | Test credential validity tự động |

#### Template System (4 tools)

| Tool | Mô tả |
|:-----|:------|
| `search_templates` | Tìm kiếm workflow mẫu từ thư viện n8n.io |
| `get_template_details` | Lấy chi tiết JSON của một template |
| `import_template` | Import template vào n8n với dependency resolution |
| `export_workflow_as_template` | Export workflow thành template an toàn (đã xóa credentials) |

#### Validation & Linting (5 tools)

| Tool | Mô tả |
|:-----|:------|
| `validate_workflow_structure` | Kiểm tra lỗi cấu trúc workflow trước khi deploy |
| `validate_workflow_credentials` | Kiểm tra credentials references và node requirements |
| `validate_workflow_expressions` | Validate expressions JS và variable references |
| `lint_workflow` | Linter phát hiện lỗi logic, orphaned nodes và security |
| `suggest_workflow_improvements` | Gợi ý tối ưu hóa workflow dựa trên cấu trúc |

#### Backup & Versioning (4 tools)

| Tool | Mô tả |
|:-----|:------|
| `backup_workflow` | Tạo bản sao lưu nhanh cho workflow |
| `list_workflow_backups` | Xem danh sách các bản sao lưu |
| `restore_workflow` | Khôi phục workflow từ một bản backup (có auto-backup an toàn) |
| `diff_workflow_versions` | So sánh sự khác biệt giữa 2 phiên bản workflow |

### Ví dụ: AI tự tạo workflow với credentials

```
Bạn: "Tạo workflow post GitHub issues to Slack"

AI tự động:
  1. list_credentials  → Check GitHub + Slack credentials
  2. get_credential_schema → Lấy schema githubApi
  3. create_credential → Tạo GitHub credential (yêu cầu token từ user)
  4. test_credential   → Verify GitHub token valid
  5. create_credential → Tạo Slack credential
  6. create_workflow   → Tạo workflow với cả 2 credentials
  7. activate_workflow → Bật workflow ✅
```

### Ví dụ: Tự tạo & test webhook workflow

```
Bạn: "Tạo webhook nhận email từ Outlook, lấy subject và sender"

AI tự động thực hiện:
  1. create_workflow  → Tạo workflow với Webhook + Set node
  2. activate_workflow → Bật workflow
  3. trigger_webhook   → Gửi POST test data
  4. list_executions   → Kiểm tra kết quả
  5. get_execution     → Đọc output → Xác nhận thành công ✅
```

### Nâng cao: Kết hợp n8n-skills

Để AI agent thông minh hơn khi tạo workflow, hãy nhúng kiến thức từ [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills) vào System Prompt. Xem [USAGE.md](docs/USAGE.md) để biết chi tiết.

## 🏗 Kiến trúc

```
LobeHub / OpenClaw
       │
       │  MCP (Streamable HTTP)
       ▼
┌──────────────────────┐
│   n8n-custom-mcp     │
│   (supergateway)     │
│   :3000/mcp          │
│                      │
│   31 MCP Tools       │
│   TypeScript + Axios │
└──────────┬───────────┘
           │  REST API (nội bộ Docker)
           ▼
┌──────────────────────┐
│   n8n Instance       │
│   :5678              │
│                      │
│   PostgreSQL + Redis │
└──────────────────────┘
```

## 🌐 SSE & Hybrid Transport (NEW in v2.2)

Server hỗ trợ **Native Server-Sent Events (SSE)**, tích hợp sẵn trong mã nguồn.

### Tính năng

- ✅ **Real-time streaming**: Nhận responses qua SSE events
- ✅ **Browser compatible**: Sử dụng EventSource API hoặc fetch()
- ✅ **CORS enabled**: Browser clients có thể connect từ bất kỳ origin nào
- ✅ **Session management**: Hỗ trợ custom headers (MCP-Session-Id)
- ✅ **Keep-alive connections**: Persistent connections cho long-running operations

### Quick Start với SSE

**Browser Client (fetch API)**:
```javascript
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

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse SSE format: "event: message\ndata: {...}\n\n"
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log('Received:', data);
    }
  }
}
```

**Node.js Client**:
```javascript
const EventSource = require('eventsource');

// Note: EventSource chỉ hỗ trợ GET, dùng fetch() cho POST requests
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'list_workflows',
    id: 1,
  }),
});

// Process SSE stream
for await (const chunk of response.body) {
  const text = chunk.toString();
  // Parse SSE events...
}
```

**cURL Testing**:
```bash
curl -N -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Chi tiết

- 📖 [SSE Integration Guide](docs/sse-integration-guide.md): Hướng dẫn tích hợp chi tiết
- 🏗️ [System Architecture](docs/system-architecture.md): Kiến trúc SSE transport layer
- 🔧 [Troubleshooting SSE](docs/troubleshooting-sse.md): Xử lý lỗi thường gặp
- 💻 [Example Clients](examples/): Browser và Node.js client examples

## 🔒 Bảo mật

- ⚠️ **KHÔNG bao giờ** hardcode API Key trong source code
- File `.env` đã được thêm vào `.gitignore`
- MCP server giao tiếp với n8n qua mạng Docker nội bộ
- Webhook client **không** gửi API Key (mô phỏng request từ bên ngoài)
- SSE endpoint không có authentication (chỉ dùng cho internal/local development)

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết chi tiết.

Một vài ý tưởng:
- [x] Thêm `search_templates` — tìm workflow mẫu từ n8n.io
- [x] Thêm `get_credentials` — quản lý credentials qua MCP
- [x] Thêm tool `import_workflow` / `export_workflow`
- [x] Thêm hệ thống `Validation & Linting`
- [x] Thêm hệ thống `Backup & Versioning`
- [x] Hỗ trợ SSE transport
- [ ] Viết test cases

## 💡 Tài liệu chi tiết

- [📖 Hướng dẫn sử dụng (USAGE.md)](docs/USAGE.md): Các kịch bản tích hợp AI Agent và n8n-skills.
- [🛠 API Reference (API.md)](docs/API.md): Mô tả chi tiết input/output của toàn bộ 31 tools.
- [🤝 Hướng dẫn đóng góp (CONTRIBUTING.md)](CONTRIBUTING.md): Quy trình phát triển và cấu trúc dự án.
- [📅 Lộ trình (project-roadmap.md)](docs/project-roadmap.md): Trạng thái hoàn thiện các Phase.

## 📝 License

[MIT License](LICENSE) — Sử dụng thoải mái cho mục đích cá nhân và thương mại.

## 🙏 Credits

- Lấy cảm hứng từ [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp)
- Kiến thức n8n từ [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills)
- MCP Protocol: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- [n8n](https://n8n.io/) — Workflow Automation Platform

---

<div align="center">

**Nếu thấy hữu ích, hãy ⭐ star repo để ủng hộ!**

Made with ❤️ by [duynghien](https://github.com/duynghien)

</div>
