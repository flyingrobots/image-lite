# Multi-stage Dockerfile for image optimization tool
FROM node:20-alpine AS base

# Install git and git-lfs for handling Git LFS files
RUN apk add --no-cache git git-lfs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage with all dependencies
FROM base AS development
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy configuration files
COPY jest.config.js ./
COPY eslint.config.js ./

# Copy source code (will also be mounted at runtime for live reload)
COPY scripts/ ./scripts/
COPY src/ ./src/

# Default command for development
CMD ["npm", "run", "_docker:test"]

# Production stage with only production dependencies
FROM base AS production
RUN --mount=type=cache,target=/root/.npm npm ci --only=production

# Copy application code
COPY scripts/ ./scripts/
COPY src/ ./src/

# Create directories
RUN mkdir -p original optimized

# Default command runs the optimization
CMD ["node", "scripts/optimize-images.js"]

# Default to development stage
FROM development