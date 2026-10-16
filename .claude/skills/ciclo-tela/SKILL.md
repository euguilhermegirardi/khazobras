---
name: ciclo-tela
description: Orquestra a entrega autônoma de uma tela do frontend KhazObras — builder constrói, tester testa, falhas voltam ao builder em loop (máx. 3 rodadas), security-reviewer, fechamento com PR. Use quando pedirem para fazer/entregar uma tela inteira.
---

# Ciclo de uma tela (loop builder ↔ tester)

Quem roda esta skill é a **sessão principal** (o maestro): subagente não chama subagente. O maestro só
delega, lê relatórios e decide; não escreve código de feature nem teste.

## 0. Preparar

- Tela e ordem: `docs/PLAN-09-frontend.md`. Branch `feat/<tela>` a partir da `main` atualizada.
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

## 3. Segurança

Tela com ação de escrita ou restrição de papel → `security-reviewer` sobre o diff da branch
(`git diff main...feat/<tela>`). Achado → builder modo corrigir com o achado + reteste do tester (passo 2),
contando nas mesmas 3 rodadas.

## 4. Fechar

1. Suíte verde: `cd frontend && npm run lint && npm run typecheck && npm test`.
2. `checagem-pre-commit`.
3. `docs/PLAN-09-frontend.md` atualizado (status da tela, lacunas, decisões) e, com tudo commitado,
   `cd frontend && npm run plano:registro -- --escrever` + commit `docs: registro`.
4. Push da branch e `gh pr create` para a `main`. Na descrição: o que a tela faz, endpoints consumidos,
   resultado da suíte e do e2e, **histórico do loop** (rodadas, falhas encontradas e como foram
   corrigidas), achados do security-reviewer, pendências.
5. Nunca merge, push ou commit na `main`; nunca `--force`, `--no-verify` ou `SKIP_PLAN_CHECK=1`. O merge é do usuário.
