# p360-hackaton

Frontend do sistema de **Hackaton** do Paciente 360, **embarcado no
avp-empresas** via iframe. Segue o mesmo padrão do
[`p360-conduta-avancada`](../../p360-conduta-avancada): React 19 + Vite +
TypeScript, design system `@cursosactive/p360-new-ui`, autenticação por
`X-Access-Token` repassado pelo host legado.

> Esqueleto/scaffold — a lógica de negócio será adicionada depois.

## Stack

- **React 19 + Vite 7 + TypeScript**
- **@cursosactive/p360-new-ui** (Chakra) para UI/tema
- **@tanstack/react-query** + **axios** para dados
- **zustand** para estado local, **react-hook-form + zod** para forms
- **i18next / react-i18next** para i18n (pt-BR default)
- **react-router**

## Embed & autenticação

O app roda dentro de um iframe de terceiro relativo ao host legado. O
host injeta `?accessToken=<token>` na URL do iframe; o token é
capturado no boot (`captureAccessTokenFromUrl`), persistido em
`sessionStorage` (não cookie — bloqueio de cookie de terceiro) e
anexado como header `X-Access-Token` em toda requisição pelo
interceptor axios ([src/api/api.ts](src/api/api.ts)). Em `401` o app
limpa o token e emite `postMessage({ type: "p360:hackaton:unauthorized" })`
para o host.

## Como começar

```bash
git clone https://github.com/paciente360/p360-hackaton.git
```

```bash
docker compose build --no-cache
```

```bash
docker compose up -d
```

Ou local, sem Docker:

```bash
npm install
```

```bash
npm run dev
```

Dev server sobe em `http://localhost:9000` (configurável via `VITE_PORT`).

## Variáveis de ambiente

Ver [.env.example](.env.example). Principais:

- `VITE_HACKATON_API_URL` — base do backend NestJS (`p360-hackaton-backend`).
- `VITE_HACKATON_API_TOKEN` — Bearer opcional.
- `VITE_USE_MOCK` — liga mocks até o backend estar de pé.
