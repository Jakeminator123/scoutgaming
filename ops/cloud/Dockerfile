# Build from the repository root: docker build -f ops/cloud/Dockerfile .
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ARG CROUPIER_LAB_BASE_PATH=/studio
ENV CROUPIER_LAB_BASE_PATH=$CROUPIER_LAB_BASE_PATH
RUN npm --prefix lab ci && npm --prefix lab run build \
    && chown -R node:node /app/lab/.next
ENV NODE_ENV=production
# The entrypoint adjusts only the mounted volume root, then irrevocably drops
# to node (1000:1000) before starting either service.
CMD ["node", "ops/cloud/container-entry.mjs"]
