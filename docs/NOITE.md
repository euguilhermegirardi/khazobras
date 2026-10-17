# Execução noturna dos agentes (Mac)

O `ciclo-tela` roda sozinho no seu Mac enquanto você dorme. De manhã você encontra um PR aberto com o relatório
da manhã na descrição (ou, se não rodou, `logs-noite/AAAA-MM-DD-<tela>-FALHA.md` dizendo por quê).

## Como funciona

```
launchd (1h) → scripts/noite.sh → confere ambiente → claude -p "/ciclo-tela <tela>" (KHAZ_NOITE=1)
                                 → limite de tempo/turnos/custo → retoma 1x se cair → push da feat/<tela> + PR
```

- **O agente** constrói, testa, revisa, commita na `feat/<tela>` e escreve o relatório. Não tem permissão de push.
- **O script** faz o que é arriscado e mecânico: pré-checagem, limites, retomada, push e PR.
- **Guardas** (`.claude/hooks/guarda-noite.sh`, só com `KHAZ_NOITE=1`): bloqueiam push, `gh`, `--no-verify`,
  `SKIP_PLAN_CHECK`, `reset --hard`, commit na main, `sudo`, `rm -rf` fora do projeto e arquivos de segredo.
  Permissões negadas ficam em `.claude/ciclos/negadas.jsonl` e entram no relatório.

## Instalação (uma vez)

1. **Pré-requisitos no Mac:** `claude` (o Claude Code **de linha de comando**; a extensão do VS Code não instala o comando),
   `node`, `dotnet`, `gh`, Postgres, Google Chrome (macOS 13), e no `frontend/`:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude --version
   cd frontend && npm install && npx playwright install chromium
   # macOS 13: o Playwright 1.64 não baixa navegadores nesse sistema; ele usa o Google Chrome instalado
   # (automático). Basta ter o Chrome em /Applications. Pode pular o "playwright install".
   gh auth login        # se ainda não estiver autenticado
   ```
2. **Token do Claude para execução sem você** (sessões agendadas não usam bem o login interativo):
   ```bash
   claude setup-token                                   # gera um token de longa duração (plano Pro/Max)
   mkdir -p ~/.config/khazobras && chmod 700 ~/.config/khazobras
   pbpaste > ~/.config/khazobras/claude-oauth-token     # depois de copiar o token
   chmod 600 ~/.config/khazobras/claude-oauth-token
   ```
   Nunca dentro do repositório. Se `ANTHROPIC_API_KEY` estiver no seu ambiente, o script remove na execução
   (para não cobrar pela API).
3. **Agendamento:**
   ```bash
   sed "s#CAMINHO_DO_REPO#$(pwd)#g" scripts/launchd/com.khazobras.noite.plist > ~/Library/LaunchAgents/com.khazobras.noite.plist
   mkdir -p logs-noite
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.khazobras.noite.plist
   ```
4. **Mac acordado à noite:** na tomada, tampa aberta (fechada ele dorme) e, em Ajustes → Bateria → Opções,
   "Impedir repouso automático com a tela desligada" ligado. Para acordar sozinho antes da 1h:
   `sudo pmset repeat wakeorpoweron MTWRFSU 00:55:00`. Durante a execução o script segura o repouso (`caffeinate`).

## Uso

```bash
echo "Relatório mensal" > noite.fila        # uma tela por linha; a primeira roda na próxima noite
./scripts/noite.sh                          # rodar agora (teste com você acordado)
launchctl kickstart gui/$(id -u)/com.khazobras.noite   # dispara o agendamento agora
```

- Tela **entregue** sai da fila; tela **parada** fica (você decide o que o relatório pede e ela roda de novo).
- Limites (variáveis de ambiente no plist ou no terminal): `KHAZ_LIMITE_SEG` (padrão 18000 = 5 h),
  `KHAZ_MAX_TURNS` (400), `KHAZ_MAX_USD` (25, estimativa), `KHAZ_MODELO` (`opus`, o maestro), `KHAZ_TENTATIVAS` (2).
- Logs: `logs-noite/` (texto + JSON de cada tentativa com custo estimado e `session_id`).
- Desinstalar: `launchctl bootout gui/$(id -u)/com.khazobras.noite`.

## Primeira vez: teste acordado

Rode `./scripts/noite.sh "Relatório mensal"` com você por perto. Confira: pré-checagem passa, o `claude -p` começa,
`.claude/ciclos/atual.json` vai sendo atualizado, e no fim aparecem o push e o PR. Ajuste o que travar (o relatório
lista as permissões negadas) antes de deixar o launchd rodar sozinho.
