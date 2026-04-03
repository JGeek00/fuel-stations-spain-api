#################
## BUILD STAGE ##
#################
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./

# Install pnpm
RUN npm install -g pnpm@latest-10

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build application
RUN pnpm run build:prod



######################
## PRODUCTION STAGE ##
######################
FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/jgeek00/fuel-stations-spain-api"

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest-10

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Install production dependencies only
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Start application
CMD [ "pnpm", "start" ]