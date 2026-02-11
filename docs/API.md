# 🛠 API Documentation - 31 Tools

Tài liệu chi tiết cho toàn bộ 31 MCP tools của n8n-custom-mcp v2.0.0.

## Workflow Management (12 tools)

### `list_workflows`
Liệt kê các workflow trên instance.
- **Inputs**:
  - `active` (boolean, optional): Lọc theo trạng thái active.
  - `limit` (number, optional): Giới hạn kết quả (mặc định 50).
- **Output**: Mảng các workflow object (id, name, active, tags).

### `get_workflow`
Lấy chi tiết cấu trúc JSON của một workflow.
- **Inputs**: `id` (string, required): ID của workflow.
- **Output**: Full workflow JSON definition.

### `create_workflow`
Tạo workflow mới.
- **Inputs**: `name`, `nodes`, `connections`, `settings`, `staticData`.
- **Output**: Workflow object vừa tạo.

### `update_workflow`
Cập nhật workflow hiện có.
- **Inputs**: `id` (required), các trường cần cập nhật.

### `delete_workflow`
Xóa workflow.
- **Inputs**: `id` (required).

### `activate_workflow`
Bật/Tắt workflow.
- **Inputs**: `id` (required), `active` (boolean, required).

### `execute_workflow`
Kích hoạt chạy workflow theo ID.

### `trigger_webhook`
Gọi một webhook endpoint. Hỗ trợ `test_mode: true` để gửi vào `/webhook-test/`.

### `list_executions`
Xem lịch sử thực thi. Lọc theo `status` (success, error, waiting).

### `get_execution`
Xem chi tiết dữ liệu vào/ra của từng node trong một lần chạy.

### `list_node_types`
Liệt kê các loại node khả dụng trên n8n instance.

### `validate_workflow_structure`
Kiểm tra tính hợp lệ cơ bản của JSON workflow.

---

## Credentials Management (6 tools)

### `get_credential_schema`
Lấy danh sách các trường bắt buộc cho một loại credential (ví dụ: `githubApi`).

### `list_credentials`
Liệt kê credentials hiện có (từ workflows và DB fallback).

### `create_credential`
Tạo credential mới với validation schema tự động.

### `update_credential`
Cập nhật thông tin credential.

### `delete_credential`
Xóa credential. Có safety check ngăn xóa nếu đang được workflow sử dụng (dùng `force: true` để ghi đè).

### `test_credential`
Kiểm tra tính hợp lệ (connectivity) của credential.

---

## Template System (4 tools)

### `search_templates`
Tìm kiếm workflow mẫu từ library của n8n.io.

### `get_template_details`
Lấy JSON workflow mẫu.

### `import_template`
Import template trực tiếp vào n8n instance.

### `export_workflow_as_template`
Xuất workflow thành JSON "sạch" (đã xóa credentials và IDs nhạy cảm).

---

## Validation & Linting (5 tools)

### `validate_workflow_credentials`
Kiểm tra xem các node có thiếu credential mapping không.

### `validate_workflow_expressions`
Kiểm tra lỗi cú pháp JavaScript trong các biểu thức `{{ }}`.

### `lint_workflow`
Phát hiện orphaned nodes, node chưa đặt tên, hoặc hardcoded secrets.

### `suggest_workflow_improvements`
Gợi ý tối ưu hóa (ví dụ: dùng Set node, thêm Error Handling).

---

## Backup & Versioning (4 tools)

### `backup_workflow`
Tạo bản sao lưu cục bộ nhanh chóng.

### `list_workflow_backups`
Liệt kê các phiên bản đã lưu.

### `restore_workflow`
Khôi phục về một phiên bản cũ. Tự động tạo backup hiện tại trước khi khôi phục.

### `diff_workflow_versions`
So sánh cấu trúc giữa 2 phiên bản.
