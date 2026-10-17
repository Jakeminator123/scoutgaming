FROM node:24-bookworm-slim
# Keep repository-relative shared imports intact. Build from the repository root;
# Dockerfile.dockerignore restricts that context to this runtime's source inputs.
WORKDIR /app/open-claw/lab
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4188 LAB_DATA_DIR=/data/catalog
COPY --chown=node:node open-claw/lab/package.json ./package.json
COPY --chown=node:node open-claw/lab/src/ ./src/
COPY --chown=node:node open-claw/lab/public/ ./public/
COPY --chown=node:node open-claw/lab/config/catalog.json ./config/catalog.json
COPY --chown=node:node open-claw/lab/fixtures/scenarios.json ./fixtures/scenarios.json
COPY --chown=node:node open-claw/lab/deploy/start-director.mjs ./deploy/start-director.mjs
COPY --chown=node:node packages/presentation/contracts/dealer-identity.mjs /app/packages/presentation/contracts/dealer-identity.mjs
RUN mkdir -p /data/catalog && chown -R node:node /data
USER node
EXPOSE 4188
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4188') + '/healthz').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "deploy/start-director.mjs"]
