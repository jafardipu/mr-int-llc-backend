# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
RUN --mount=type=cache,target=/etc/apk/cache,sharing=locked \
    apk add python3 make g++ openssl

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.alias.json generateFolder.js ./
COPY src ./src
COPY public ./public
COPY docs ./docs

# Client generation does not connect to MongoDB.
RUN DATABASE_URL="mongodb://localhost:27017/build_placeholder" pnpm exec prisma generate
RUN pnpm build
RUN grep -R '@app/' dist && exit 1 || true
RUN pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app

RUN --mount=type=cache,target=/etc/apk/cache,sharing=locked \
    apk add openssl

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=build --chown=1001:1001 /app/package.json ./package.json
COPY --from=build --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=build --chown=1001:1001 /app/dist ./dist
COPY --from=build --chown=1001:1001 /app/generated ./generated
COPY --from=build --chown=1001:1001 /app/public ./public
COPY --from=build --chown=1001:1001 /app/prisma ./prisma
COPY --from=build --chown=1001:1001 /app/docs ./docs

USER appuser
EXPOSE 5000 5005
ENV NODE_ENV=production
ENV IP=0.0.0.0
ENV PORT=5000
ENV SOCKET_PORT=5005

LABEL org.opencontainers.image.title="mr_int_llc_ecom_server"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "dist/server.js"]
