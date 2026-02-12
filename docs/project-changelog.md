# Project Changelog - n8n-custom-mcp

Tất cả các thay đổi quan trọng của dự án sẽ được ghi nhận tại đây.

## [2.1.0-dev] - 2026-02-12

### Added
- **Dynamic Node Schema Discovery**: Triển khai thành công công cụ `get_node_schema` cho phép AI truy vấn cấu trúc tham số của node.
- **Tối ưu hóa**: Cơ chế caching in-memory cho schema node để tăng tốc độ phản hồi.
- **Tiết kiệm token**: Cơ chế làm sạch schema (loại bỏ `displayOptions` và các trường UI không cần thiết) giúp giảm kích thước JSON đầu ra.

## [2.0.0] - 2026-02-11

### Added
- **Phát hành chính thức v2.0.0** với đầy đủ 31 tools.
- **Hiệu năng**: Triển khai cơ chế caching cho Credentials (30s) và tối ưu hóa Template cache.
- **Bảo mật**: Hệ thống tự động che giấu (redact) dữ liệu nhạy cảm trong thông báo lỗi.
- **Bảo mật**: Chống chèn lệnh (Command Injection) cho các shell commands.
- **Docker**: Thêm Healthcheck, postgresql-client và tối ưu hóa image size.
- **Tài liệu**: Cập nhật toàn bộ hướng dẫn sử dụng cho 31 tools.

## [1.0.0] - 2024-12-01

### Added
- Phiên bản đầu tiên với 12 workflow tools cơ bản (CRUD, Execute, Webhook).
- Hỗ trợ Docker và supergateway.
