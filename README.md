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

## Como rodar (passo a passo, do zero)

Isto aqui é escrito pra não deixar dúvida nenhuma. Siga na ordem.

### Passo 0 — o que precisa estar instalado

- **Node.js 20+** (`node -v` pra conferir)
- **Docker** + **Docker Compose** (`docker -v` pra conferir) — é onde o
  Postgres deste projeto roda
- Só se for usar `run-env.sh` (ambiente completo, com os legados): **nvm**
  (`nvm -v`) — alguns projetos legados só rodam em Node antigo

Se algum desses comandos der "command not found", instale antes de
continuar. Sem Docker rodando, o Postgres não sobe e nada mais funciona.

### Passo 1 — criar os arquivos `.env`

Cada projeto tem seu próprio arquivo de configuração. Rode exatamente isto,
a partir da raiz do repositório:

```bash
cp p360-hackaton-backend/.env.example p360-hackaton-backend/.env
cp p360-hackaton/.env.example p360-hackaton/.env
```

(Se você rodar `./start.sh` sem fazer isso, ele copia sozinho e avisa — mas
prefira fazer manual pra já abrir o arquivo e conferir as chaves abaixo.)

### Passo 2 — preencher as chaves que importam

Abra `p360-hackaton-backend/.env` num editor e preencha:

| Variável | Pra que serve | Onde conseguir | Obrigatória? |
|---|---|---|---|
| `GEMINI_API_KEY` | Gera slides/simulado/resumo/enquete (provider principal, mais barato) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **Sim** — sem nenhuma das duas (Gemini/Anthropic), a geração de conteúdo responde erro 503 |
| `ANTHROPIC_API_KEY` | Fallback do Gemini + único que faz busca web de verdade (material complementar) | [console.anthropic.com](https://console.anthropic.com) | Recomendada, não obrigatória |
| `UNSPLASH_ACCESS_KEY` | Fotos reais nos slides | [unsplash.com/developers](https://unsplash.com/developers) | Não — sem ela cai pra Wikimedia/Picsum, só menos bonito |
| `LEGACY_*`, `AVP_EMPRESAS_URL` | Integração com o P360 legado (login, acervo de casos, matrícula) | Só existe se você tiver acesso ao ecossistema legado | Não — sem isso o app roda, mas rotas que exigem login real falham (não afeta geração de conteúdo) |

**Todo o resto do `.env` do backend pode ficar exatamente como veio no
`.env.example`** — já está ajustado pra combinar com o `compose.yml` deste
projeto (porta do Postgres, nomes de banco etc).

O `p360-hackaton/.env` (frontend) **não precisa de nenhum ajuste** pra rodar
localmente — os valores do `.env.example` já funcionam.

### Passo 3 — subir só este produto

```bash
./start.sh
```

Isso sobe, nessa ordem, e espera cada um responder antes de ir pro próximo
(não é um "sleep" cego, é uma checagem de verdade): Postgres (Docker) →
migrations do banco → backend (`http://localhost:8000`) → frontend
(`http://localhost:9000`, ou a porta que estiver em `VITE_PORT`).

No final ele imprime as duas URLs. Abra a do frontend no navegador.

```bash
./stop.sh
```

Derruba backend e frontend. O Postgres fica de pé de propósito (é só
infraestrutura, não precisa religar toda hora) — se quiser derrubar ele
também: `docker compose -f p360-hackaton-backend/compose.yml down`.

**Deu erro?** Veja `logs/backend.log` e `logs/frontend.log` — o erro
específico está sempre lá. Os motivos mais comuns:
- Porta 8000 ou a `VITE_PORT` já ocupada por outra coisa → feche o que
  estiver usando essa porta, ou mude a porta no `.env`.
- Docker não está rodando → abra o Docker Desktop (ou `sudo systemctl start
  docker` no Linux) e rode `./start.sh` de novo.
- `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` vazias → o app sobe normalmente, só a
  geração de conteúdo (slides/simulado/resumo/enquete) que vai falhar com
  503. Preencha uma das duas no `.env` do backend e rode `./stop.sh &&
  ./start.sh`.

### Passo 4 (opcional) — ambiente completo, com os projetos legados

Só precisa disso se for testar login real, acervo de casos do legado, ou a
enquete ao vivo (poll360) de ponta a ponta. Pra só criar aulas e gerar
material com IA, o Passo 3 já basta.

O hackaton depende de 5 projetos legados do ecossistema Paciente 360:
`avp-backend` (API legada — login, matrícula, acervo), `avp-empresas` (host
onde o hackaton é embarcado via iframe), `p360-auth-front` (login do
aluno), `p360-monolith-backend` e `p360-survey-frontend` (módulo de
enquete ao vivo, poll360).

**Antes de rodar**, mapeie o host de login no `/etc/hosts` (uma vez só, pra
sempre — o `p360-auth-front` só funciona nesse endereço):

```bash
echo '127.0.0.1 auth.paciente360.local' | sudo tee -a /etc/hosts
```

Depois:

```bash
./run-env.sh
```

Isso roda `./start.sh` **e** sobe os 5 projetos legados, cada um como
processo comum (sem Docker). É idempotente: se uma porta já estiver
ocupada, ele pula em vez de duplicar o processo — então pode rodar de novo
sem medo se algo já estiver no ar.

Por padrão ele procura os 5 projetos legados em `~/workspace`. Se estiverem
em outro lugar:

```bash
WORKSPACE_DIR=/caminho/onde/estao/os/projetos ./run-env.sh
```

Se uma pasta não existir em `WORKSPACE_DIR`, o script só avisa e pula
aquele projeto — não trava o resto.

```bash
./stop-env.sh
```

Derruba tudo (este projeto + os 5 legados). Postgres/Redis do **sistema**
(fora do Docker deste projeto) continuam de pé — são serviços do SO, esse
script não mexe neles.

⚠️ **`avp-backend` e `avp-empresas` só rodam em Node 10-12** — em Node 20 o
driver antigo do Postgres trava (bug real do driver, não é rede/DB). O
`run-env.sh` já troca de versão sozinho via `nvm use 10` antes de subir
esses dois; só funciona se `nvm` estiver instalado.

### Perguntas rápidas (resolve sem precisar entender o projeto)

- **"Rodei `./start.sh` e nada abriu no navegador"** → o script imprime a
  URL no final do log; se não chegou lá, o erro está em `logs/backend.log`
  ou `logs/frontend.log`.
- **"Erro 503 ao criar material"** → falta `GEMINI_API_KEY` ou
  `ANTHROPIC_API_KEY` no `.env` do backend.
- **"p360-auth-front não sobe/trava no `run-env.sh`"** → falta o
  `/etc/hosts` do Passo 4.
- **"Preciso rodar num computador novo do zero"** → Passo 0 → Passo 1 →
  Passo 2 → Passo 3 (ou Passo 4 se precisar dos legados). Nessa ordem, sem
  pular nenhum.

⚠️ **Nota sobre a chave Anthropic**: se ela estiver sem crédito, o material
complementar ainda é gerado, mas cai para o Gemini (sem pesquisa web real) —
confira o saldo em [console.anthropic.com](https://console.anthropic.com) se
quiser garantir busca web de verdade.

## Estrutura por pasta

Ver o `README.md` de cada projeto (`p360-hackaton-backend/README.md`,
`p360-hackaton/README.md`) para detalhes de stack, rotas e variáveis
específicas.
