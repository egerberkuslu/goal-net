# The Node service has no dependencies at all: built-ins only. So there is no
# npm install layer, which also means the image builds without network access.
# The built client is copied in from dist/ — run `npm run build` first.
FROM node:20-alpine

WORKDIR /app

# Ordered cheapest-changing first so edits to dist/ do not invalidate the code.
COPY packages/server ./packages/server
COPY server ./server
COPY dist ./dist

ENV NODE_ENV=production \
    PORT=5210 \
    HOST=0.0.0.0 \
    DIST_DIR=/app/dist

USER node
EXPOSE 5210

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/server/src/index.mjs"]
