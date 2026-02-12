# ============================================
# n8n-custom-mcp — Multi-stage Docker Build
# ============================================
# Stage 1: Build TypeScript → JavaScript
# Stage 2: Production runtime with supergateway
# ============================================

# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (Docker layer caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine

# Set labels for the image
LABEL maintainer="duynghien"
LABEL version="2.0.0"
LABEL description="Full-power MCP Server for n8n"

WORKDIR /app

# Install production dependencies only and security tools
RUN apk add --no-cache postgresql-client

# Copy built files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Install supergateway globally
# supergateway wraps stdio MCP server into HTTP endpoint with SSE support
# - Converts stdio JSON-RPC messages to Server-Sent Events (SSE)
# - Enables browser and HTTP clients to connect directly
# - Supports CORS for cross-origin requests
# - Provides real-time streaming responses
RUN npm install -g supergateway && npm cache clean --force

# Default port
ENV PORT=3000
EXPOSE 3000

# Entrypoint: supergateway wraps our MCP server
ENTRYPOINT ["supergateway"]

# Healthcheck to ensure the server is responding
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD nc -z localhost ${PORT} || exit 1

# Default command — can be overridden in docker-compose.yml
# SSE Transport Configuration:
# - --outputTransport streamableHttp: Enables SSE (Server-Sent Events) support
# - --streamableHttpPath /mcp: SSE endpoint path
# - --cors: Enables CORS for browser clients
# See docs/sse-integration-guide.md for client integration examples
CMD ["--stdio", "node dist/index.js", "--port", "3000", "--outputTransport", "streamableHttp", "--streamableHttpPath", "/mcp", "--cors"]