# Project Changelog - n8n-custom-mcp

Tất cả các thay đổi quan trọng của dự án sẽ được ghi nhận tại đây.

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
