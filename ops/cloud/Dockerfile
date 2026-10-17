# Build from the repository root: docker build -f ops/cloud/Dockerfile .
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ARG CROUPIER_LAB_BASE_PATH=/studio
ENV CROUPIER_LAB_BASE_PATH=$CROUPIER_LAB_BASE_PATH
RUN npm --prefix services/astrid-gpu-worker/gateway ci --omit=dev --ignore-scripts \
    && npm --prefix web ci --omit=dev --ignore-scripts \
    && npm --prefix apps/studio ci && npm --prefix apps/studio run build \
    && chown -R node:node /app/apps/studio/.next \
    && mkdir -p /app/apps/studio/data/platform-private \
    && chown node:node /app/apps/studio/data /app/apps/studio/data/platform-private \
    && chmod 700 /app/apps/studio/data /app/apps/studio/data/platform-private
ENV NODE_ENV=production
# The entrypoint adjusts only the mounted volume root, then irrevocably drops
# to node (1000:1000) before starting either service.
CMD ["node", "ops/cloud/container-entry.mjs"]
