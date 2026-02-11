# 📖 Hướng dẫn sử dụng nâng cao

## Mục lục

- [Kết hợp n8n-skills vào System Prompt](#kết-hợp-n8n-skills-vào-system-prompt)
- [Các kịch bản sử dụng phổ biến](#các-kịch-bản-sử-dụng-phổ-biến)
- [Tips & Tricks](#tips--tricks)

---

## Kết hợp n8n-skills vào System Prompt

[czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills) cung cấp 7 bộ kiến thức giúp AI agent tạo workflow chính xác hơn.

### Cách tích hợp

1. Clone repo:
   ```bash
   git clone https://github.com/czlonkowski/n8n-skills.git
   ```

2. Đọc 3 file SKILL.md quan trọng nhất:
   ```
   skills/n8n-mcp-tools-expert/SKILL.md     ← Cách dùng MCP tools
   skills/n8n-workflow-patterns/SKILL.md     ← 5 mẫu workflow chuẩn
   skills/n8n-expression-syntax/SKILL.md     ← Cú pháp {{ }} trong n8n
   ```

3. Copy nội dung vào **System Prompt** của Agent trên LobeHub/OpenClaw.

### System Prompt mẫu

```markdown
# Vai trò
Bạn là chuyên gia n8n workflow automation với quyền truy cập MCP Server.

# Kiến thức quan trọng

## Webhook Data
- Dữ liệu LUÔN nằm dưới $json.body
- ✅ {{ $json.body.email }}
- ❌ {{ $json.email }}

## Code Node Return Format
- Bắt buộc: [{json: {key: "value"}}]

## Quy trình làm việc chuẩn
1. create_workflow → Tạo
2. activate_workflow → Bật
3. trigger_webhook (test_mode: true) → Test
4. list_executions → Kiểm tra
5. get_execution → Debug nếu lỗi
6. update_workflow → Sửa
7. Lặp lại 3-6 cho đến khi OK
```

---

## Các kịch bản sử dụng phổ biến

### Kịch bản 1: Tạo webhook workflow hoàn chỉnh

```
Prompt: "Tạo webhook nhận POST từ Outlook, lấy subject và sender,
         gửi thông báo vào Slack channel #notifications"
```

AI sẽ tự động:
1. `create_workflow` — Tạo workflow với 3 nodes: Webhook → Set → Slack
2. `activate_workflow` — Bật workflow
3. `trigger_webhook` — Test với dữ liệu giả lập
4. `list_executions` + `get_execution` — Kiểm tra kết quả

### Kịch bản 2: Debug workflow đang lỗi

```
Prompt: "Workflow ID 42 đang bị lỗi, giúp tôi tìm nguyên nhân"
```

AI sẽ:
1. `get_workflow` (id: "42") — Đọc cấu trúc workflow
2. `list_executions` (workflowId: "42", status: "error") — Tìm lần chạy lỗi
3. `get_execution` — Đọc error message chi tiết
4. `update_workflow` — Sửa lỗi
5. `execute_workflow` — Chạy lại để kiểm tra

### Kịch bản 3: Quản lý hàng loạt

```
Prompt: "Liệt kê tất cả workflow đang active, tắt những cái có tên chứa 'test'"
```

AI sẽ:
1. `list_workflows` (active: true) — Liệt kê
2. Lọc kết quả tìm workflow có tên chứa "test"
3. `activate_workflow` (active: false) — Tắt từng cái

---

## Tips & Tricks

### 1. Luôn dùng test_mode khi test webhook

```json
{
  "webhook_path": "your-path",
  "test_mode": true,      // ← Quan trọng!
  "body": { "key": "value" }
}
```

`test_mode: true` gửi request vào `/webhook-test/` — n8n sẽ hiển thị data trên Editor UI, rất tiện để debug trực quan.

### 2. Debug execution hiệu quả

Khi `get_execution` trả về lỗi, hãy chú ý:
- `error.message` — Thông báo lỗi chính
- `error.node` — Node nào bị lỗi
- `data.resultData.runData` — Dữ liệu chạy qua từng node

### 3. Kiểm tra node compatibility

Trước khi tạo workflow dùng node lạ, hãy chạy:
```
list_node_types → Kiểm tra xem node đó có cài trên n8n không
```

### 4. Backup trước khi xoá/sửa

```
get_workflow → Lưu JSON hiện tại → update_workflow hoặc delete_workflow
```

AI agent nên được dặn trong System Prompt: "Luôn đọc workflow hiện tại trước khi sửa hoặc xoá."

---

## Template System (Phase 3)

Hệ thống template cho phép AI agent tìm kiếm và sử dụng các workflow mẫu từ thư viện chính thức của n8n.io.

### Quy trình sử dụng Template

1. **Tìm kiếm**: Dùng `search_templates` để tìm ý tưởng.
2. **Xem chi tiết**: Dùng `get_template_details` để xem các nodes và credentials cần thiết.
3. **Import**: Dùng `import_template` để đưa vào instance của bạn.

### Ví dụ: Import workflow mẫu

```markdown
Bạn: "Tìm và cài đặt workflow mẫu để gửi thông báo từ GitHub sang Telegram"

AI tự động thực hiện:
  1. search_templates (query: "github telegram") → Trả về danh sách templates
  2. get_template_details (id: "123") → Kiểm tra các nodes cần thiết
  3. import_template (templateId: "123") → Import vào n8n (mặc định ở trạng thái Inactive)
  4. Trả lời: "Tôi đã import workflow mẫu ID 123. Bạn cần cấu hình credentials để bắt đầu sử dụng."
```

### Xuất workflow thành template an toàn

Khi muốn chia sẻ workflow hoặc lưu trữ dưới dạng mẫu, dùng `export_workflow_as_template`. Tool này sẽ tự động:
- Xóa bỏ tất cả thông tin `credentials` (chỉ giữ lại mapping type).
- Xóa bỏ `execution data` cũ.
- Làm sạch các trường định danh cá nhân (ID, static data).

```json
// Gọi tool
{
  "workflowId": "42"
}
// Kết quả: Trả về JSON sạch, sẵn sàng để chia sẻ.
```
