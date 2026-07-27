# --- Build stage ---
FROM node:22-slim AS builder

WORKDIR /workspace

# openssl é exigido pelo engine do Prisma no runtime slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src src
RUN npm run build

# Poda para dependências de produção (mantém @prisma/client gerado).
RUN npm prune --omit=dev

# --- Runtime stage ---
FROM node:22-slim AS runtime

ENV NODE_ENV=production

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/node_modules /workspace/node_modules
COPY --from=builder /workspace/dist /workspace/dist
COPY --from=builder /workspace/prisma /workspace/prisma
COPY --from=builder /workspace/package.json /workspace/package.json

EXPOSE 8000

CMD ["node", "dist/main.js"]

# --- Migration stage ---
FROM node:22-slim AS migrations

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma prisma
RUN npx prisma generate

CMD ["npx", "prisma", "migrate", "deploy"]
