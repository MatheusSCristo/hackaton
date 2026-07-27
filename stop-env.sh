#!/usr/bin/env bash
# Encerra tudo que ./run-env.sh subiu: os projetos legados + este projeto
# (via ./stop.sh). Postgres/Redis do sistema ficam de pé de propósito —
# são infraestrutura compartilhada, não algo que este script gerencia.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.run-env-pids"

log() { echo "[stop-env.sh] $1"; }

# Este projeto (backend + frontend).
"$ROOT_DIR/stop.sh"

# Projetos legados subidos pelo run-env.sh.
if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      # `-$pid` mata o GRUPO inteiro (run-env.sh sobe com `setsid`, então o
      # PID do processo líder também é o PGID) — cobre nvm/npm/node/webpack
      # em cadeia, não só o processo mais externo.
      kill -TERM -- "-$pid" 2>/dev/null && log "Encerrado grupo $pid"
    fi
  done <"$PID_FILE"
  rm -f "$PID_FILE"
else
  log "Nenhum .run-env-pids encontrado — nada de projeto legado pra parar."
fi

# Garante que as portas ficam livres mesmo se algum processo não repassou o
# sinal para os filhos (comum em cadeias nvm/npm/node).
for porta in 3000 3200 4000 9500 8081; do
  fuser -k "$porta/tcp" 2>/dev/null || true
done

log "Ambiente legado parado. Postgres/Redis do sistema continuam rodando (são serviços do SO, não deste projeto)."
