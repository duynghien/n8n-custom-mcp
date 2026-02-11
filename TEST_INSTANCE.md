# n8n Test Instance Setup

## Quick Start

```bash
npm run test:env:up
```

Wait 30s for n8n to initialize, then access http://localhost:5679

## Manual API Key Setup

1. Access http://localhost:5679
2. Complete owner setup (email/password)
3. Go to Settings → API
4. Create API key
5. Update `.env.test` with the generated key

## Integration Tests

Integration tests require manual API key setup. Unit tests use mocked data and don't need running instance.

```bash
# Unit tests only (no n8n instance needed)
npm test

# With integration tests (requires manual setup above)
npm test -- --run
```

## Cleanup

```bash
npm run test:env:down
```
