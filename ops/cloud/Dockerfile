# Build from the repository root: docker build -f ops/cloud/Dockerfile .
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Keep locked dependency installation reusable when only product source changes.
COPY services/astrid-gpu-worker/gateway/package.json services/astrid-gpu-worker/gateway/package-lock.json services/astrid-gpu-worker/gateway/
COPY services/game/package.json services/game/package-lock.json services/game/
COPY apps/studio/package.json apps/studio/package-lock.json apps/studio/
RUN npm --prefix services/astrid-gpu-worker/gateway ci --omit=dev --ignore-scripts \
    && npm --prefix services/game ci --omit=dev --ignore-scripts \
    && npm --prefix apps/studio ci
COPY . .
ARG CROUPIER_LAB_BASE_PATH=/studio
ENV CROUPIER_LAB_BASE_PATH=$CROUPIER_LAB_BASE_PATH
RUN npm --prefix apps/studio run build \
    && chown -R node:node /app/apps/studio/.next \
    && mkdir -p /app/lab/data/platform-private \
    && chown node:node /app/lab/data /app/lab/data/platform-private \
    && chmod 700 /app/lab/data /app/lab/data/platform-private
ENV NODE_ENV=production
# The entrypoint adjusts only the mounted volume root, then irrevocably drops
# to node (1000:1000) before starting either service.
CMD ["node", "ops/cloud/container-entry.mjs"]
