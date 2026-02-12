# Project Changelog - n8n-custom-mcp

Tất cả các thay đổi quan trọng của dự án sẽ được ghi nhận tại đây.

## [2.1.0] - 2026-02-12

### Added
- **SSE Transport Enhancement**: Hoàn thành Phase 1 - Documentation & Examples cho Server-Sent Events transport.
  - Comprehensive documentation (2,600+ lines): System architecture, integration guide, troubleshooting guide
  - 3 working client examples: Browser (HTML/JS), Node.js full-featured, Node.js simplified
  - Verified supergateway SSE capabilities với MCP Protocol 2024-11-05
  - Zero code changes required - SSE hoạt động out-of-the-box qua supergateway
- **Dynamic Node Schema Discovery**: Triển khai thành công công cụ `get_node_schema` cho phép AI truy vấn cấu trúc tham số của node.
- **Tối ưu hóa**: Cơ chế caching in-memory cho schema node để tăng tốc độ phản hồi.
- **Tiết kiệm token**: Cơ chế làm sạch schema (loại bỏ `displayOptions` và các trường UI không cần thiết) giúp giảm kích thước JSON đầu ra.

### Changed
- **Port Standardization**: Standardized tất cả documentation và examples sử dụng port 3000 (consistent với docker-compose.yml)
- **Protocol Compliance**: Added MCP-Protocol-Version header vào tất cả SSE client examples
- **Error Handling**: Enhanced error logging với full context (timestamp, sessionId, requestId, method, httpStatus, stack trace)

### Documentation
- Created `docs/system-architecture.md` (732 lines) - Detailed architecture với Mermaid diagrams
- Created `docs/sse-integration-guide.md` (711 lines) - Integration guide cho Browser, Node.js, Python
- Created `docs/troubleshooting-sse.md` (805 lines) - Comprehensive troubleshooting guide
- Created `examples/sse-client.html` (515 lines) - Browser client với beautiful UI
- Created `examples/sse-client.js` (341 lines) - Production-ready Node.js client
- Created `examples/sse-client-simple.js` (181 lines) - Simplified learning example
- Updated `README.md` - Added SSE Transport section với quick start examples

### Quality
- Test coverage maintained: 201/201 tests passing (100%)
- Code review score: 9.5/10 (improved from 8.7/10)
- Zero regressions, backward compatible
- Production ready

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
