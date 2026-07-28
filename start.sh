#!/usr/bin/env bash
# Sobe o produto inteiro: Postgres do backend (Docker), backend NestJS e
# frontend React. Veja README.md para o que cada parte faz e para as
# variáveis de ambiente necessárias (GEMINI_API_KEY/ANTHROPIC_API_KEY/
# UNSPLASH_ACCESS_KEY etc — já vêm preenchidas nos .env versionados deste
# ambiente de desenvolvimento).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/p360-hackaton-backend"
FRONTEND_DIR="$ROOT_DIR/p360-hackaton"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$ROOT_DIR/.hackaton-pids"

mkdir -p "$LOG_DIR"
# Não trunca se já existir: rodar start.sh de novo com backend/frontend já
# no ar (pulados abaixo) não pode apagar o PID de quem já está rodando.
touch "$PID_FILE"

log() { echo "[start.sh] $1"; }

# Sem isso, um `.env` ausente faz o script inteiro morrer num `grep`/comando
# que lê o arquivo (erro de bash confuso, tipo "No such file or directory",
# sem explicar o que fazer). Copia do `.env.example` automaticamente na
# primeira vez — o app já roda em modo degradado sem as chaves de LLM
# preenchidas (ver README), então isso nunca deveria travar o start.
garantir_env() {
  local dir="$1" nome="$2"
  if [ -f "$dir/.env" ]; then return; fi
  if [ -f "$dir/.env.example" ]; then
    cp "$dir/.env.example" "$dir/.env"
    log "AVISO: '$dir/.env' não existia — copiado de .env.example."
    log "       Preencha as chaves (GEMINI_API_KEY etc — ver README.md) em '$dir/.env' e rode de novo se quiser tudo funcionando."
  else
    log "ERRO: nem '$dir/.env' nem '$dir/.env.example' existem — não dá pra continuar sem isso."
    log "      Confira se a pasta '$nome' ($dir) está certa."
    exit 1
  fi
}

garantir_env "$BACKEND_DIR" "backend"
garantir_env "$FRONTEND_DIR" "frontend"

porta_aberta() {
  local porta="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/$porta") 2>/dev/null
  local ok=$?
  exec 3<&- 2>/dev/null; exec 3>&- 2>/dev/null
  return $ok
}

wait_for_http() {
  local url="$1" nome="$2" tentativas="${3:-60}"
  for _ in $(seq 1 "$tentativas"); do
    if curl -sf -o /dev/null "$url"; then
      log "$nome respondendo em $url"
      return 0
    fi
    sleep 1
  done
  log "ERRO: $nome não respondeu em $url após ${tentativas}s — veja os logs em $LOG_DIR"
  return 1
}

# ---------------------------------------------------------------- Postgres
log "Subindo Postgres do backend (docker compose)…"
(cd "$BACKEND_DIR" && docker compose -f compose.yml up -d db)

log "Aguardando Postgres ficar healthy…"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' p360-hackaton-backend-db-1 2>/dev/null || echo "starting")"
  [ "$status" = "healthy" ] && break
  sleep 1
done

# ---------------------------------------------------------------- backend
log "Aplicando migrations do Prisma (não-interativo)…"
(cd "$BACKEND_DIR" && npx prisma migrate deploy && npx prisma generate) >>"$LOG_DIR/backend.log" 2>&1

if porta_aberta 8000; then
  log "Backend já está rodando em :8000 — pulando (evita processo duplicado)."
else
  log "Subindo backend (NestJS)…"
  # `setsid` isola num grupo de processo novo: `nest start --watch` sobe um
  # supervisor de compilação (webpack) que gera o servidor real como
  # processo-neto — sem isso, matar só o PID do npm ou só a porta deixa esse
  # supervisor órfão rodando pra sempre (RAM/CPU vazando a cada restart).
  # `&` FORA dos parênteses (backgrounda o subshell inteiro como 1 job só) +
  # `exec` dentro (o subshell vira o próprio setsid, sem processo a mais) —
  # assim `$!` é inequívoco e o script não fica esperando nada.
  ( cd "$BACKEND_DIR" && exec setsid nohup npm run start:dev >>"$LOG_DIR/backend.log" 2>&1 ) &
  echo $! >>"$PID_FILE"
fi

wait_for_http "http://localhost:8000/api/health" "Backend"

# --------------------------------------------------------------- frontend
FRONTEND_PORT="$(grep -E '^VITE_PORT=' "$FRONTEND_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')"
FRONTEND_PORT="${FRONTEND_PORT:-9000}"

if porta_aberta "$FRONTEND_PORT"; then
  log "Frontend já está rodando em :$FRONTEND_PORT — pulando (evita processo duplicado)."
else
  log "Subindo frontend (Vite)…"
  # Vite não injeta o .env em process.env (só em import.meta.env do client) —
  # exportamos as variáveis do shell antes de rodar, senão VITE_PORT do
  # vite.config.ts cai no default (9000) em vez do que está no .env.
  ( cd "$FRONTEND_DIR" && set -a && source .env && set +a && \
    exec setsid nohup npm run dev >>"$LOG_DIR/frontend.log" 2>&1 ) &
  echo $! >>"$PID_FILE"
fi

wait_for_http "http://localhost:$FRONTEND_PORT/" "Frontend"

echo
log "Tudo no ar:"
log "  Backend:  http://localhost:8000/api/health"
log "  Frontend: http://localhost:$FRONTEND_PORT/"
log "Logs em: $LOG_DIR/backend.log e $LOG_DIR/frontend.log"
log "Para parar tudo: ./stop.sh"
