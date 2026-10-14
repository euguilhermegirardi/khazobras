# KhazObras — Frontend

React 19 + Vite + TypeScript (estrito). Regras do projeto em [`CLAUDE.md`](./CLAUDE.md).

## Rodar

```bash
cp .env.example .env     # VITE_API_URL=http://localhost:5285
npm install
npm run dev              # http://localhost:5173 (origem liberada no CORS do backend)
```

A API precisa estar no ar (`dotnet run --project src/KhazObras.Api`, na pasta `backend/`).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm test` | Vitest (jsdom + Testing Library + MSW) |

## Estado

Esqueleto pronto: cliente de API (`shared/lib/apiClient.ts`), sessão em `sessionStorage`, login,
guardas de rota por papel e layouts vazios de cliente e admin. As telas entram uma a uma, seguindo
a skill `nova-tela-frontend`.
