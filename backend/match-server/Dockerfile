# Build context: repository root.  docker build -f backend/match-server/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY shared ./shared
COPY backend/match-server ./backend/match-server
# app/ is excluded from the server image; drop it from the workspace list for this build
RUN sed -i '/"app"/d' pnpm-workspace.yaml && pnpm install --frozen-lockfile=false \
      --filter @tashzone/match-server...
RUN for p in engine protocol; do (cd shared/$p && npx tsc -p tsconfig.json); done \
 && (cd shared/engine && node scripts/bundle.mjs && node scripts/digest.mjs) \
 && (cd backend/match-server && npx tsc -p tsconfig.build.json)

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/match-server/dist/main.js"]
