FROM node:24-bookworm-slim
# Keep repository-relative shared imports intact. Build from the repository root;
# Dockerfile.dockerignore restricts that context to this runtime's source inputs.
WORKDIR /app/services/openclaw/lab
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4188 LAB_DATA_DIR=/data/catalog
COPY --chown=node:node services/openclaw/lab/package.json ./package.json
COPY --chown=node:node services/openclaw/lab/src/ ./src/
COPY --chown=node:node services/openclaw/lab/public/ ./public/
COPY --chown=node:node services/openclaw/lab/config/catalog.json ./config/catalog.json
COPY --chown=node:node services/openclaw/lab/fixtures/scenarios.json ./fixtures/scenarios.json
COPY --chown=node:node services/openclaw/lab/deploy/start-director.mjs ./deploy/start-director.mjs
COPY --chown=node:node packages/presentation/contracts/dealer-identity.mjs /app/packages/presentation/contracts/dealer-identity.mjs
COPY --chown=node:node packages/presentation/contracts/dealer-chat-persona.mjs /app/packages/presentation/contracts/dealer-chat-persona.mjs
COPY --chown=node:node packages/director/admin-error.mjs /app/packages/director/admin-error.mjs
COPY --chown=node:node packages/director/astrid-observation.mjs /app/packages/director/astrid-observation.mjs
COPY --chown=node:node packages/director/companion-personas.mjs /app/packages/director/companion-personas.mjs
COPY --chown=node:node packages/director/companion-search.mjs /app/packages/director/companion-search.mjs
COPY --chown=node:node packages/director/companion.mjs /app/packages/director/companion.mjs
COPY --chown=node:node packages/director/configuration.mjs /app/packages/director/configuration.mjs
COPY --chown=node:node packages/director/conversation-memory.mjs /app/packages/director/conversation-memory.mjs
COPY --chown=node:node packages/director/dashboard-handoff-contract.mjs /app/packages/director/dashboard-handoff-contract.mjs
COPY --chown=node:node packages/director/engine.mjs /app/packages/director/engine.mjs
COPY --chown=node:node packages/director/openclaw.mjs /app/packages/director/openclaw.mjs
COPY --chown=node:node packages/director/product-probe.mjs /app/packages/director/product-probe.mjs
COPY --chown=node:node packages/director/product-speech.mjs /app/packages/director/product-speech.mjs
COPY --chown=node:node packages/director/generated-speech-text.mjs /app/packages/director/generated-speech-text.mjs
COPY --chown=node:node packages/director/social.mjs /app/packages/director/social.mjs
COPY --chown=node:node packages/director/speech-routing.mjs /app/packages/director/speech-routing.mjs
COPY --chown=node:node packages/director/studio-admin-contract.mjs /app/packages/director/studio-admin-contract.mjs
COPY --chown=node:node packages/director/node/companion-store.mjs /app/packages/director/node/companion-store.mjs
COPY --chown=node:node packages/director/node/settings-reader.mjs /app/packages/director/node/settings-reader.mjs
RUN mkdir -p /data/catalog && chown -R node:node /data
USER node
EXPOSE 4188
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4188') + '/healthz').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "deploy/start-director.mjs"]
