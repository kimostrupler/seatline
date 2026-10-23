# Seatline web app (Next.js, standalone server). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t seatline-web .
# All settings (AUTH_MODE, API_URL, secrets…) are read at runtime, so one image fits every environment.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /app
# packages first (only the lockfile): this layer is reused until dependencies change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --offline --frozen-lockfile --filter @seatline/web... \
 && pnpm --filter @seatline/shared build \
 && pnpm --filter @seatline/web exec next build

FROM ${NODE_IMAGE}
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
