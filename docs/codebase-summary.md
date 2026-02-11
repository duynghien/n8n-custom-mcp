# Codebase Summary - n8n-custom-mcp

## Tổng quan dự án
n8n-custom-mcp là một MCP Server mạnh mẽ cho phép AI Agent quản lý toàn diện n8n workflow. Khác với các giải pháp thông thường chỉ cho phép đọc/chạy workflow, dự án này cung cấp khả năng CRUD (Tạo, Đọc, Sửa, Xóa), quản lý Credentials, Validation cấu trúc và Hệ thống Template.

## Trạng thái hiện tại (v2.0.0-beta)
- **Tổng số công cụ (Tools):** 23 tools.
- **Kiến trúc:** Modular, phân tách rõ ràng giữa Service, Tool và Utility.
- **Chất lượng code:** Test coverage > 85%, tuân thủ nguyên tắc YAGNI/KISS/DRY.
- **Tập trung hiện tại:** Phase 4 - Backup & Versioning.

## Cấu trúc thư mục chính
- `src/index.ts`: Điểm khởi đầu của MCP Server.
- `src/tools/`: Định dạng các MCP tools (Workflow, Credentials, Template, Validation).
- `src/services/`: Logic nghiệp vụ xử lý tương tác với n8n API và Template API.
- `src/utils/`: Các công cụ bổ trợ (Cleaner, Graph Analyzer, Expression Validator).
- `src/types/`: Định nghĩa kiểu dữ liệu TypeScript.
- `src/__tests__/`: Hệ thống test toàn diện.

## Các tính năng nổi bật
1. **Workflow Management:** CRUD workflow, thực thi và theo dõi execution.
2. **Credentials Management:** Tự động hóa việc tạo và kiểm tra credentials.
3. **Template System:** Tích hợp thư viện mẫu n8n.io với cơ chế cache hiệu quả.
4. **Validation:** Kiểm tra cấu trúc workflow, phát hiện vòng lặp trước khi triển khai.

## Công nghệ sử dụng
- **TypeScript & Node.js**
- **Axios:** Giao tiếp với REST API.
- **Vitest:** Kiểm thử đơn vị và tích hợp.
- **Supergateway:** Expose MCP qua HTTP.
- **Docker:** Đóng gói và triển khai nhanh.

---
*Cập nhật lần cuối: 2026-02-11*
