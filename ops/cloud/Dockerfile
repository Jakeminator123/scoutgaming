# Build from the repository root: docker build -f ops/cloud/Dockerfile .
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm --prefix lab ci && npm --prefix lab run build \
    && chown -R node:node /app/lab/.next
ENV NODE_ENV=production
USER node
CMD ["node", "ops/cloud/start.mjs", "--start"]
