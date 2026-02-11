# n8n-custom-mcp: 19 New MCP Tools Implementation Plan

**Created:** 2026-02-10
**Status:** Active
**Target:** Production-ready v2.0.0 with AI Agent Autonomy

---

## Overview

Transform n8n-custom-mcp from 12-tool workflow manager to comprehensive 31-tool autonomous AI platform with credentials management, template system, validation, and backup capabilities.

### Goals

- ✅ **AI Agent Autonomy:** Zero manual intervention for workflow + credentials setup
- ✅ **Production Quality:** Handle all edge cases, 80%+ test coverage
- ✅ **Modular Architecture:** Every file <200 lines, YAGNI/KISS/DRY compliance
- ✅ **Solo Dev Friendly:** Self-hosted only, simple deployment

### Scope

**Current State:** 12 tools, 296-line monolithic index.ts
**Target State:** 31 tools, modular architecture with comprehensive testing

**4 Feature Groups (19 New Tools):**
1. **Credentials Management** (6 tools) - Priority 1
2. **Template System** (4 tools) - Priority 2
3. **Validation & Linting** (5 tools) - Priority 3
4. **Backup & Versioning** (4 tools) - Priority 4

---

## Implementation Phases

| Phase | Focus | Duration | Status | Deliverable |
|-------|-------|----------|--------|-------------|
| [Phase 0](phase-00-foundation-setup.md) | Testing + Modular Foundation | Week 1 | Completed | Refactored codebase, Vitest setup |
| [Phase 1](phase-01-credentials-management.md) | Credentials Management (6 tools) | Week 1-2 | Completed | AI autonomous credential setup |
| [Phase 2](phase-02-basic-validation.md) | Basic Validation (1 tool) | Week 2 | Completed ✅ | Pre-deployment error prevention |
| [Phase 3](phase-03-template-system.md) | Template System (4 tools) | Week 3-4 | Completed ✅ | Template import/export |
| [Phase 4](phase-04-backup-system.md) | Backup System (4 tools) | Week 4-5 | Completed ✅ | Workflow versioning safety net |
| [Phase 5](phase-05-advanced-validation.md) | Advanced Validation (4 tools) | Week 5-6 | Completed ✅ | Comprehensive linting |
| [Phase 6](phase-06-integration-polish.md) | Integration & Polish | Week 6-7 | Pending | Production-ready v2.0.0 |

---

## Target Architecture

```
src/
├── index.ts                          # 50 lines - MCP server setup only
├── config/
│   └── env.ts                        # Environment vars, axios clients
├── tools/
│   ├── workflow-tools.ts             # 12 existing tools (Phase 0 extract)
│   ├── credential-tools.ts           # 6 new tools (Phase 1)
│   ├── template-tools.ts             # 4 new tools (Phase 3)
│   ├── validation-tools.ts           # 5 new tools (Phase 2 + 5)
│   └── backup-tools.ts               # 4 new tools (Phase 4)
├── services/
│   ├── n8n-api.service.ts            # n8n REST API wrapper
│   ├── credential.service.ts         # Credential business logic
│   ├── template.service.ts           # Template parsing, cleaning
│   ├── validation.service.ts         # Validation logic
│   └── backup.service.ts             # Backup I/O, versioning
├── utils/
│   ├── workflow-cleaner.ts           # Remove IDs, sanitize JSON
│   ├── expression-validator.ts       # Regex {{ }} validation
│   └── error-handler.ts              # Standardized MCP errors
├── types/
│   └── n8n.types.ts                  # TypeScript interfaces
└── __tests__/                        # Vitest tests (80%+ coverage)
    ├── services/
    ├── tools/
    └── utils/
```

---

## Key Technical Decisions

### 1. Incremental Refactor Strategy
**Decision:** Refactor alongside feature addition, not big-bang upfront

**Rationale:**
- Minimize risk of breaking existing 12 tools
- Continuous integration ensures stability
- Each phase delivers working functionality

**Trade-off:** Slightly slower initial progress, but lower risk

### 2. Hybrid Credential Listing
**Decision:** Parse workflows first, fallback to psql if available

**Rationale:**
- n8n API doesn't support `GET /credentials`
- Parsing workflows covers 90% of cases
- psql fallback for completeness

**Trade-off:** More complex logic, but robust solution

### 3. Local Filesystem Backup
**Decision:** Docker volume mount to /backups, no cloud storage

**Rationale:**
- Solo dev/small team doesn't need cloud complexity
- Simple, predictable, follows KISS
- Docker volume ensures persistence

**Trade-off:** No cloud redundancy, but acceptable for target users

### 4. Full Testing Included
**Decision:** Vitest setup + 80% coverage target from Phase 0

**Rationale:**
- Production-ready quality requirement
- Catch edge cases early
- Regression prevention during incremental refactor

**Trade-off:** More upfront work, but essential for quality

---

## Success Metrics

### Technical Quality
- ✅ 31 total tools (12 existing + 19 new)
- ✅ Every file <200 lines (CLAUDE.md compliance)
- ✅ Test coverage >80% (services, tools, utils)
- ✅ Zero credential data leaks (security audit pass)
- ✅ API response time <1s (95th percentile)

### User Experience
- ✅ AI agent creates workflow with credentials in 1 conversation
- ✅ Template import success rate >90%
- ✅ Validation catches >70% errors before execution
- ✅ Zero data loss with backup system

### Business Impact
- ✅ 3x increase in workflows created via MCP
- ✅ 50% reduction in debug cycles
- ✅ Positive feedback from 5+ solo developers

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| n8n API gaps (no GET credentials) | HIGH | Documented workarounds with fallbacks |
| Template incompatibility | MEDIUM | Pre-import validation + clear error messages |
| Expression validation false positives | LOW | Warning-only, document limitations |
| Backup storage scaling | MEDIUM | Rotation policy (keep last 10), compression |
| Over-engineering | HIGH | YAGNI compliance, user feedback loop |

---

## Dependencies

### External APIs
- **n8n REST API v1:** /workflows, /executions, /credentials, /node-types
- **n8n Template API:** https://api.n8n.io/templates
- **n8n.io Schema:** GET /credentials/schema/{type}

### Internal
- Phase 1 depends on Phase 0 (foundation)
- Phase 2-5 can run in parallel after Phase 1
- Phase 6 requires all previous phases complete

---

## Documentation Updates Required

1. **README.md:** Update tool list (12 → 31), new features section
2. **USAGE.md:** Add sections for credentials, templates, validation, backup
3. **CONTRIBUTING.md:** Testing guidelines, modular architecture
4. **API.md:** Document all 31 tools with examples
5. **CHANGELOG.md:** v2.0.0 release notes

---

## Next Steps

1. Review and approve this plan
2. Execute [Phase 0: Foundation Setup](phase-00-foundation-setup.md)
3. Iteratively implement Phases 1-6
4. Release v2.0.0

---

**Context:**
- Brainstorm Report: `/Users/vnrom/self-hosted/n8n-custom-mcp/plans/reports/brainstormer-260210-2336-n8n-mcp-feature-proposals.md`
- Research Reports: `/Users/vnrom/self-hosted/n8n-custom-mcp/plans/reports/researcher-*`
- Current Codebase: Single-file `src/index.ts` (296 lines)
