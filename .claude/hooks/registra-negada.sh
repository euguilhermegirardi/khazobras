#!/bin/bash
# PermissionDenied — anota cada permissão negada na execução noturna em .claude/ciclos/negadas.jsonl.
# O maestro leva isso para "Sinais para o harness" no relatório da manhã (o que liberar ou ensinar).
[ "${KHAZ_NOITE:-0}" = "1" ] || exit 0
dir="${CLAUDE_PROJECT_DIR:-.}/.claude/ciclos"
mkdir -p "$dir"
{ printf '{"quando":"%s","evento":' "$(date '+%Y-%m-%dT%H:%M:%S')"; cat; printf '}\n'; } >> "$dir/negadas.jsonl"
exit 0
