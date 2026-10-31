#!/bin/bash
# Arranca el servidor MCP de Rea. stdout queda reservado al protocolo MCP.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versiones.env
source "$DIR/versiones.env"
export PATH="$REA_PREFIX/bin:$PATH"
export GHIDRA_INSTALL_DIR

actual="$("$REA_PREFIX/bin/rea" --version 2>/dev/null | tr -d '[:space:]' || true)"
if [ "$actual" != "$REA_VERSION" ]; then
  if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
    # Si el hook de inicio aún no terminó, esto espera su bloqueo o instala.
    bash "$DIR/instalar-rea.sh" --solo-rea >&2
  else
    exec npx -y "rea-agents@$REA_VERSION" mcp
  fi
fi

exec "$REA_PREFIX/bin/rea" mcp
