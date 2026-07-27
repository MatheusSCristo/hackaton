# Paciente 360 — Hackaton

Sistema de **"Aula conectada"**: o professor cria uma aula a partir de um caso
clínico do acervo (ou de um tema livre) e, com um clique, gera todo o material
de apoio — slides com imagens reais, simulado, resumo e material complementar
com referências pesquisadas na web — além de conduzir a sessão ao vivo com a
turma (enquete, caso clínico, sala do aluno).

## Arquitetura

Dois projetos rodam de fato; um terceiro é histórico/congelado.

| Pasta | Papel |
|---|---|
| **`p360-hackaton-backend/`** | Backend NestJS. Fonte de verdade do produto: autenticação com o P360 legado, acervo de casos clínicos, aulas/sessão ao vivo, **e o motor de geração de conteúdo** (slides com imagem real, simulado, resumo, material complementar com busca web) — este motor foi unificado a partir do `projeto-hackathon`. |
| **`p360-hackaton/`** | Frontend React (Vite). O wizard de criação de aula, o cockpit da sessão, a sala do aluno — inclui o visualizador de slides (com imagem, fullscreen, miniaturas) portado do `projeto-hackathon/frontend`. |
| `projeto-hackathon/` | **Congelado, não roda mais.** Era um "Slide Generator" standalone; sua lógica de geração (prompts, resolução de imagem, PDF com pesquisa web, visualizador de slides) foi portada para os dois projetos acima. Mantido só como referência histórica — `start.sh` não sobe esse projeto. |

### O motor de geração, resumido

O professor **nunca escreve um prompt**. O backend monta o contexto a partir
do que já foi escolhido na aula (`src/materiais/contexto-aula.service.ts`):
caso clínico selecionado (ou tema livre), público, duração, objetivos, e os
pontos fracos diagnosticados em blocos de caso anteriores. Esse contexto vira
o prompt de cada tipo de material:

- **Slides** (`slides-ia.service.ts` + `image-resolver.service.ts` +
  `pptx-renderer.service.ts`): gera a estrutura dos slides via LLM, resolve
  imagem real por slide de desenvolvimento (Unsplash → Wikimedia Commons →
  Picsum, nessa ordem de fallback) e renderiza o PPTX com a marca P360.
- **Simulado** (`simulado-ia.service.ts`): questões de múltipla escolha estilo
  Enamed, com gabarito e explicações.
- **Resumo** (`resumo-ia.service.ts` + `pdf-renderer.service.ts`): material de
  estudo em PDF.
- **Material complementar** (`material-complementar-ia.service.ts` +
  `pdf-renderer.service.ts`): leituras/vídeos/artigos com **busca web real**
  (só a Anthropic faz isso de verdade — ver `src/llm/anthropic.provider.ts`,
  método `generateJson` com a tool `web_search`; o Gemini gera sem pesquisar,
  como fallback degradado).

Todo o acesso a LLM passa por `src/llm/` (Gemini com fallback Anthropic,
retry + fila de concorrência) — ver `src/llm/llm.module.ts`.

## Como rodar

```bash
./start.sh
```

Sobe, nessa ordem: Postgres (Docker) → migrations → backend (`:8000`) →
frontend (porta do `p360-hackaton/.env`, `VITE_PORT`). Espera cada health
check antes de seguir — não é um sleep cego. Logs em `logs/backend.log` e
`logs/frontend.log`.

```bash
./stop.sh
```

Encerra backend e frontend. O Postgres fica de pé de propósito (é
infraestrutura, não precisa religar toda hora) — derrube com
`docker compose -f p360-hackaton-backend/compose.yml down` se quiser.

### Ambiente completo (com os projetos legados)

O hackaton depende de outros projetos do ecossistema Paciente 360 pra
funcionar de ponta a ponta: `avp-backend` (API legada — login, matrícula,
acervo), `avp-empresas` (host onde o hackaton é embarcado via iframe),
`p360-auth-front` (login do aluno), `p360-monolith-backend` e
`p360-survey-frontend` (módulo de enquete ao vivo, poll360).

```bash
./run-env.sh
```

Sobe `./start.sh` **e** os 5 projetos acima, cada um como processo Node
comum (sem Docker, sem nodemon/watch nos legados — só este produto roda em
modo watch, já que é nele que você está mexendo). Idempotente: se uma porta
já está ocupada, pula em vez de subir de novo (evita processo duplicado).

Por padrão espera os projetos legados em `~/workspace`. Pra apontar pra
outro lugar:

```bash
WORKSPACE_DIR=/outro/caminho ./run-env.sh
```

```bash
./stop-env.sh
```

Encerra tudo (este projeto + os 5 legados). Postgres/Redis do sistema
continuam de pé — são serviços do SO, não deste script.

⚠️ **`avp-backend` precisa de Node 10-12** (`engines` no `package.json`) — no
Node 20 do sistema o driver do Postgres trava em timeout de 5s em toda
consulta (bug real do driver antigo, não é rede/DB). O `run-env.sh` já sobe
via `nvm use 10` automaticamente; se for rodar esse projeto manualmente,
faça o mesmo. `avp-empresas` também exige Node 10 (app AngularJS/gulp
antiga) — mesma lógica.

### Variáveis de ambiente

Cada projeto tem seu `.env`/`.env.example` próprio. As chaves mais
importantes (já preenchidas nos `.env` deste ambiente):

- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` (backend) — providers de LLM,
  Gemini primário (mais barato) com fallback automático pra Anthropic.
- `UNSPLASH_ACCESS_KEY` (backend) — banco de imagens reais dos slides.
- `LEGACY_*` / `AVP_EMPRESAS_URL` (backend) — integração com o P360 legado
  (auth, acervo de casos, matrícula). Sem isso, o app roda mas as rotas
  autenticadas exigem um `X-Access-Token` válido do host legado.
- `VITE_PORT`, `VITE_HACKATON_API_URL` (frontend) — porta do dev server e
  base do backend (vazio = usa o proxy do `vite.config.ts` pra
  `localhost:8000`).

⚠️ **Nota sobre a chave Anthropic**: se ela estiver sem crédito, o material
complementar ainda é gerado, mas cai para o Gemini (sem pesquisa web real) —
confira o saldo em [console.anthropic.com](https://console.anthropic.com) se
quiser garantir busca web de verdade.

## Estrutura por pasta

Ver o `README.md` de cada projeto (`p360-hackaton-backend/README.md`,
`p360-hackaton/README.md`) para detalhes de stack, rotas e variáveis
específicas.
