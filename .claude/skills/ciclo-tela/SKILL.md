---
name: ciclo-tela
description: Orquestra a entrega autônoma de uma tela do frontend KhazObras — builder constrói, tester testa, design-reviewer compara com o protótipo, falhas voltam ao builder em loop (máx. 3 rodadas), security-reviewer, fechamento com PR. Use quando pedirem para fazer/entregar uma tela inteira.
---

# Ciclo de uma tela (loop builder ↔ tester)

Quem roda esta skill é a **sessão principal** (o maestro): subagente não chama subagente. O maestro só
delega, lê relatórios e decide; não escreve código de feature nem teste.

## Modo noturno (quando `KHAZ_NOITE=1` / disparado por `scripts/noite.sh`)

- **Ninguém vai responder.** Onde a skill diz "pare e chame o usuário": escreva o relatório da manhã com o motivo
  em "Precisa de você", marque `resultado: "parado"` no estado e **termine** (não pergunte, não espere).
- **Estado em `.claude/ciclos/atual.json`** (o script lê no fim e usa para retomar se a sessão cair). Atualize a cada
  etapa concluída, sobrescrevendo o arquivo:
  ```json
  {"tela": "...", "branch": "feat/<slug>", "passo": "construir|teste|design|seguranca|relatorio|fim",
   "rodada": 0, "resultado": "andamento|entregue|parado", "relatorio": "docs/relatorios/AAAA-MM-DD-<slug>.md",
   "notas": ["falhas por tipo, decisões, o que travou — matéria-prima do relatório"]}
  ```
  Retomada: leia o estado e o `git log` da branch e continue do `passo`; não refaça o que já está commitado.
- **Sem push e sem PR**: o script faz os dois no fim (o hook `guarda-noite.sh` bloqueia push/gh). Commite tudo na
  branch antes de terminar: árvore suja no fim vira `git stash` e se perde do PR.
- **Sem mudança de schema e sem backend que exija aplicar SQL**: lacuna assim = parar (relatório explica).
- Permissão negada? Não contorne. As negações ficam em `.claude/ciclos/negadas.jsonl`; leve para "Sinais para o harness".
- Uma tela por noite. Encerrou (entregue ou parado) → `passo: "fim"` e termine a sessão.

## 0. Preparar

- Tela e ordem: `docs/PLAN-09-frontend.md`. Branch `feat/<tela>` a partir da `main` atualizada.
- A captura visual precisa de `@playwright/test` no `frontend/`. Ainda não instalado: o tester instala no
  primeiro fluxo (decisão do PLAN-09); sem browser no ambiente, o design-reviewer devolve `BLOQUEADO`.
- Tela depende de lacuna do backend? Rode `backend-gap-filler` antes, numa branch própria
  (`feat/backend-<lacuna>`). Se ele mudar o schema (novo `database/schema/00x_*.sql`) → **pare**: o usuário
  precisa aplicar o script localmente antes de seguir.

## 1. Construir

`frontend-builder` em modo **construir**, com o nome da tela e a branch. Se ele parar por lacuna de backend,
volte ao passo 0.

## 2. Loop de teste (máx. 3 rodadas de correção)

```
rodada = 0
tester (contexto novo) → relatório
enquanto RESULTADO = FALHAS:
    se rodada = 3 → PARE (escala)
    builder modo corrigir ← relatório inteiro do tester
    tester (contexto novo) ← "reteste" + relatório anterior → novo relatório
    rodada += 1
```

- Sempre um **contexto novo** para o tester (nova chamada), para ele não herdar o raciocínio do builder.
- Repasse o relatório **inteiro**, sem resumir: o formato é o contrato entre os dois.
- `CONTESTO` do builder: mande ao tester no reteste. Se o tester mantiver o teste citando a fonte no
  SPEC/regras, a contestação vai para o usuário (é decisão de produto, não bug).

**Pare e chame o usuário** (com o último relatório, a branch e o que já foi feito) quando:

- estourar 3 rodadas de correção;
- a mesma falha aparecer em duas rodadas seguidas (sem progresso);
- `RESULTADO: BLOQUEADO` (divergência SPEC × backend ou ambiente);
- contestação mantida pelos dois lados;
- a correção exigir mudar regra de acesso, contrato da API ou o SPEC.

## 3. Design (visual)

Com o tester `VERDE`: `design-reviewer` (contexto novo) com a tela, a rota, o papel e o arquivo de mocks
(`frontend/e2e/mocks/<tela>.json`, criado pelo tester). `FALHAS` → builder modo corrigir com o relatório do
design-reviewer → **tester de novo** (a correção visual não pode quebrar comportamento) → design-reviewer de
novo. Conta nas mesmas 3 rodadas. Divergência de conteúdo entre protótipo e SPEC: vale o SPEC, não é falha.

## 4. Segurança

Tela com ação de escrita ou restrição de papel → `security-reviewer` sobre o diff da branch
(`git diff main...feat/<tela>`). Achado → builder modo corrigir com o achado + reteste do tester (passo 2),
contando nas mesmas 3 rodadas.

## Relatório da manhã (sempre, entregue ou parado)

Ao terminar **ou** parar, escreva `docs/relatorios/AAAA-MM-DD-<tela>.md` a partir de `docs/relatorios/MODELO.md`
(métricas no cabeçalho + seções) e commite na branch da tela. É a primeira coisa que o usuário lê de manhã:
comece por "Em uma linha" e "Precisa de você"; não cole transcript. Anote ao longo do ciclo (rodadas, falhas
por tipo, decisões tomadas sem o SPEC dizer, o que travou) para não reconstruir de memória no fim.
Parou? O relatório explica onde, por quê e o que falta decidir; a branch fica com tudo o que foi feito.

## 5. Fechar

1. Suíte verde: `cd frontend && npm run lint && npm run typecheck && npm test`.
2. `checagem-pre-commit`.
3. `docs/PLAN-09-frontend.md` atualizado (status da tela, lacunas, decisões) e, com tudo commitado,
   `cd frontend && npm run plano:registro -- --escrever` + commit `docs: registro`.
4. (Fora do modo noturno) Push da branch e `gh pr create` para a `main`. Na descrição: o que a tela faz, endpoints consumidos,
   resultado da suíte e do e2e, capturas da tela (claro, escuro, notebook 1280px), **histórico do loop** (rodadas, falhas encontradas e como foram
   corrigidas), achados do security-reviewer, pendências e o link para o relatório da manhã.
5. Nunca merge, push ou commit na `main`; nunca `--force`, `--no-verify` ou `SKIP_PLAN_CHECK=1`. O merge é do usuário.
