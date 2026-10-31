#!/bin/bash
# Instala Rea (rea-agents) y Ghidra en ~/.local de forma idempotente.
# Uso: instalar-rea.sh [--solo-rea]
# Todo el registro va a stderr: el wrapper MCP necesita stdout limpio.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versiones.env
source "$DIR/versiones.env"

log() { printf '[rea-instalar] %s\n' "$*" >&2; }
mkdir -p "$REA_PREFIX/bin" "$REA_PREFIX/opt"

# --- Rea (npm) ---------------------------------------------------------------
(
  flock 8
  actual="$("$REA_PREFIX/bin/rea" --version 2>/dev/null | tr -d '[:space:]' || true)"
  if [ "$actual" != "$REA_VERSION" ]; then
    log "Instalando rea-agents@$REA_VERSION (actual: ${actual:-ninguna})"
    npm install --global --prefix "$REA_PREFIX" --no-fund --no-audit "rea-agents@$REA_VERSION" >&2
    instalada="$("$REA_PREFIX/bin/rea" --version 2>/dev/null | tr -d '[:space:]')"
    [ "$instalada" = "$REA_VERSION" ] || { log "ERROR: versión instalada '$instalada' != $REA_VERSION"; exit 1; }
  fi
) 8>"$REA_PREFIX/.rea-npm.lock"

[ "${1:-}" = "--solo-rea" ] && exit 0

# --- Ghidra (release oficial, verificada por SHA-256) ------------------------
(
  flock 9
  if [ ! -f "$GHIDRA_INSTALL_DIR/.rea-verificado" ]; then
    command -v java >/dev/null || { log "ERROR: Ghidra $GHIDRA_VERSION necesita JDK 21+ y no hay java"; exit 1; }
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    log "Descargando Ghidra $GHIDRA_VERSION (~570 MB)"
    curl -fsSL --retry 3 -o "$tmp/ghidra.zip" "$GHIDRA_URL"
    echo "$GHIDRA_SHA256  $tmp/ghidra.zip" | sha256sum -c --status - \
      || { log "ERROR: el SHA-256 de Ghidra no coincide; descarga descartada"; exit 1; }
    rm -rf "$GHIDRA_INSTALL_DIR"
    unzip -q "$tmp/ghidra.zip" -d "$REA_PREFIX/opt"
    touch "$GHIDRA_INSTALL_DIR/.rea-verificado"
    log "Ghidra $GHIDRA_VERSION instalado en $GHIDRA_INSTALL_DIR"
  fi
) 9>"$REA_PREFIX/.rea-ghidra.lock"
