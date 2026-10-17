#!/bin/bash
# PreToolUse (Bash) — guarda da execução noturna. Só age com KHAZ_NOITE=1 (definido por scripts/noite.sh);
# em sessões normais não interfere. Bloqueia (exit 2) o que o agente nunca faz sozinho à noite.
# Push e PR são feitos pelo próprio scripts/noite.sh depois que o agente termina, não pelo agente.
[ "${KHAZ_NOITE:-0}" = "1" ] || exit 0

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
[ -n "$cmd" ] || exit 0

bloquear() {
  echo "Bloqueado na execução noturna: $1. Não tente contornar; registre no relatório da manhã se precisar disso." >&2
  exit 2
}

# Normaliza espaços para pegar variações simples (git  push, git -C . push...)
norm=$(printf '%s' "$cmd" | tr -s '[:space:]' ' ')

echo "$norm" | grep -Eq '(^|[;&|( ])git( -[cC] [^ ]+)* push( |$)'      && bloquear "git push (o script faz o push no fim)"
echo "$norm" | grep -Eq '(^|[;&|( ])gh +(pr +(merge|close|create)|repo|release|api)' && bloquear "gh (o script abre o PR no fim)"
echo "$norm" | grep -Eq -- '--no-verify|SKIP_PLAN_CHECK'                && bloquear "pular hook (--no-verify / SKIP_PLAN_CHECK)"
echo "$norm" | grep -Eq -- 'git( -[cC] [^ ]+)* reset +--hard'           && bloquear "git reset --hard"
echo "$norm" | grep -Eq -- 'git( -[cC] [^ ]+)* (clean +-[a-z]*f|branch +-D)' && bloquear "apagar trabalho (git clean -f / branch -D)"
echo "$norm" | grep -Eq -- '(^|[;&|( ])(sudo|rm +-[a-zA-Z]*r[a-zA-Z]*f? +(/|~|\$HOME|\.\.))' && bloquear "comando destrutivo fora do projeto"
echo "$norm" | grep -Eq -- 'appsettings\.Development\.json|(^|/)\.env( |$)' && bloquear "arquivo de segredo"

# Commit direto na main: nunca
if echo "$norm" | grep -Eq '(^|[;&|( ])git( -[cC] [^ ]+)* (commit|merge|rebase|cherry-pick)( |$)'; then
  branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null)
  [ "$branch" = "main" ] && bloquear "commit/merge na main (trabalhe na feat/<tela>)"
fi

exit 0
