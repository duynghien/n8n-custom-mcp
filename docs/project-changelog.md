# Project Changelog - n8n-custom-mcp

Tất cả các thay đổi quan trọng của dự án sẽ được ghi nhận tại đây.

## [Unreleased]

### Added
- **Phase 2: Basic Validation** hoàn tất.
- Thêm tool `validate_workflow_structure` để kiểm tra lỗi trước khi triển khai.
- Triển khai `ValidationService` xử lý 8+ loại quy tắc kiểm tra cấu trúc.
- Thuật toán `GraphAnalyzer` phát hiện vòng lặp (circular dependencies) chính xác.
- Tiện ích `ExpressionValidator` kiểm tra cú pháp `{{ }}` cơ bản.
- Bổ sung 115 tests cho phần validation, nâng cao độ tin cậy.

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
