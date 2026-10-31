#!/bin/bash
# Hook SessionStart: deja Rea + Ghidra listos en cada sesión cloud.
# stdout de este hook se añade al contexto de Claude; los registros van a stderr.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}"
# shellcheck source=../rea/versiones.env
source .claude/rea/versiones.env

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export PATH=\"$REA_PREFIX/bin:\$PATH\""
    echo "export GHIDRA_INSTALL_DIR=\"$GHIDRA_INSTALL_DIR\""
  } >> "$CLAUDE_ENV_FILE"
fi

mkdir -p ingenieria-inversa/objetivos ingenieria-inversa/trabajo ingenieria-inversa/informes

if bash .claude/rea/instalar-rea.sh >&2; then
  echo "Entorno de ingeniería inversa listo: Rea $REA_VERSION (MCP 'rea') y Ghidra $GHIDRA_VERSION en $GHIDRA_INSTALL_DIR."
  echo "Sigue las instrucciones de inicio de CLAUDE.md: pregunta a Guille por el objetivo de ingeniería inversa."
else
  echo "AVISO: la instalación automática de Rea/Ghidra ha fallado en este arranque."
  echo "Díselo a Guille al principio de tu respuesta y ejecuta 'bash .claude/rea/instalar-rea.sh' para ver el error."
fi
