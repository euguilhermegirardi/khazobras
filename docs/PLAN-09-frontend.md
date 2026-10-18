# PLAN-09 — Frontend React (plano vivo)

> Documento de passagem entre sessões (VS Code, chat, subagentes). **Toda tela concluída atualiza
> este arquivo** (tabela + registro). Referências: `SPEC.md` §5/§6, `frontend/CLAUDE.md`.

## Como atualizar (obrigatório ao fechar uma tela)

> O hook `.githooks/pre-commit` bloqueia o commit de tela/rota/endpoint/script de banco sem este arquivo
> staged. Ativar: `bash scripts/instalar-hooks.sh`. O agente atualiza; você só revisa o diff.

1. Mudar o status da tela na tabela abaixo (⬜ → 🟨 em andamento → ✅ feita).
2. Acrescentar uma linha no **Registro**: `cd frontend && npm run plano:registro -- --escrever` gera a linha
   a partir do git; complete com "Pendente: ..." se houver. É **uma linha por branch**: rodar de novo
   substitui a anterior e preserva o "Pendente:". Antes do merge, rode de novo com tudo commitado
   (commit `docs: registro`).
3. Se descobriu lacuna de backend, acrescentar na tabela de lacunas.
4. Se tomou decisão técnica, acrescentar em **Decisões**.
5. Hook bloqueou? O agente resolve sozinho (itens 1–4 + `git add` + commit), sem esperar o usuário.

## Pendências antes da próxima tela

- [x] Biblioteca de componentes decidida: **shadcn/ui** (ver Decisões).
- [x] Navbar do cliente: moldura sidebar + topbar em `src/layouts/shell/` (itens em `src/layouts/navigation.ts`).

## Telas do cliente (SPEC §5) — ordem sugerida

| # | Tela | Backend pronto? | Status | Branch / observação |
|---|---|---|---|---|
| 1 | Hub | ✅ `GET /obras` (cliente vê só as suas) | ✅ | `feat/hub-cliente` (na main) |
| 2 | Fechamento (medições + aprovar) | ✅ medições + `POST /medicoes/{id}/approve` só do cliente (`ClientOnly`, UPDATE condicional) | ✅ | `feat/fechamento` + `feat/backend-aprovacao-cliente` (PRs #1 e #2, na main). Lista + itens + aprovar com confirmação; 58 testes + 2 e2e. Relatório: `docs/relatorios/2026-10-16-fechamento.md` |
| 3 | Relatório mensal | ✅ `GET /obras/{id}/relatorios-mensais?onlyPublished=true` | ✅ | `feat/relatorio-mensal` (+ `feat/ajustes-relatorio-shell`). Lista dos publicados, mês mais novo primeiro, texto puro; 10 testes + 2 e2e. Visual conferido pelo Guilherme no localhost (18/10). B4/B5 resolvidas no backend, filtro `published` no SQL. Relatório: `docs/relatorios/2026-10-16-relatorio-mensal.md` |
| 4 | Relatório fotográfico | ✅ `GET /obras/{id}/relatorios-fotograficos` + `GET /fotos/{fotoId}/arquivo` (download autenticado da imagem) | ✅ | `feat/relatorio-fotografico`. Tabs Mensal/Etapa, grade de fotos via blob autenticado, ampliar; 20 testes + 2 e2e. 2 rodadas (design: overlay escuro; segurança: download preso à obra no SQL). **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac antes do merge.** Relatório: `docs/relatorios/2026-10-18-relatorio-fotografico.md` |
| 5 | Financeiro (somente leitura) | ✅ lançamentos `visivel_cliente` + download de comprovante | ⬜ | parcelas dependem de Contratos |
| 6 | Cronograma (sem Curva S) | 🟨 `GET /obras/{id}/etapas`; falta % concluído | ⬜ | lacuna: atualização de etapas |
| 7 | Projetos | 🟨 listagem ok; download pelo cliente bloqueado | ⬜ | lacuna: liberar download ao cliente da obra |
| 8 | Contratos | ❌ sem endpoints | ⬜ | lacuna: módulo Contratos/Pagamentos |
| 9 | Dashboard | ❌ sem KPIs/custo acumulado | ⬜ | lacuna: Dashboard/KPIs |

Navbar do cliente cresce uma entrada por tela entregue (ordem do SPEC §5).

## Telas admin/master (SPEC §6)

Começam depois da visão cliente. Prioridade provável: Medições (criar e emitir NF), Financeiro (edição
e flag `visivel_cliente`), Relatórios. Detalhar aqui quando iniciar.

## Lacunas de backend que bloqueiam telas

Ao implementar uma, removê-la daqui e atualizar a tabela de telas. Faltam (provavelmente com script `008_*.sql`+):

- Contratos e pagamentos (endpoints) — bloqueia Contratos e parcelas do Financeiro do cliente
- Dashboard / KPIs / Curva S / Rentabilidade / comparativo entre obras — bloqueia Dashboard
- Cronograma: atualização de etapas e campo de % concluído — bloqueia Cronograma completo
- Medições (achados do Fechamento): (B3) `MedicaoResponse` devolve `ApprovedByUserId` (id interno) ao cliente — criar DTO
  reduzido para a visão cliente, como no Financeiro (o front já ignora o campo); `GET /obras/{id}/medicoes` não é paginado
  (array puro) e não traz unidade, qtd. contratada, medido anterior nem saldo (colunas do protótipo).
- Relatórios mensais: `GET /obras/{id}/relatorios-mensais` não é paginado (array puro).
- Download de anexos de **projetos** pelo cliente da obra (hoje só AdminOrMaster) — bloqueia Projetos
- Download fora da régua (security-reviewer, 18/10): `GET /projetos/{id}/download` sem `EnsureAccessAsync` (e baixa do R2
  antes de checar o perfil). Corrigir com o padrão do download de foto (resolve `obra_id` → `EnsureAccessAsync` →
  `WHERE id = @Id AND obra_id = @ObraId`) antes da tela Projetos.
- Categorias (CRUD); Empresa / equipe (Administração) — telas admin
- PUT/PATCH/DELETE na maioria dos módulos; `GET /users/{id}`, desativar usuário — telas admin
- Envio real de e-mail / WhatsApp nas notificações
- Integração do `LogAuditoria` nas ações dos demais módulos (estrutura pronta, não plugada)
- PDF consolidado (Fase 10)

## Decisões

- Token em `sessionStorage` (V1). Sem refresh; sessão expira em 8h.
- Componentes: **shadcn/ui** (Tailwind 4, tema por variáveis CSS em `src/index.css`), código em `src/components/ui/`.
  Instalados: Button, Card, Badge, Skeleton, Table, Tabs, Alert. Recharts entra com o Dashboard.
- Estado: TanStack Query (servidor) + `useState`/`useReducer` (local) + Context só para a sessão. Sem Zustand.
- E2E: Playwright em **Chromium** (instalado com o Fechamento, `frontend/e2e/*.e2e.ts`). Era WebKit, mas o Playwright 1.64
  não baixa navegadores no macOS 13 (Mac do usuário): lá usa o Google Chrome instalado (`channel: 'chrome'`, automático;
  `PW_CHANNEL` força). `PW_BROWSER=webkit` onde houver suporte. Na nuvem:
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- **Design = protótipo do engenheiro** (`docs/design/referencia.html`, anonimizado, + `capturas/`): tema copiado em
  `src/index.css` (claro/escuro pelo sistema, cores semânticas info/success/warning/danger/neutral), moldura
  sidebar+topbar em `src/layouts/shell/` (itens em `src/layouts/navigation.ts`), componentes `table`/`tabs`/`alert` +
  `KpiCard`/`ProgressBar`. Guia: `.claude/rules/frontend-design.md`. Do protótipo vem só a aparência; conteúdo é do SPEC.
- **Só desktop web** (SPEC §10): sem layout mobile; larguras de referência 1440px e 1280px. (O guia de design
  chegou a pedir 390px por engano; corrigido após a rodada supervisionada do Fechamento.)
- Verificação visual no loop: `design-reviewer` compara a captura da tela (`scripts/capturar-tela.mjs` + mocks do
  tester em `frontend/e2e/mocks/`) com a referência.
- Pendência de ambiente: o registro do shadcn (`ui.shadcn.com`) é bloqueado na sessão de nuvem; `table`/`tabs`/`alert`
  foram escritos a partir do código padrão do shadcn. Rodar agentes à noite na nuvem exige resolver isso
  (liberar o domínio ou rodar no Mac).
- **Execução noturna no Mac do usuário** (decisão out/2026; a nuvem não tem .NET/NuGet/shadcn/`gh`): `scripts/noite.sh`
  via launchd roda `claude -p "/ciclo-tela <tela>"` com `KHAZ_NOITE=1`, limites de tempo/turnos/custo e 1 retomada pelo
  estado em `.noite/atual.json`; o agente não dá push (hook `guarda-noite.sh`), o script faz push + PR no fim.
  Fila em `noite.fila`. Guia: `docs/NOITE.md`.
- Entrega de tela autônoma pela skill `ciclo-tela`: builder ↔ tester em loop (tester nunca corrige produção,
  builder nunca mexe nos testes do tester), máx. 3 rodadas, escala ao usuário em divergência/sem progresso.
- Interfaces/tipos da API em `src/interfaces/`; componente só tem a interface das próprias props; um
  componente por arquivo; ordem fixa dentro do componente (`.claude/rules/frontend-componentes.md`).
- Componentes e funções internas como `const` + arrow; utilitários (`utils/`) e serviços (`services/`) como `function` (lint cobra).
- Lint explícito em `frontend/.oxlintrc.json` (oxlint), com segurança (`no-danger`, sem `localStorage`), a11y e
  fronteiras de import (módulo ↛ módulo; base ↛ modules/layouts/routes; layouts ↛ modules/routes).
- Sessão/auth em `src/auth/` (usada por várias telas); `modules/auth/` só tem a tela de login.
- Node 20.19+ (ou 22.12+) por causa do Vite 8.
- Uma branch por tela (`feat/<tela>`); nunca commitar direto na `main`.
- Atualização do plano é travada no commit (hook versionado) e o Registro é gerado do git (`plano:registro`).
- Testes de rota passam pelo `renderApp` (helper) com MSW; endpoint não stubado derruba o teste.
- **Aprovação de medição é do cliente** (decisão do dono; SPEC §5 item 4 e §8): o engenheiro gera, o cliente revisa e
  aprova para emitir a NF. `POST /medicoes/{id}/approve` usa a política `ClientOnly` (só `Client`; Admin/Master = 403)
  e `EnsureAccessAsync` (cliente de outra obra = 403). O `UPDATE` de aprovação e o de emissão de NF agora são condicionais
  (`status = 'pending_approval'` / `'approved'`) e devolvem se afetaram linha; 0 linhas = 409 (corrige a corrida do B2).
  Testes: `Http/ApproveMedicaoAuthorizationTests`. Escrito na nuvem sem .NET; validado e mesclado pelo usuário (PR #1).
  Regra geral: `EnsureAccessAsync` libera Admin/Master em qualquer obra — ação exclusiva do cliente precisa de política de papel.
- Fechamento (cliente): rota `/cliente/obras/:obraId/fechamento` (lista) e `.../fechamento/:medicaoId` (itens + aprovar).
  Aprovação pede confirmação inline (`Alert` + botões), porque o shadcn `alert-dialog` não pôde ser instalado na nuvem
  (pendência: trocar por `AlertDialog` quando o registro estiver acessível). Status em linguagem simples: "Aguardando sua
  aprovação" / "Aprovada" / "Nota fiscal emitida". Tipo `Medicao` omite `approvedByUserId` de propósito.
- Relatório mensal (cliente): rota `/cliente/obras/:obraId/relatorio-mensal`, item "Relatório mensal" na sidebar (após
  Fechamento, enquanto Financeiro/Cronograma não existem). SPEC só diz "versão publicada, sem edição"; o `conteudo` é um
  único texto livre (não há campos estruturados como no protótipo), então a tela é uma lista de cards por mês
  (competência + data de publicação + texto com `whitespace-pre-line`, nunca HTML). Sem filtro/aba de histórico: todos
  os publicados aparecem, do mais novo ao mais antigo. A tela sempre pede `onlyPublished=true`, mas isso não é controle
  de acesso. Tipo `RelatorioMensal` omite `createdByUserId`.
- Relatório mensal, regra no backend (B4/B5): para `Client`, `GET /obras/{id}/relatorios-mensais` ignora `onlyPublished` e
  só devolve `published`; `GET /relatorios-mensais/{id}` de rascunho = 404. O cliente recebe `RelatorioMensalClienteResponse`
  (sem `createdByUserId`); Admin/Master seguem com o DTO completo e `onlyPublished` opcional. Testes:
  `Http/RelatorioMensalClienteTests`.
  Filtro `status = 'published'` também no SQL (`GetPublished...Async` no repositório, defense in depth).
  `POST /relatorios-mensais/{id}/publish` passou a chamar `EnsureAccessAsync` (regra 4).
- Relatório fotográfico, backend (18/10): `GET /fotos/{fotoId}/arquivo` (`RequireAuthorization` + `EnsureAccessAsync` pela obra do
  relatório; 401/403/404) devolve a imagem pelo R2 via API, sem URL pública. A tabela `fotos` não guarda content type nem nome:
  ambos saem da `storage_key` (`{guid}{ext}`; tipo pela extensão jpg/png/webp/gif). `FotoResponse` não expõe `storage_key`,
  então não precisou de DTO de visão cliente. `POST /relatorios-fotograficos/{id}/fotos` passou a chamar `EnsureAccessAsync`.
  O front deve buscar a imagem com o token (fetch -> blob -> object URL), pois `<img src>` não envia `Authorization`.
  Testes: `Http/FotoDownloadTests`. Escrito na nuvem sem .NET: validar com `dotnet build` e `dotnet test`.
  Correção do security-reviewer (rodada 2): o download resolve só o `obra_id` da foto (`GetObraIdByFotoIdAsync`), valida acesso e
  busca o arquivo com `WHERE f.id = @FotoId AND r.obra_id = @ObraId` (`GetFotoByIdAndObraAsync`; obra errada = 404). Upload de
  foto aceita só jpg/jpeg/png/webp/gif (400 caso contrário); chave nova `{guid}{ext}` sem nome original (chaves antigas
  `{guid}-{nome}` seguem legíveis); `Content-Disposition` fixo `foto-{fotoId}{ext}`. Backlog: mesmo padrão em
  `GET /projetos/{id}/download`.
- Financeiro, download de comprovante (18/10, correção do security-reviewer): `GET /financeiro/anexos/{id}/download` agora
  resolve só o `obra_id` (`GetObraIdByAnexoIdAsync`), valida `EnsureAccessAsync` e busca o anexo numa consulta única
  `WHERE a.id = @AnexoId AND l.obra_id = @ObraId AND (@SomenteVisiveisCliente = FALSE OR l.visivel_cliente)` (cliente com
  lançamento oculto = 404; só então lê do R2). Upload novo grava `{guid}{ext}` sem o nome original (`NomeArquivo` segue no
  DTO e no `Content-Disposition`). Testes: `Http/FinanceiroAnexoDownloadTests`. Escrito na nuvem sem .NET: validar com
  `dotnet build` e `dotnet test`.
- Relatório fotográfico (cliente, front): rota `/cliente/obras/:obraId/relatorio-fotografico`, item na sidebar antes de
  "Relatório mensal" (SPEC §5: item 7 vem antes do 8). Tabs Mensal/Etapa filtram `tipo` no front (o backend devolve tudo
  num array). Mensal: título = `formatMonthYearTitle(competencia)`, ordenado por competência desc; Etapa: título = nome da
  etapa via `GET /obras/{id}/etapas` (falha ou etapa desconhecida = título do relatório; erro de etapas não derruba a tela).
  Imagens: hook de base `hooks/useAuthenticatedObjectUrl` (reusa `apiDownload`: Bearer -> blob -> object URL, revogado no
  cleanup; cache 5 min no TanStack Query), reaproveitável por Projetos e Financeiro. Foto que falha = placeholder
  "Imagem indisponível". Ampliar: `components/ImageDialog` feito à mão (role=dialog, Esc/clique fora/botão fechar, foco
  vai ao botão e volta ao gatilho), porque `@radix-ui/react-dialog` não está instalado; trocar por shadcn `dialog` quando
  o registro estiver acessível. Todas as miniaturas do relatório carregam de uma vez (sem lazy/paginação; V1).
  Tipos `Foto`/`RelatorioFotografico` (`interfaces/relatorioFotografico.ts`) e `Etapa` (`interfaces/etapa.ts`, só id/nome/ordem).
- Shell: "← Minhas obras" (volta ao hub) fica no `AppShell` e aparece em toda tela da obra, não só no Dashboard.
  Hover dos itens da sidebar: fundo escuro e texto claro (tokens `--sidebar-hover`, `--sidebar-hover-empresa`,
  `--sidebar-hover-foreground`), azul no bloco da obra e verde no da empresa. Pedido do Guilherme (18/10).
- Título de mês ("Setembro de 2026"): `formatMonthYearTitle` em `utils/dates.ts` (o CSS `capitalize`
  deixava "De" maiúsculo).

- **Achado da revisão humana vira ajuste no harness** (regra, skill, agente ou checklist do reviewer), não só correção
  de código. Regra que já existia e passou mesmo assim → repetir no checklist de quem executa e no critério de
  quem revisa. Primeira aplicação (18/10, Relatório mensal): filtro de status no SQL, `EnsureAccessAsync` mesmo em
  endpoint só de admin, piso de severidade do security-reviewer, navegação comum no `AppShell`, título de mês,
  hover/foco no checklist visual.

- **Estrutura de pastas = modelo "por módulos"** (escolha do Guilherme, 18/10): `src/modules/<tela>/` + base plana na
  raiz de `src/` (`components/` com `ui/` do shadcn, `interfaces/`, `utils/`, `services/`, `auth/`, `hooks/`) +
  `layouts/` (shell e navegação) + `routes/`. Substitui `app/` + `features/` + `shared/`. Fronteiras no `.oxlintrc.json`.

## Registro

- 2026-10-18 — `feat/relatorio-fotografico`: feat(backend): download autenticado de fotos do relatório fotográfico; feat(relatorio-fotografico): tela do cliente com tabs Mensal e Etapa; chore(captura): mocks de imagem e chave com curinga no capturar-tela; test: relatorio-fotografico (unitários, e2e e mocks de captura); fix(relatorio-fotografico): overlay do diálogo escuro nos dois temas; docs: capturas do relatório fotográfico (claro, escuro, 1280); fix(backend): download de foto preso à obra no SQL, upload só de imagem, nome fixo; fix(api-client): nome de arquivo malformado não derruba o download; docs: relatório da manhã do Relatório fotográfico, PLAN-09 e npm run e2e. Arquivos: infra (2), backend (4), testes backend (2), docs (4), front (10), front/rotas-layouts (2), modules/relatorio-fotografico (8).
- 2026-10-18 — `refactor/estrutura-modules`: refactor(front): estrutura por módulos (modules/ + base plana em src/). Arquivos: infra (5), outros (1), front (36), front/rotas-layouts (10), modules/auth (2), modules/fechamento (10), modules/obras (6), modules/relatorio-mensal (5).
- 2026-10-18 — `feat/ajustes-relatorio-shell`: feat: voltar ao hub em toda tela da obra, hover escuro na sidebar, ajustes do relatório mensal. Arquivos: backend (4), testes backend (1), front/app (4), features/relatorio-mensal (1), front (4).
- 2026-10-16 — `feat/relatorio-mensal`: (sem commits ainda; descreva o que está staged). Arquivos: front/app (2), features/relatorio-mensal (5), front (1).
- 2026-10-16 — `chore/e2e-chrome-mac13`: e2e/captures: use installed Google Chrome on macOS 13 (Playwright 1.64 ships no browsers there). Arquivos: docs (1), front (1), infra (2).
- 2026-10-16 — `chore/e2e-chromium`: e2e: default to Chromium (Playwright has no WebKit on macOS 13); WebKit opt-in via PW_BROWSER. Arquivos: infra (1), docs (1), front (1).
- 2026-10-16 — `chore/execucao-noturna`: Night runs on the Mac: noite.sh (preflight, limits, resume, push+PR), guard hooks, launchd template, ciclo-tela night mode. Arquivos: infra (6), outros (2), docs (1).
- 2026-10-16 — `chore/plano-limpeza`: docs: PLAN-09 pós-merge — Fechamento ✅ (linha única), lacunas consolidadas, decisão de aprovação em Decisões.
- 2026-10-16 — `feat/fechamento`: feat(fechamento): tela Fechamento do cliente (medições, itens e aprovação); test: fechamento (cliente) — unitários, e2e de aprovação e mock de captura; fix(fechamento): tabelas responsivas no celular, texto neutro de aprovação, 409 amigável, limpa cache ao sair; test: fechamento reteste (texto neutro, 409 amigável, tela estreita, limpeza de cache ao trocar sessão); test: fechamento remove testes de tela estreita (sistema é desktop-only); docs: relatório da manhã do Fechamento + status no PLAN-09. Arquivos: docs (7), front (9), front/app (2), features/fechamento (10).
- 2026-10-16 — `feat/backend-aprovacao-cliente`: Backend: aprovação de medição só pelo cliente (política `ClientOnly`), UPDATE condicional por status (409), testes HTTP. Mesclado (PR #1). Pendente: B3 (DTO reduzido ao cliente).
- 2026-10-16 — `chore/design-somente-web`: Design check is desktop-only (SPEC §10): drop 390px requirement, use 1440/1280. Arquivos: infra (3), docs (1), front (1).
- 2026-10-16 — `chore/relatorio-manha`: Morning report: template with metrics, written by ciclo-tela on finish or stop. Arquivos: infra (1), outros (1), docs (1).
- 2026-10-16 — `chore/design-sistema`: Design reference: anonymize CREA and invoice numbers; Design system from the engineer's prototype: theme, app shell, base components, design guide, reference captures, design-reviewer in the loop. Arquivos: infra (8), outros (1), docs (18), front (15), front/app (5), features/obras (3).
- 2026-10-16 — `chore/design-referencia`: Design reference: anonymized prototype HTML in docs/design. Arquivos: outros (1), docs (2).
- 2026-10-16 — `chore/loop-agentes`: Loop builder↔tester: ciclo-tela skill, tester report contract, builder fix mode. Arquivos: infra (4), outros (1).
- 2026-10-15 — `chore/padroes-componentes`: Frontend conventions: explicit oxlint config, shared/interfaces, component structure rule. Arquivos: infra (2), outros (1), front (14), front/app (4), features/auth (1), features/obras (6).
- 2026-10-14 — `chore/skill-tela-shadcn`: Skill nova-tela-frontend: shadcn/ui guidance and Skeleton loading state. Arquivos: infra (1), front (2), features/obras (1).
- 2026-10-14 — `chore/revisao-infra`: Review of Claude infra: slim root CLAUDE.md, shadcn/ui setup, auth to shared/, gaps moved to PLAN-09. Arquivos: infra (2), outros (1), front (17), front/app (4), features/auth (1), features/obras (1).
- 2026-10-14 — `chore/registro-upsert`: Registro: one line per branch (upsert); agents resolve hook blocks on their own. Arquivos: infra (6), outros (1), front (1).
- 2026-10-14 — `chore/plano-automatico`: trava de commit (`.githooks/pre-commit`) exige este plano em mudanças de tela/rota/endpoint/schema; `npm run plano:registro` gera a linha do Registro a partir do git. Arquivos: infra (6), outros (1), front (2).
- 2026-10-14 — `feat/hub-cliente`: Hub do cliente (lista de obras, 4 estados), 27 testes. Navbar ainda
  não existe (layout só tem o cabeçalho).
- 2026-10-13 — Esqueleto: login, sessão, guardas de rota por papel, cliente de API, 22 testes.
