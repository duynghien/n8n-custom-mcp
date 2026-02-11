<div align="center">

# 🔌 n8n-custom-mcp v2.0.0

**Full-power MCP Server cho n8n — Dành cho AI Agent thực sự muốn _làm chủ_ workflow.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)
[![n8n](https://img.shields.io/badge/n8n-API%20v1-orange.svg)](https://docs.n8n.io/api/)

[Tính năng](#-tính-năng) · [Cài đặt](#-cài-đặt-nhanh) · [Cấu hình](#%EF%B8%8F-cấu-hình) · [Sử dụng](#-sử-dụng) · [Đóng góp](#-đóng-góp)

---

<img src="https://raw.githubusercontent.com/duyasia/n8n-custom-mcp/main/docs/architecture.png" alt="Architecture" width="700" />

</div>

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
Quản lý credentials hoàn toàn tự động:\n- Tạo, cập nhật, xoá credentials với validation\n- Liệt kê credentials từ workflows và database\n- Test credential validity tự động\n- Safety checks ngăn chặn xoá credentials đang sử dụng

### ✅ Workflow Validation (NEW in v2.0)
Kiểm tra cấu trúc workflow trước khi deploy để ngăn chặn lỗi:\n- Validate cấu trúc JSON và các trường bắt buộc\n- Phát hiện duplicate node IDs/names\n- Kiểm tra node types có tồn tại trên instance\n- Validate connections giữa các nodes\n- Phát hiện circular dependencies (vòng lặp)\n- Cảnh báo missing trigger nodes cho active workflows\n- Giảm 50% thời gian debug của AI agent

### 🎯 Webhook Testing
Tool `trigger_webhook` hỗ trợ:
- Gọi webhook với bất kỳ HTTP method nào (GET/POST/PUT/DELETE)
- **Test mode** (`/webhook-test/`) để debug trên n8n Editor
- **Production mode** (`/webhook/`) cho webhook đang active
- Custom headers & query parameters

### 🔍 Execution Debugging
Theo dõi và debug workflow execution:
- Liệt kê lịch sử chạy, lọc theo trạng thái (success/error/waiting)
- Xem chi tiết dữ liệu đầu vào/đầu ra của từng node
- Đọc error message cụ thể để AI tự sửa lỗi

### 🐳 Docker-Ready
Đóng gói sẵn Dockerfile multi-stage + [supergateway](https://github.com/nichochar/supergateway) để expose MCP qua HTTP — chỉ cần `docker compose up`.

## 📦 Cài đặt nhanh

### Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- n8n instance đang chạy (hoặc chạy cùng docker-compose)
- [n8n API Key](https://docs.n8n.io/api/authentication/)

### Bước 1: Clone

```bash
git clone https://github.com/duyasia/n8n-custom-mcp.git
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
  depends_on:
    n8n:
      condition: service_started
  command: >
    --stdio "node dist/index.js"
    --port 3000
    --outputTransport streamableHttp
    --streamableHttpPath /mcp
    --cors
```

### Bước 4: Kết nối LobeHub/OpenClaw

Trong phần cấu hình MCP Plugin:

| Trường | Giá trị |
|:-------|:--------|
| Type | MCP (Streamable HTTP) |
| URL | `http://<IP-máy-chủ>:3000/mcp` |

Sau khi kết nối, bạn sẽ thấy **31 tools** xuất hiện. ✅

## ⚙️ Cấu hình

### Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|:-----|:--------:|:---------|:------|
| `N8N_HOST` | ✅ | `http://localhost:5678` | URL đến n8n instance |
| `N8N_API_KEY` | ✅ | — | API Key từ n8n Settings |
| `PORT` | ❌ | `3000` | Port cho MCP HTTP endpoint |

### Supergateway Options

MCP server chạy qua stdio, được wrap bởi [supergateway](https://github.com/nichochar/supergateway) để expose qua HTTP:

```bash
supergateway \
  --stdio "node dist/index.js" \
  --port 3000 \
  --outputTransport streamableHttp \
  --streamableHttpPath /mcp \
  --cors
```

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

## 🔒 Bảo mật

- ⚠️ **KHÔNG bao giờ** hardcode API Key trong source code
- File `.env` đã được thêm vào `.gitignore`
- MCP server giao tiếp với n8n qua mạng Docker nội bộ
- Webhook client **không** gửi API Key (mô phỏng request từ bên ngoài)

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết chi tiết.

Một vài ý tưởng:
- [x] Thêm `search_templates` — tìm workflow mẫu từ n8n.io
- [x] Thêm `get_credentials` — quản lý credentials qua MCP
- [x] Thêm tool `import_workflow` / `export_workflow`
- [x] Thêm hệ thống `Validation & Linting`
- [x] Thêm hệ thống `Backup & Versioning`
- [ ] Hỗ trợ SSE transport
- [ ] Viết test cases

## 📝 License

[MIT License](LICENSE) — Sử dụng thoải mái, kể cả cho mục đích thương mại.

## 🙏 Credits

- Lấy cảm hứng từ [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp)
- Kiến thức n8n từ [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills)
- MCP Protocol: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- [n8n](https://n8n.io/) — Workflow Automation Platform

---

<div align="center">

**Nếu thấy hữu ích, hãy ⭐ star repo để ủng hộ!**

Made with ❤️ by [duyasia](https://github.com/duyasia)

</div>