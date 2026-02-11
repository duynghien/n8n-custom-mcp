# 🤝 Đóng góp cho n8n-custom-mcp

Cảm ơn bạn đã quan tâm đến việc đóng góp! Mọi contribution đều được chào đón.

## 📋 Quy trình đóng góp

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/n8n-custom-mcp.git
cd n8n-custom-mcp
npm install
```

### 2. Tạo branch

```bash
git checkout -b feature/ten-tinh-nang
# hoặc
git checkout -b fix/ten-bug
```

### 3. Phát triển

```bash
# Chạy dev mode (cần n8n instance)
export N8N_HOST=http://localhost:5678
export N8N_API_KEY=your_key
npm run dev
```

### 4. Build & Test

```bash
# Build TypeScript
npm run build

# Test với Docker
docker build -t n8n-custom-mcp-test .
docker run --rm -e N8N_HOST=http://host.docker.internal:5678 -e N8N_API_KEY=your_key n8n-custom-mcp-test
```

### 5. Commit & Push

```bash
git add .
git commit -m "feat: mô tả ngắn gọn"
git push origin feature/ten-tinh-nang
```

### 6. Tạo Pull Request

Mở PR trên GitHub với mô tả rõ ràng về thay đổi.

## 📁 Cấu trúc dự án

```
n8n-custom-mcp/
├── src/
│   ├── index.ts          ← Entry point (MCP server setup)
│   ├── tools/            ← Định nghĩa các MCP tools (workflow, credential, v.v.)
│   ├── services/         ← Logic nghiệp vụ (API, backup, validation, v.v.)
│   ├── utils/            ← Utilities (cache, error handling, validators)
│   ├── types/            ← TypeScript interfaces
│   └── __tests__/        ← Unit & Integration tests
├── package.json
├── tsconfig.json
├── Dockerfile            ← Multi-stage build
├── .env.example
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── docs/
    ├── USAGE.md          ← Hướng dẫn sử dụng nâng cao
    ├── API.md            ← Tài liệu chi tiết 31 tools
    └── project-roadmap.md ← Lộ trình phát triển
```

## 🎯 Thêm MCP Tool mới

Dự án sử dụng kiến trúc modular. Để thêm tool mới:

1. **Định nghĩa Tool**: Thêm vào file tương ứng trong `src/tools/` (ví dụ: `workflow-tools.ts`).
2. **Triển khai Logic**: Thêm service method trong `src/services/`.
3. **Đăng ký Handler**: Cập nhật handler trong `src/tools/` và đảm bảo nó được gọi từ `src/index.ts`.

## 📐 Quy ước

### Commit Messages

Sử dụng [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — Tính năng mới
- `fix:` — Sửa bug
- `docs:` — Cập nhật tài liệu
- `refactor:` — Tái cấu trúc code
- `chore:` — Việc vặt (CI, dependencies...)

### Code Style

- TypeScript strict mode
- Sử dụng `any` khi cần thiết (MCP args là dynamic)
- Xử lý error đầy đủ — luôn trả về `isError: true` thay vì throw
- Comment bằng tiếng Việt hoặc tiếng Anh đều OK

## 💡 Ý tưởng đóng góp

Nếu bạn muốn contribute nhưng chưa biết làm gì, đây là một số ý tưởng:

- [ ] **`search_templates`** — Tìm workflow template từ n8n.io
- [ ] **`get_credentials`** — Quản lý credentials
- [ ] **`import_workflow`** / **`export_workflow`** — Import/Export JSON
- [ ] **SSE Transport** — Hỗ trợ Server-Sent Events
- [ ] **Unit tests** — Viết test cho từng tool
- [ ] **Rate limiting** — Giới hạn request tránh abuse
- [ ] **Authentication** — Thêm auth layer cho MCP endpoint

## ❓ Câu hỏi?

Mở [Issue](https://github.com/duynghien/n8n-custom-mcp/issues) trên GitHub hoặc liên hệ qua Discussion.

---

Cảm ơn bạn đã giúp dự án tốt hơn! 🙏