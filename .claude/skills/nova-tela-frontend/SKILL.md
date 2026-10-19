---
name: nova-tela-frontend
description: Passo a passo para construir uma tela/feature do frontend React do KhazObras (cliente ou admin) a partir do SPEC, com tipos, hooks de dados, estados, guarda de role e testes. Use ao iniciar qualquer tela.
---

# Nova tela no frontend

0. **Branch**: `git checkout -b feat/<tela>` a partir da `main` atualizada. Nunca na `main`.
1. **Escopo**: ler `docs/PLAN-09-frontend.md` (ordem e pendências), a tela em `docs/SPEC.md`
   (§5 cliente / §6 admin) e `frontend/CLAUDE.md`. O módulo `src/modules/obras/` é o molde.
   Definir: quem acessa (role), o que lê, o que escreve (cliente: só aprovar medição).
2. **Contrato**: localizar endpoints em `backend/src/KhazObras.Api/Program.cs` e DTOs em
   `Application`. Se faltar endpoint ou o response vazar campo interno para o cliente →
   parar e acionar `backend-gap-filler`.
3. **Módulo** em `src/modules/<modulo>/`:
   - Tipos: `src/interfaces/<dominio>.ts` espelha o DTO (enums PascalCase na resposta; snake_case no request).
   - Componentes: um por arquivo, só a própria interface de props, ordem da regra `.claude/rules/frontend-componentes.md`.
   - `api.ts`: funções sobre `apiClient`; sem `fetch` solto.
   - `hooks.ts`: `useQuery`/`useMutation` com chaves estáveis (`['obra', obraId, 'medicoes', page]`);
     mutação invalida as chaves afetadas.
   - `components/` e `pages/`: página fina, lógica em hooks.
   - Aparência: `.claude/rules/frontend-design.md` + a captura de referência da tela em `docs/design/capturas/`
     (abra com Read antes de montar). Item da sidebar em `src/layouts/navigation.ts`, na ordem do SPEC.
   - UI: componentes de `src/components/ui/` (shadcn/ui) e `src/components/` (`KpiCard`, `ProgressBar`) primeiro; faltou um → `npx shadcn@latest add <nome>`
     (nunca recriar à mão; sem acesso ao registro do shadcn, pare e registre a pendência). Cores só por tokens do tema (`text-muted-foreground`, `bg-destructive`...),
     nunca cor fixa. O Hub (`modules/obras`) é o exemplo.
4. **Estados**: carregando (`Skeleton` de `components/ui`, dentro de `role="status"` com texto `sr-only`), vazio (mensagem útil), erro (com `requestId` em 500;
   403 → sem permissão; 409 → mensagem da transição), sucesso.
5. **Rota**: registrar com guarda de role dentro do layout certo (`ClientLayout` / `AdminLayout`) e
   o item da sidebar em `src/layouts/navigation.ts` (bloco obra ou empresa), na ordem do SPEC.
6. **Formulários** (admin): React Hook Form + Zod, espelhando as regras do validator do backend;
   erros do servidor (400) mapeados nos campos.
7. **Visão cliente**: linguagem simples, sem termos técnicos, só valores previstos/contratados.
8. **Testes**: são do `frontend-tester` (contexto separado), acionado pelo `ciclo-tela`; falhas voltam
   para você corrigir o código, nunca o teste. Mínimo: 4 estados + teste de papel
   (`.claude/rules/frontend-testes.md`). Fora do ciclo e sem subagente disponível, escreva os testes e diga
   isso na entrega. Se a tela chama endpoints novos, ajuste os testes antigos que renderizam essa rota
   (MSW falha em chamada sem handler).
9. **Verificar**: `npm run format`, depois `npm run lint && npm run typecheck && npm test`.
10. **Plano**: atualizar `docs/PLAN-09-frontend.md`: status da tela, lacunas e decisões à mão; linha do
    Registro com `cd frontend && npm run plano:registro -- --escrever`. O hook de commit exige isso.
    Se o hook bloquear, resolva sozinho (não espere o usuário); `SKIP_PLAN_CHECK=1` só se ele pedir.
11. Rodar `checagem-pre-commit` e, em telas com ação de escrita ou restrição, `security-reviewer`
    (no `ciclo-tela`, o maestro faz isso).
12. **Fechamento da branch** (no `ciclo-tela`, o maestro faz isso) (antes do merge/PR): com tudo commitado, `cd frontend && npm run plano:registro -- --escrever`
    (atualiza a linha desta branch com todos os commits) e commit `docs: registro`. Depois: push da branch e
    PR para a `main` (`gh pr create`). Nunca commitar, mergear ou dar push na `main`; o merge é do usuário.
