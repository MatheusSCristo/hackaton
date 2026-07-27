#!/usr/bin/env bash
# Encerra o backend e o frontend subidos por ./start.sh. O Postgres (Docker)
# fica de pé de propósito — é infraestrutura persistente, não precisa subir
# de novo a cada `start.sh`. Pare com `docker compose -f
# p360-hackaton-backend/compose.yml down` se quiser derrubar também.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.hackaton-pids"

if [ ! -f "$PID_FILE" ]; then
  echo "[stop.sh] Nenhum .hackaton-pids encontrado — nada pra parar (rodou ./start.sh antes?)."
  exit 0
fi

while read -r pid; do
  [ -z "$pid" ] && continue
  if kill -0 "$pid" 2>/dev/null; then
    # `-$pid` mata o GRUPO inteiro (o start.sh sobe com `setsid`, então o PID
    # do processo líder também é o PGID) — não só o processo do npm, que não
    # repassa sinal de forma confiável pros filhos/netos (nest --watch, vite).
    kill -TERM -- "-$pid" 2>/dev/null && echo "[stop.sh] Encerrado grupo $pid"
  fi
done <"$PID_FILE"

rm -f "$PID_FILE"

# Rede de segurança: garante que as portas ficam livres mesmo se o kill de
# grupo não tiver pegado tudo.
fuser -k 8000/tcp 2>/dev/null || true
if [ -f "$ROOT_DIR/p360-hackaton/.env" ]; then
  PORT="$(grep -E '^VITE_PORT=' "$ROOT_DIR/p360-hackaton/.env" | cut -d= -f2 | tr -d '[:space:]')"
  fuser -k "${PORT:-9000}/tcp" 2>/dev/null || true
fi

echo "[stop.sh] Backend e frontend parados. Postgres continua rodando (docker compose -f p360-hackaton-backend/compose.yml down para derrubar)."
