#!/bin/bash
# Execução noturna do ciclo-tela no Mac (sem o usuário). Uso:
#   ./scripts/noite.sh "Relatório mensal"     # tela explícita
#   ./scripts/noite.sh                        # primeira linha de ./noite.fila
# Agendado pelo launchd (scripts/launchd/com.khazobras.noite.plist). Guia: docs/NOITE.md
#
# Divisão de responsabilidades (harness):
#   - o agente (claude -p + skill ciclo-tela) constrói, testa, revisa, commita na feat/<tela> e escreve o relatório;
#   - ESTE script faz o que é arriscado e determinístico: confere o ambiente, limita tempo/custo, retoma se cair,
#     dá push da branch e abre o PR. O agente não tem permissão de push (hook guarda-noite.sh).
# Compatível com o bash 3.2 do macOS.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

TELA="${1:-}"
[ -z "$TELA" ] && [ -f noite.fila ] && TELA="$(grep -v '^[[:space:]]*\(#\|$\)' noite.fila | head -n1)"
if [ -z "$TELA" ]; then echo "Fila vazia (noite.fila). Nada a fazer."; exit 0; fi

DATA="$(date +%F)"
SLUG="$(python3 -c 'import sys,unicodedata,re; t=unicodedata.normalize("NFKD",sys.argv[1]).encode("ascii","ignore").decode().lower(); print(re.sub(r"[^a-z0-9]+","-",t).strip("-"))' "$TELA")"
LOGDIR="$ROOT/logs-noite"; mkdir -p "$LOGDIR" "$ROOT/.claude/ciclos"
LOG="$LOGDIR/$DATA-$SLUG.log"
ESTADO="$ROOT/.claude/ciclos/atual.json"
exec > >(tee -a "$LOG") 2>&1

MODELO="${KHAZ_MODELO:-opus}"                 # maestro; os subagentes têm modelo fixo no próprio arquivo
LIMITE_SEG="${KHAZ_LIMITE_SEG:-18000}"        # 5 h para a noite inteira
MAX_TURNS="${KHAZ_MAX_TURNS:-400}"
MAX_USD="${KHAZ_MAX_USD:-25}"
TENTATIVAS="${KHAZ_TENTATIVAS:-2}"            # 1 execução + 1 retomada se cair no meio
INICIO="$(date +%s)"

avisar() { osascript -e "display notification \"$1\" with title \"KhazObras — noite\"" >/dev/null 2>&1 || true; }
falhar() {
  {
    echo "# Execução noturna NÃO rodou — $DATA ($TELA)"
    echo
    echo "**Motivo:** $1"
    echo
    echo "Log completo: \`logs-noite/$DATA-$SLUG.log\`. Nada foi alterado na main."
  } > "$LOGDIR/$DATA-$SLUG-FALHA.md"
  echo "FALHA: $1"; avisar "Não rodou: $1"; exit 1
}
log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "Início — tela: $TELA (slug $SLUG)"

# ── 1. Credenciais: token de longa duração (claude setup-token), nunca chave de API ─────────────────────
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
TOKEN_FILE="${KHAZ_TOKEN_FILE:-$HOME/.config/khazobras/claude-oauth-token}"
if [ -f "$TOKEN_FILE" ]; then
  CLAUDE_CODE_OAUTH_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"; export CLAUDE_CODE_OAUTH_TOKEN
else
  log "Aviso: $TOKEN_FILE não existe; tentando o login do Claude Code (pode falhar fora de uma sessão aberta)."
fi

# ── 2. Pré-checagem do ambiente (falhou = não roda, e o relatório de falha explica) ────────────────────
for c in claude git node npm dotnet gh python3 perl; do command -v "$c" >/dev/null || falhar "comando '$c' não encontrado no PATH ($PATH)"; done
git fetch -q origin || falhar "git fetch falhou (rede ou credenciais do GitHub)"
[ -z "$(git status --porcelain)" ] || falhar "há mudanças locais não commitadas no repositório; a noite só roda com a árvore limpa"
git checkout -q main && git pull -q --ff-only || falhar "não consegui atualizar a main (checkout/pull)"
gh auth status >/dev/null 2>&1 || falhar "gh não está autenticado (rode: gh auth login)"
pg_isready -q 2>/dev/null || log "Aviso: Postgres não respondeu (só importa se o ciclo precisar do backend real)."
(cd frontend && npm install --no-audit --no-fund --silent) || falhar "npm install falhou no frontend"
(cd frontend && npx --no-install playwright --version >/dev/null 2>&1) || log "Aviso: Playwright indisponível; e2e e captura visual vão sair como 'não rodou'."

PERM_PROMPTS=()
claude --help 2>/dev/null | grep -q -- '--permission-prompts' && PERM_PROMPTS=(--permission-prompts none)

# ── 3. O que o agente pode fazer sozinho (o resto é negado e anotado em .claude/ciclos/negadas.jsonl) ──
ALLOWED=(
  Read Glob Grep Edit Write Agent Skill TaskCreate TaskUpdate TaskList TaskGet
  "Bash(cd *)" "Bash(pwd)" "Bash(ls *)" "Bash(cat *)" "Bash(head *)" "Bash(tail *)" "Bash(wc *)" "Bash(grep *)"
  "Bash(rg *)" "Bash(find *)" "Bash(sed *)" "Bash(awk *)" "Bash(sort *)" "Bash(uniq *)" "Bash(jq *)" "Bash(echo *)"
  "Bash(date *)" "Bash(sleep *)" "Bash(which *)" "Bash(test *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)"
  "Bash(touch *)" "Bash(chmod +x *)" "Bash(python3 *)"
  "Bash(git status *)" "Bash(git diff *)" "Bash(git log *)" "Bash(git show *)" "Bash(git add *)" "Bash(git commit *)"
  "Bash(git checkout *)" "Bash(git switch *)" "Bash(git branch *)" "Bash(git rev-parse *)" "Bash(git fetch *)"
  "Bash(git pull *)" "Bash(git merge *)" "Bash(git stash *)" "Bash(git restore *)" "Bash(git ls-files *)"
  "Bash(git rm *)" "Bash(git mv *)" "Bash(git worktree *)"
  "Bash(npm *)" "Bash(npx *)" "Bash(node *)" "Bash(dotnet *)"
  "Bash(pgrep *)" "Bash(pkill *)" "Bash(kill *)" "Bash(lsof *)" "Bash(curl -s http://localhost*)"
)

PROMPT_INICIAL="/ciclo-tela $TELA
Execução noturna: o usuário está dormindo e KHAZ_NOITE=1. Siga a seção \"Modo noturno\" da skill: estado em
.claude/ciclos/atual.json a cada etapa, nunca espere resposta (escalar = escrever o relatório e parar), sem push e
sem PR (o script faz no fim). Data de hoje: $DATA."
PROMPT_RETOMADA="/ciclo-tela $TELA
Execução noturna (KHAZ_NOITE=1) — RETOMADA: a sessão anterior caiu no meio. Leia .claude/ciclos/atual.json e o git
da branch indicada, e continue do passo registrado (não refaça o que já está commitado). Mesmas regras do \"Modo
noturno\" da skill. Data de hoje: $DATA."

export KHAZ_NOITE=1
caffeinate -i -w $$ >/dev/null 2>&1 &          # não deixa o Mac dormir enquanto o script roda

concluido() { python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("resultado") in ("entregue","parado") else 1)' "$ESTADO" 2>/dev/null; }

tentativa=1
rm -f "$ESTADO"
while [ "$tentativa" -le "$TENTATIVAS" ]; do
  RESTANTE=$(( LIMITE_SEG - ( $(date +%s) - INICIO ) ))
  [ "$RESTANTE" -gt 300 ] || { log "Sem tempo para nova tentativa."; break; }
  if [ "$tentativa" -eq 1 ]; then PROMPT="$PROMPT_INICIAL"; else PROMPT="$PROMPT_RETOMADA"; fi
  log "Tentativa $tentativa (limite ${RESTANTE}s, $MAX_TURNS turnos, US\$ $MAX_USD, modelo $MODELO)"
  perl -e 'alarm shift; exec @ARGV' "$RESTANTE" \
    claude -p "$PROMPT" --model "$MODELO" --permission-mode dontAsk ${PERM_PROMPTS[@]+"${PERM_PROMPTS[@]}"} \
      --allowedTools "${ALLOWED[@]}" --max-turns "$MAX_TURNS" --max-budget-usd "$MAX_USD" \
      --output-format json > "$LOGDIR/$DATA-$SLUG-tentativa$tentativa.json"
  codigo=$?
  log "claude terminou com código $codigo"
  concluido && break
  tentativa=$(( tentativa + 1 ))
done

# ── 4. Push e PR (determinístico, fora do agente) ──────────────────────────────────────────────────────
BRANCH="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("branch",""))' "$ESTADO" 2>/dev/null)"
RESULTADO="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("resultado","desconhecido"))' "$ESTADO" 2>/dev/null || echo desconhecido)"
RELATORIO="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("relatorio",""))' "$ESTADO" 2>/dev/null)"
log "Estado final: resultado=$RESULTADO branch=$BRANCH relatorio=$RELATORIO"

case "$BRANCH" in feat/*) ;; *) falhar "o ciclo não registrou uma branch feat/* em .claude/ciclos/atual.json (resultado: $RESULTADO)";; esac
git checkout -q "$BRANCH" 2>/dev/null || falhar "branch $BRANCH não existe localmente"
[ -z "$(git status --porcelain)" ] || { git stash -u -q -m "noite $DATA: sobras não commitadas"; log "Aviso: havia mudanças não commitadas; guardei em git stash."; }
[ "$(git rev-list --count origin/main..HEAD)" -gt 0 ] || falhar "a branch $BRANCH não tem commits além da main"

git push -q -u origin "$BRANCH" || falhar "push da $BRANCH falhou"
if gh pr view "$BRANCH" >/dev/null 2>&1; then
  log "PR já existe para $BRANCH (push atualizou)."
else
  TITULO="$TELA — ciclo noturno $DATA ($RESULTADO)"
  if [ -n "$RELATORIO" ] && [ -f "$RELATORIO" ]; then
    gh pr create --base main --head "$BRANCH" --title "$TITULO" --body-file "$RELATORIO" || falhar "gh pr create falhou"
  else
    gh pr create --base main --head "$BRANCH" --title "$TITULO" --body "Relatório não encontrado; veja logs-noite/$DATA-$SLUG.log." || falhar "gh pr create falhou"
  fi
fi
git checkout -q main

# Tela entregue sai da fila; parada fica (você decide e ela roda de novo).
if [ "$RESULTADO" = "entregue" ] && [ -f noite.fila ]; then
  python3 - "$TELA" <<'PY'
import sys
tela=sys.argv[1]; linhas=open('noite.fila',encoding='utf-8').read().splitlines()
feito=False; out=[]
for l in linhas:
    if not feito and l.strip()==tela: feito=True; continue
    out.append(l)
open('noite.fila','w',encoding='utf-8').write('\n'.join(out)+('\n' if out else ''))
PY
fi

log "Fim: $RESULTADO — $BRANCH"
avisar "$TELA: $RESULTADO. PR aberto para $BRANCH."
