# Seatline API (NestJS). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t seatline-api .
# The same image runs the API, the database migration job and the nightly people sync.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
# packages first (only the lockfile): this layer is reused until dependencies change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter @seatline/api... \
 && pnpm --filter @seatline/shared build \
 && pnpm --filter @seatline/api build

FROM ${NODE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
