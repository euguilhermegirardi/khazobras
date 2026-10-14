---
name: nova-tela-frontend
description: Passo a passo para construir uma tela/feature do frontend React do KhazObras (cliente ou admin) a partir do SPEC, com tipos, hooks de dados, estados, guarda de role e testes. Use ao iniciar qualquer tela.
---

# Nova tela no frontend

0. **Branch**: `git checkout -b feat/<tela>` a partir da `main` atualizada. Nunca na `main`.
1. **Escopo**: ler `docs/PLAN-09-frontend.md` (ordem e pendências), a tela em `docs/SPEC.md`
   (§5 cliente / §6 admin) e `frontend/CLAUDE.md`. A feature `src/features/obras/` é o molde.
   Definir: quem acessa (role), o que lê, o que escreve (cliente: só aprovar medição).
2. **Contrato**: localizar endpoints em `backend/src/KhazObras.Api/Program.cs` e DTOs em
   `Application`. Se faltar endpoint ou o response vazar campo interno para o cliente →
   parar e acionar `backend-gap-filler`.
3. **Feature** em `src/features/<modulo>/`:
   - `types.ts`: espelha o DTO (enums PascalCase na resposta; snake_case no request).
   - `api.ts`: funções sobre `apiClient`; sem `fetch` solto.
   - `hooks.ts`: `useQuery`/`useMutation` com chaves estáveis (`['obra', obraId, 'medicoes', page]`);
     mutação invalida as chaves afetadas.
   - `components/` e `pages/`: página fina, lógica em hooks.
4. **Estados**: carregando (skeleton), vazio (mensagem útil), erro (com `requestId` em 500;
   403 → sem permissão; 409 → mensagem da transição), sucesso.
5. **Rota**: registrar com guarda de role dentro do layout certo (`ClientLayout` / `AdminLayout`) e
   o item no navbar na ordem do SPEC.
6. **Formulários** (admin): React Hook Form + Zod, espelhando as regras do validator do backend;
   erros do servidor (400) mapeados nos campos.
7. **Visão cliente**: linguagem simples, sem termos técnicos, só valores previstos/contratados.
8. **Testes**: acionar `frontend-tester` (contexto separado) seguindo `.claude/rules/frontend-testes.md`.
   Mínimo: 4 estados + teste de papel. Sem subagente disponível, escreva os testes e diga isso na entrega.
   Se a tela chama endpoints novos, ajuste os testes antigos que renderizam essa rota (MSW falha em
   chamada sem handler).
9. **Verificar**: `npm run lint && npm run typecheck && npm test`.
10. **Plano**: atualizar `docs/PLAN-09-frontend.md` (status da tela + linha no Registro).
11. Rodar `checagem-pre-commit` e, em telas com ação de escrita ou restrição, `security-reviewer`.
