FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4188 LAB_DATA_DIR=/data/catalog
COPY --chown=node:node . .
RUN mkdir -p /data/catalog && chown -R node:node /data
USER node
EXPOSE 4188
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4188') + '/healthz').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "deploy/start-director.mjs"]
