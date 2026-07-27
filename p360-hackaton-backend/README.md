# p360-hackaton-backend

Backend **NestJS** do sistema de Hackaton do Paciente 360. Segue o
padrão do [`p360-cases-backend`](../../p360-cases-backend) (health, CORS
allow-list, validação do `X-Access-Token` contra o P360 legado, Docker
multistage com estágio de migrations e deploy GitOps/ArgoCD), porém em
NestJS + Prisma no lugar de FastAPI + SQLModel.

> Esqueleto/scaffold — sem lógica de negócio ainda. Os módulos de
> domínio serão adicionados depois.

## Stack

- **NestJS 11** (TypeScript, Express)
- **Prisma 6** + **PostgreSQL 17**
- **@nestjs/config** para env
- **class-validator / class-transformer** (ValidationPipe global)
- **Jest** para testes

## Arquitetura

```
src/
  main.ts                    ← bootstrap: prefixo /api, CORS allow-list, ValidationPipe
  app.module.ts              ← Config + Prisma + Auth + Health
  prisma/                    ← PrismaService (Global) + módulo
  auth/                      ← AccessTokenGuard global + LegacyAuthService + @Public()
  health/                    ← GET /api/health (público)
prisma/
  schema.prisma              ← datasource/generator (entidades a definir)
```

### Autenticação (embed)

O frontend (`p360-hackaton`, embarcado no avp-empresas) repassa o token
de sessão legado no header `X-Access-Token`. O `AccessTokenGuard` é
global: valida esse token via `LegacyAuthService` contra
`LEGACY_API_BASE_URL/users/get-token-info`. Rotas anotadas com
`@Public()` (ex.: `/api/health`) ficam de fora.

## Como começar

Com Docker (sobe app + migrations + postgres):

```bash
docker compose up --build
```

Local, sem Docker:

```bash
npm install
```

```bash
npx prisma generate
```

```bash
npm run start:dev
```

API sobe em `http://localhost:8000` (prefixo global `/api`). Health em
`GET http://localhost:8000/api/health`.

## Migrations (Prisma)

```bash
npx prisma migrate dev --name init
```

Em produção o estágio `migrations` do Dockerfile roda
`prisma migrate deploy`.

## Variáveis de ambiente

Ver [.env.example](.env.example):

- `PORT` — porta HTTP (default 8000).
- `CORS_ALLOW_ORIGINS` — allow-list separada por vírgula (`*` = tudo).
- `LEGACY_API_BASE_URL` — base da API HTTP do P360 legado.
- `DATABASE_URL` — string de conexão do Postgres (usada pelo Prisma).
