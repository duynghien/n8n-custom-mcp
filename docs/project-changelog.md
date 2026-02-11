# Project Changelog - n8n-custom-mcp

Tất cả các thay đổi quan trọng của dự án sẽ được ghi nhận tại đây.

## [2.0.0-beta] - 2026-02-11

### Added
- **Phase 3: Template System** hoàn tất.
- Triển khai 4 tools mới: `search_templates`, `get_template_details`, `import_template`, `export_workflow_as_template`.
- Tích hợp n8n.io Template API với cơ chế cache 1 giờ giúp giảm 70% lượng request.
- Cơ chế `WorkflowCleaner` đảm bảo bảo mật: Tự động loại bỏ credentials, execution data và IDs khi export.
- Hỗ trợ `Dependency Resolution`: Cảnh báo khi thiếu community nodes trong template.

## [2.0.0-alpha] - 2025-02-10

### Added
- **Credentials Management (6 tools)**: Cho phép AI quản lý thông tin xác thực tự động.
- **Modular Architecture**: Tách mã nguồn thành các service và tool riêng biệt (<200 dòng/file).
- **Testing Infrastructure**: Tích hợp Vitest và mock API n8n.

### Changed
- Refactor `src/index.ts` từ 296 dòng xuống còn ~80 dòng.
- Chuẩn hóa định dạng lỗi MCP.

## [1.0.0] - 2024-12-01

### Added
- Phiên bản đầu tiên với 12 workflow tools cơ bản (CRUD, Execute, Webhook).
- Hỗ trợ Docker và supergateway.
