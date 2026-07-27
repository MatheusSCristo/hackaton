# Plano — Sessão de Aula (builder de blocos + momentos ao vivo)

> **Status de implementação (25/07/2026):** MVP (§11), runtime da sessão (§12) e v2 do bloco
> `caso` (§13) **implementados** — typecheck, lint e build limpos nos dois repos; backend sobe
> com 32 rotas mapeadas e gateway ativo. Migrações aplicadas:
> `add_aula_blocos`, `add_sessoes_aula`, `add_caso_v2`.
>
> **Não implementado ainda:** geração de slides, bloco `reforco`, clonar sessão, painel
> compartilhável, modo assíncrono (cron), identidade do aluno na enquete (§11.4 — depende de
> afordância no poll360). **Não testado ponta a ponta** contra Claude/poll360/avp reais.
>
> Detalhes por seção abaixo; ver §14 para o inventário do que foi construído.

> **Status:** rascunho de arquitetura (v0.1). Consolida análise dos repositórios reais
> (hackaton, poll360/monolith, avp-stream-novo, avp-comunicacao, avp-apresentacao,
> avp-backend, avp-empresas) + o doc de produto `avp/docs/aula-conectada.md`.
> Objetivo: integrar caso clínico e enquete a uma "sessão de aula" **sem reescrever**
> os runtimes e **com mínimo toque no legado**.

---

## 1. Objetivo e princípios

Dentro do módulo **Aula Conectada** (repos `p360-hackaton` + `p360-hackaton-backend`), o
professor monta uma **sessão de aula** como uma **sequência de blocos** livremente
ordenável, e conduz esses blocos (alguns ao vivo). A IA conecta os dados de um bloco aos
seguintes.

Princípios:

- **Não engessar.** Sessão = blocos ordenáveis + **templates** de partida (editáveis). Ordem livre.
- **Reuso máximo.** Cada bloco *orquestra* um sistema que já existe; o hackaton não
  reimplementa caso nem enquete.
- **Caso roda no player nativo legado** (hand-off), o hackaton orquestra em volta.
- **IA contextual**, não obrigatória: um bloco pode consumir os *outputs* dos blocos anteriores.
- **Legado intocado:** só uso de APIs existentes + navegação; nenhuma alteração de código legado.

---

## 2. Mapa de sistemas (corrigido)

| Capacidade | Sistema correto | Natureza |
|---|---|---|
| Enquete ao vivo (PIN/QR, votação, resultados, Redis) | **poll360** = `p360-survey-frontend` + `p360-monolith/src/poll360` (`/ws/poll360`) | Novo/moderno — reuso |
| Conteúdo da enquete gerado por IA | **hackaton** (Claude) → API do poll360 | **Novo** |
| Caso agudo/crônico (runtime) | **avp-stream-novo** (diretiva bower no avp-empresas) | Legado — reuso |
| Caso comunicação (runtime) | **avp-comunicacao** (diretiva bower) | Legado — reuso |
| "Professor apresenta" ao vivo | **avp-apresentacao** + socket `/apresentacao` + `controlemobile` (QR) | Legado — reuso pronto |
| Dados/conteúdo/logs/relatórios do caso | **avp-backend** (`caso.js`, `casolog`, `casotime`, `caseevent`, `relatorio.js`) | Legado — só APIs |
| Slides / reforço / diagnóstico | **hackaton** (Claude) | **Novo** |
| Orquestração da sessão | **p360-hackaton** (front + back) | **Novo** |

> **Não usar** `p360-stream` nem `p360-cases-backend` para o caso — não fazem parte deste fluxo.

---

## 3. Modelo de blocos

A sessão é uma lista ordenada de **`AulaBloco`**. Cada bloco tem um tipo que mapeia num sistema.

```
AulaBloco
  id, aulaId, ordem,
  tipo        : slides | caso | enquete | reforco   (extensível)
  origem      : template | manual
  config      : JSON  (ex.: { casoId, modo: apresenta|autonomo, turmaId }  |  { foco: geral|fraquezas })
  output      : JSON  (ex.: diagnóstico gerado a partir dos dados do caso)  ← alimenta blocos seguintes
```

- **`output` feed-forward:** o resultado de um bloco (ex.: diagnóstico da IA sobre o caso)
  fica disponível para qualquer bloco posterior. É o que permite encadeamento **sem** fixar a ordem.
- **`SessaoDiagnostico`** (pode ser o `output` do bloco `caso`): JSON com os pontos fracos da
  turma, consumido por blocos `reforco` e `enquete` (modo focado).

### Templates (ponto de partida, sempre editáveis)

Conjuntos nomeados de blocos-semente. No MVP podem ser fixos em código; depois, tabela.

| Template | Blocos-semente |
|---|---|
| Diagnóstica | `slides → caso → reforço → enquete (focada)` |
| Caso primeiro (PBL) | `caso → slides → enquete` |
| Revisão rápida | `enquete (geral) → slides de correção` |
| Só apresentação | `slides` |
| Em branco | (vazio — monta do zero) |

O professor escolhe um template e **reordena/adiciona/remove/edita** os blocos à vontade.

---

## 4. Integração por tipo de bloco

### 4.1 `slides`
IA gera a apresentação (material `ppt`, já previsto no fluxo atual de "Gerar materiais").

### 4.2 `caso` — **hand-off ao player legado** (o hackaton não embarca o caso)

Os players são **diretivas bower** (`avpStreamNovo`, `avpComunicacao`, `avpApresentacao`)
dentro do `avp-empresas`, que recebem o objeto `caso` já hidratado (via `Caso.getCaso`) e a
identidade pelo `accessToken` global — **não** são micro-frontends embarcáveis. Portanto o
bloco `caso` **orquestra**, não renderiza:

**Modo A — Professor apresenta (ao vivo, projetado)**
- Abrir o state legado do player já existente:
  `/#/caso/play/<base64(casoId)>?apresentacao=true` (state `casoplayer`,
  `caso-player.module.js`). O parâmetro `apresentacao=true` liga o botão "Apresentar".
- O fluxo de apresentação **já está pronto**: `avp-apresentacao` + socket `/apresentacao`
  (sala = `casoId+timestamp`, papéis `caso`/`controle`) + QR para `controlemobile`
  (2ª tela / celular). Reuso total.
- Abertura por `window.open(...)` a partir do iframe (a sessão avp-empresas do professor já
  está autenticada) → **zero código novo no legado**.
  *(Alternativa: um handler `postMessage` no host que faça `$state.go('casoplayer', ...)` —
  só se quisermos abrir na mesma aba; é o único ponto que exigiria 1 handler no legado.)*
- Dado pedagógico aqui é limitado (é projeção). O dado rico vem do modo autônomo.

**Modo B — Alunos com conta acessam sozinhos (janela de tempo)**

> **Decisão (Opção A — "curso-wrapper invisível"):** o aluno faz **um caso só**, mas por
> baixo o caso roda pelo **fluxo de curso** (não pelo player standalone). Motivo técnico: o
> player standalone `/caso/play/:id` **não grava** `casolog`/`casotime`/`caseevent` no
> avp-backend (`caso-player.module.js:15-29` só publica na Data API externa) — os relatórios
> ricos por etapa/tempo/questão existem **apenas** pelo fluxo de curso
> (`CasoLog.loggerStream`, `caso-log.js:19-38`). Então usamos um **curso contêiner mínimo**,
> invisível para professor e aluno.

- **Curso-wrapper:** o hackaton cria/reusa um `curso` técnico contendo um único
  `cursoaula` (`caso_id`, `tpa_id=1`) — um caso, não uma trilha. Do ponto de vista do
  professor e do aluno é "um caso"; o `curso` é só o contêiner que habilita o registro e os
  relatórios. (A definir em §10.1: um curso-wrapper por caso reutilizável, ou um por sessão.)
- **Atribuição:** `POST /api/turmacursos` (CRUD LoopBack) atribuindo esse curso-wrapper à
  turma com `agendamento=true`, `data_ini`, `data_fim` (a "janela").
- **Matrícula:** alunos entram na turma por `turma.codigo_acesso` →
  `POST /api/usuarios/add-turma-from-code` (logado) ou no cadastro
  (`create-user-web` com `codigo`), populando `turmausuario`.
- **Liberação/bloqueio pela janela:** cron `POST /cron/cursos-agendados/` alterna
  `turmacurso.status` conforme `data_ini/data_fim` (`utils/cron/cursosAgendados.js`).
- Alunos resolvem no **fluxo normal de curso** (state `cursocaso`), sem embed.

**Coleta pós-execução (não é tempo real)**
- `GET /api/relatorios/pager?scope=relatoriodeatividades&filter[atividade_turma]=<turma>&filter[atividade_curso]=<curso>`
  → por aluno: `acoes` (`anamnese/examefisico/hipotese/exames/diagnostico/conduta` com
  `{total,feito,porcentagem}`) + `tempos` (de `casotime`). (`relatorio.js:425`)
- `POST /api/relatorios/get-atividades-detalhes { turma_id, curso_id }` → acerto por
  questão/tentativa. (`relatorio.js:850`)
- (Opcional) `POST /api/relatorios/get-reldesempenho-dados` — desempenho por resposta.
- **Correlação execução↔aula sem alterar o legado:** a tabela **`caseevent`** grava
  `class_id`(turma) + `caso_id` + `curso_id` + `session_uuid` + `company_id` + `createdat` —
  então "esta aula" = `(turma_id, caso_id[, curso_id])` dentro de `[data_ini, data_fim]`.
  `casolog`/`casotime` não têm turma, mas os relatórios resolvem por join estrutural
  (turma→turmacurso→cursoaula→caso e turmausuario→aluno).

**Comunicação:** mesmo padrão, player `avp-comunicacao` (state `comunicacao`). É vídeo
interativo; sem tentativa graduada — dado pedagógico mais pobre (fica para fase posterior).

### 4.3 `enquete` — poll360 (runtime como hoje) + conteúdo por IA
- **IA gera o conteúdo:** `EnqueteIaService` (Claude) a partir do caso/tema + objetivos +
  público → N perguntas com opções, correta, justificativa, pontos. Shape casa 1:1 com
  `Poll`/`PollOption` do poll360.
- **Criação no poll360:** `POST /api/v1/poll360/packages` → `POST .../polls` → opções,
  usando o token do professor.
- **Execução ao vivo:** exatamente como hoje — `POST /api/v1/poll360/sessions/start` gera
  PIN; alunos entram por PIN/QR (anônimos + aceite LGPD); resultados ao vivo via
  `/ws/poll360` (Redis). O hackaton **não toca** nesse realtime.
- **Foco:** `geral` (independe de caso) ou `fraquezas` (usa o `SessaoDiagnostico` de um bloco
  `caso` anterior).

### 4.4 `reforco` — IA gera material sob demanda
A partir do `SessaoDiagnostico`, a IA gera o reforço na forma escolhida pelo professor:
**slide detalhado adicional** ou **documento** (resumo/leitura). Reusa a geração de materiais.

---

## 5. A IA como tecido conectivo (3 novos usos estruturados)

Reusa a integração Claude já existente no hackaton (`ANTHROPIC_MODEL=claude-haiku-4-5`,
padrão *tool-use com saída estruturada* do `SemanticSearchService`):

1. **Diagnóstico** — dados do caso (relatórios) → pontos fracos da turma
   ("21% confundiu IC com DPOC", "conduta na sepse com baixo acerto").
2. **Geração de enquete** — perguntas MCQ (geral ou focadas nas fraquezas).
3. **Geração de reforço** — slide detalhado ou documento sobre os gaps.

Acionamento é **contextual**: a IA usa o que existir de `output` nos blocos anteriores. Sem
bloco `caso` antes, só há enquete "geral" e nenhuma sugestão de reforço.

---

## 6. Identidade / auth

- O hackaton já valida `X-Access-Token` via `POST /users/get-token-info` e recebe
  `legacyUser` (`id`, `emp_id`, `pusu_id`); o token legado também carrega `turma_id`.
- Papéis: `isProfessor`/`isAdmin`/`isSpeaker`/`isAluno` pelo `pusu_id` (auth.service legado).
- **Enquete:** aluno pode ser anônimo (PIN). **Caso:** aluno precisa estar autenticado e
  matriculado na turma (o player legado conversa com backends protegidos).

---

## 7. Modelo de dados (hackaton, schema `plano_aula`)

Estende o atual (`Aula`/`AulaMaterial`/`AulaMetrica`) sem alterá-lo:

- `AulaBloco` — ver §3 (`tipo`, `ordem`, `origem`, `config`, `output`).
- `Template` — fixo em código no MVP; tabela depois.
- `SessaoCasoResultado` (opcional) — cache do relatório puxado do avp-backend após a janela.
- Enquete guarda só `poll360PackageId` / `accessPin` no `config`/`output` do bloco.

UI: a aba **Materiais** atual (checkboxes) evolui para um **builder de sequência**
(escolher template ou vazio, arrastar/reordenar, configurar cada bloco). O `aulaStore`
(zustand) passa de `materiais: string[]` para `blocos: AulaBloco[]`.

---

## 8. Toque no legado — balanço

**Intocado (só uso de API / navegação):**
- avp-backend: `turmacursos`, `turmausuarios`, `usuarios/add-turma-from-code`, `relatorios/*`,
  `casos/get-caso`, `cron/cursos-agendados`.
- avp-stream-novo / avp-comunicacao / avp-apresentacao / socket `/apresentacao`: reuso via
  navegação (`window.open` do state do player).
- avp-empresas: aba "Plano de Aula" já existente.

**Único toque potencial (evitável):** se quisermos hand-off na *mesma aba* em vez de
`window.open`, um handler `postMessage`→`$state.go` no host. Com `window.open`, **nada**.

**Fora do hackaton, mas moderno (não "legado"):** poll360 — só uso de API para MVP; se
formos além do embed, há gaps conhecidos (`room-info` ausente, eventos speaker
dessincronizados, socket sem `auth.token`).

---

## 9. Faseamento

**MVP — builder + enquete IA (baixo risco)**
- `AulaBloco` + templates + UI de builder.
- Bloco `slides` (fluxo atual) + bloco `enquete` com **conteúdo gerado por IA** rodando via
  poll360 (embarcado, como hoje) — com validação estrutural + revisão humana (§11.3).
- Sala da sessão + cockpit + gateway de estado reidratável (§12.1).
- **Identidade do aluno na enquete** (§11.4) — barato e destrava correlação por aluno.

**v2 — caso + IA contextual**
- Bloco `caso`: modo apresenta (hand-off) + modo autônomo (wrapper + `turmacurso`).
- Gate de liberação no nosso backend (§13.5) + auto-matrícula (§13.3) + auditoria de escritas (§13.9).
- Coleta pós-janela + contador "X/Y concluíram" + **métricas reais substituindo o mock** (§13.6).
- `SessaoDiagnostico` + bloco `reforco` + enquete no modo `fraquezas`.

**v2.1 — ganhos baratos sobre a base do v2**
- **Modo assíncrono (dever de casa)** via `agendamento` + cron (§13.4).
- **Clonar sessão** para outra turma; painel compartilhável pós-aula (§13.10).
- Bloco de **comunicação** como "vivencial" (sem diagnóstico).

**v3 — o flywheel (maior risco/incerteza, ver `avp/docs/aula-conectada.md`)**
- **Recomendação de temas** ("sua turma vai mal em IC") — exige histórico agregado entre aulas.
- **Briefing pré-aula** (liberar só a queixa + coletar hipótese) — o legado não faz liberação
  parcial de caso; é o item de maior atrito técnico.
- **Material editável de verdade** (PPTX/DOCX) — hoje só existe PPSX não-editável.
- **Trilha de reforço por aluno**; convite por e-mail (SendGrid já existe no legado).

---

## 10. Riscos e decisões em aberto

1. **Curso-wrapper (DECIDIDO — Opção A):** o caso autônomo roda por um `curso` contêiner
   mínimo e invisível (um `cursoaula` com o caso), necessário porque só o fluxo de curso
   grava os relatórios ricos. **A definir:** (a) um curso-wrapper **por caso**, reutilizável
   entre turmas/sessões, ou (b) um **por sessão/aula** (isola melhor a janela, mas cria mais
   registros); e (c) como evitar poluir a listagem de cursos do professor (ex.: flag/tipo
   "wrapper" ou emp/curso técnico).
2. **Correlação sem carimbo:** `(turma+caso+janela)` via `caseevent` é forte, mas não é um
   `aula_id` explícito. Decidir se basta para o MVP ou se vale um carimbo mínimo.
3. **Dado pobre no modo apresenta:** projeção gera pouco dado per-student; o rico vem do
   autônomo. Alinhar expectativa de "diagnóstico".
4. **Segurança (legado):** vários remote methods de relatório interpolam IDs direto no SQL —
   validar/parametrizar `turma_id/curso_id/usuario_id` antes de repassar.
5. **poll360 além do embed:** só investir se quisermos código único de sessão em vez de
   PIN próprio.
6. **LGPD:** turma/aluno + desempenho são dados pessoais — reusar o consentimento existente.

---

## 11. Desenho de implementação — MVP

**Escopo do MVP:** builder de blocos + templates + bloco `slides` + bloco `enquete` gerada
por IA rodando no poll360. Blocos `caso` e `reforco` ficam para v2 (o modelo já os comporta).

### 11.1 Backend — modelo (Prisma, schema `plano_aula`)

Novo modelo `AulaBloco` (o `AulaMaterial` atual fica deprecado — `blocos` passam a ser a
fonte; migração aditiva, sem dropar nada no MVP):

```prisma
model AulaBloco {
  id        String   @id @default(uuid())
  aulaId    String   @map("aula_id")
  ordem     Int
  tipo      String   // slides | caso | enquete | reforco
  origem    String   @default("manual") // template | manual
  config    Json     @default("{}")     // ex.: { foco: "geral"|"fraquezas", nPerguntas, casoBlocoId }
  output    Json?                        // ex.: { poll360PackageId, poll360PollIds[], perguntas[], accessPin }
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  aula Aula @relation(fields: [aulaId], references: [id], onDelete: Cascade)

  @@index([aulaId])
  @@map("aula_blocos")
  @@schema("plano_aula")
}
```
Adicionar `blocos AulaBloco[]` no model `Aula`. Migração: `npx prisma migrate dev --name add_aula_blocos`.

### 11.2 Backend — endpoints & módulos

Estender o módulo `aulas/` (blocos) + novo módulo `enquete/`:

| Método | Rota | Resumo |
|---|---|---|
| GET | `/api/aula-templates` | Lista de templates (estático em código) |
| POST | `/api/aulas` | Criar aula **com `blocos[]`** (estender `CreateAulaDto`) |
| GET | `/api/aulas/:id/blocos` | Blocos da aula, ordenados |
| POST | `/api/aulas/:id/blocos` | Adiciona bloco (`CreateBlocoDto`) |
| PATCH | `/api/aulas/:id/blocos/:blocoId` | Atualiza `config`/`ordem` |
| PUT | `/api/aulas/:id/blocos/reorder` | `{ ordem: blocoId[] }` |
| DELETE | `/api/aulas/:id/blocos/:blocoId` | Remove |
| POST | `/api/aulas/:id/apply-template` | `{ templateId }` → semeia blocos |
| POST | `/api/aulas/:id/blocos/:blocoId/enquete/gerar` | IA gera perguntas → salva em `output.perguntas` (rascunho) |
| POST | `/api/aulas/:id/blocos/:blocoId/enquete/publicar` | Cria package+polls no poll360 → salva `output.poll360PackageId` |
| POST | `/api/aulas/:id/blocos/:blocoId/enquete/iniciar` | poll360 `sessions/start` → retorna `{ accessPin, joinUrl }` |

Todas seguem o padrão atual: `@LegacyUser()` + `requireProfessorId(user)` (ver
`aulas.controller.ts:20`). `CreateBlocoDto`/`UpdateBlocoDto` com `class-validator` (espelhar
`create-aula.dto.ts`): `tipo` `@IsIn([...])`, `config` objeto validado por tipo.

### 11.3 Backend — `EnqueteIaService` (Claude, saída estruturada)

Espelha `SemanticSearchService` (`casos/semantic-search.service.ts`): client Anthropic via
`ConfigService`, `tool_choice` forçado. Modelo padrão `claude-haiku-4-5` (`ANTHROPIC_MODEL`).

- **Entrada:** contexto do caso (`titulo/descricao/area/tema`) **ou** `tema + objetivos +
  publico`, + `fraquezas?: string[]` (do diagnóstico, quando `foco="fraquezas"`), + `nPerguntas`,
  + **`idioma`** (o host passa `?lang=`; o hackaton já tem pt-BR/en-US — o conteúdo gerado
  deve seguir o idioma da sessão, não o do prompt).
- **Tool `gerar_enquete`** — `input_schema`:
  ```
  { perguntas: [ { enunciado, opcoes: [ { texto, correta:boolean, justificativa, pontos:int } ] } ] }
  ```
- **Validação estrutural antes de aceitar** (não confiar na saída do modelo): exatamente **uma**
  opção `correta` por pergunta (a menos que o formato seja `MULTIPLE`), mínimo 3 opções, sem
  textos duplicados, enunciado não vazio, `pontos` ≥ 0. Falha → nova tentativa ou erro claro.
- **Revisão humana obrigatória:** o rascunho fica em `bloco.output.perguntas` e só vai ao
  poll360 quando o professor **publica**. Nunca publicar automaticamente.
- **Renderizar como texto**, nunca via `dangerouslySetInnerHTML` (conteúdo gerado + descrições
  vindas do banco legado).
- **Fallback:** sem `ANTHROPIC_API_KEY`, retorna erro amigável (ou 1 pergunta-modelo) — não há
  fallback textual como no caso da busca.

### 11.4 Backend — `Poll360Service` (cliente REST) + auth

Cliente axios server-to-server para o monolith. Base: `POLL360_API_URL`
(= `MONOLITH_BACKEND_URL` + `/api/v1/poll360`). **Auth:** reencaminha o token legado do
professor como o poll360 espera — headers `x-auth-token: <X-Access-Token>` +
`x-auth-source: "legacy"`. Como o guard atual só expõe `LegacyUser` (id/emp/pusu), adicionar
um `@LegacyToken()` (param decorator lendo `request.headers['x-access-token']`) para repassar
o token cru.

Métodos:
- `criarPacote(token, { packageName, perguntas })` → `POST /packages`, depois `POST
  /packages/:id/polls` + opções por pergunta. Retorna `{ packageId, pollIds }`.
- `iniciarSessao(token, { pollId, packageId })` → `POST /sessions/start` → `{ accessPin }`.
- `joinUrl(accessPin)` → monta a URL pública de entrada do aluno (survey-frontend `/join`).

#### Identidade do aluno na enquete (habilita correlação entre blocos)

Por padrão o respondente do poll360 é **anônimo** (entra por PIN). Isso quebraria o cruzamento
mais valioso da sessão: *"quem errou a conduta no caso escolheu qual opção na enquete?"*. Como
na nossa sala o aluno **já está logado**, devemos carregar a identidade para o poll360:

- O poll360 já suporta campos livres no respondente: `POST /api/v1/public/poll360/attendees`
  aceita `customData: [{id, value}]` (além de `pin`, e do aceite LGPD).
- **Abordagem:** o hackaton-backend **pré-cria o attendee** com
  `customData: [{ id: "p360_usu_id", value: <usuarioId> }]` e entrega o `attendeeId` à sala do
  aluno, que o repassa ao poll360 (que já persiste `attendeeId` por PIN em `attendeeStorage`).
- **Alternativa:** declarar `p360_usu_id` no `customFieldsSchema` do pacote e pré-preencher.
- ⚠️ Pode exigir uma pequena afordância no poll360 (aceitar `attendeeId` por query param ao
  entrar na sala). **Validar antes de prometer o cruzamento por aluno.**
- **LGPD:** vincular identidade a resposta muda a natureza do dado (deixa de ser anônimo) —
  precisa base legal e transparência no aviso da sessão (§13.13).

### 11.5 Frontend — store, services, hooks

- **`store/aulaStore.ts`:** trocar `materiais: string[]` por `blocos: BlocoDraft[]`
  (`{ tempId, tipo, origem, config }`), com ações `addBloco`, `updateBloco`, `moveBloco`,
  `removeBloco`, `applyTemplate`, `reset`.
- **`services/blocos.ts`** e **`services/enquete.ts`** (gerar/publicar/iniciar) no padrão de
  `services/aulas.ts` (usam `hackatonApi`, que já injeta `X-Access-Token`).
- **`hooks/useEnquete.ts`** (react-query mutations: `useGerarEnquete`, `usePublicarEnquete`,
  `useIniciarEnquete`).
- Estender `CriarAulaPayload`/`criarAula` para enviar `blocos`.

### 11.6 Frontend — UI (aba Materiais → builder)

Evoluir `tabs/MateriaisTab.tsx`:
- **Seletor de template** no topo (cards) → escolher template ou "Em branco".
- **Lista de blocos** ordenada (cards): ícone do tipo, título, resumo da `config`, ações
  **mover ↑/↓** e **remover**. (MVP: botões ↑/↓ — evita nova dependência; `@dnd-kit` fica p/ depois.)
- **Menu "adicionar bloco":** `slides` | `enquete` (com `caso` desabilitado no MVP).
- **Config do bloco `enquete`:** `foco` (`geral` | `fraquezas` — `fraquezas` só habilita se
  houver bloco `caso` antes), `nPerguntas`.
- **Rodar enquete** (ação no bloco): `gerar` → revisar perguntas → `publicar` → `iniciar` →
  exibir **PIN + QR** (QR gerado no cliente a partir da `joinUrl`) para os alunos entrarem.

### 11.7 Config / env

- **Backend `.env`:** `MONOLITH_BACKEND_URL` (ou `POLL360_API_URL`) + `POLL360_PUBLIC_URL`
  (survey-frontend, para a `joinUrl`). `ANTHROPIC_MODEL=claude-haiku-4-5` (já existe).
- **Front `.env`:** `VITE_SURVEY_URL` (se quisermos embarcar a tela do poll360).

### 11.8 Templates (estático em código)

`aula-templates.ts` no backend (espelhado no front p/ preview): `{ id, nome, blocos:
[{ tipo, config }] }` para `diagnostica`, `pbl`, `revisao`, `apresentacao`, `branco` (ver §3).

### 11.9 Ordem de implementação sugerida

1. Prisma: `AulaBloco` + migração; estender `CreateAulaDto` com `blocos[]`; CRUD de blocos.
2. Front: `aulaStore` (blocos) + builder na aba Materiais + templates + persistência.
3. `EnqueteIaService` (Claude) + endpoint `enquete/gerar`; UI de revisão das perguntas.
4. `Poll360Service` + `@LegacyToken()` + endpoints `publicar`/`iniciar`; UI de PIN/QR.
5. Testar ponta a ponta com token dev (empresa 143) e um poll360 de dev.

### 11.10 Dependência/risco no "rodar ao vivo" (poll360)

O caminho **participante** do poll360 (join→started→submit→results→ended) está alinhado ao
backend; os caminhos **speaker/presentation** estão em migração/dessincronizados, e o
`SocketGateway` do front do poll360 não envia `auth.token` hoje. Para o MVP, a
responsabilidade limpa do hackaton é **gerar conteúdo por IA + criar package + iniciar
sessão (PIN)**; o **controle ao vivo e a projeção de resultados** dependem do poll360 e
precisam ser validados/ajustados lá antes de considerar o live 100% pronto.

---

## 12. Runtime da sessão — casca única no hackaton-front (entrega)

**Modelo (decidido):** o `p360-hackaton-front` é a **casca única** da sessão. O professor cria
a sessão e compartilha **um link só** do hackaton-front. O aluno entra por esse link, faz
login com a conta Paciente 360 (quando houver caso), e **tudo acontece dentro dessa página**:
o caso inicia quando o professor autoriza, e a enquete aparece ali também — sem o aluno
navegar por vários lugares.

Isso reintroduz **duas peças** que estavam de-escopadas e depende de **uma verificação**.

### 12.1 Peça 1 — Canal de tempo real da sessão (orquestração)
Não é progresso passo a passo do caso (isso continua coletado ao fim). É o **sinal de
orquestração**: "professor autorizou o caso", "professor iniciou a enquete", presença dos
alunos. Um **gateway Socket.IO leve no `p360-hackaton-backend`** (`@nestjs/websockets` +
`@nestjs/platform-socket.io`) com salas por sessão (código de entrada). Moderno, nosso, sem
tocar `avp-socket`.

**Estado autoritativo no banco, socket só transporta.** O socket **não** é a fonte da verdade:
o estado da sessão (bloco atual, liberado/encerrado) vive no banco do hackaton. Isso é o que
permite F5 do professor, aluno entrando atrasado e reconexão sem perder o fio.

Eventos:

| Evento | Direção | Payload / efeito |
|---|---|---|
| `sessao:entrar` | cliente → servidor | `{ codigo }`; entra na sala e **responde `sessao:estado`** |
| `sessao:estado` | servidor → cliente | Snapshot completo: `{ sessao, blocoAtual, estado, blocos[] }` — enviado no join e em toda mudança (rehidratação) |
| `sessao:presenca` | servidor → sala | `{ total }` (e lista nominal quando o aluno está logado) |
| `sessao:atividade` | servidor → sala | `{ tipo, blocoId, estado }` — professor liberou/encerrou |

Como o estado é reidratável, uma queda do gateway degrada para "sem live", **não** para "sessão
perdida" — o cockpit e a sala podem cair para polling do estado via REST.

### 12.2 Peça 2 — Superfícies da sessão

**Enquete → iframe do poll360** (`survey-frontend`) com `?accessToken=`. É SPA standalone,
embarca bem. O aluno responde dentro da casca; resultados via `/ws/poll360` do próprio poll360.

**Caso → hand-off em modo quiosque (DECIDIDO — Opção B).** O caso **não** é embarcado; abre em
nova aba direto no player legado. Motivo: os players são **diretivas AngularJS bower** que só
rodam dentro do avp-empresas (dependem de `auth`, `Caso.getCaso`, SDK LoopBack, assets) — não
existe app standalone para embarcar, e iframar o avp-empresas exigiria liberar framing no
CDN. Hand-off evita esse risco de infra.

URL do hand-off (deep-link autenticado, modo quiosque):
```
https://<avp-empresas>/?t=<tokenAluno>#/curso/play/<cursoWrapperId>/caso/<casoIdB64>/<nomeB64>?exit=false
```
- `?t=` → SSO por URL via `processUrlToken` (`auth.service.js:65`).
- **Rota de CURSO** (não a `casoplayer` standalone) de propósito: só o fluxo de curso grava
  `casolog`/`casotime`/`caseevent` (§4.2) — amarra com o **curso-wrapper** (Opção A).
- Pré-condições em runtime: aluno matriculado (`turmausuario`) e `turmacurso` **liberado**.

**Por que o hand-off não deixa o aluno "andar na plataforma" (3 travas do próprio legado):**
1. **Fullscreen sem menu** — `cursocaso`/`comunicacao`/`apresentacao` são states **top-level**
   (`curso-player.module.js:391`), não `app.*`; a sidebar vive sob o state `app`. Não há
   sidebar nem menu nessas telas.
2. **Sem botão de sair** — `?exit=false` → `show_exit=false` (`curso-player.module.js:198`).
   Para aluno, `show_consulta` já vem desligado (`:194`).
3. **Curso-wrapper de um caso só** — se ainda assim sair, o `exitCaso` cai no `cursoplayer`,
   que é o wrapper com **exatamente um caso**: não há o que explorar.

Resíduo aceito: o aluno fica numa aba do domínio legado e poderia digitar outra URL
manualmente — limitação que o iframe também não eliminaria.

### 12.3 Login do aluno (conta Paciente 360)
- **Sessão com caso:** o aluno precisa de token legado. O link do hackaton-front leva ao
  login (reusar `p360-auth-front` / login legado) → obtém o token → o hackaton-front o usa
  como `X-Access-Token` **e** injeta no iframe do caso via `?t=`.
- **Sessão só de enquete:** pode ser anônimo (PIN do poll360) — login opcional.

### 12.4 Fluxo do aluno (unificado)
1. Abre o link do hackaton-front → (se houver caso) faz login Paciente 360.
2. Entra na **sala da sessão** (estado "aguardando"); o socket registra presença.
3. Professor autoriza uma atividade → o broadcast `sessao:atividade` faz a casca reagir:
   - **enquete** → renderiza o iframe do poll360 na própria sala;
   - **caso** → mostra o botão/redirect "Abrir o caso" (hand-off quiosque, §12.2).
4. Após o caso, o aluno volta à aba da sessão e aguarda a próxima atividade.
5. Professor encerra → próxima atividade (ou fim). Dados do caso coletados após a janela (§4.2).

Detalhe de UX do retorno: a casca fica na aba original em "aguardando/em andamento"; ao
detectar `visibilitychange` (ou pelo broadcast do professor) atualiza o estado. Assim o
hand-off é o único desvio, e é de ida-e-volta.

### 12.5 Impacto no §11 (MVP)
- Adicionar o **gateway Socket.IO** (§12.1) + **página da sala de sessão** (aluno) + **cockpit**
  do professor (autorizar/encerrar atividade).
- "Iniciar enquete" passa a **renderizar o iframe do poll360** na sala, além de mostrar PIN/QR
  para quem entrar por fora.
- O bloco `caso` (hand-off quiosque + curso-wrapper + coleta) permanece no **v2**.
- **Sem dependência de framing do avp-empresas** — a decisão B eliminou esse risco de infra.

---

## 13. Desenho de implementação — v2 (bloco `caso`)

**Escopo:** bloco `caso` ponta a ponta — curso-wrapper, atribuição à turma, liberação
controlada pelo professor, hand-off quiosque, coleta pós-execução e **diagnóstico da IA**
(que habilita `reforco` e enquete `foco="fraquezas"`).

> **Decisão de acesso ao legado:** as consultas e escritas necessárias são feitas **no novo
> backend** (`p360-hackaton-backend`), via **SQL direto e parametrizado** no banco `avp` —
> não pelo REST do LoopBack. Motivos: elimina a incerteza de ACL do token de professor,
> evita as idiossincrasias do framework "fw"/`pager`, e nos deixa **parametrizar** as queries
> (o legado interpola IDs direto no SQL). Zero alteração de código legado.
>
> **Contrapartidas assumidas** (ver §13.13): escrever direto contorna os hooks do LoopBack —
> `createdat`/`updatedat` são **NOT NULL sem default** e precisam ser setados por nós; e as
> tabelas de auditoria (`turmacursoevent`) não são preenchidas automaticamente.

### 13.1 Valores de referência (verificados no banco de dev `avp`)

| Item | Valor | Como foi verificado |
|---|---|---|
| `cursoaula.tpa_id` para caso | **1** (`tipoaula`: 1=Caso, 2=Video, 3=Conteudo, 4=Questionario) | `SELECT id,nome FROM tipoaula` |
| `curso.status_id` publicado | **6** (`casostatus`: 1=Produção, 2=Revisão Interna, 6=Publicado, 7=Desativado) | `SELECT * FROM casostatus` |
| `curso.nome` é único? | **Não** — `curso_nome_key` é índice comum (`CREATE INDEX`), não unique | `pg_indexes` / `pg_constraint` |
| `turmacurso` unicidade | **Único `(curso_id, tma_id)`** | `turma-curso.json:7-15` |
| `turmacurso.data_ini/fim` | tipo **`date`** (granularidade de DIA) | `turma-curso.json:45-56` |
| `empresacurso` | `(curso_id, emp_id, status, prioridade, free, ...)`, índice não-único | `\d empresacurso` |

### 13.2 Curso-wrapper — criação e reuso

**Estratégia:** **um wrapper por `(caso_id, emp_id)`**, reutilizável entre turmas e sessões.
O hackaton mantém o vínculo numa tabela própria (`CursoWrapper`) para não recriar.

Criação em **uma transação** no banco `avp` (idempotente — se já há wrapper para o par, reusa):

```sql
BEGIN;

-- 1. curso contêiner (esp_id/tem_id herdados do próprio caso; status_id 6 = Publicado)
INSERT INTO curso (nome, status_id, esp_id, tem_id, idioma, certificado, overview,
                   createdat, updatedat)
SELECT c.catalogo_nome, 6, c.esp_id, c.tem_id, 'pt-BR', false, false, now(), now()
  FROM caso c WHERE c.id = $1
RETURNING id;                                   -- :cursoId

-- 2. único item do curso: o caso (tpa_id 1 = Caso; nome é NOT NULL)
INSERT INTO cursoaula (curso_id, caso_id, tpa_id, nome, ordem, required,
                       createdat, updatedat)
SELECT :cursoId, c.id, 1, c.catalogo_nome, 1, true, now(), now()
  FROM caso c WHERE c.id = $1;

-- 3. acesso do curso à empresa do professor
INSERT INTO empresacurso (curso_id, emp_id, status, free, createdat, updatedat)
VALUES (:cursoId, $2, true, false, now(), now());

COMMIT;
```

Notas:
- `createdat`/`updatedat` são **NOT NULL sem default** → sempre `now()`.
- `curso.nome` **não é único** (§13.1) — sem risco de colisão.
- `status_id`/`esp_id` são `required` no modelo LoopBack mas **nullable no banco**; setamos de
  todo modo, porque `esp_id` participa dos joins de catálogo/relatório.
- Ler `catalogo_nome`/`esp_id`/`tem_id` do próprio `caso` mantém o wrapper coerente com o caso.

**Efeito colateral a aceitar:** o wrapper é um curso real — aparece na lista de cursos da
turma enquanto liberado, com o **nome do caso**. Na prática lê-se como "o caso", e é
justamente o destino do `exitCaso` (§12.2, trava 3). Não há como ter os relatórios sem um
curso; o wrapper é o custo mínimo.

### 13.3 Turma e matrícula

- **Turma:** o professor escolhe uma turma sua no bloco. Listagem por SQL direto
  (`SELECT id, nome, codigo_acesso FROM turma WHERE emp_id = $1 AND status = true`).
- **Matrícula dos alunos:** já existente (`turmausuario`). Alunos entram por
  `turma.codigo_acesso` → `POST /api/usuarios/add-turma-from-code` (logado) ou no cadastro.
- **Auto-matrícula na entrada da sessão (evita o muro do 403).** O caso exige
  `turmausuario`; um aluno não matriculado receberia erro sem entender o motivo. Ao entrar na
  sala, o hackaton verifica a matrícula e, se faltar, **matricula na turma da sessão** — usando
  o `codigo_acesso` da turma (via `add-turma-from-code`) ou o upsert idempotente:
  ```sql
  INSERT INTO turmausuario (tma_id, usu_id, createdat, updatedat)
  VALUES ($1, $2, now(), now())
  ON CONFLICT (tma_id, usu_id) DO NOTHING;
  ```
  Fallback de UI: exibir o `codigo_acesso` para entrada manual.
- ⚠️ Matricular alguém numa turma é um efeito colateral com peso acadêmico — deve ser
  **explícito para o aluno** ("você está entrando na turma X") e registrado na auditoria (§13.9).
- O bloco guarda `turmaId` no `config`.

### 13.4 Liberação — controlada pelo professor (não por data)

> **Decisão de design:** `turmacurso.data_ini/data_fim` são **`date`** — não expressam "os
> próximos 30 minutos". Para uma sessão de aula, a liberação é feita pelo **booleano
> `status`**, alternado pelo hackaton no momento em que o professor autoriza/encerra.

> ⚠️ **Limite real do gate (verificado):** `Caso.getCaso` valida acesso **apenas no nível da
> empresa** — existe `empresacurso → cursoaula` para aquele caso? Se não, 403 (`caso.js:612-624`).
> Ele **não** consulta `turmacurso.status`. Logo `status` governa a **listagem/abertura do
> curso** (via `Curso.getCurso`), mas **não bloqueia o deep-link do player**. A consequência
> está em §13.5: o gate efetivo da sessão vive **no nosso backend**, não no legado.
> (Observação: a query de `getCaso` tem precedência `AND/OR` sem parênteses, o que a torna
> ainda mais permissiva. Bug legado — apenas registrado, não corrigido aqui.)

- **Atribuir (uma vez por turma)** — upsert aproveitando o único `(curso_id, tma_id)`:
  ```sql
  INSERT INTO turmacurso (curso_id, tma_id, usu_id, status, agendamento,
                          bloquear_exame_fisico, bloquear_diagnostico, createdat, updatedat)
  VALUES ($1, $2, $3, false, false, false, false, now(), now())
  ON CONFLICT (curso_id, tma_id) DO UPDATE SET updatedat = now()
  RETURNING id;
  ```
- **Professor autoriza** → `UPDATE turmacurso SET status = true, updatedat = now() WHERE id = $1`
  → alunos podem abrir.
- **Professor encerra** → `UPDATE turmacurso SET status = false, updatedat = now() WHERE id = $1`.
- (Opcional, paridade de auditoria com a UI legada) inserir `turmacursoevent` a cada troca de
  status — o avp-empresas faz isso explicitamente; o SQL direto não faz sozinho.

**Concorrência e colisão (tratar na UI e no serviço):**
- `turmacurso` é único em `(curso_id, tma_id)` → **duas aulas usando o mesmo caso na mesma
  turma compartilham a mesma linha**. Se ambas estiverem ativas, uma "encerra" a outra.
  Detectar no `preparar` e **avisar o professor** ("este caso já está liberado para esta turma
  na aula X"); não abrir duas sessões concorrentes sobre a mesma linha.
- `liberar`/`encerrar` devem ser **idempotentes** (duplo-clique, retry de rede): a operação
  escreve o estado desejado e devolve o estado atual, sem alternar cegamente.

**Modo assíncrono (dever de casa) — mesmo mecanismo, outra chave:** com `agendamento=true` +
`data_ini`/`data_fim`, o cron `/cron/cursos-agendados` passa a liberar/bloquear sozinho pela
janela de dias. É a base do "pacote assíncrono" do doc de produto, e sai quase de graça depois
do v2 — muda apenas quem alterna o `status` (cron em vez do professor).
- `agendamento=false` mantém o **cron `/cron/cursos-agendados` fora do caminho** (ele só toca
  registros com `agendamento=true`) — evita que o cron reabra/feche por conta das datas.
- **Modo assíncrono (dever de casa, multi-dia):** aí sim usar `agendamento=true` +
  `data_ini/data_fim` e deixar o cron liberar/bloquear.

### 13.5 Hand-off quiosque (o link do aluno)

> **Revisado depois da implementação.** Esta seção descrevia um deep-link montado à mão e um
> nonce de uso único. Os dois se mostraram errados na prática; o que está abaixo é o que o
> código faz hoje.

**O gate fica no nosso backend.** Como o legado não valida `turmacurso.status` no deep-link
(§13.4), o aluno não recebe a URL legada direto. Ele chama `autorizar`, que valida o estado da
sessão, garante a matrícula e **devolve a URL** — o cliente abre em nova aba.

```
POST /api/sessoes/:sessaoId/blocos/:blocoId/caso/autorizar   (autenticado)
  → bloco não liberado  → 403 "aguarde o professor"
  → liberado            → { url } com o link SSO do avp-empresas
```

**Por que devolver a URL em vez de um 302.** `window.open` é navegação do browser e **não**
envia `X-Access-Token` — só XHR envia. Um endpoint de redirect nunca conseguiria autenticar o
aluno: respondia 401 antes de chegar ao 302.

**Por que usar o ponto de entrada SSO do legado, e não um deep-link nosso.** O destino é:

```
https://<avp-empresas>/?t=<tokenAluno>&directCase=<casoId>&curso_id=<wrapperId>
```

O `$urlRouterProvider.otherwise` (`core.module.js:1284-1358`) autentica pelo `?t=`, faz o
`btoa()` dos ids **internamente** e navega com `exit:false` (quiosque). Montar o hash à mão
falhava porque os segmentos iam em base64, que pode conter `/` e quebra o casamento da rota —
a aba caía no `otherwise` e terminava em `/app/cursos`. Caso de comunicação:
`&clinicalType=comunicacao`. Travas de quiosque: §12.2.

**O nonce não endurece nada — é trilha de auditoria.** A ideia de "uso único" não sobrevive ao
hand-off: quem carrega o link é o browser, e o único credencial que o legado aceita é o `?t=`,
que já é o token do próprio aluno. A tabela `CasoAcessoNonce` ficou como registro de **quem
abriu o caso e quando**, e é isso que ela deve dizer. O gate real é a liberação do bloco,
checada em `autorizar`.

**Limitação conhecida: recarregar a aba do caso cai na aba padrão da plataforma.** O `?t=` é
consumido na entrada e sai da barra de endereço. Se aquela aba for recarregada sem sessão do
avp-empresas, o `getCaso` falha → bounce para o auth front → ele volta à raiz **sem**
`directCase`/`curso_id` → o legado cai no branch de aba padrão (`core.module.js:1372`) e o aluno
termina em `/app/new-dashboard`. O destino se perde no ida-e-volta do login.

Não há correção possível **só do nosso lado**: quem decide o destino após o SSO é o legado. O
caminho barato seria uma linha lá — o `otherwise` **já** suporta `?url=` (linhas 1280 e 1321)
para "volte para cá depois do SSO", e ninguém passa esse parâmetro no bounce; isso consertaria a
classe toda, inclusive as integrações WAID, que têm o mesmo furo. Enquanto isso não for feito, a
mitigação é de produto: o botão na sala **continua disponível** depois de abrir, e clicar de novo
gera um link novo. A sala diz isso ao aluno explicitamente.

**O que o gate resolve e o que não resolve.** Impede entrada fora da janela do bloco. **Não**
impede que um aluno que já entrou permaneça com a aba aberta — e nem deveria, pois ele está
legitimamente resolvendo o caso. Também não é fronteira de confidencialidade: o caso já pertence
ao catálogo da empresa do aluno, então não há exposição de dado novo. A única alavanca legada
para um bloqueio absoluto seria remover a linha `empresacurso` (destrutivo e global) — **não
recomendado**.

### 13.6 Coleta pós-execução

Disparada quando o professor **encerra** o bloco (ou sob demanda "atualizar resultados").
Como estamos em SQL direto, consultamos as tabelas-fonte em vez de depender do formato do
`relatoriodeatividades` — mais simples de agregar e já recortado pela **janela da sessão**.

**Fonte primária — `caseevent`** (a única com turma): tem `class_id`, `caso_id`, `curso_id`,
`usuario_id`, `evento`, `session_uuid`, `createdat`. Recorte natural da sessão:
```sql
SELECT usuario_id, evento, session_uuid, createdat
  FROM caseevent
 WHERE class_id = $1 AND caso_id = $2
   AND createdat BETWEEN $3 AND $4        -- liberadoEm .. encerradoEm
```
Os eventos (`anamnese_play/end`, `examefisico_play/end`, `diagnostico_end`, `caso_end`,
`exit`) permitem derivar **progresso por etapa** e **conclusão** por aluno.

**Tempo por etapa — `casotime`** (`caso_id`, `usuario_id`, `evento`, `tempo` interval; sem
turma) → juntar por `usuario_id` restrito aos alunos da turma (`turmausuario`) e ao caso.

**Universo da turma** (para calcular % sobre o total de alunos):
```sql
SELECT u.id, u.nome FROM turmausuario tu
  JOIN usuario u ON u.id = tu.usu_id
 WHERE tu.tma_id = $1
```

**Referência de paridade:** a lógica canônica de "% por etapa" está em
`relatorio.js:477-604` (universo por `turma→turmacurso→cursoaula(tpa_id=1)→caso` × alunos, e
`feito` por presença em `casolog`). Nossa agregação deve reproduzir esse racional; usar
`relatoriodeatividades` via REST fica como **fallback/validação cruzada**.

Persistir bruto + agregado em `bloco.output` (e/ou `SessaoCasoResultado`) para não reconsultar.

#### Contador "X de Y concluíram" (durante a janela)

Não é streaming de progresso — é **uma consulta leve e periódica** (ex.: a cada 15–30s, só
enquanto o bloco está liberado) contando alunos com `caso_end`/`exit` em `caseevent` na janela,
sobre o total de alunos da turma. Serve para a decisão prática do professor: *"já posso
encerrar?"*. O resultado vai ao cockpit pelo `sessao:atividade`/`sessao:estado` (§12.1).

#### Métricas reais substituem o mock (encerra uma incoerência do produto)

Hoje o overview usa `mockMetrica()` — números aleatórios por aula (`aulas.service.ts:18`).
Manter isso ao lado de dados reais mina a confiança em todo o dashboard. Com a coleta acima:

- `AulaMetrica` passa a ser **derivada** do agregado: `alunosTotal` = alunos da turma;
  `alunosEngajados` = alunos com ao menos um evento na janela; `mediaAcertos` = do agregado por
  etapa/questão; `taxaConclusao` = % com `caso_end`.
- **Mock só como fallback explícito:** aula sem bloco de caso executado exibe "sem dados ainda",
  **não** número inventado. Remover a geração aleatória na criação da aula.
- Os KPIs do overview (`totalAulas`, `alunosImpactados`, `mediaAcertos`, `engajamento`) passam a
  agregar apenas aulas com dados reais.

Persistir o resultado bruto + o agregado em `bloco.output` (e/ou `SessaoCasoResultado`) para
não reconsultar o legado a cada abertura.

### 13.7 Diagnóstico da IA (`CasoDiagnosticoService`)

Novo serviço no hackaton, mesmo padrão do `SemanticSearchService` (client Anthropic via
`ConfigService`, `tool_choice` forçado, `claude-haiku-4-5`).

- **Entrada:** agregado do §13.6 (médias por etapa, dispersão, tempos, nº de alunos) +
  contexto do caso (título/área/tema) + público-alvo.
- **Tool `diagnosticar_turma`** — `input_schema`:
  ```
  { pontos_fracos: [ { titulo, descricao, etapa, severidade: "alta"|"media"|"baixa",
                       evidencia, sugestao_reforco } ],
    resumo }
  ```
- **Saída → `bloco.output.diagnostico`**, que é o `SessaoDiagnostico`. Consumido por:
  - bloco **`reforco`** (gera slide detalhado ou documento sobre os gaps);
  - bloco **`enquete`** com `foco="fraquezas"` (§11.3 recebe `fraquezas: string[]`).
- **Sem chave Anthropic:** fallback heurístico (ranquear etapas por menor `porcentagem` e
  maior tempo) — mesmo espírito do `AulasInsightsService` atual.

### 13.8 Modelo de dados (hackaton, additivo)

```prisma
model CursoWrapper {                    // vínculo caso↔curso técnico no legado
  id            String   @id @default(uuid())
  casoLegacyId  Int      @map("caso_legacy_id")
  empId         Int      @map("emp_id")
  cursoLegacyId Int      @map("curso_legacy_id")
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([casoLegacyId, empId])
  @@map("curso_wrappers")
  @@schema("plano_aula")
}
```
No `AulaBloco.config` do tipo `caso`: `{ casoLegacyId, casoTitulo, modalidade, turmaId,
modo: "apresenta"|"autonomo" }`.
No `AulaBloco.output`: `{ wrapperId, turmaCursoId, liberadoEm, encerradoEm, agregado, diagnostico }`.

### 13.9 Endpoints no hackaton (v2)

| Método | Rota | Resumo |
|---|---|---|
| GET | `/api/turmas` | Turmas do professor (SQL no legado) + `codigo_acesso` |
| POST | `/api/aulas/:id/blocos/:blocoId/caso/preparar` | Garante wrapper (§13.2) + `turmacurso` (§13.4, `status:false`) |
| POST | `/api/aulas/:id/blocos/:blocoId/caso/liberar` | `PATCH turmacurso {status:true}` + broadcast `sessao:atividade` |
| POST | `/api/aulas/:id/blocos/:blocoId/caso/encerrar` | `status:false` + dispara coleta (§13.6) |
| POST | `/api/sessoes/:sessaoId/blocos/:blocoId/caso/autorizar` | Valida liberação, matricula e devolve `{ url }` do hand-off (§13.5) |
| GET | `/api/aulas/:id/blocos/:blocoId/caso/resultado` | Agregado + diagnóstico |
| POST | `/api/aulas/:id/blocos/:blocoId/caso/diagnosticar` | (Re)gera o diagnóstico da IA (§13.7) |

**Acesso ao legado — pool de escrita separado.** O `LegacyDbService` atual é **read-only**
(`options: "-c default_transaction_read_only=on"`, `legacy-db.service.ts:52`). Para o v2:

- manter o pool read-only para tudo que é leitura (casos, turmas, relatórios);
- adicionar um **segundo pool read-write** (ex.: `LegacyDbWriteService`, mesmo módulo
  `legacy-db/`, sem a flag e com `max` menor), usado só pelo `preparar/liberar/encerrar`;
- toda escrita **em transação** e com queries **parametrizadas** (`$1, $2, ...`);
- credencial dedicada de escrita via env própria (ex.: `LEGACY_PGUSER_WRITE`/`_PASSWORD`),
  para poder limitar privilégios no banco.

**Auditoria própria de tudo que escrevemos no legado.** Escrever em banco compartilhado sem
trilha deixa debug e rollback cegos — e aqui há efeitos com peso acadêmico (criar curso,
matricular aluno em turma, liberar conteúdo). Tabela nossa, no schema `plano_aula`:

```prisma
model LegacyWriteLog {
  id        String   @id @default(uuid())
  sessaoId  String?  @map("sessao_id")
  blocoId   String?  @map("bloco_id")
  acao      String   // criar_wrapper | atribuir_turmacurso | liberar | encerrar | matricular_aluno
  tabela    String   // curso | cursoaula | empresacurso | turmacurso | turmausuario
  registroId String? @map("registro_id")
  payload   Json
  professorId String @map("professor_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([sessaoId])
  @@map("legacy_write_log")
  @@schema("plano_aula")
}
```
Registrar **antes/depois** de cada escrita, com o `professorId` que originou a ação. Isso
também dá o material para uma futura rotina de limpeza (remover wrappers órfãos).

### 13.10 Frontend (v2)

- **Config do bloco `caso`:** escolher **turma** (+ mostrar `codigo_acesso`), **modo**
  (`apresenta` | `autonomo`), e o caso (já vem do bloco anterior/aula).
- **Cockpit do professor:** botões **Liberar** / **Encerrar**; no modo `apresenta`, botão
  **Abrir apresentação** (hand-off `?apresentacao=true`, §4.2 Modo A). Durante a janela, exibir
  o contador **"X de Y concluíram"** (§13.6) — é o que informa a decisão de encerrar.
- **Sala do aluno:** ao receber `sessao:atividade` do tipo `caso`, mostra **"Abrir o caso"**
  (link assinado, §13.5) + estado "aguardando o professor" antes disso.
- **Pós-encerramento:** painel com % por etapa, tempos, e os **pontos fracos** da IA, com
  atalhos "criar bloco de reforço" e "criar enquete focada".
- **Painel compartilhável pós-aula:** o mesmo resultado em formato apresentável, para o
  professor mostrar à turma / coordenação (sem dados individuais identificáveis por padrão).
- **Clonar sessão para outra turma:** ação que copia os blocos da aula e pede só a nova turma.
  Barato (o modelo de blocos já permite) e é o pedido mais comum na prática — o professor dá a
  mesma aula em várias turmas.

### 13.11 Ordem de implementação (v2)

1. `LegacyDbWriteService` (pool read-write) + `GET /api/turmas` (SQL).
2. `CursoWrapper` (Prisma) + `caso/preparar` (curso + cursoaula + empresacurso + turmacurso).
3. `caso/liberar` / `caso/encerrar` + `caso/link` (hand-off) + UI de cockpit/sala.
4. Coleta (`relatoriodeatividades`) + agregação + `caso/resultado`.
5. `CasoDiagnosticoService` + `caso/diagnosticar` + painel de pontos fracos.
6. Ligar `reforco` e enquete `foco="fraquezas"` ao diagnóstico.

### 13.13 Verificações e riscos do v2

**Resolvidos pela decisão de SQL direto (§13):** ACL de escrita do token de professor (não
usamos mais o REST) e SQL não parametrizado dos relatórios (escrevemos as nossas queries).

**Riscos introduzidos por escrever direto no banco legado:**

1. **Hooks do LoopBack contornados.** `createdat`/`updatedat` são NOT NULL sem default →
   sempre `now()` (já no SQL do §13.2/§13.4). Qualquer outro efeito colateral que o
   `FwBaseModel` produza é perdido; auditoria (`turmacursoevent`) precisa ser inserida por nós
   se quisermos paridade.
2. **Acoplamento a schema legado.** Mudanças no `avp` quebram nossas queries silenciosamente.
   Mitigar concentrando **todo** SQL legado em `legacy-db/` (nenhum SQL espalhado em
   services), e cobrir com um teste de fumaça que valide colunas usadas.
3. **Escrita num banco compartilhado.** Usar credencial dedicada com privilégio mínimo
   (idealmente apenas `INSERT/UPDATE` nas 4 tabelas do wrapper), pool pequeno, transações
   curtas. Nunca reutilizar o pool read-only.

**Resolvido — `cursousuario` (era o risco nº 1 do v2):**

4. **Criado sob demanda, não por `aplicado`.** `Curso.getCurso` faz `findOne` e, se não
   existir, `CursoUsuario.create({curso_id, usuario_id, qtd_time:1})` (`curso.js:1508-1512`).
   Confirmado nos dados: há `cursousuario` nos três grupos de `turmacurso.aplicado`
   (true/false/null) e só numa fração dos pares possíveis → é lazy, por acesso.
   **Logo o `preparar` NÃO precisa popular `cursousuario` nem setar `aplicado`.**
   - **Efeito colateral do nosso deep-link:** ele vai direto ao state `cursocaso`, que **não**
     chama `getCurso` (isso está no `CursoPlayerController`, `curso-player.module.js:77`) →
     `cursousuario` e `CourseSession` **não** são criados no nosso fluxo.
   - **Impacto na coleta: nenhum.** O `loggerStream` dispara normalmente com
     `curso_id`/`session_uuid` (`:97-104`), gravando `casolog` + `caseevent` + `casotime` — que
     são exatamente nossas fontes (§13.6). O `relatoriodeatividades` também não depende de
     `cursousuario`. Só progresso/conclusão/certificado do *curso* ficam sem registro —
     irrelevante para um wrapper de caso único.

**Verificações pendentes em runtime:**
5. **Wrapper poluindo catálogo:** o curso aparece na lista da turma enquanto liberado
   (§13.2). Se incomodar, avaliar `empresacurso.status=false` + liberar só via `turmacurso`,
   ou uma convenção de nome/tag.
6. **Paridade da agregação:** validar nossa agregação (§13.6) contra o
   `relatoriodeatividades` do legado num caso real, para garantir o mesmo racional de
   `total`/`feito`.

**Limitações de produto:**

7. **Modo `apresenta` gera pouco dado:** a projeção não produz execução por aluno; o
   diagnóstico só é rico no modo `autonomo`. Deixar explícito na UI.
8. **Caso de comunicação:** sem tentativa graduada — agregado pobre (vídeo). Tratar como bloco
   "vivencial", sem diagnóstico.

**LGPD — ações concretas (não só menção):**

9. A sessão trata **dados pessoais de desempenho** de estudantes, e a identidade na enquete
   (§11.4) **desanonimiza** respostas que hoje são anônimas. Antes do v2:
   - definir **base legal** (provavelmente execução de contrato/legítimo interesse educacional,
     não consentimento — decidir e documentar);
   - **transparência na sala**: avisar que respostas e desempenho ficam visíveis ao professor;
   - **retenção** dos agregados que persistimos em `bloco.output`/`SessaoCasoResultado`;
   - **minimização**: o painel compartilhável (§13.10) não deve expor aluno identificável;
   - a **auto-matrícula** (§13.3) altera vínculo acadêmico — precisa ser explícita e auditada.
   O repositório tem skills de LGPD (`lgpd-legal-basis`, `lgpd-data-mapping`) que podem gerar
   esses artefatos quando chegarmos nesse ponto.

---

## 14. Inventário da implementação (25/07/2026)

### Backend (`p360-hackaton-backend`)

| Área | Arquivos |
|---|---|
| Blocos | `src/aulas/bloco-tipos.ts`, `blocos.service.ts`, `dto/bloco.dto.ts`, `templates.controller.ts` |
| Enquete | `src/enquete/enquete-ia.service.ts`, `poll360.service.ts`, `enquete.service.ts`, `enquete.controller.ts` |
| Sessão | `src/sessao/sessao.service.ts`, `sessao.gateway.ts`, `sessao.controller.ts` |
| Caso (v2) | `src/caso/curso-wrapper.service.ts`, `caso-coleta.service.ts`, `caso-diagnostico.service.ts`, `caso.service.ts`, `caso.controller.ts` |
| Infra | `src/legacy-db/legacy-db-write.service.ts`, `src/auth/legacy-token.decorator.ts` |

Modelos Prisma novos: `AulaBloco`, `SessaoAula`, `SessaoParticipante`, `CursoWrapper`,
`LegacyWriteLog`, `CasoAcessoNonce`.

Dependências adicionadas: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`.

Env novas: `MONOLITH_BACKEND_URL`, `POLL360_API_URL`, `POLL360_PUBLIC_URL`,
`AVP_EMPRESAS_URL`, `LEGACY_PGUSER_WRITE`, `LEGACY_PGPASSWORD_WRITE`.

### Frontend (`p360-hackaton`)

| Área | Arquivos |
|---|---|
| Builder | `store/aulaStore.ts` (blocos), `tabs/MateriaisTab.tsx`, `blocoMeta.ts` |
| Cockpit | `AulaCockpitPage.tsx`, `SessaoPanel.tsx`, `EnqueteBloco.tsx`, `CasoBloco.tsx` |
| Sala do aluno | `components/pages/sala/SalaAlunoPage.tsx` |
| Dados | `services/blocos.ts`, `enquete.ts`, `sessao.ts`, `caso.ts` + hooks correspondentes |
| Realtime | `hooks/useSessaoLive.ts` (socket.io-client) |

Rotas novas: `/aulas/:aulaId` (cockpit), `/sala/:codigo` (aluno).

### Decisões de implementação que valem registro

- **Métrica mock removida da criação da aula.** `AulaMetrica` agora só existe com dados reais
  (vem da coleta do caso, §13.6). Aula sem execução mostra "sem dados" em vez de número
  inventado.
- **Liberar/encerrar um bloco `caso` é uma ação só**: abre/fecha `turmacurso.status` no legado,
  marca a atividade corrente da sessão e (no encerrar) dispara coleta + diagnóstico.
- **O bloco `caso` herda `casoLegacyId` da aula** — só a turma precisa ser escolhida.
- **QR Code não implementado**: sem lib de QR no projeto; a sala mostra PIN + link, e a tela de
  apresentação do poll360 já projeta o QR.
- **Entrada na sala é `@Public()` com resolução opcional do token**: a enquete admite anônimo,
  mas se vier `X-Access-Token` capturamos a identidade (o caso depende dela).

### Pendências conhecidas

1. **Teste ponta a ponta** com Claude, poll360 e avp reais (o avp-backend estava fora).
2. Verificar ACL/privilégios da credencial de escrita no `avp` em ambiente real.
3. Validar a paridade da agregação (§13.6) contra o `relatoriodeatividades` do legado.
4. Identidade do aluno na enquete (§11.4) — depende de afordância no poll360.
5. Blocos `slides` e `reforco`; clonar sessão; painel compartilhável; modo assíncrono.

---

## 15. Modo apresentação e condução (27/07/2026)

### 15.1 Divisão cockpit ↔ apresentar

O cockpit passou a ser **só preparação**; quem conduz é a tela de apresentação. A liberação
manual de bloco saiu do cockpit: avançar a etapa em `/apresentar` já libera para a turma. Motivo
prático — durante a aula o professor está no projetor, e ter dois lugares que liberam a mesma
coisa rendia cliques e estados divergentes.

Consequência secundária boa: como o aluno passa a entrar sempre pela sala, a limitação de reload
do hand-off do caso (§13.5) fica muito menos alcançável.

Duas janelas, sincronizadas por `BroadcastChannel` (mesma origem, sem rede):
- **controle** (`/aulas/:id/apresentar`) — notebook do professor, fonte da verdade;
- **projeção** (`/aulas/:id/projetar`) — projetor, pede o estado ao montar.

É essa separação que permite **ver os dados antes de decidir projetá-los** (`projetarDados`).

`sessionStorage` é **por aba**: a janela de projeção nasce sem token e levava 401 em tudo. O
token vai na URL do `window.open`, e o boot persiste e limpa a barra de endereço.

Na projeção, caso clínico e enquete mostram **QR Code + URL grandes**, os dois apontando para a
sala. Quem está em notebook/tablet não escaneia — digita; por isso a URL é o elemento principal,
sem o `https://`, e o código/PIN vem depois.

### 15.2 Enquete multi-questão — o modelo real do poll360

No poll360 **uma sessão vale uma questão**: `sessions/start` recebe um `pollId` só, e
`poll:start` sobe justamente o poll daquela sessão (`start-poll.usecase.ts` lê
`session.pollId`). **Não existe** evento de "próxima questão".

O que destrava a navegação é o `StartPoll360PollSessionUseCase`: ao abrir sessão para outro
`pollId` ele reaproveita o `accessPin` da sessão anterior
(`accessPin = currentSession?.accessPin ?? generateAccessPin()`). Então avançar de questão é
abrir uma sessão nova — e **a turma não reentra**: mesmo PIN, mesmo QR.

Fluxo implementado, tudo pela tela de apresentação:
1. chegar na etapa → publica o pacote (se preciso) e abre a questão 0;
2. reconhecido como `speaker` (o gateway devolve `role` em **minúsculas**) → `poll:start` sozinho;
3. "Próxima questão" → `poll:end` (com resultado) → `sessions/start` no `pollId` seguinte → `poll:start`;
4. fim da etapa → `poll:end-session`.

`iniciar` aceita `indice` e grava `questaoAtual`/`totalQuestoes` no `output` do bloco — é isso
que a UI usa para o "questão 2 / 5" e para desabilitar o avanço na última.

### 15.3 Pós-aula: resumo com página própria

O resumo tinha "disponibilizar para a turma" mas nenhum consumidor — só o PDF do professor.
Agora existe `GET /api/resumos/:blocoId` (gate: publicação; autenticado, como o simulado) e a
página `/resumo/:blocoId`, espelhando o simulado. O cockpit mostra o link para compartilhar.
