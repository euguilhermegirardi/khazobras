---
paths:
  - "frontend/**/*.test.ts"
  - "frontend/**/*.test.tsx"
  - "frontend/src/test/**"
---

# Testes do frontend

- Render de página/rota: `renderApp(path, role?)` de `@/test/helpers` (já traz Router, `AuthProvider` e
  `QueryClient` com `retry: false`). `role` grava uma sessão falsa; sem `role` = deslogado.
- API: MSW com `server` de `@/test/server` e `API` (base URL). Registre handlers no teste com
  `server.use(http.get(`${API}/...`, ...))`. O setup usa `onUnhandledFrame: 'error'`, então **toda
  chamada que a página faz precisa de handler**, inclusive em testes que só olham o título.
- Formato real das respostas: paginação `{ totalItems, pageIndex, pageSize, items }`; enums PascalCase;
  datas `yyyy-MM-dd`; erros 500 `{ requestId, message }`.
- Consulta por papel/label (`getByRole`, `getByLabelText`) e `userEvent`; nada de classes CSS ou
  detalhes internos. Esperas com `findBy*`, não `setTimeout`.
- Cada tela: carregando, vazio, erro (com `requestId` nos 500) e sucesso. Tela com restrição: teste de
  papel (cliente não vê ação/dado de admin; admin não entra na rota do cliente).
- `sessionStorage` é limpo em `afterEach` pelo setup. Dados sintéticos apenas, sem credenciais reais.
