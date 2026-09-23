# Build context: repository root.  docker build -f backend/api/infrastructure/docker/Dockerfile .
# Stage 1 produces the behaviour manifest (engine build hash + digests) that /api/v1/app-config serves.
FROM node:22-slim AS engine
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY shared ./shared
RUN sed -i '/"app"/d;/match-server/d' pnpm-workspace.yaml && pnpm install --frozen-lockfile=false --filter @tashzone/engine... \
 && cd shared/engine && npx tsc -p tsconfig.json && node scripts/bundle.mjs && node scripts/digest.mjs && node scripts/bundle-profiles.mjs

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /bin/uv
WORKDIR /srv/api
COPY backend/api/pyproject.toml ./
RUN uv sync --no-dev
COPY backend/api ./
COPY --from=engine /repo/backend/api/app/Schemas/contracts/profile_bundles ./app/Schemas/contracts/profile_bundles
COPY --from=engine /repo/shared/engine/dist/bundle/behaviour_manifest.json /srv/engine/behaviour_manifest.json
ENV ENGINE_MANIFEST=/srv/engine/behaviour_manifest.json PATH="/srv/api/.venv/bin:$PATH"
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health').status==200 else 1)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
