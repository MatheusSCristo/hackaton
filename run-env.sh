#!/usr/bin/env bash
# Sobe o ambiente completo: este projeto (via ./start.sh) MAIS os projetos
# legados dos quais ele depende (auth, acervo/matrícula, enquete ao vivo).
#
# Todo mundo sobe como processo Node comum, sem Docker e sem watch/nodemon
# nos projetos legados (só rodam pra servir de dependência, não pra
# desenvolver neles) — é o jeito mais leve de RAM/CPU pra isso.
#
# Idempotente: se uma porta já está ocupada, pula aquele serviço em vez de
# tentar subir de novo (evita processo duplicado e erro de porta em uso).
set -uo pipefail

# ============================ CONFIGURÁVEL =============================
# Pasta onde ficam os projetos legados (avp-backend, avp-empresas,
# p360-auth-front, p360-monolith-backend, p360-survey-frontend). Mude aqui
# ou rode: WORKSPACE_DIR=/outro/caminho ./run-env.sh
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME/workspace}"
# =========================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$ROOT_DIR/.run-env-pids"
mkdir -p "$LOG_DIR"
# Não trunca: rodar de novo com serviços já no ar (pulados abaixo) não pode
# apagar o PID de quem já está rodando de uma execução anterior.
touch "$PID_FILE"

log() { echo "[run-env.sh] $1"; }

# TCP puro (não HTTP): funciona pra qualquer serviço, mesmo os que não
# respondem 200 na raiz.
porta_aberta() {
  local host="$1" porta="$2"
  (exec 3<>"/dev/tcp/$host/$porta") 2>/dev/null
  local ok=$?
  exec 3<&- 2>/dev/null; exec 3>&- 2>/dev/null
  return $ok
}

esperar_porta() {
  local host="$1" porta="$2" nome="$3"
  for _ in $(seq 1 60); do
    porta_aberta "$host" "$porta" && { log "$nome respondendo em $host:$porta"; return 0; }
    sleep 1
  done
  log "AVISO: $nome não respondeu em $host:$porta após 60s — veja logs/$nome.log"
  return 1
}

# Roda um comando em background numa pasta, pulando se a porta já estiver
# ocupada (outro run-env.sh já rodando, ou serviço subido manualmente).
subir_em_background() {
  local nome="$1" dir="$2" host="$3" porta="$4"; shift 4
  if [ ! -d "$dir" ]; then
    log "AVISO: pasta de $nome não encontrada em '$dir' — pulando (confira WORKSPACE_DIR)."
    return
  fi
  if porta_aberta "$host" "$porta"; then
    log "$nome já está rodando em $host:$porta — pulando."
    return
  fi
  log "Subindo $nome ($host:$porta)…"
  # `setsid` isola num grupo de processo novo — `npm run dev/start` some vezes
  # sobe um supervisor (nest --watch, vite) que gera o servidor real como
  # processo-neto; sem isso, matar só o PID do npm deixa esse supervisor
  # órfão rodando pra sempre (RAM/CPU vazando a cada restart).
  # `&` FORA dos parênteses (backgrounda o subshell inteiro como 1 job só) +
  # `exec` dentro — `$!` fica inequívoco e nada fica esperando o subshell.
  ( cd "$dir" && exec setsid nohup "$@" >>"$LOG_DIR/$nome.log" 2>&1 ) &
  echo $! >>"$PID_FILE"
  esperar_porta "$host" "$porta" "$nome"
}

# ---------------------------------------------------------- este projeto
log "=== Este projeto (p360-hackaton-backend + p360-hackaton) ==="
"$ROOT_DIR/start.sh"

# ---------------------------------------------------------- avp-backend
# API legada (login, matrícula, acervo). Exige Node 10-12
# (`"engines": ">=10.0.0 <13.0.0"` no package.json) — no Node 20 do sistema
# o driver do Postgres trava em timeout de 5s em toda query (bug real,
# confirmado: com Node 10 a mesma rota responde em ~0.2s). Por isso passa
# pelo nvm, igual ao avp-empresas. `npm start` (sem nodemon) por ser só
# dependência, não o que você está desenvolvendo.
log "=== avp-backend ==="
if [ ! -d "$WORKSPACE_DIR/avp-backend" ]; then
  log "AVISO: pasta de avp-backend não encontrada em '$WORKSPACE_DIR/avp-backend' — pulando."
elif porta_aberta "localhost" "3000"; then
  log "avp-backend já está rodando em localhost:3000 — pulando."
else
  log "Subindo avp-backend (localhost:3000, Node 10 via nvm)…"
  ( cd "$WORKSPACE_DIR/avp-backend" && \
    exec setsid nohup bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 10 >/dev/null && API_PORT=3000 NODE_ENV=local npm start' \
      >>"$LOG_DIR/avp-backend.log" 2>&1 ) &
  echo $! >>"$PID_FILE"
  esperar_porta "localhost" "3000" "avp-backend"
fi

# ---------------------------------------------------- p360-monolith-backend
# Módulo de enquete ao vivo (poll360). `npm start` roda o Nest sem --watch
# (mais leve que start:dev). Precisa de Postgres (localhost:5432,
# 'p360-access-management') e Redis (localhost:6379) já de pé no sistema.
log "=== p360-monolith-backend ==="
subir_em_background "p360-monolith-backend" "$WORKSPACE_DIR/p360-monolith-backend" "localhost" "3200" \
  npm start

# ---------------------------------------------------------- p360-auth-front
# Login (quando o aluno abre um caso/simulado por link avulso). Repare que o
# host é auth.paciente360.local (fixo no vite.config.ts, não localhost) — já
# precisa estar mapeado em /etc/hosts pra 127.0.0.1. Sem isso o serviço até
# sobe, mas "esperar_porta" nunca vai resolver o host — o aviso de timeout
# sozinho não deixa isso óbvio, por isso o aviso explícito abaixo.
if ! grep -qE '(^|[[:space:]])auth\.paciente360\.local([[:space:]]|$)' /etc/hosts 2>/dev/null; then
  log "AVISO: 'auth.paciente360.local' não está em /etc/hosts — p360-auth-front vai parecer travado sem isso."
  log "       Rode: echo '127.0.0.1 auth.paciente360.local' | sudo tee -a /etc/hosts"
fi
log "=== p360-auth-front ==="
subir_em_background "p360-auth-front" "$WORKSPACE_DIR/p360-auth-front" "auth.paciente360.local" "4000" \
  npm run dev

# ------------------------------------------------------- p360-survey-frontend
# Frontend do poll360 (onde o aluno vota na enquete ao vivo).
log "=== p360-survey-frontend ==="
subir_em_background "p360-survey-frontend" "$WORKSPACE_DIR/p360-survey-frontend" "localhost" "9500" \
  npm run dev

# ---------------------------------------------------------- avp-empresas
# Host legado (onde o hackaton é embarcado via iframe). É uma app
# AngularJS/gulp antiga — só roda em Node 10 (nvm), por isso o comando
# precisa carregar o nvm e trocar de versão antes do `npm run dev`.
log "=== avp-empresas ==="
if [ ! -d "$WORKSPACE_DIR/avp-empresas" ]; then
  log "AVISO: pasta de avp-empresas não encontrada em '$WORKSPACE_DIR/avp-empresas' — pulando."
elif porta_aberta "localhost" "8081"; then
  log "avp-empresas já está rodando em localhost:8081 — pulando."
else
  log "Subindo avp-empresas (localhost:8081)…"
  ( cd "$WORKSPACE_DIR/avp-empresas" && \
    exec setsid nohup bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 10 >/dev/null && npm run dev' \
      >>"$LOG_DIR/avp-empresas.log" 2>&1 ) &
  echo $! >>"$PID_FILE"
  esperar_porta "localhost" "8081" "avp-empresas"
fi

echo
log "Resumo:"
log "  Backend (este projeto):   http://localhost:8000/api/health"
log "  Frontend (este projeto):  http://localhost:$(grep -E '^VITE_PORT=' "$ROOT_DIR/p360-hackaton/.env" | cut -d= -f2 | tr -d '[:space:]')/"
log "  avp-backend (legado):     http://localhost:3000"
log "  p360-monolith-backend:    http://localhost:3200"
log "  p360-auth-front:          http://auth.paciente360.local:4000"
log "  p360-survey-frontend:     http://localhost:9500"
log "  avp-empresas (host):      http://localhost:8081"
log "Logs em: $LOG_DIR/*.log"
log "Pra parar tudo (inclusive os projetos legados): ./stop-env.sh"
