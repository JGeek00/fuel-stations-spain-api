#################
## BUILD STAGE ##
#################
FROM node:26-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Install pnpm
RUN npm install -g pnpm@latest

# Native toolchain for better-sqlite3 (no prebuilds shipped: prebuild-install
# falls back to node-gyp compile)
RUN apk add --no-cache python3 make g++

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build application
RUN pnpm run build:prod



######################
## PRODUCTION STAGE ##
######################
FROM node:26-alpine
LABEL org.opencontainers.image.source="https://github.com/jgeek00/fuel-stations-spain-api"

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Install production dependencies only
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
# Native toolchain: better-sqlite3 compiles from source at install time
# (removed afterwards to keep the runtime image lean)
RUN apk add --no-cache python3 make g++ && pnpm install --prod --frozen-lockfile && apk del python3 make g++

# Start application
CMD [ "pnpm", "start" ]