# Changelog

All notable changes to n8n-custom-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Workflow Validation Tool** - `validate_workflow_structure` tool for pre-deployment validation
  - Validates required fields, node uniqueness, node types, connections
  - Detects circular dependencies using DFS algorithm
  - Warns about missing triggers for active workflows
  - Warns about disabled nodes with connections
  - Comprehensive error messages for debugging
  - 26 test cases with >90% coverage

## [2.0.0-alpha] - 2025-02-10

### Added
- **Credentials Management (6 tools)**
  - `create_credential` - Create new credentials with schema validation
  - `update_credential` - Update existing credentials
  - `delete_credential` - Delete credentials with safety checks
  - `list_credentials` - List all credentials (from workflows + database)
  - `get_credential_schema` - Get credential type schema for validation
  - `test_credential` - Test credential validity
- **Modular Architecture**
  - Extracted 12 workflow tools to `src/tools/workflow-tools.ts`
  - Separated credential tools to `src/tools/credential-tools.ts`
  - Created service layer (`n8n-api-service.ts`, `credential-service.ts`)
  - Added TypeScript types (`n8n-types.ts`)
- **Testing Infrastructure**
  - Vitest setup with 80%+ coverage target
  - Test files for all services and tools
  - Mock utilities for n8n API calls

### Changed
- Refactored `src/index.ts` from 296 lines to 80 lines
- Updated version to `2.0.0-alpha`
- Improved error handling with standardized error messages

### Fixed
- PostgreSQL connection handling for credential listing
- API error handling with proper error codes

## [1.0.0] - 2024-12-01

### Added
- Initial release with 12 workflow management tools
- Workflow CRUD operations
- Execution monitoring and debugging
- Webhook testing (test mode + production mode)
- Node types discovery
- Docker deployment with supergateway
- MCP Server implementation using `@modelcontextprotocol/sdk`

### Tools Included
1. `list_workflows` - List all workflows
2. `get_workflow` - Get workflow details
3. `create_workflow` - Create new workflow
4. `update_workflow` - Update existing workflow
5. `delete_workflow` - Delete workflow
6. `activate_workflow` - Activate/deactivate workflow
7. `execute_workflow` - Execute workflow manually
8. `list_executions` - List execution history
9. `get_execution` - Get execution details
10. `trigger_webhook` - Trigger webhook (test/production)
11. `list_node_types` - List available node types
12. `get_credential_schema` - Get credential schema

[Unreleased]: https://github.com/duyasia/n8n-custom-mcp/compare/v2.0.0-alpha...HEAD
[2.0.0-alpha]: https://github.com/duyasia/n8n-custom-mcp/compare/v1.0.0...v2.0.0-alpha
[1.0.0]: https://github.com/duyasia/n8n-custom-mcp/releases/tag/v1.0.0
