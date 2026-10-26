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
- **Testes sem tempo (anti-flaky).** Teste que passa na nuvem e falha numa máquina lenta quase sempre assume
  que a resposta do MSW chega antes de uma checagem síncrona. O setup já dá `asyncUtilTimeout` de 5 s e
  espera as requisições em voo no `afterEach`; o resto é com o teste:
  - **Nunca `getByRole('status'|'alert')` singular** (nem `findByRole` seguido de `toHaveTextContent`) onde pode
    haver mais de um: skeleton "Carregando…" também é `status`, e a confirmação inline "Excluir…?" também é
    `alert`. `findBy*` resolve no primeiro que existir e a asserção seguinte não é refeita. Espere o estado
    final: `findByText('texto exato')` ou `await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(x))`.
    Se for conferir um entre vários, `getAllByRole(...)`.
  - Depois de `await findBy/waitFor` de **um** elemento, outro que vem de **outra requisição** (KPIs, resumo,
    lista relida, contadores do handler) precisa do próprio `waitFor`. `expect(chamadas).toHaveLength(n)` e
    `toHaveFocus()` logo após uma ação assíncrona também.
  - `findAllByRole('listitem')`/`('row')` pega itens da sidebar ou do cabeçalho: espere o contêiner nomeado
    (`findByRole('list', { name })`, `findByRole('table')`) e use `within`.
  - Sem `setTimeout`/`sleep` para "dar tempo". Para segurar uma resposta use um portão (`new Promise` + `liberar()`)
    e libere antes do fim do teste.
  - Loops grandes (200 itens etc.): `fireEvent` dentro de um único `act(() => { ... })` (o React junta os
    renders); `userEvent` em loop só com poucas iterações. Não eleve o timeout do teste para esconder custo.
  - Para provar que o teste é robusto, rode-o com latência: `vi.mock('msw')` embrulhando `http.*` com
    `await delay(150-300)` (não commitar), ou CPU saturada com `nice`. Teste que só passa sem latência é frágil.
- `sessionStorage` é limpo em `afterEach` pelo setup. Dados sintéticos apenas, sem credenciais reais.
