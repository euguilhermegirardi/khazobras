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
| 5 | Financeiro (somente leitura) | ✅ lançamentos `visivel_cliente` + download de comprovante (presos à obra no SQL) | ✅ | `feat/financeiro`. Só a visão Lançamentos (tabela paginada + download de comprovante); Resumo/Por categoria e parcelas dependem de Contratos. 21 testes + 3 e2e. 1 rodada (segurança: PATCH de visibilidade e detalhe presos à obra). **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac antes do merge.** Relatório: `docs/relatorios/2026-10-18-financeiro.md` |
| 6 | Cronograma (sem Curva S) | ✅ `GET /obras/{id}/etapas` (detalhe preso à obra no SQL) + `percentualConcluido` (script 008; edição pelo Gantt admin) | ✅ | `feat/cronograma` (empilhada sobre `feat/financeiro`). Linha do tempo mensal + 4 KPIs, com % concluído ao lado da barra (desde `feat/etapas-admin`); 18 testes + 15 da timeline + 3 e2e. 1 rodada (design: largura, respiro, cores da legenda). **Backend não compilado na nuvem.** Relatório: `docs/relatorios/2026-10-18-cronograma.md` |
| 7 | Projetos | ✅ `GET /obras/{id}/projetos` + `GET /projetos/{id}/download` (liberado ao cliente da obra, preso à obra no SQL) | ✅ | `feat/projetos` (empilhada sobre `feat/cronograma`). Cards por etapa, Visualizar (PDF/imagem, nova aba) e Baixar; 219 testes na suíte + 4 e2e. 2 rodadas (design: colunas alinhadas; segurança: só PDF/imagem abrem). **Backend não compilado na nuvem.** Relatório: `docs/relatorios/2026-10-19-projetos.md` |
| 8 | Contratos | ✅ `GET /obras/{id}/contratos` (cliente: DTO reduzido com `totalPago`/`saldoAPagar`) + `GET /contratos/{id}` (com pagamentos) | ✅ | `feat/contratos` (empilhada sobre `feat/medicoes-admin`, PR #17; mesclar depois dele; sem script SQL). Front feito: `modules/contratos`, rota `/cliente/obras/:obraId/contratos` (somente leitura). Falta: testes (tester), design e segurança. Contrato em "Decisões" (Contratos, backend e front). **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac** |
| 9 | Dashboard | ✅ `GET /obras/{id}/dashboard` (DTO único `DashboardClienteResponse`: avanço físico, prazo, valores contratado/medido, avanço por etapa, medido por mês) | ✅ | `feat/dashboard-cliente` (empilhada sobre `feat/contratos`, PR #18; o PR terá base `main` e dirá "mesclar depois do #18"; sem script SQL). Front feito: `modules/dashboard`, rota `/cliente/obras/:obraId` (4 KPIs + "Avanço por etapa" + gráfico "Custo acumulado — todos os meses" com Recharts; somente leitura). Falta: testes da tela (tester), design e segurança. Contrato em "Decisões" (Dashboard do cliente, backend e front). **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac** |

Navbar do cliente cresce uma entrada por tela entregue (ordem do SPEC §5).

## Telas admin/master (SPEC §6)

Começam depois da visão cliente. Prioridade provável: Medições (criar e emitir NF), Financeiro (edição
e flag `visivel_cliente`), Relatórios. Primeira entregue: o Gantt editável (pedido do Guilherme: etapas deixarem de ser
sempre "Não iniciada").

| # | Tela | Backend pronto? | Status | Branch / observação |
|---|---|---|---|---|
| A1 | Hub admin ("Meus projetos", SPEC §6 item 1) | ✅ `GET /obras` (admin/master: todas, paginado) | ✅ | `feat/etapas-admin`. Mesma `ObraHubPage` do cliente (props `title`/`description`/`emptyMessage`/`obraPath`), em `/admin`; clicar abre `/admin/obras/:obraId`. Paginação (50 por página) só se `totalItems > pageSize`. Falta: criar/editar obra, avanço % no card (SPEC), Dashboard da obra (placeholder "em construção"). Relatório: `docs/relatorios/2026-10-19-etapas-admin.md` |
| A2 | Gantt editável (SPEC §6 item 5) | ✅ `GET /obras/{id}/etapas`, `POST /etapas`, `PUT /etapas/{id}` (script 008) | ✅ | `feat/etapas-admin`, `modules/etapas-admin`, rota `/admin/obras/:obraId/gantt`. Tabela + Dialog de edição/criação (RHF + zod). Sem excluir etapa, sem "Orçado R$"/"Observação" (não existem no modelo), sem "Imprimir Gantt". 112 testes + 8 e2e; design e segurança sem bloqueio. **Aplicar o script 008 no Mac; backend não compilado na nuvem.** Relatório: `docs/relatorios/2026-10-19-etapas-admin.md` |
| A3 | Medições (SPEC §6 item 7: criar, acompanhar status, emitir NF) | ✅ `POST /medicoes`, `GET /obras/{id}/medicoes/resumo` (paginado), `GET /medicoes/{id}`, `POST /medicoes/{id}/issue-invoice` (branch `feat/medicoes-admin`; sem script SQL) | ✅ | `feat/medicoes-admin`, `modules/medicoes-admin`, rotas `/admin/obras/:obraId/medicoes` (lista) e `.../medicoes/:medicaoId` (detalhe + emitir NF). Falta: testes da tela (tester), design e segurança. **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac.** Contrato em "Decisões" (Medições, backend e front) |
| A4 | Contratos (SPEC §6 item 9: criar contrato, registrar pagamento) | ✅ `POST /contratos`, `GET /obras/{id}/contratos`, `GET /contratos/{id}`, `POST /contratos/{id}/pagamentos` + `GET /obras/{id}/medicoes/resumo?status=invoice_issued` (seletor) | ✅ | `feat/contratos`, `modules/contratos-admin`, rota `/admin/obras/:obraId/contratos`. Lista de cards + "+ Novo contrato" + "Registrar pagamento" (RHF + zod). Sem editar/excluir (backend não tem). Falta: testes (tester), design e segurança. Contrato em "Decisões" (Contratos, front) |
| A5 | Financeiro — edição completa (SPEC §6 item 8: lançamentos, flag `visivel_cliente`, anexos) | ✅ backend (`feat/financeiro-admin`, sem script SQL): `GET /obras/{id}/financeiro/lancamentos` (admin: todos + filtros), `GET .../financeiro/resumo`, `GET /financeiro/categorias`, `POST/PUT/DELETE /financeiro/lancamentos[/{id}]`, `PATCH` de visibilidade (unitário e em lote), `POST/DELETE` de anexo | ✅ | Front feito: `modules/financeiro-admin`, rota `/admin/obras/:obraId/financeiro` (item "Financeiro" entre Medições e Contratos). KPIs internos, tabela com seleção e lote, flag por linha, novo/editar com comprovantes, exclusão com confirmação. Falta: testes da tela (tester), design e segurança. Contrato em "Decisões" (Financeiro admin, backend e front) e em `backend/docs/API.md`. **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac** |
| A6 | Relatório fotográfico (SPEC §6 item 11: criar/editar relatório, upload e gestão das fotos) | ✅ backend (`feat/fotos-admin`, empilhada sobre `feat/financeiro-admin`, PR #20; o PR terá base `main` e dirá "mesclar depois do #20"; sem script SQL): `GET /obras/{id}/relatorios-fotograficos` (com `quantidadeFotos`), `POST/PUT/DELETE /relatorios-fotograficos[/{id}]`, `POST /relatorios-fotograficos/{id}/fotos`, `PATCH /fotos/{id}`, `DELETE /fotos/{id}`, `PATCH /relatorios-fotograficos/{id}/fotos/ordem` | 🟨 | Front feito: `modules/relatorio-fotografico-admin`, rotas `/admin/obras/:obraId/relatorio-fotografico` (lista) e `.../:relatorioId` (gerenciador de fotos). Falta: testes da tela (tester), design e segurança. Contrato em "Decisões" (Relatório fotográfico admin, backend e front) e em `backend/docs/API.md`. **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac** |
| A7 | Projetos (SPEC §6 item 12: upload e gestão dos documentos técnicos) | ✅ backend (`feat/projetos-admin`, empilhada sobre `feat/fotos-admin`; sem script SQL): `GET /obras/{id}/projetos`, `POST /obras/{id}/projetos?etapaId&tipoDocumento` (multipart), `PUT /projetos/{id}` (nome, tipoDocumento, etapaId), `DELETE /projetos/{id}`, `GET /projetos/{id}/download` | ✅ | `feat/projetos-admin`: `modules/projetos-admin`, rota `/admin/obras/:obraId/projetos`, item "Projetos" depois de Relatório fotográfico no `ADMIN_NAV.obra`. Tester, design e segurança verdes (2 rodadas de correção). Relatório: `docs/relatorios/2026-10-21-projetos-admin.md`. Contrato em "Decisões" (Projetos admin, backend) e em `backend/docs/API.md`. **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac** |
| A8 | Relatório ao cliente (SPEC §6 item 13: edição + histórico) | ✅ backend (`feat/relatorio-admin`, empilhada sobre `feat/projetos-admin`, PR #22; sem script SQL): `GET /obras/{id}/relatorios-mensais` (admin: todos), `POST /relatorios-mensais`, `PUT /relatorios-mensais/{id}` (competência + conteúdo, só rascunho), `DELETE /relatorios-mensais/{id}` (só rascunho), `POST /relatorios-mensais/{id}/publish`, `GET /relatorios-mensais/{id}/historico` | ⬜ | Backend pronto, falta a tela (`modules/relatorio-mensal-admin`, rota `/admin/obras/:obraId/relatorio-ao-cliente`, item depois de Projetos no `ADMIN_NAV.obra`). Contrato em "Decisões" (Relatório ao cliente, backend) e em `backend/docs/API.md`. **Backend não compilado na nuvem: `dotnet build` + `dotnet test` no Mac** |

## Lacunas de backend que bloqueiam telas

Ao implementar uma, removê-la daqui e atualizar a tabela de telas. Faltam (provavelmente com script `009_*.sql`+):

- Contratos (backlog, o módulo está pronto: ver Decisões): sem editar/excluir contrato nem pagamento (estorno/correção),
  sem upload/download do documento do contrato (`storage_key` sem uso), sem aditivos, sem paginação do detalhe, sem unicidade
  de pagamento por medição, e a auditoria é gravada depois do `INSERT`, fora da transação (como nas medições).
  Security-reviewer (20/10, baixas): `POST /contratos/{id}/pagamentos` sem idempotência (reenvio após queda de rede grava dois
  pagamentos iguais e infla o total pago; `Idempotency-Key` ou aviso no front, decisão de negócio); os testes HTTP usam
  repositório falso, então o SQL real (`INSERT ... SELECT`, filtros por obra) não é coberto por teste automático
  (integração com Postgres); `GET /obras/{id}/contratos` devolve array puro, sem paginação.
  Decisão em aberto: o KPI "Saldo a pagar" da obra soma os saldos com sinal (um contrato pago a mais abate o saldo de outro);
  confirmar com o engenheiro se o esperado é esse ou somar só os saldos positivos.
- Obras (security-reviewer 19/10, baixas): `GET /obras` sem limite de `pageIndex`/`pageSize` (negativo → 500); lista do cliente
  com N+1 e sem paginação (trocar por um JOIN com `user_obra`); front sem validar `obraId` como GUID antes de montar a URL da API.
- Auditoria: medições, contratos/pagamentos, financeiro (editar, excluir, visibilidade, remover anexo) e relatório fotográfico (editar,
  excluir, editar/remover/reordenar foto), projetos e relatório mensal (criar, editar, excluir, publicar) gravam `log_auditoria`. Os demais endpoints de escrita (inclusive
  `PUT /etapas`) ainda não gravam; plugar com o mesmo `LogAuditoriaService.RegistrarAsync`.
- Dashboard do ADMIN: KPIs internos (custo real, margem), Curva S, Rentabilidade, comparativo entre obras — bloqueia o
  Dashboard admin (`AdminObraDashboardPage` segue placeholder). O dashboard do CLIENTE está pronto (ver Decisões).
  Backlog do dashboard do cliente: sem integração com Postgres nos testes (os HTTP usam repositório falso, então o SQL de
  `DashboardClienteRepository` não é coberto por teste automático); `diasRestantes` usa fuso fixo UTC-3 (sem tabela de fusos).
  Security-reviewer (20/10, informativo): o peso das etapas pode ser estimado por um cliente que cruze várias leituras de
  `avancoFisicoPercentual` e `percentualConcluido` (não é custo nem margem; confirmar com o engenheiro se o peso é confidencial);
  `etapas.status` sai em snake_case, fora da convenção PascalCase do front (só consistência de contrato).
  Visual (design-reviewer): o card do gráfico fica com ~70px de espaço vazio no fim quando o card de etapas é mais alto
  (opcional: subir a altura do gráfico para ~340px).
- Medições (backlog, o resto do módulo está pronto: ver Decisões): `GET /obras/{id}/medicoes` do cliente segue array puro
  (sem paginação) e não traz unidade, qtd. contratada, medido anterior nem saldo (colunas do protótipo; não existem no
  schema); sem editar/excluir medição nem itens; sem unicidade de número de NF; a auditoria é gravada depois do UPDATE, fora
  da transação (falha ao gravar = 500 com a medição já alterada).
- Financeiro (backlog, o backend do admin está pronto: ver Decisões): sem lixeira/soft delete (exclusão é definitiva); sem
  auditoria de `POST /financeiro/lancamentos` nem de upload de anexo; sem CRUD de categorias (tabela `categorias` sem uso,
  `categoria_id` nulo; exigiria script novo); lote só por ids (sem "liberar tudo do filtro"); o limite de 10 anexos pode estourar
  em 1 sob corrida de uploads simultâneos fora do `INSERT` condicional (aceito); os testes HTTP usam repositório falso, então o SQL
  novo (filtros, resumo, lote, exclusão) não é coberto por teste automático (integração com Postgres).
  Achados baixos do security-reviewer (20/10, sem ação agora):
  - B1 corrida no limite de 10 anexos: o `COUNT` dentro do `INSERT ... SELECT` não trava nada, então dois uploads simultâneos podem
    passar de 10. Correção: `SELECT ... FOR UPDATE` do lançamento numa transação, ou `pg_advisory_xact_lock(hashtext(lancamento_id))`.
  - B2 lote de visibilidade não é totalmente tudo-ou-nada se um dos lançamentos for excluído ao mesmo tempo, e o `statusAnterior`
    da auditoria do PATCH unitário pode sair errado (leitura antes do UPDATE, sem trava). Correção: `FOR UPDATE` + transação.
  - B4 exclusão definitiva: se a auditoria falhar (gravada fora da transação, padrão do projeto), os arquivos ficam no R2 e o
    lançamento já foi apagado sem trilha. Correção: auditoria dentro da transação ou limpeza do R2 antes da auditoria.
  - B6 404 x 403 revela a existência de um id (aceito, como nos outros módulos).
  - Harness (verificar): o padrão `COUNT` dentro do `INSERT` e CTE sem `FOR UPDATE` também pode existir em outros módulos
    (Medições, Contratos); varrer quando mexer neles. **Fotos e Projetos já foram varridos** (limite e lote com
    transação + `FOR UPDATE`/`FOR NO KEY UPDATE` na linha pai). O B1 do Financeiro (10 anexos) segue aberto: aplicar o mesmo padrão lá.
- Projetos (backlog, o backend do admin está pronto: ver Decisões): sem lixeira na exclusão; sem substituir o arquivo (re-enviar e
  excluir o antigo; se um dia existir, travar a linha com `FOR UPDATE` antes de ler a chave do R2); sem versionamento/revisões; sem
  paginação (no máximo 200 por obra); sem DWG/ZIP (exigiria estender o `FileUploadValidator` com magic bytes); `.docx/.xlsx` seguem com
  checagem fraca (ZIP renomeado passa; lacuna aceita no V1); `tipoDocumento` é texto livre (sem lista fechada, decidir com o engenheiro) e
  vai na **query string** do upload (texto pode parar em log de acesso/proxy; avaliar mover para campo do multipart junto com o front);
  o tamanho do arquivo não é gravado (a lista não mostra KB/MB); a auditoria é gravada depois do `INSERT`/`UPDATE`/`DELETE`, fora da
  transação (falha = 500 com a alteração feita; no `DELETE` o R2 é limpo mesmo assim); os testes HTTP usam repositório falso, então o SQL
  novo (`FOR NO KEY UPDATE`, `UPDATE/DELETE ... RETURNING`) só roda com Postgres de verdade; a corrida do limite de 200 não é testável sem
  banco (o fake só simula o resultado); `GET /obras/{id}/projetos` de obra inexistente devolve `[]` para Admin/Master.
- Relatório fotográfico (backlog, o backend do admin está pronto: ver Decisões): sem unicidade por mês/etapa (o schema 005 não tem
  `UNIQUE`; exigiria índice novo e decisão de produto) e sem rascunho/publicação (cliente vê tudo, como o schema permite); `tipo =
  etapa` não exige `etapaId` e `tipo = mensal` não exige `competencia` (decidir com o engenheiro antes de endurecer); sem lixeira na
  exclusão; `GET /obras/{id}/relatorios-fotograficos` sem paginação (traz todas as fotos de todos os relatórios); sem miniaturas (a
  imagem inteira é baixada em cada card); upload de uma foto por requisição (o front sobe várias em sequência); o nome do arquivo
  não é gravado (só a extensão entra na chave), então o front não consegue mostrar o nome original; auditoria de criar relatório e de
  enviar foto não existe (só editar/excluir/reordenar/remover; avaliar gravar `relatorio_fotografico_criado` e `foto_enviada`);
  `descricao` e `dataFoto` do upload vão na query string (`POST /relatorios-fotograficos/{id}/fotos?descricao=...`): texto livre
  pode parar em logs de acesso/proxy; avaliar mover para campos do multipart (muda backend e front juntos); os testes HTTP usam
  repositório falso, então o SQL novo (`FOR UPDATE`, `unnest`, `UPDATE ... CASE`) só roda com Postgres de verdade.
- Relatório ao cliente (backlog, o backend do admin está pronto: ver Decisões): sem despublicar (o SPEC não pede; decisão de produto: o cliente já pode
  ter lido), sem versões do texto (o histórico é a auditoria: quem/quando/quais campos, nunca o texto anterior; guardar versões exigiria tabela
  nova `relatorios_mensais_versoes`, script 009), sem "publicado por" como coluna (sai do histórico), sem lixeira na exclusão do rascunho,
  sem notificar o cliente ao publicar (a tela "Notificar cliente" é separada), texto puro sem formatação (negrito, listas) nem anexos/fotos
  no relatório, sem modelo de relatório; `GET /obras/{id}/relatorios-mensais` devolve array puro (no máximo um por mês, limitado pelo `UNIQUE`),
  com o texto inteiro de cada um (até 20000 caracteres); a auditoria é gravada depois da escrita, fora da transação (falha = 500 com a
  alteração feita; mesma lacuna de Medições, Contratos, Financeiro, Fotos e Projetos); os testes HTTP usam repositório falso, então o SQL novo
  (`INSERT ... SELECT ... ON CONFLICT DO NOTHING`, `UPDATE/DELETE ... WHERE status = 'draft' RETURNING`) só roda com Postgres de verdade;
  relatórios antigos com `competencia` fora do dia 1 continuam como estão (só os novos e os editados são normalizados);
  `GET /relatorios-mensais/{id}/historico` não tem paginação (até 100 registros).
- Categorias (CRUD); Empresa / equipe (Administração) — telas admin
- PUT/PATCH/DELETE nos módulos que ainda não têm (Financeiro já tem); `GET /users/{id}`, desativar usuário — telas admin
- Envio real de e-mail / WhatsApp nas notificações
- Integração do `LogAuditoria` nas ações dos demais módulos (estrutura pronta; plugada só em Medições)
- PDF consolidado (Fase 10)

## Decisões

- Token em `sessionStorage` (V1). Sem refresh; sessão expira em 8h.
- Componentes: **shadcn/ui** (Tailwind 4, tema por variáveis CSS em `src/index.css`), código em `src/components/ui/`.
  Instalados: Button, Card, Badge, Skeleton, Table, Tabs, Alert (+ Dialog, Input, NativeSelect). Recharts 3.10.1 (fixa, de
  25/07/2026) entrou com o Dashboard do cliente.
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
  `{guid}-{nome}` seguem legíveis); `Content-Disposition` fixo `foto-{fotoId}{ext}`.
- Financeiro, download de comprovante (18/10, correção do security-reviewer): `GET /financeiro/anexos/{id}/download` agora
  resolve só o `obra_id` (`GetObraIdByAnexoIdAsync`), valida `EnsureAccessAsync` e busca o anexo numa consulta única
  `WHERE a.id = @AnexoId AND l.obra_id = @ObraId AND (@SomenteVisiveisCliente = FALSE OR l.visivel_cliente)` (cliente com
  lançamento oculto = 404; só então lê do R2). Upload novo grava `{guid}{ext}` sem o nome original (`NomeArquivo` segue no
  DTO e no `Content-Disposition`). Testes: `Http/FinanceiroAnexoDownloadTests`. Escrito na nuvem sem .NET: validar com
  `dotnet build` e `dotnet test`.
- Financeiro, rodada 1 do security-reviewer (18/10): `GET /financeiro/lancamentos/{id}` e `PATCH .../visibilidade` agora
  resolvem o `obra_id` → `EnsureAccessAsync` → consulta/UPDATE presos a `id + obra_id` (+ visibilidade no SQL para o cliente;
  oculto = 404). Listagem valida `pageIndex >= 0` e `pageSize` 1..100 (400 `{ message }`), offset em `long` e anexos da página
  numa consulta só (`ANY(@Ids)`). Download de comprovante envia `X-Content-Type-Options: nosniff`. Testes:
  `Http/FinanceiroLancamentoAcessoTests`. Sem .NET na nuvem: validar com `dotnet build` e `dotnet test`.
- Projetos, backend (18/10): `GET /projetos/{id}/download` resolve `obra_id` → `EnsureAccessAsync` → `WHERE id AND obra_id` →
  só então R2; liberado ao cliente da obra (outra obra 403, inexistente 404). `Content-Type` pela extensão, `nosniff`,
  `Content-Disposition` com o nome do documento (nome vazio/com `/`, `\` ou controle → `projeto-{id}{ext}`). Upload: etapa
  informada precisa ser da mesma obra (400, antes do R2), chave nova `{guid}{ext}`. Lista ordena por `etapas.ordem` (sem etapa
  por último), depois `uploaded_at desc`, `nome`. O front busca com token (fetch → blob), como nas fotos. Testes:
  `Http/ProjetoDocumentoAcessoTests`. Sem .NET na nuvem: validar com `dotnet build` e `dotnet test`.
- **Etapas, atualização (backend pronto e tela admin feita na branch `feat/etapas-admin`: ver "Gantt editável" abaixo).**
  **Aplicar o script 008 no Mac antes de rodar a API:** `psql -d khazobras_db -f database/schema/008_etapas_percentual_concluido.sql`
  (coluna `percentual_concluido` + CHECK de status; seguro: todas as etapas existentes são `nao_iniciada`).
  `PUT /etapas/{id}` (`AdminOrMaster`): resolve `obra_id` (404) → `EnsureAccessAsync` (403) → validação (400) →
  `UPDATE ... WHERE id AND obra_id` → 200 com `EtapaResponse`. `EtapaResponse` ganhou `percentualConcluido` (avanço físico;
  o cliente vê). Regras: nome ≤150, ordem ≥1, peso e % 0..100, fim ≥ início (previsto e real); `nao_iniciada` = 0% sem datas
  reais; `em_andamento` = 0..<100% com início real e sem fim real; `concluida` = 100% com início e fim reais (100% só com
  `concluida`). `POST /etapas` segue criando 0% / `nao_iniciada`. **Sem DELETE de etapa no V1** (FKs de medições, relatórios
  fotográficos e projetos). `EtapaRepository.GetByIdAsync` (sem filtro de obra) removido. Testes: `Http/EtapaAtualizacaoTests`.
  Sem .NET na nuvem: validar com `dotnet build` e `dotnet test`.
- Etapas, varredura do módulo (18/10, antes do Cronograma): `GET /etapas/{id}` resolve `obra_id` → `EnsureAccessAsync` →
  `WHERE id = @Id AND obra_id = @ObraId`; `POST /etapas` checa acesso à obra antes de validar o corpo; a lista ordena por
  `ordem, data_inicio_prevista NULLS LAST`. `EtapaResponse` não expõe nada interno. "% concluído" segue como lacuna (sem
  schema novo). Testes: `Http/EtapaAcessoTests`. Sem .NET na nuvem: validar com `dotnet build` e `dotnet test`.
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
- Financeiro (cliente, front): rota `/cliente/obras/:obraId/financeiro`, item "Financeiro" (ícone `Wallet`) na sidebar logo
  depois de "Fechamento" (SPEC §5). V1 = só a visão **Lançamentos**, somente leitura (sem edição, checkbox, pagador, "Novo
  lançamento"/"Importar"). **Sem "Resumo" e sem "Por categoria"**: "Valor contratado" depende de Contratos (lacuna) e
  "Custo realizado" é custo real (regra 7); nenhum total chamado "custo" é exibido. Tabela: Data, Competência
  (`formatMonthYearTitle`), Categoria (badge neutro: Mão de obra/Material/Equipamento), Descrição, Valor (BRL, direita,
  `tabular-nums`), Comprovante (botão de clipe por anexo com `aria-label="Baixar comprovante <nome>"`; sem anexo = "—").
  Download: `apiDownload` (Bearer -> blob) + `utils/download.saveBlob` (link temporário `download`, object URL revogado);
  botão desabilitado enquanto baixa; erro aparece em `Alert` sem derrubar a tabela. Paginação do servidor (20 por página,
  `keepPreviousData`): Anterior/Próxima, "Página X de Y", "N lançamentos". Sem filtro de mês (o backend não filtra por mês;
  filtrar só a página atual enganaria). `categoria` chega em PascalCase (`ItemTipo.ToString()` => `MaoDeObra`); o mapa de
  rótulos aceita também snake_case por segurança. Tipo `LancamentoCliente` omite `createdByUserId`/`visivelCliente`.
- Cronograma (cliente, front): rota `/cliente/obras/:obraId/cronograma`, item "Cronograma" (ícone `CalendarDays`) entre
  "Dashboard" e "Fechamento" (SPEC §5). Sem Curva S, sem Gantt editável, sem exportar/importar, sem botão de escrita.
  **% concluído (atualizado em `feat/etapas-admin`, antes era "sem %"):** o backend passou a mandar `percentualConcluido`;
  a barra prevista mostra o "80%" ao lado (depois da barra; antes dela se ela termina a mais de 90% da grade; fundo `bg-card`
  para a linha de Hoje não cortar o texto) e o texto acessível da barra termina em ", 80% concluído". `percentualPeso` segue
  fora da tela do cliente. KPIs: Etapas totais, Concluídas, Em
  andamento, Não iniciadas (contagem por status exato; status desconhecido entra só no total). Linha do tempo **mensal** do
  mês da menor data ao mês da maior (previstas e reais; sem nenhuma data = só o mês de hoje), cabeçalho "Mar/26" (`formatMonthYearShort`),
  meses de largura flexível (esticam para ocupar o card; mínimo 48px, então ~12 meses cabem em 1440 e 1280 sem rolar; posições
  das barras e do "Hoje" em %), rolagem horizontal só dentro do card e só quando nem o mínimo cabe (`overflow-x-auto`), colunas
  Etapa + Situação fixas (`sticky left-0`, 336px), linhas de 64px (3 linhas de texto com respiro igual). Barra grossa = período **previsto** (data final inclusiva, mín. 6px); período **real** = segunda barra fina
  logo abaixo em `bg-foreground` (cor que não é de nenhum status; mesma classe na legenda) (só quando há início e fim reais) mais a linha de texto "Real: ..." na coluna da etapa (só início: "iniciada em",
  só fim: "concluída em"). Cor por status via token (success/info/neutral) + legenda; **situação também em texto** (Badge na
  coluna Situação) e período por extenso na coluna da etapa, então nada depende só de cor. Status desconhecido = neutro com o
  texto cru. Etapa sem as duas datas previstas: sem barra, texto "Sem datas previstas". Marcador "Hoje" (linha de 2px `bg-danger`, mesma classe na legenda) e
  "Hoje: dd/mm/aaaa" no cabeçalho do card só se o mês de hoje está na grade. Acessibilidade: barras `role="img"` com
  `aria-label` "<nome>: previsto de dd/mm/aaaa a dd/mm/aaaa, <situação>" (real: "<nome>: realizado de ... a ..."); área
  rolável é `role="region"` rotulada. Hoje é fixado na montagem da página (`useState`). Tipo `EtapaCronograma extends Etapa`
  (`interfaces/etapa.ts`); chave de cache própria `['obra', obraId, 'cronograma']`. Helpers novos em `utils/dates.ts`:
  `formatMonthYearShort`, `monthIndex`, `monthIndexToDateOnly`, `monthPosition`, `dayFractionOfMonth` (com teste).
- Projetos (cliente, front): rota `/cliente/obras/:obraId/projetos`, item "Projetos" (ícone `FolderOpen`) como último da sidebar
  (depois de "Relatório mensal", ordem do SPEC §5 item 9). Só projetos técnicos: **sem abas** Todos/Projetos/Contratos/Fotos
  (o SPEC não tem "Documentos" no navbar do cliente), sem área de upload, sem botão de escrita. Um `Card` por etapa (título =
  nome da etapa via `GET /obras/{id}/etapas`) na ordem do backend; sem etapa = card final "Documentos gerais"; etapa que não
  pôde ser nomeada (etapas falharam) = "Outros documentos" (erro de etapas não derruba a tela; enquanto carregam, a tela
  mostra o Skeleton para o título não piscar). Tabela: Nome (ícone lucide por extensão: `FileText` pdf, `Image` imagens,
  `FileSpreadsheet` xls/xlsx, `File` outros), Tipo (badge neutro com `tipoDocumento`, "—" se null), Enviado em (dd/mm/aaaa),
  Ações. Sem coluna Tamanho (o backend não devolve). Ações: **Baixar** sempre (`apiDownload` -> `utils/download.saveBlob`) e
  **Visualizar** só para PDF e imagens (decidido pela extensão de `nome`): o blob autenticado vira object URL aberto em **nova
  aba** (`window.open(url, '_blank', 'noopener')`, novo `utils/download.openBlobInNewTab`, URL revogado após 60 s). Escolhi
  nova aba (e não `ImageDialog`) para PDF e imagem usarem o mesmo caminho e o leitor nativo do navegador; nunca URL do bucket.
  `openBlobInNewTab(blob, fileName)` só abre `application/pdf` e `image/(jpeg|png|webp|gif)` pelo `blob.type`; outro tipo
  (vazio, `text/html`, `image/svg+xml`) cai em `saveBlob` (security-reviewer, rodada 2). Pop-up: mantido `window.open` com
  `noopener` após o fetch (abrir `about:blank` no clique e navegar depois exigiria dispensar `noopener`; não vale o risco
  nem a mudança de contrato). Limitação: se o navegador bloquear pop-up, nada abre (com `noopener` o `window.open` sempre devolve `null`). Altura da linha
  fixa (`h-7`) com ou sem "Visualizar". Colunas com largura fixa e igual em todos os cards (`table-fixed`: Nome 40%, Tipo 20%,
  Enviado em 15%, Ações 25% à direita), para não "dançarem" entre cards empilhados. Durante a ação os botões daquele item ficam desabilitados; erro (403 = sem permissão)
  vira `Alert` sem derrubar a lista. Tipo `ProjetoDocumento` (`interfaces/projeto.ts`). Mudança na base: `useEtapas` saiu de
  `modules/relatorio-fotografico` para `hooks/useEtapas.ts` (mesma chave `['obra', id, 'etapas']`), porque Projetos também o usa
  (módulo não importa módulo). Agrupamento puro em `modules/projetos/agrupar.ts`.
- **Medições, backend** (`feat/medicoes-admin`, 19/10; sem script SQL; escrito na nuvem sem .NET: validar com `dotnet build` e
  `dotnet test`). Resolve o B3 e prepara a tela admin A3.
  - **Padrão de acesso em todos os endpoints:** resolve só o `obra_id` (404) → `EnsureAccessAsync` (403) → leitura/escrita
    com `WHERE id AND obra_id` (inclusive os dois `UPDATE` condicionais) → validação do corpo (400) → regra de estado (409).
    `issue-invoice` passou de `RequireAuthorization()` + checagem manual para a política `AdminOrMaster` + `EnsureAccessAsync`.
    `POST /medicoes` agora checa o acesso à obra do corpo **antes** de validar. `MedicaoRepository.GetByIdAsync` (sem obra) removido.
  - **B3:** cliente recebe `MedicaoClienteResponse` (= `MedicaoResponse` sem `approvedByUserId`) em `GET /obras/{id}/medicoes`
    (continua array puro), `GET /medicoes/{id}` e `POST /medicoes/{id}/approve`. Admin/Master seguem com `MedicaoResponse`
    completo. Custo real/margem: não existem em `medicoes`/`medicao_itens`; `valorUnitario`/`valorTotal` dos itens são o
    medido/cobrado do cliente (previsto/contratado), então nada a esconder; qualquer campo novo de custo exige DTO separado.
  - **Criar** (`POST /medicoes`, `AdminOrMaster`) → 201 `MedicaoResponse` + `Location`. Body `{ obraId, etapaId?, numero,
    competencia "yyyy-MM-dd", itens: [{ tipo "mao_de_obra"|"material"|"equipamento", descricao ≤255, quantidade > 0,
    valorUnitario ≥ 0 }] }`. Validações: numero 1..100000; competência 2000..2100; 1..200 itens; quantidade e valor com no
    máximo 2 casas e dentro de NUMERIC(12,2)/(14,2); soma cabe em NUMERIC(14,2). O total (item e medição) é **calculado no
    servidor** (arredonda 2 casas), o corpo não aceita total. Obra inexistente = 404; `etapaId` de outra obra ou inexistente =
    400 `{ errors: { EtapaId: [...] } }`; número repetido na obra = 409 `{ message }` (também na corrida, pela violação do UNIQUE).
  - **Lista de acompanhamento (admin):** `GET /obras/{obraId}/medicoes/resumo?pageIndex=0&pageSize=20&status=` (`AdminOrMaster`),
    `{ totalItems, pageIndex, pageSize, items }`, mais nova primeiro, `pageIndex >= 0` e `pageSize` 1..100 (400 `{ message }`),
    `status` opcional em snake_case (`pending_approval|approved|invoice_issued`, senão 400). Item: `id, obraId, etapaId,
    etapaNome, numero, competencia, valorTotal, status (PascalCase), quantidadeItens, createdAt, approvedAt, nfIssuedAt, nfNumber`.
    O nome da etapa vem de JOIN preso à mesma obra. O detalhe com itens é `GET /medicoes/{id}`. Itens da lista do cliente
    e do admin agora vêm numa consulta só (`ANY(@Ids)`, sem N+1).
  - **Emitir NF** (`POST /medicoes/{id}/issue-invoice`, `AdminOrMaster`) body `{ nfNumber }` (obrigatório, ≤50, sem
    caracteres de controle; 400 `{ errors: { NfNumber: [...] } }`); só a partir de `approved` (senão 409 `{ message }`); 200
    `MedicaoResponse` completo.
  - **Auditoria (SPEC §8):** `MedicaoService` grava em `log_auditoria` (`LogAuditoriaService`, sem schema novo) com
    `entidade = "medicao"`, `entidade_id` = id da medição, `user_id` = usuário do token e ação `medicao_criada`,
    `medicao_aprovada` ou `medicao_nf_emitida`. `detalhes` só com `obraId`, `numero`, `statusAnterior`, `statusNovo` (sem
    valores, descrições nem número de NF). Gravada depois do `UPDATE`, fora da transação (backlog: atomicidade).
  - **Para o front:** o tipo `Medicao` do cliente continua válido (omite `approvedByUserId`; o backend agora também omite).
    Tela admin deve usar `/resumo` para a tabela e `GET /medicoes/{id}` para o detalhe; listar etapas pelo `etapaNome`.
  - Testes: `Http/MedicaoAdminTests`, `MedicaoValidatorTests`, rotas novas em `WriteEndpointsAuthorizationTests`;
    `FakeLogAuditoriaRepository` novo; `FakeMedicaoRepository` com a API presa à obra (mantém atalhos sem obra para os testes antigos).
- **Contratos, backend** (`feat/contratos`, 19/10; sem script SQL: usa as tabelas do script 004; escrito na nuvem sem .NET:
  validar com `dotnet build` e `dotnet test`). Absorve "Pagamentos" (SPEC §5 item 6, §8). Detalhe dos contratos em `backend/docs/API.md`.
  - **Padrão de acesso em todos os endpoints:** resolve só o `obra_id` (404) → `EnsureAccessAsync` (403) → leitura/escrita
    com `WHERE ... AND obra_id` → validação do corpo (400) → regra de estado (409). `POST /contratos` checa o acesso à obra do corpo
    **antes** de validar (cliente = 403 pela política `AdminOrMaster`, mesmo com corpo inválido).
  - **Endpoints:** `POST /contratos` (201 + `Location`; número único por obra = 409, inclusive na corrida pela UNIQUE),
    `GET /obras/{obraId}/contratos` (array puro), `GET /contratos/{id}` (contrato + pagamentos por data desc),
    `POST /contratos/{id}/pagamentos` (201, `Location` = contrato). Sem `PUT`/`DELETE` no V1.
  - **Cliente (DTO reduzido):** `{ id, obraId, numero, valorContratado, dataAssinatura, totalPago, saldoAPagar }`; no detalhe,
    `pagamentos: [{ id, referenteMedicaoId, referenteMedicaoNumero, valor, dataPagamento, formaPagamento }]`. Sem `createdAt`,
    `updatedAt`, `contratoId`, `storageKey`. Ele vê o que **pagou** (valor recebido pela empresa, não custo); nenhuma coluna de
    custo/margem entra nas consultas (teste varre o JSON do cliente por "custo"/"margem"). **A `storage_key` não é exposta a
    ninguém** (nem ao admin): sem upload, ela não tem uso.
  - **Totais:** `totalPago` = `SUM(pagamentos.valor)` no SQL (`LEFT JOIN` + `GROUP BY c.id`, uma consulta para a lista toda);
    `saldoAPagar` = `valorContratado - totalPago`, **pode ser negativo** (não se impede pagamento acima do contratado:
    adiantamentos/aditivos). O front deve tratar saldo negativo (ex.: "pago a mais").
  - **Pagamento:** `valor` > 0 (2 casas, ≤ NUMERIC(14,2)); `dataPagamento` de 2000 até **hoje + 1 dia (UTC)** — decisão: já foi
    recebido, então data futura é erro de digitação, e o dia a mais cobre fuso; `formaPagamento` ≤ 50 (livre, vazio = null);
    `referenteMedicaoId` opcional: precisa ser da **mesma obra** e estar `invoice_issued` (SPEC §8), senão 400
    `errors.ReferenteMedicaoId` com mensagem única (inexistente, de outra obra e sem NF são indistinguíveis). A regra também está
    no próprio `INSERT ... SELECT` (contrato da obra + medição da obra com NF), então não há janela entre checar e gravar.
    Várias parcelas por medição são aceitas.
  - **Auditoria (SPEC §8):** `LogAuditoriaService`, `user_id` = token. `contrato_criado` (`entidade "contrato"`, `detalhes`
    `{ obraId, numero, valorContratado }`) e `pagamento_registrado` (`entidade "pagamento"`, `detalhes` `{ obraId, contratoId,
    valor, referenteMedicaoId }`). Decisão: o valor entra no payload por ser auditoria financeira (diferente das medições, que só
    gravam ids/status); o log é lido só pelo Master.
  - **Para o front:** o Financeiro do cliente pode compor "Valor contratado", "Pago" e "Saldo" só com `GET /obras/{id}/contratos`
    (somar entre contratos no front) e as parcelas com `GET /contratos/{id}` (`pagamentos`); a tela Contratos (cliente) usa os
    dois. `referenteMedicaoNumero` vem das leituras (no 201 do pagamento é `null`).
  - Testes: `Http/ContratoAcessoTests`, `ContratoValidatorTests`, rotas novas em `WriteEndpointsAuthorizationTests`;
    `FakeContratoRepository` novo (espelha o SQL: preso à obra, SUM, UNIQUE e o INSERT condicional).
- **Medições (admin, front)** (`feat/medicoes-admin`, 19/10): item "Medições" (ícone `Ruler`) em `ADMIN_NAV.obra` depois de "Gantt
  editável". **Lista** `/admin/obras/:obraId/medicoes`: tabela paginada (20/página, `keepPreviousData`, `components/Pagination`)
  com Nº (link para o detalhe), Competência (`formatMonthYearTitle`), Etapa (`etapaNome` ou "—"), Itens, Valor total (BRL),
  Status (Badge: "Aguardando aprovação do cliente" warning / "Aprovada — emitir NF" success / "NF emitida" info), Nº da NF e três
  datas (criada, aprovada, NF emitida; "—" quando não há, para a altura da linha ser uniforme; células sem quebra de linha, NF
  incluída, mas o Nº da NF trunca com `title`, pois aceita até 50 caracteres; tabela `table-fixed` + `colgroup` (880px fixos com padding de 6px por célula: NF 112, Competência 128; Etapa flexível e truncada, ≥ ~118px em 1280) para caber em 1280 sem rolar, e o "← Voltar" do detalhe tem a altura do botão para o cabeçalho não pular entre status). Filtro por status
  (`NativeSelect` -> `status=`; trocar volta à página 1). **KPIs** (Total, Aguardando aprovação, Aprovadas aguardando NF, NF
  emitida) = 4 consultas a `/resumo` com `pageSize=1` lendo `totalItems` (1 sem filtro + 1 por status): é a contagem da obra
  inteira, sem baixar páginas e sem somar só a página; se uma falhar, o KPI mostra "—" e a tabela segue. **Criar**: `Dialog`
  largo (`sm:max-w-5xl`) com RHF + zod + `useFieldArray` (`medicaoForm.ts`, campos como texto; regras do
  `CreateMedicaoRequestValidator`: número 1..100000, competência `<input type="month">` 2000..2100, 1..200 itens, descrição ≤255,
  quantidade > 0 e valor ≥ 0 com até 2 casas, soma ≤ limite da coluna). Número padrão = `max(maior número da página, total) + 1`
  (a lista é por criação, não por número; é só sugestão, o 409 cai no campo número). Etapa opcional via `hooks/useEtapas`
  (falhar não bloqueia). Totais do item e geral são **só prévia** (soma em centavos inteiros; o servidor recalcula; o body não
  leva total). Erros: 400 `Itens[0].Tipo` -> `itens.0.tipo` (campo da linha), `Numero`/`Competencia`/`EtapaId` -> campo, `Itens` ->
  mensagem da lista, o resto + 403/404/500 em `Alert` (500 com `requestId`); 409 no campo número. Sucesso: fecha, `Alert` de
  sucesso, volta ao filtro "todos" página 1 e invalida lista/totais/detalhe + `['obra', id, 'medicoes']` (Fechamento do cliente).
  **Detalhe** `/admin/obras/:obraId/medicoes/:medicaoId`: cabeçalho (competência + etapa pelo nome via `useEtapas`), KPIs
  (valor, itens, status, criada em), faixa por status ("Aguardando aprovação do cliente" sem ação: **admin não aprova**;
  "Aprovada em ... Emita a NF" + botão "Emitir NF"; "NF nº X emitida em ..."), tabela de itens somente leitura. `approvedByUserId`
  não está no tipo nem é exibido. Emitir NF: `Dialog` com `nfNumber` (RHF + zod: obrigatório, ≤50, sem `\p{Cc}`), 400 `NfNumber` no
  campo, 409/403/404/500 em `Alert`; `onSettled` invalida (inclusive no 409). Sem editar/excluir medição (backend não tem).
  Medição de outra obra na URL = "não encontrada nesta obra". Base: `utils/medicaoItem.ts` (`ITEM_TIPO_LABEL`, que o Fechamento
  agora re-exporta); `interfaces/medicao.ts` ganhou `MedicaoResumo`, `CreateMedicao*Request`, `IssueInvoiceRequest` e o comentário
  de `Medicao` foi corrigido (o cliente nunca recebe `approvedByUserId`). Impacto no Fechamento: nenhum no código (o tipo já omitia
  o campo); o mock do `Fechamento.test` ainda manda o id para provar que não aparece, o que continua válido como defesa.
- **Contratos (cliente e admin, front)** (`feat/contratos`, 20/10). Item "Contratos" (ícone `FileSignature`) na sidebar do cliente
  depois de "Financeiro" (SPEC §5 item 6) e em `ADMIN_NAV.obra` depois de "Medições". Rotas `/cliente/obras/:obraId/contratos`
  (`modules/contratos`, só leitura) e `/admin/obras/:obraId/contratos` (`modules/contratos-admin`).
  - **Base compartilhada** (módulo não importa módulo): `components/ContratoCard` (número, data de assinatura ou "Data de
    assinatura não informada", dl com Valor contratado/Pago/Saldo, `ProgressBar` do pago, slot de ações e de conteúdo),
    `ContratosKpis` (Valor contratado total / Total pago / Saldo; **só renderiza com 2+ contratos**), `PagamentosSecao` (4 estados)
    e `PagamentosTabela` (Data, Valor à direita `tabular-nums`, Forma truncada com `title`, "Medição nº N" ou "—"; 4 colunas,
    `table-fixed` + `colgroup` mesmo assim, para as colunas não "dançarem" entre cards); `interfaces/contrato.ts` (tipo do
    cliente sem `createdAt`/`updatedAt`/`contratoId`; o do admin estende); `utils/contrato.ts` (`somarContratos` em centavos,
    `saldoExibicao`, `percentualPago`) e `utils/decimal.ts` (`parseDecimal` subiu de `medicoes-admin/medicaoForm`, que re-exporta).
  - **Saldo negativo** = rótulo "Pago a mais" com o valor sem sinal, em `text-danger` (KPI e card); saldo positivo "Saldo a pagar" em
    `warning`. A barra marca 100% só com saldo quitado (arredonda para baixo; 99,6% mostra 99%).
  - **Pagamentos: carga de todos os cards de uma vez** (cada card faz `GET /contratos/{id}` ao montar), em vez de expandir sob
    demanda: uma obra tem poucos contratos, é mais simples e não esconde pagamento. Erro/vazio/carregando são por card (não derruba a página).
  - **Chaves de cache:** cliente `['obra', id, 'contratos', 'lista'|'detalhe', cid]`; admin `['obra', id, 'contratos-admin', ...]`.
    Criar contrato/registrar pagamento invalida as duas famílias (sucesso fecha o diálogo e mostra `Alert` discreto).
  - **Novo contrato** (Dialog): número ≤50 sem caracteres de controle, valor > 0 com até 2 casas (aceita vírgula, ≤ NUMERIC(14,2)),
    data de assinatura opcional 2000..2100 (`<input type="date">`). 400 `errors` -> campo (`Numero`, `ValorContratado`,
    `DataAssinatura`; o resto em `Alert`), 409 -> campo número, 403/404/500 em `Alert` (500 com `requestId`).
  - **Registrar pagamento** (Dialog por contrato): valor > 0, data (padrão hoje; máximo amanhã, local; mínimo ano 2000, igual ao
    backend), forma opcional ≤50, medição opcional via `NativeSelect` ("Medição nº N — Competência — valor") de
    `GET /obras/{id}/medicoes/resumo?status=invoice_issued&pageIndex=0&pageSize=100`. **Limite:** só a 1ª página (100 mais novas);
    falha ao carregar não bloqueia (hint, "Sem medição"). 400 `ReferenteMedicaoId` -> campo da medição. Sem editar/excluir.
  - Testes antigos ajustados: nenhum (só o re-export de `parseDecimal` mantém `medicaoForm.test` válido).
- **Dashboard do cliente, backend** (`feat/dashboard-cliente`, 20/10; sem script SQL, sem schema novo). `GET /obras/{obraId}/dashboard`,
  `RequireAuthorization()`; padrão `EnsureAccessAsync` (cliente de outra obra ou obra inexistente para cliente = 403) → consultas
  presas a `obra_id` → 404 se a obra não existe (só Admin/Master chegam a esse 404). **DTO único** `DashboardClienteResponse`
  para qualquer papel (Admin/Master recebem o mesmo JSON; o DTO com KPIs internos vem em outra fase). Um round-trip ao banco:
  `QueryMultiple` com 4 consultas agregadas (obra, etapas, medições aprovadas por mês, pagamentos dos contratos), todas com
  `WHERE obra_id = @ObraId`. Auditoria: não (leitura). Formato (camelCase; datas `yyyy-MM-dd`; decimais como número JSON):
  ```json
  {
    "obra": { "id": "770e8400-...", "nome": "Residencial Aurora", "dataInicio": "2026-01-10",
              "dataPrevisaoTermino": "2026-12-31", "status": "EmAndamento" },
    "avancoFisicoPercentual": 70.0,
    "prazo": { "diasRestantes": 72, "dataPrevisaoTermino": "2026-12-31" },
    "valores": { "valorContratado": 100000.00, "valorMedidoAcumulado": 50000.00, "valorRestante": 50000.00, "totalPago": 12000.00 },
    "avancoPorEtapa": [
      { "etapaId": "aa0e8400-...", "nome": "Fundacao", "ordem": 1, "percentualConcluido": 100.00, "status": "concluida",
        "dataInicioPrevista": "2026-02-01", "dataFimPrevista": "2026-03-15" }
    ],
    "medidoPorMes": [
      { "competencia": "2026-08-01", "valorMedido": 30000.00, "valorMedidoAcumulado": 30000.00 },
      { "competencia": "2026-10-01", "valorMedido": 20000.00, "valorMedidoAcumulado": 50000.00 }
    ]
  }
  ```
  - **"Custo acumulado" para o cliente = `valores.valorMedidoAcumulado`**: soma de `valor_total` das medições `approved` +
    `invoice_issued` (o que ele já aprovou; custo para ELE), nunca o custo real da empresa. A API não tem campo, rótulo nem consulta
    de custo real/margem/lançamentos do financeiro (regra 7 do CLAUDE.md); o teste varre o JSON por `custo`, `margem`, `peso`,
    `storageKey`, ids de usuário e pelo valor de um lançamento semeado. `valorRestante = valorContratado − valorMedidoAcumulado`
    (pode ser **negativo**: o front mostra "Excedeu em R$ X"). `totalPago` = soma dos pagamentos dos contratos da obra (extra,
    para a tela; o rótulo "Custo acumulado" NÃO é o total pago).
  - **Avanço físico**: `Σ(percentualConcluido × peso) / Σ(peso)`, com peso negativo tratado como 0; se `Σ(peso) = 0`, média simples;
    sem etapas = 0; arredondado a **uma casa** (afastando de zero). Calculado no servidor (service) sobre as etapas já lidas,
    sem consulta extra. `avancoPorEtapa` **não traz o peso** (é critério interno de gestão), nem datas reais, nem `createdAt`;
    traz `etapaId`, `nome`, `ordem`, `percentualConcluido`, `status` (`nao_iniciada | em_andamento | concluida`) e as datas
    previstas; ordenado por `ordem` (desempate pela data de início prevista). Datas previstas podem ser `null`.
  - **Prazo**: `diasRestantes = dataPrevisaoTermino − hoje` (negativo = atrasado, 0 = vence hoje; `null` sem data de previsão).
    "Hoje" = data UTC do servidor − 3h (America/Sao_Paulo, sem horário de verão), via `TimeProvider` injetado
    (`TimeProvider.System` em produção; os testes trocam por relógio fixo). 02:00 UTC ainda é o dia anterior.
  - **`medidoPorMes`**: um item por mês de competência **que tem medição aprovada**, em ordem crescente, **sem preencher meses
    vazios** (nem zeros entre o primeiro e o último; o front completa a escala do gráfico se quiser). `competencia` é sempre o dia 1
    (`date_trunc('month')`: duas medições do mesmo mês somam numa linha). `valorMedidoAcumulado` é corrido até aquele mês e o do
    último item é igual a `valores.valorMedidoAcumulado`. Medição `pending_approval` e de outra obra nunca entram. Sem medição =
    lista vazia.
  - `obra.status` segue o mesmo formato do `GET /obras/{id}` (nome do enum: `EmAndamento | Concluida | Pausada`).
- **Dashboard do cliente, front** (`feat/dashboard-cliente`, 20/10). `modules/dashboard`, rota `/cliente/obras/:obraId` (item
  "Dashboard" da sidebar, `end`; substitui o placeholder `ClientObraPage`, removido; o do admin `/admin/obras/:obraId` segue
  placeholder). Tipos em `interfaces/dashboard.ts` (sem campos internos). Chave `['obra', id, 'dashboard']`. Título da página = nome
  da obra (enquanto carrega, "Dashboard"). Layout `lg:grid-cols-5`: "Avanço por etapa" (2 colunas) + gráfico (3), cards esticados à mesma altura (sem `items-start`).
  - **KPIs:** Avanço físico (`58,5%`, hint "Calculado a partir das etapas"); Prazo restante (`72 dias` verde + "Previsão: dd/mm/aaaa";
    `Vence hoje` âmbar; `Prazo vencido há N dias` vermelho + "Previsão era ..."; `Sem prazo definido` neutro; os textos longos em 15px
    para caber em 1280); **Custo acumulado** = `valorMedidoAcumulado`, hint "medições aprovadas" + "Pago: R$ x"; **Valor restante** com
    "de R$ contratado". Decisão: `totalPago` vai como linha secundária do card Custo acumulado (o "de R$ contratado" já ocupa o hint do
    Valor restante), e nunca como o valor principal. Restante negativo: o rótulo vira **"Acima do contratado"** e o valor sai sem
    sinal, em danger (igual ao "Pago a mais" de Contratos); zero = verde; positivo = âmbar. Regras em `kpis.ts` (puro, testado).
  - **Avanço por etapa:** linha = `ProgressBar` (nome truncado com `title` + % à direita) + `Badge` do `utils/etapaStatus` (mesmo
    tom na barra e no badge); `h-11` em todas; ordem do backend; vazio tracejado. `ProgressBar` ganhou `truncate`/`title` no
    rótulo e `gap-2` (nome longo não encosta no %).
  - **Gráfico (Recharts, `ComposedChart`):** barras `valorMedido` (`--chart-1`) + linha com pontos `valorMedidoAcumulado`
    (`--chart-3`, âmbar: sem verde/vermelho de status, legível por daltônicos); cores em `constants.ts` e usadas também na legenda
    feita à mão (8d). Eixo X `Mar/26` (`formatMonthYearShort`); eixo Y compacto em BRL (`R$ 100 mil`, `formatCurrencyCompact` em
    `utils/format`) com teto redondo de 4 intervalos (`maximoDoEixo`, evita "R$ 95 mil/190 mil"); tooltip em BRL completo; grade só
    horizontal tracejada; sem animação; altura fixa 280px; `ResponsiveContainer` com `initialDimension`. Todo mês tem rótulo até 12
    meses; acima, `interval` numérico fixo `ceil(meses/10)-1` (espaçamento regular; 30 meses = a cada 3). Meses sem medição entre o primeiro e o último são **completados no front** (`completarMeses`:
    medido 0, acumulado mantido; sem completar se o intervalo passar de 120 meses). `role="img"` + `aria-label` (período e acumulado
    final) e **tabela `sr-only`** (Mês, Medido no mês, Acumulado) fora do `img`, para leitor de tela; sem botão "Ver tabela". 1 mês =
    uma barra e um ponto; vazio = "Ainda não há medições aprovadas".
  - **Base de teste:** `test/setup.ts` ganhou um stub mínimo de `ResizeObserver` (o `ResponsiveContainer` o exige; jsdom não tem). Sem
    layout real no jsdom: o gráfico renderiza com a `initialDimension`; teste que dependa de medida é e2e. Mock de captura em
    `e2e/mocks/dashboard.json`.
  - Erros: `ErrorState` com retry (403 = "Você não tem permissão para esta ação."; 500 com requestId). Obra sem etapas/medições não é
    erro (cada card mostra o vazio). Sem status da obra na tela (a constante de rótulo mora em `modules/obras`).
  - Testes antigos afetados: nenhum falhou (placeholder do Dashboard do cliente não tinha teste).
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
- **Formatação = Prettier** (escolha do Guilherme, 19/10): ponto e vírgula, aspas simples, vírgula final, 120 colunas
  (`.prettierrc.json` na raiz), só em `frontend/` e `scripts/` (Markdown e backend fora). `npm run format` /
  `npm run format:check`; o pre-commit bloqueia arquivo staged não formatado. Motivo: um `Edit` engolia o espaço em
  `AppRoutes.tsx` e lint/typecheck não pegavam. Commit só de formatação listado em `.git-blame-ignore-revs`.

- Hub admin + Gantt editável (`feat/etapas-admin`, primeira tela admin). **Hub:** `ObraHubPage` virou reutilizável por papel
  (props `obraPath`, `title`, `description`, `emptyMessage`), `useObras(pageIndex, pageSize)` com chave
  `['obras', pageIndex, pageSize]` e `keepPreviousData`; paginação genérica em `components/Pagination.tsx` (a do Financeiro,
  `LancamentosPaginacao`, continua no módulo dele). `/admin` agora é o Hub; o item "Dashboard" do bloco da empresa (que
  apontava para `/admin`) saiu (o bloco some até as telas da empresa existirem); `AdminDashboardPage` virou
  `AdminObraDashboardPage` (placeholder em `/admin/obras/:obraId`). **Nav da obra no admin:** "Dashboard" (`end`) e "Gantt
  editável" (ícone `ChartNoAxesGantt`); o "← Meus projetos" do AppShell já volta ao `/admin` (`nav.hub`). **Gantt:** tabela
  (#, Etapa, Previsto, Real, % exec. com `ProgressBar hideLabel`, Status em `Badge` pelo mapa de status, Peso, "Editar") +
  `Dialog` único para criar e editar. Edição = `PUT /etapas/{id}` com todos os campos; criação ("+ Etapa") = `POST /etapas`
  só com nome, ordem (padrão = maior + 1), peso e datas previstas (nasce 0% / `nao_iniciada`). Formulário com RHF + zod:
  campos como texto (`etapaForm.ts` converte para número/null), regras do `UpdateEtapaRequestValidator` espelhadas num
  `superRefine` (backend é a fonte); o % sugere o status (0 → não iniciada, 100 → concluída, senão em andamento) sem travar
  o select; erro 400 `{ errors: { Campo: [msg] } }` vira mensagem no campo (chave PascalCase → camelCase), o que não casa e
  403/404/500 viram `Alert` no diálogo (500 com `requestId`). Sucesso: fecha, `Alert` de sucesso discreto na página e
  invalida `['obra', id, 'gantt' | 'cronograma' | 'etapas']` (Cronograma e Projetos/Relatório fotográfico do cliente).
  Sem excluir etapa (decisão do backend). Dinheiro não entra na tela. **Base nova:** `components/ui/dialog` (Radix Dialog,
  escrito a partir do código padrão do shadcn porque o registro estava bloqueado na nuvem; dependência
  `@radix-ui/react-dialog`), `ui/input`, `ui/native-select` (`<select>` nativo), `components/FormField` (label + controle +
  erro/dica, com `aria-invalid`/`aria-describedby`), `components/Pagination`, `utils/etapaStatus.ts` (rótulos/cores de status
  e `etapaStatusInfo`, movidos do `modules/cronograma/constants.ts`, que re-exporta) e `formatPercent` em `utils/format.ts`.
  `ProgressBar` ganhou `hideLabel` (rótulo só para leitor de tela). `EtapaCronograma` ganhou `percentualConcluido` (obrigatório)
  e `interfaces/etapa.ts` os tipos `EtapaCreateRequest`/`EtapaUpdateRequest`.
  Testes antigos ajustados por causa do campo novo/da decisão mudada: fixtures de `Cronograma.test`, `timeline.test` e
  `e2e/cronograma` (+ mock), nomes acessíveis das barras (", N% concluído"), remoção do assert "cliente não vê %" e o
  `ProtectedRoute.test` (admin em `/admin` agora vê "Meus projetos").
- **Financeiro admin, backend** (`feat/financeiro-admin`, 20/10; sem script SQL; contrato completo em `backend/docs/API.md` →
  Módulo Financeiro). Pronto para a tela admin "Financeiro — edição completa" (SPEC §6 item 8):
  - **Lista admin** `GET /obras/{id}/financeiro/lancamentos`: Admin/Master recebem **todos** (liberados ou não) no DTO completo
    (`visivelCliente`, `createdByUserId`, `anexos`); cliente, só os liberados no DTO reduzido. Filtros opcionais só do admin
    (`visivelCliente=true|false`, `categoria`, `competencia=yyyy-MM`; inválido = 400 `{ message }`), todos parametrizados no SQL
    (contagem e itens); o cliente os ignora. Ordem estável: `data_lancamento DESC, created_at DESC, id`.
  - **Resumo** `GET /obras/{id}/financeiro/resumo` (`AdminOrMaster`): `totalLancado`, `totalLiberadoCliente`, `totalNaoLiberado`,
    `quantidadeLancamentos/Liberada/NaoLiberada` num SQL agregado (`WHERE obra_id`, `FILTER`). Tem custo real: cliente = 403 (teste).
  - **Edição** `PUT /financeiro/lancamentos/{id}`: resolve `obra_id` → `EnsureAccessAsync` → valida → `UPDATE ... WHERE id AND
    obra_id`. Mesmos campos do POST **sem `obraId`** (ignorado se vier); `visivelCliente` omitido mantém o atual. 200 com DTO admin.
    Auditoria `lancamento_editado` com ids e **nomes** dos campos alterados (sem valores nem texto livre; nada alterado = sem registro).
  - **Exclusão** `DELETE /financeiro/lancamentos/{id}` (204): **hard delete**, aceito porque a única FK para o lançamento é a dos
    anexos (`ON DELETE CASCADE`, schema 003). As chaves do R2 são lidas e o lançamento apagado na mesma transação; depois os
    arquivos saem do R2 (falha no R2 não vira 500: 204 + `LogWarning`, objeto órfão). Auditoria `lancamento_excluido`
    (`quantidadeAnexos`). Decisão de produto em aberto no backlog: lixeira/soft delete, que exigiria coluna nova.
  - **Visibilidade**: o PATCH unitário audita `lancamento_visibilidade_alterada` (`statusAnterior`/`statusNovo`: `oculto`|`liberado`;
    sem registro se não mudou). **Lote** `PATCH /obras/{id}/financeiro/lancamentos/visibilidade` `{ ids, visivelCliente }`: máx. 200,
    um único `UPDATE ... WHERE id = ANY(@Ids) AND obra_id = @ObraId` que só grava se a contagem bater (tudo-ou-nada, sem transação
    explícita); id inexistente ou de outra obra = o mesmo 400 `errors.Ids` genérico, sem alterar nenhum. Um registro de auditoria por
    lançamento que mudou (`lote: true`). 200 `{ atualizados, visivelCliente }`.
  - **Anexos**: upload só de Admin/Master (já era), agora resolve a obra sem carregar o lançamento, e limita a **10 por lançamento**
    (400 `{ message }`; checagem antes do R2 e de novo no `INSERT ... SELECT ... WHERE COUNT < max`; se a corrida estourar, o arquivo
    é apagado do R2). `DELETE /financeiro/anexos/{id}` (204): anexo → obra → acesso → `DELETE ... USING ... WHERE l.obra_id` → R2;
    auditoria `lancamento_anexo_removido` (na entidade do lançamento).
  - **Categorias**: `categoria` é o enum `item_tipo` (`mao_de_obra`, `material`, `equipamento`); a tabela `categorias` do SPEC §9 não é
    usada (`categoria_id` nulo) e **não mudamos schema**. `GET /financeiro/categorias` (`AdminOrMaster`) devolve `[{ valor, rotulo }]`
    para o select. Pegadinha de contrato: **entra** snake_case, **sai** PascalCase (`MaoDeObra`); o POST/PUT aceitam os dois.
  - **Varredura do módulo (violações corrigidas)**: `POST /financeiro/lancamentos` validava o corpo **antes** do acesso e, com obra
    inexistente, dava 500 (FK) → agora acesso → validação → 404 se a obra não existe; o upload carregava o lançamento inteiro antes do
    acesso (agora `ResolveLancamentoAsync` + `WHERE id AND obra_id`); o validator aceitava valor com mais de 2 casas ou acima de
    `NUMERIC(14,2)` e datas absurdas (500 no INSERT) → limites iguais aos de Medições/Contratos (datas 2000–2100); anexos e lista com
    ordem não determinística → `ORDER BY` estável.
  - Auditoria: entidade `financeiro_lancamento` (consultável por `/auditoria/financeiro_lancamento/{id}`, Master); `user_id` = token.
    Payloads só com ids, status e nomes de campos. Gravada depois do UPDATE, fora da transação (como Medições/Contratos).
  - Testes: `Http/FinanceiroAdminTests` (lista admin x cliente, filtros, resumo 403, PUT/DELETE/lote/anexos com 403 antes do corpo,
    outra obra, 404, 400, auditoria, limite de anexos, storage falhando), `FinanceiroValidatorTests`, rotas novas em
    `WriteEndpointsAuthorizationTests`; `FakeFinanceiroRepository` espelha o SQL (preso à obra, tudo-ou-nada, limite). **Escrito na
    nuvem sem .NET: `dotnet build` + `dotnet test` no Mac antes do merge** (o SQL novo só roda com Postgres de verdade: conferir à mão
    lista com filtros, resumo, lote, exclusão e remoção de anexo).
  - **Correções do security-reviewer (20/10, achados baixos)**: (B5) removido o código morto `GetByIdAsync(id)` sem filtro de obra
    do serviço, da interface e do repositório (testes migrados para `GetByIdAndObraAsync`; o fake guarda um `GetByIdAsync` só para
    os testes inspecionarem estado). (B3) upload com nome de arquivo vazio ou maior que 255 caracteres (coluna `VARCHAR(255)`) agora
    responde **400 `{ message }`** antes de enviar ao R2 (recusa em vez de truncar, para nunca gravar um nome diferente do enviado);
    se o `INSERT` do anexo lançar exceção depois do upload, o objeto é removido do R2 e a exceção é relançada. Testes em
    `Http/FinanceiroAdminTests`. Front: tratar o 400 do upload também para nome longo (mesma forma `{ message }` do limite de anexos).
- **Relatório fotográfico admin, backend** (`feat/fotos-admin`, 20/10; sem script SQL, sem schema novo; contrato completo em
  `backend/docs/API.md` → Módulo Relatórios Fotográficos). Pronto para a tela admin (SPEC §6 item 11). Escrito na nuvem sem .NET:
  `dotnet build` + `dotnet test` no Mac antes do merge.
  - **Modelo**: `relatorios_fotograficos` (tipo `mensal|etapa`, `etapa_id`, `titulo` ≤150, `competencia`) e `fotos` (`descricao` ≤255,
    `data_foto`, `ordem`). Não há rascunho/publicação nem `UNIQUE`, então **não inventamos**: cliente e admin veem o mesmo DTO e pode
    haver vários relatórios por mês/etapa (sem 409 de duplicado). Backlog nas lacunas.
  - **Lista/detalhe** (mesmo DTO para cliente e admin): `quantidadeFotos` (computada) + `fotos[{ id, dataFoto, descricao, ordem,
    createdAt }]` **sem `storage_key`** (teste varre o JSON). Ordem estável: fotos por `ordem, created_at, id`; relatórios
    `created_at DESC, id`. Fotos de todos os relatórios numa consulta só (`= ANY(@Ids)`), no lugar do N+1 de antes.
  - **Varredura do módulo (violações corrigidas)**: `GET /relatorios-fotograficos/{id}` e o upload carregavam o relatório inteiro (com
    todas as fotos) **antes** do acesso, sem filtro de obra, e o upload tinha um `IsAdminOrMaster` redundante → agora `GetObraIdByIdAsync`
    → `EnsureAccessAsync` → `WHERE id AND obra_id`; o `GetByIdAsync(id)` sem obra foi removido da interface, do repositório e do serviço
    (o fake guarda `Inspecionar`/`InspecionarFoto` só para os testes). `POST /relatorios-fotograficos` validava o corpo **antes** do
    acesso e com obra inexistente dava 500 (FK) → acesso → validação → 404 se a obra não existe; `etapaId` não era conferido (podia ser de
    outra obra) → 400 genérico `errors.EtapaId` (inexistente = outra obra); `competencia` aceitava ano absurdo → 2000–2100.
  - **Escritas novas** (todas `AdminOrMaster`, padrão 404 → 403 → 400): `PUT /relatorios-fotograficos/{id}` (tipo, etapaId, titulo,
    competencia; a obra não troca; `relatorio_fotografico_editado` com nomes de campos), `DELETE /relatorios-fotograficos/{id}`
    (hard delete: chaves lidas e relatório apagado na mesma transação, fotos por `CASCADE`, R2 depois, falha vira aviso;
    `relatorio_fotografico_excluido`), `PATCH /fotos/{id}`, `DELETE /fotos/{id}` (`foto_removida`) e
    `PATCH /relatorios-fotograficos/{id}/fotos/ordem` (`fotos_reordenadas`). Auditoria na entidade `relatorio_fotografico` com o id do
    relatório, payload só com ids/quantidade/nomes de campos (nunca título nem descrição).
  - **Upload**: limite de **100 fotos por relatório** (400 `{ message }`), nome do arquivo > 255 → 400 **antes** do R2 (o nome nem é
    gravado, mas segue o padrão dos anexos), `descricao` ≤255, `dataFoto` 2000-01-01..amanhã, `ordem` 0..100000, tudo antes do R2.
    **`ordem` omitida = fim da lista** (antes era sempre 0, o que embaralhava a ordem em uploads em sequência). `dataFoto`,
    `descricao` e `ordem` continuam na **query string** (o endpoint já era assim). Se o `INSERT` lançar depois do upload, ou o limite
    estourar na corrida, o objeto sai do R2.
  - **Concorrência (lição do B1 do Financeiro)**: `TryAddFotoAsync` e `ReordenarFotosAsync` rodam numa transação que primeiro faz
    `SELECT ... FROM relatorios_fotograficos WHERE id AND obra_id FOR UPDATE`; só então contam/inserem/atualizam. Uploads e reordenações
    do mesmo relatório se enfileiram, então o limite de 100 não estoura. O lote é `UPDATE ... FROM unnest(@Ids, @Ordens)` preso ao
    relatório e conferido pela contagem de linhas (diferente = `ROLLBACK`, tudo-ou-nada). Limite: o `DELETE` de foto não trava o
    relatório (só diminui a contagem, é seguro para o limite); uma foto apagada durante o lote faz o lote falhar com 400.
  - **Exclusão de relatório trava antes de ler as chaves** (achado do security-reviewer): `DeleteAsync` abre a transação com o mesmo
    `FOR UPDATE` do upload e só então lê as chaves das fotos e apaga (CASCADE); sem isso um upload concorrente tinha a foto apagada
    pelo CASCADE e o arquivo ficava órfão no R2. R2 continua sendo removido só após o commit. O mesmo padrão foi corrigido em
    `FinanceiroLancamentoRepository.DeleteAsync` (trava o lançamento antes de ler as chaves dos anexos). Só roda com Postgres real.
  - **PATCH de foto parcial de verdade**: o corpo é lido como `JsonElement` (`UpdateFotoRequestParser`) para distinguir campo ausente
    (mantém) de `null` (limpa descrição/data); o SQL usa `CASE WHEN @SetX THEN @X ELSE coluna END`. `ordem` não aceita `null`.
  - **Lote de ordem**: máx. 200, ids únicos, `ordem` 0..100000; só fotos **do próprio relatório**; id inexistente, de outro relatório ou de
    outra obra dão o mesmo 400 (`errors.Fotos`). A resposta traz **todas** as fotos do relatório na nova ordem. Fotos não citadas
    não mudam (pode haver `ordem` repetida; o desempate é `created_at, id`).
  - **Download** `GET /fotos/{id}/arquivo`: agora com `X-Content-Type-Options: nosniff`. Resto igual (cliente só da própria obra).
  - Testes: `Http/RelatorioFotograficoAdminTests` (lista/detalhe, criar/PUT/DELETE, upload com limite/nome/metadados/limpeza do R2,
    PATCH/DELETE de foto, lote, 403 antes do corpo, outra obra, 404, auditoria, `storage_key` fora do JSON), `RelatorioFotograficoValidatorTests`
    (validators, `FotoRegras`, parser do PATCH), rotas novas em `WriteEndpointsAuthorizationTests`; `FotoDownloadTests` ajustado ao novo
    construtor do serviço; `FakeRelatorioFotograficoRepository` espelha o SQL (preso à obra, limite, tudo-ou-nada).
  - **Validar no Mac**: aplicar nada (sem script); rodar build + testes; conferir à mão com Postgres: upload simultâneo (2 janelas) perto
    de 100 fotos, `PATCH /fotos/{id}` com `null`, lote com foto de outro relatório, `DELETE` de relatório com fotos (R2 limpo), e a lista
    com vários relatórios (uma consulta de fotos). Front: o admin deve mandar `ordem` só ao reordenar; uploads em sequência (não em paralelo
    com a mesma `ordem`).
- **Projetos admin, backend** (`feat/projetos-admin`, 21/10; sem script SQL, sem schema novo; contrato completo em
  `backend/docs/API.md` → Módulo Projetos/Documentos). Pronto para a tela admin (SPEC §6 item 12). Escrito na nuvem sem .NET:
  `dotnet build` + `dotnet test` no Mac antes do merge.
  - **Modelo** (`projetos_documentos`, script 005): `nome` ≤255 (nome exibido e do download), `tipo_documento` ≤50, `etapa_id`, `storage_key`,
    `uploaded_at`. Não há tamanho, descrição nem autor, e **não inventamos coluna**. DTO único `ProjetoDocumentoResponse` para cliente e admin
    (`id, obraId, etapaId, nome, tipoDocumento, uploadedAt`): nada interno a esconder; teste varre o JSON (sem `storageKey`, sem `obras/`).
  - **Endpoints**: `POST /obras/{obraId}/projetos` (já existia, endurecido), `PUT /projetos/{id}` (novo), `DELETE /projetos/{id}` (novo, 204),
    lista e download inalterados no contrato. Escritas só `AdminOrMaster` (policy antes de ler o corpo: cliente = 403 mesmo com arquivo ou corpo
    inválido). Padrão do PUT/DELETE: `ResolveAsync` (404) → `EnsureAccessAsync` (403) → corpo (400) → `WHERE id AND obra_id`.
  - **PUT substitui os três campos** (`nome`, `tipoDocumento`, `etapaId`; `null` limpa tipo e etapa), em vez de PATCH parcial: o front sempre tem o
    documento inteiro e não precisa de parser de JSON. O `nome` **precisa manter a extensão do arquivo** (senão 400 `errors.Nome`): o
    `Content-Type` do download sai da extensão da **chave** do R2 (imutável), nunca do nome editável, e o nome do `Content-Disposition` cai para
    `projeto-{id}{ext}` se a extensão não bater, tem barra ou controle. Etapa de outra obra/inexistente = o mesmo 400 `errors.EtapaId`.
  - **Tipos aceitos no upload** (mais estreito que o `FileUploadValidator` genérico): `.pdf`, imagens (jpg/jpeg/png/webp/gif) e `.doc/.docx/.xls/.xlsx`.
    `.txt` saiu (sem assinatura para conferir). Quem abre no navegador do cliente é só PDF/imagem (decisão do front de Projetos cliente); o resto baixa.
    DWG/ZIP ficam no backlog.
  - **Antes do R2** (corrigido na varredura: tudo isso virava 500 com arquivo órfão): obra inexistente = **404** (antes: FK → 500), limite, etapa
    da obra, nome 1..255 sem barras/controle, `tipoDocumento` ≤50, extensão permitida. Se o `INSERT` lançar, o objeto sai do R2 e a exceção é
    relançada.
  - **Concorrência**: `TryAddAsync` abre transação, trava a obra com `SELECT id FROM obras WHERE id = @ObraId FOR NO KEY UPDATE`, conta e insere.
    **Desvio consciente do `FOR UPDATE` pedido**: `FOR UPDATE` na linha da obra bloquearia, por até a duração do upload, qualquer `INSERT` em
    tabela filha (etapas, medições...) que toma `FOR KEY SHARE` na mesma linha pela FK; `FOR NO KEY UPDATE` mantém a exclusão mútua entre
    uploads de projeto e não conflita com esses `INSERT`. Limite: **200 documentos por obra** (400 `{ message }`, como fotos e anexos; não é 409,
    que fica para transição de estado). `DELETE ... RETURNING` é atômico porque a `storage_key` nunca muda (sem substituição de arquivo), então
    não precisa de `FOR UPDATE` antes de ler a chave; comentário na interface avisa quem implementar substituição. R2 só depois do commit;
    falha vira `LogWarning`. Se a auditoria do `DELETE` lançar, o arquivo ainda sai do R2 (`try/finally`) e o 500 sobe.
  - **Auditoria** (entidade `projeto_documento`, id do documento): `projeto_enviado` (`obraId`, `etapaId`), `projeto_editado` (`obraId`, `campos`),
    `projeto_excluido` (`obraId`, `etapaId`). Nunca nome nem tipo. Gravada depois da escrita, fora da transação (como Medições/Fotos).
  - **Varredura do módulo (achados corrigidos)**: upload com obra inexistente = 500 (FK); nome >255 e `tipoDocumento` >50 = 500 depois do R2 (arquivo
    órfão); `INSERT` sem limpeza do R2; sem limite por obra; `.txt` aceito; `Content-Type` do download derivado do `nome` (agora da chave);
    `ORDER BY` sem desempate (agora `, id`); upload sem auditoria. Já corretos: download e lista (acesso por obra, `WHERE id AND obra_id`,
    `nosniff`, chave sem nome original), `EnsureAccessAsync` antes de ler o arquivo, nenhum método de repositório sem filtro de obra
    (`GetByIdAsync` solto não existia). Removido o `EtapaPertenceAObraAsync` público do serviço (virou privado; o status volta no resultado).
  - **Front**: tratar 400 `{ message }` (arquivo, nome, tipo, limite, extensão) e 400 `errors.EtapaId`/`errors.Nome` (PUT e upload). Mandar o PUT
    sempre com os três campos. Upload em sequência (um por requisição), `etapaId`/`tipoDocumento` na query com `encodeURIComponent`.
  - Testes: `Http/ProjetoAdminTests` (lista admin x cliente, upload com tipos/nome/limite/etapa/obra 404/403 antes do arquivo/auditoria/R2 limpo
    no erro e na corrida, PUT com campos/null/extensão/etapa/403 antes do corpo/404, DELETE com R2 falhando e auditoria falhando, download),
    `ProjetoValidatorTests`, rotas novas em `WriteEndpointsAuthorizationTests`; `ProjetoDocumentoAcessoTests` ajustado ao novo construtor;
    `FakeProjetoDocumentoRepository` espelha o SQL (preso à obra, obra inexistente, limite). **Validar no Mac com Postgres**: dois uploads simultâneos
    perto de 200; `PUT` e `DELETE` de documento de outra obra; `DELETE` com o R2 desligado.
- **Relatório ao cliente, backend** (`feat/relatorio-admin`, 21/10; sem script SQL, sem schema novo; contrato completo em
  `backend/docs/API.md` → Módulo Relatórios Mensais). Pronto para a tela admin (SPEC §6 item 13). Escrito na nuvem sem .NET: `dotnet build` +
  `dotnet test` no Mac antes do merge.
  - **Modelo** (`relatorios_mensais`, script 005): `competencia` DATE, `conteudo` TEXT, `status` (`draft`/`published`), `published_at`,
    `created_by_user_id`, `UNIQUE (obra_id, competencia)`. **Não inventamos coluna**: não existe "publicado por" nem versões.
  - **Histórico = auditoria** (decisão mínima que cumpre "edição + histórico"): lista de relatórios por competência (com status e `publishedAt`) +
    `GET /relatorios-mensais/{id}/historico` com criado/editado/publicado (ação, usuário e nome, data e **nomes** dos campos alterados, nunca o texto).
    Versões do texto ficam no backlog (exigiriam tabela e script 009).
  - **Endpoints**: `POST /relatorios-mensais` (corrigido), `PUT /relatorios-mensais/{id}`, `DELETE /relatorios-mensais/{id}` (204),
    `GET /relatorios-mensais/{id}/historico` (novos), `publish` (corrigido); lista e detalhe inalterados no contrato (o DTO admin ganhou
    `updatedAt`). Escritas e histórico só `AdminOrMaster` (policy antes de ler o corpo: cliente = 403 mesmo com corpo inválido).
    Padrão: `ResolveAsync` (404) → `EnsureAccessAsync` (403) → corpo (400) → 409 → SQL preso a `obra_id`.
  - **Regras**: `PUT` substitui `competencia` e `conteudo`; só rascunho (publicado = 409). `publish` de publicado = 409. Excluir publicado = 409
    (não existe despublicar). `competencia` sempre vira o **dia 1** do mês (a unicidade do schema é por data exata); mês repetido na criação ou na
    edição = **409** `{ message }`. Obra inexistente no `POST` = **404** (antes: FK → 500). Conteúdo: texto puro, 1..20000 caracteres, recusa
    controle (menos `\n \r \t`; o NUL derrubaria o INSERT) e caracteres de direção do texto (U+202A–202E, U+2066–2069); o servidor não interpreta
    HTML e o front deve exibir como texto. Competência entre os anos 2000 e 2100.
  - **Concorrência**: editar, publicar e excluir são **um comando** `UPDATE/DELETE ... WHERE id AND obra_id AND status = 'draft' RETURNING`
    (atômico, sem transação nem `FOR UPDATE`: a linha é o próprio alvo). Quando não volta linha, uma consulta `WHERE id AND obra_id` separa 404
    (não existe) de 409 (existe e não é rascunho). Criar é `INSERT ... SELECT FROM obras ... ON CONFLICT (obra_id, competencia) DO NOTHING
    RETURNING id`: obra inexistente e mês repetido não viram exceção; a corrida entre dois `POST` do mesmo mês termina em 409 para o segundo.
    No `PUT` a violação do `UNIQUE` (23505) vira 409.
  - **Auditoria** (entidade `relatorio_mensal`, id do relatório): `relatorio_mensal_criado`/`_publicado`/`_excluido` (`obraId`) e
    `relatorio_mensal_editado` (`obraId`, `campos`). Nunca o texto. Gravada depois da escrita, fora da transação (como os outros módulos).
  - **Varredura do módulo (achados corrigidos)**: `POST` validava o corpo **antes** do acesso e dava 500 em obra inexistente (FK) e em mês repetido
    (`UNIQUE`); `GET /relatorios-mensais/{id}` e `publish` liam o relatório **sem filtro de obra** (`GetByIdAsync(id)`) e o detalhe do cliente fazia
    duas leituras; `publish` era `RequireAuthorization()` com checagem de papel no corpo (o cliente via 404 em vez de 403) e a transição era
    leitura + `UPDATE` sem condição de status (corrida: duas publicações, `publishedAt` sobrescrito); a lista do admin buscava tudo e filtrava
    `onlyPublished` em memória (agora SQL); sem limite de tamanho do conteúdo, sem auditoria, `ORDER BY` sem desempate (agora `, id`). Removidos
    `GetByIdAsync(id)` e `GetPublishedByIdAsync(id)` do repositório (sem filtro por obra). Já corretos: filtro `published` no SQL e DTO do cliente sem
    `createdByUserId`.
  - **Testes**: `Http/RelatorioMensalAdminTests` (403 do cliente inclusive com corpo inválido, 401, criar/404/409/400, editar/excluir/publicar com 409,
    preso à obra no service, cliente não vê rascunho nem campos internos, histórico sem texto, auditoria sem texto livre),
    `RelatorioMensalValidatorTests`, rotas novas em `WriteEndpointsAuthorizationTests`; `FakeRelatorioMensalRepository` espelha o SQL
    (preso à obra, só rascunho, `UNIQUE`); `StateMachineTests` migrou para os métodos novos do repositório.
- **Financeiro admin, front** (`feat/financeiro-admin`, 20/10). `modules/financeiro-admin`, rota `/admin/obras/:obraId/financeiro`, item
  "Financeiro" (ícone `Wallet`) em `ADMIN_NAV.obra` **entre Medições e Contratos** (ordem do SPEC §6: 7 Medições, 8 Financeiro, 9 Contratos;
  antes o Contratos vinha logo depois de Medições). Sem Importar/Exportar, sem pagador, sem abas Resumo/Por categoria.
  - **Nomes reais do contrato** (o pedido dizia `data`/`competencia`; o DTO é `dataLancamento`/`mesCompetencia`): tipo `LancamentoAdmin extends
    LancamentoCliente` + `visivelCliente`, `createdAt` (`interfaces/financeiroAdmin.ts`; `createdByUserId` vem no JSON mas não é tipado nem exibido).
    Categoria entra snake_case (`CategoriaRequest`) e sai PascalCase; `utils/lancamentoCategoria` tem `CATEGORIA_LABEL` (subiu de
    `modules/financeiro`, que re-exporta) e `categoriaParaRequest`.
  - **Chaves de cache:** `['obra', id, 'financeiro-admin', 'lista'|'resumo', ...]`; toda escrita (criar, editar, excluir, flag unitária e em lote,
    enviar/remover anexo) invalida essa família **e** `['obra', id, 'financeiro']` (lista do cliente). Categorias: `['financeiro', 'categorias']`,
    `staleTime: Infinity`; se `GET /financeiro/categorias` falhar, o select usa as 3 categorias do enum (`CATEGORIAS_PADRAO`).
  - **KPIs** (`GET .../financeiro/resumo`): Total lançado, Liberado ao cliente, Não liberado (+ "N lançamentos"). É custo real, **só no admin**; se
    falhar (ou enquanto carrega) mostra "—" sem derrubar a tela.
  - **Tabela** (20/página, `keepPreviousData`, `components/Pagination`): checkbox, Data, Competência (`formatMonthYearTitle`), Categoria (Badge
    neutro), Descrição (truncate + `title`), Valor (direita, `tabular-nums`), Anexos (clipe + contagem; "—" sem anexo), Visível ao cliente
    (Badge "Liberado" success / "Oculto" neutro + interruptor), Ações (Editar, Excluir em botões-ícone). `table-fixed` + `colgroup`:
    **colunas fixas = 744px** (36 + 84 + 128 + 112 + 128 + 56 + 128 + 72; padding de 6px por lado) → em 1280 (998px úteis) a Descrição fica com
    **~254px** (~239px com barra de rolagem), em 1440 com ~414px; sem rolagem horizontal. Altura de linha uniforme (células de controle com `h-7`).
  - **Filtros** (visibilidade → `visivelCliente=true|false`; categoria do endpoint; competência `<input type="month">` → `competencia=yyyy-MM`):
    mudar volta à página 1 e limpa a seleção/confirmação; competência incompleta (navegador sem input de mês) não vai à API (seria 400).
  - **Flag por linha:** novo `components/ui/switch` (`role="switch"`, `aria-checked`, `loading` com spinner; escrito à mão porque `@radix-ui/react-switch`
    não está instalado e o registro do shadcn é bloqueado na nuvem; trocar pelo do shadcn quando houver acesso). `PATCH .../visibilidade`, um por vez
    (as outras linhas travam enquanto uma grava); sucesso e erro em `Alert`.
  - **Lote:** seleção só da página atual (limpa ao trocar de página/filtro e conta só o que ainda está na lista), barra "N selecionados — Liberar ao
    cliente / Ocultar do cliente / Limpar seleção", `PATCH .../lancamentos/visibilidade` (trava de 200 ids no cliente; o 400 `errors.Ids`
    tudo-ou-nada cai como mensagem genérica do servidor num `Alert`). Checkbox do cabeçalho seleciona/limpa a página (estado indeterminado).
  - **Novo/Editar** (`Dialog`, RHF + zod em `lancamentoForm.ts`, mesmas regras do `LancamentoRegras`: categoria do enum, descrição ≤255, valor > 0 com
    2 casas e ≤ 999999999999,99, datas e competência entre 2000 e 2100). **`visivelCliente` começa FALSO** com texto explicando que o cliente só vê os
    liberados; competência = `yyyy-MM` no formulário e `yyyy-MM-01` no corpo. No PUT o formulário manda a flag atual explicitamente. 400 `errors` →
    campo (`Categoria`, `Descricao`, `Valor`, `DataLancamento`, `MesCompetencia`), o resto + 403/404/500 em `Alert` (500 com `requestId`). Novo lançamento
    não tem comprovantes (precisam do id): anexar depois, em Editar. A edição usa a versão mais nova da lista (anexos enviados/removidos refletem na hora).
  - **Comprovantes (Editar):** lista (nome truncado + tamanho + data), Baixar (`apiDownload` + `saveBlob`), Remover com confirmação inline na linha
    (`DELETE /financeiro/anexos/{id}`), Enviar (`POST .../anexos` multipart, campo `file`; **`apiUpload` novo em `services/apiClient`**). Validação no
    cliente em `utils/anexo.ts`, espelhando o `FileUploadValidator`: vazio, ≤10 MB, extensão (jpg, jpeg, png, webp, gif, pdf, doc, docx, xls, xlsx, txt);
    `prepararAnexo` regrava o MIME pela extensão (o backend recusa MIME incompatível); limite de 10 por lançamento (campo travado no limite). Magic bytes
    e MIME seguem só no servidor. Erros 400 `{ message }`/403/404/500 em `Alert`.
  - **Excluir:** confirmação inline (`Alert` warning com foco em "Cancelar"): "Excluir definitivamente? Os comprovantes também serão removidos."
    → `DELETE`; se era o único item da última página, volta uma página.
  - **Base nova/movida** (módulo não importa módulo): `utils/serverErrors` (`mapServerErrors`; `contratos-admin/serverErrors` re-exporta),
    `isDataValida` em `utils/dates`, `VALOR_MAX` em `utils/decimal` (`contratoForm` re-exporta), `formatBytes` em `utils/format`, `utils/anexo`,
    `utils/lancamentoCategoria`, `components/ui/switch`. Testes unitários dos puros: `utils/anexo.test`, `utils/lancamentoCategoria.test`,
    `modules/financeiro-admin/lancamentoForm.test`.
  - **Testes antigos afetados:** `ContratosAdmin.test` ("Contratos fica depois de Medições na sidebar do admin") assume que Contratos vem logo
    depois de Medições; com o Financeiro no meio (ordem do SPEC) o assert fica obsoleto. Não editado (é do tester): trocar por "depois de Financeiro".

- **Relatório fotográfico admin, front** (`feat/fotos-admin`, 20/10). `modules/relatorio-fotografico-admin`; item "Relatório fotográfico" (ícone `Camera`)
  em `ADMIN_NAV.obra` **depois de Contratos** (SPEC §6 item 11; Rentabilidade, item 10, ainda não existe; Projetos admin virá depois).
  - **Rotas:** lista `/admin/obras/:obraId/relatorio-fotografico` e gerenciador `.../relatorio-fotografico/:relatorioId` (página, não Dialog: o
    `ImageDialog` e o Dialog do Radix disputam o foco). Detalhe lê `GET /relatorios-fotograficos/{id}`; relatório de outra obra na URL =
    "não encontrado nesta obra".
  - **Lista:** tabs Mensal/Etapa (como no cliente), cards em 3 colunas de altura uniforme (título = `tituloDoRelatorio`, badge do tipo, título digitado,
    data de registro, N fotos, "Gerenciar fotos", Editar, Excluir). Sem capa (o backend não tem miniatura: seria baixar a imagem inteira por card).
    Excluir = confirmação inline "Excluir definitivamente este relatório e suas N fotos?" (lista e detalhe). Criar/editar abre a aba do tipo salvo.
  - **Formulário (Dialog, RHF + zod):** tipo, etapa (select de `useEtapas`), título (obrigatório, ≤150), competência (`<input type="month">`, opcional,
    2000–2100). O backend **não** exige etapa no tipo `etapa` nem competência no tipo `mensal`: a UI só sugere ("Recomendado no tipo Etapa...") sem travar.
    PUT manda os 4 campos (`null` limpa). 400 por campo (`EtapaId`, `Titulo`...), 403/404/500 em `Alert` (500 com requestId). O diálogo só monta o form com as
    etapas resolvidas (select nativo não reaplica o valor se as opções chegam depois).
  - **Fotos:** grade de 4 colunas (240px no 1280, 280px no 1440; cartão 265/295px de altura, igual para todos, com/sem descrição, data ou confirmação).
    Por foto: miniatura (blob autenticado, `components/FotoMiniatura`, ampliar), descrição e data truncadas, "N de M", setas, Editar (Dialog; PATCH só com os
    campos alterados, vazio = `null`), Remover (confirmação inline na própria linha). **Reordenar** por setas (acessível por teclado; arrastar não foi feito):
    troca com a vizinha, renumera 0..n-1 e manda só as fotos cuja ordem mudou; atualização otimista no detalhe com rollback (`onError`), uma troca por vez
    (sem `disabled`, para não perder o foco), foco devolvido ao botão depois de mover, `aria-live` com a nova posição.
  - **Upload:** `<input multiple>` dentro de uma label tracejada (soltar arquivos é só atalho), validação em `utils/foto` (jpg/jpeg/png/webp/gif, ≤10 MB,
    nome ≤255, vazio; limite de 100 contando as do servidor + fila; repetido = recusado), prévia local (object URL revogado), descrição e data do **lote**, fila
    **sequencial** (um POST por arquivo; `dataFoto`/`descricao` na query, `file` no multipart; sem `ordem` = fim), progresso (`ProgressBar`), status por
    arquivo, mensagem do 400 `{ message }` na linha, "Tentar de novo (N)", "Cancelar fila" (o envio em andamento **termina**, não é abortado, porque poderia
    gravar no servidor mesmo assim; pendentes viram "cancelada"), erro 403/404/401/rede interrompe a fila e deixa o resto pendente. Ao fim da rodada invalida a lista.
  - **Cache:** lista `['obra', id, 'relatorios-fotograficos']` (a mesma do cliente) e detalhe sob o mesmo prefixo; toda escrita invalida o prefixo.
    `useRelatoriosFotograficos` subiu para `hooks/` (o `modules/relatorio-fotografico/hooks.ts` reexporta; o `api.ts` dele saiu).
  - **Base nova/movida:** `components/FotoMiniatura` (FotoThumb do cliente usa), `components/ErroAlert` + `utils/erros` (financeiro-admin reexporta),
    `utils/foto`, `utils/relatorioFotografico` (`tituloDoRelatorio`, `ordenarFotos`, rótulos), `interfaces/relatorioFotografico` (requests e `quantidadeFotos`).
    Testes unitários dos puros: `utils/foto`, `reordenar`, `uploadFila`, `fotoForm`, `relatorioForm`.
  - **Rodada 1 (tester):** `useAuthenticatedObjectUrl` deriva o object URL com `useMemo` (revoga no cleanup) em vez de `setUrl` em efeito: com 100 miniaturas
    resolvendo juntas o ciclo estourava "Maximum update depth". Sem lazy-load (o e2e espera as 100 imagens). Excluir pelo detalhe remove a query do detalhe antes de
    navegar (sem piscar 404); 400 `errors.Fotos` ao reordenar mostra a mensagem do servidor; `PageSection` limita o h1 a 2 linhas (`line-clamp-2`, `title`).
  - **Testes antigos afetados:** nenhum falhou (871 verdes). O de ordem do menu do admin só vale se não assumir que Contratos é o último item.

- **Projetos admin, front** (`feat/projetos-admin`, 21/10). `modules/projetos-admin`, rota `/admin/obras/:obraId/projetos`, item "Projetos" (ícone `FolderOpen`)
  em `ADMIN_NAV.obra` **depois de Relatório fotográfico** (SPEC §6 item 12).
  - **Base subida (módulo não importa módulo; comportamento idêntico, testes do tester intactos):** fila de upload de arquivos genérica em `utils/uploadFila`
    (tipos, `filaReducer`, `resumoFila`, `prepararItens` com `validar`/`limite`/`mensagemLimite`, `plural`) + `hooks/useUploadFila` (laço sequencial, cancelar,
    repetir, interrupção por 403/404/401/rede; recebe `enviar` e `aoTerminar`); componentes `UploadDropzone`, `UploadRecusadosAlert`, `UploadFilaPainel`,
    `UploadFilaAcoes`, `UploadItemLinha` (miniatura por slot). O módulo de fotos virou só a regra de foto (limite 100, `uploadFoto`, prévia local) sobre essa base;
    `modules/relatorio-fotografico-admin/uploadFila.ts` reexporta a base e mantém `prepararItens(fila, arquivos, jaNoRelatorio, novoId)`.
    Do cliente de Projetos: `utils/arquivoTipo` (`arquivoTipo`, `podeVisualizar`, ícones), `components/ArquivoIcone`, `utils/agruparProjetos` (títulos dos grupos de
    exceção por parâmetro) e `hooks/useProjetos` (`projetosKey`, `useProjetos`, `useAcaoProjeto`; `modules/projetos/{hooks,constants,agrupar}.ts` reexportam; o `api.ts` dele saiu).
  - **Rota e menu:** `/admin/obras/:obraId/projetos` (`ProjetosAdminPage`), item "Projetos" (`FolderOpen`) logo depois de "Relatório fotográfico" em `ADMIN_NAV.obra`.
  - **Lista:** um `Card` por etapa (mesma agregação do cliente, `utils/agruparProjetos`; sem etapa = "Sem etapa" por último; etapa que não pôde ser nomeada =
    "Etapa não identificada"), cabeçalho com o nome da etapa e "N documentos". A etapa **não é coluna** (ela é o título do card; repetir em toda linha só ocuparia
    largura). Tabela de 4 colunas `table-fixed` + `colgroup`: Nome (flexível, ícone por extensão + `truncate` + `title`), Tipo 160px (badge truncado, `title`),
    Enviado em 100px (dd/mm/aaaa), Ações 272px (Visualizar só PDF/imagem, Baixar, Editar, Excluir; botões de 28px, altura de linha uniforme de 49px com ou sem
    "Visualizar"). Contador "A obra tem N de 200 documentos" na ajuda da área de upload (um só lugar). Sem paginação (o backend entrega até 200).
  - **Visualizar/Baixar:** as mesmas ações do cliente (`useAcaoProjeto`: `apiDownload` -> blob; `openBlobInNewTab` só abre `application/pdf` e `image/(jpeg|png|webp|gif)`,
    o resto baixa); botões da linha travados durante a ação; erro em `ErroAlert` (403, 404, 500 com código).
  - **Upload:** mesmo padrão e componentes do de fotos (dropzone acessível `#upload-projetos`, fila sequencial, progresso, status por linha, mensagem do 400 na linha,
    "Tentar de novo (N)", "Cancelar fila", "Limpar finalizadas", interrupção por 403/404/401/rede). Validação no cliente (`projetoRegras`): pdf, jpg, jpeg, png, webp, gif, doc,
    docx, xls, xlsx (sem txt/dwg/zip), ≤10 MB, nome 1..255 sem `/`, `\` nem controle, vazio, repetido na fila; limite de 200 contando os da obra + fila (obra cheia
    desabilita a área). Etapa e tipo de documento valem para o **lote** (`etapaId`/`tipoDocumento` na query com `encodeURIComponent`, `file` no multipart; um POST por arquivo;
    `tipoDocumento` ≤50). Item da fila sem prévia (documento): ícone do tipo. Concordância: "2 de 3 documentos enviados" (a base aceita o particípio por prop).
    400 de campo (`errors.EtapaId`) na linha da fila vira o texto do campo (mudança na base, vale para fotos: antes "Dados inválidos."). Ao fim da rodada invalida
    `['obra', id, 'projetos']`.
  - **Editar (Dialog, RHF + zod):** nome (1..255, sem barras/controle, **mantém a extensão do arquivo**, sem diferenciar maiúsculas), tipo (≤50, vazio = `null`), etapa (select
    nativo com "Sem etapa"; "Etapa atual" se a etapa do documento não está na lista). PUT manda os três campos; nada mudou = fecha sem chamar a API; 400 por campo
    (`Nome`, `TipoDocumento`, `EtapaId`) nos campos, o resto em `ErroAlert`. O diálogo só monta o formulário com as etapas resolvidas.
  - **Excluir:** confirmação inline em faixa âmbar "Excluir definitivamente o documento <nome>?" (nome em até 2 linhas, `title`), foco em "Cancelar"; botões
    "Excluir definitivamente" / "Cancelar"; 204 -> "Documento excluído."; 404 = "Documento não encontrado. Atualize a página." e a lista é relida mesmo assim.
  - **Estados:** carregando (Skeleton em `role="status"`, enquanto lista **ou** etapas carregam), erro (`ErrorState` com requestId e "Tentar novamente"; 403 = mensagem do
    cliente da API), vazio (tracejado, com a área de upload acima), sucesso (alerta `role="status"` após editar/excluir).
  - **Medidas** (Chromium, mock normal e de estresse com 200 documentos, nomes de 255, tipo de 50, etapas de 140 caracteres, fila com nomes de 255; `e2e/mocks/projetos-admin.json` e
    `projetos-admin-estresse.json`): 1280 = Nome 464px, 1440 = Nome 624px (sobra bem acima dos 110px de 8f); colunas idênticas nos 5-6 cards; linha 49px em todas as 200; nenhuma
    célula transborda; sem rolagem horizontal da página nem das tabelas; linhas da fila 48px com nome de 255 (truncado); faixa de exclusão 123px com nome de 255; diálogo 512x413 sem transbordo.
    Sem miniaturas (documento não tem prévia), então não há carga de imagens a medir.
  - **Testes antigos afetados:** nenhum (1008 verdes). O de ordem do menu do admin só vale se Projetos for aceito depois de Relatório fotográfico.
  - **Falta (tester):** ver relatório: tela, e2e, mocks de captura; segurança (escrita) e design.

## Registro

- 2026-10-21 — `feat/projetos-admin`: feat(projetos): backend admin com PUT/DELETE, limite por obra travado, tipos restritos e auditoria; test(projetos): upload, PUT, DELETE, limite, etapa, R2 limpo, auditoria e DTO sem chave; docs(projetos): contrato da API de projetos (lista, upload, PUT, DELETE, download); docs: registro; refactor(upload): fila de envio e componentes de upload sobem para a base; fotos usa a base sem mudar comportamento; refactor(upload): 400 de campo vira texto na linha da fila e o resumo concorda com o substantivo; feat(projetos-admin): tela Projetos admin (lista por etapa, upload em fila, editar, excluir) e mocks de captura; test: projetos-admin (lista, editar, excluir, upload em fila, papel, e2e) e regressao do 400 de campo no upload de fotos; fix(etapas): useEtapas nao refaz a query em erro ao montar (evita loop de skeleton no dialogo de edicao); fix(upload): area de soltar desabilitada mantem o texto legivel (opacidade so no icone); docs: capturas da revisao de design de Projetos admin; fix(projetos): nome recusa caracteres Unicode de formatacao e rollback protegido; docs: relatorio da manha de Projetos admin. Arquivos: outros (1), backend (7), testes backend (5), docs (13), front (17), front/rotas-layouts (2), modules/projetos-admin (21), modules/projetos (5), modules/relatorio-fotografico-admin (5).
- 2026-10-20 — `feat/fotos-admin`: feat(financeiro): backend admin com edicao, exclusao, lote de visibilidade, resumo, filtros e anexos limitados, tudo preso a obra e auditado; docs: registro do financeiro admin (backend); feat(financeiro-admin): base compartilhada (switch, upload multipart, validacao de anexo, tipos, utilitarios movidos); feat(financeiro-admin): tela Financeiro admin com KPIs, tabela, flag por linha, lote, novo/editar com comprovantes e exclusao; test: financeiro-admin lista, KPIs, filtros, paginacao, papel e datas; ordem do menu em contratos-admin; test: financeiro-admin selecao, lote, interruptor por linha, novo e editar lancamento; test: financeiro-admin comprovantes (baixar, remover, enviar, limite) e exclusao de lancamento; test: financeiro-admin bordas dos utilitarios (anexo, categoria, formulario, datas no fuso de Sao Paulo); test: financeiro-admin mocks de captura (normal e estresse com 20 itens, descricoes longas e 10 anexos); test: financeiro-admin e2e (liberar, lote, criar/editar com anexo, excluir, larguras 1280/1440, acesso negado); test: financeiro-admin remove import sem uso; docs: capturas do financeiro-admin (claro, escuro, 1280, estresse); fix(financeiro): remove busca de lancamento sem filtro de obra e valida nome do anexo antes do R2; docs: relatorio da manha do Financeiro admin, status e registro; feat(fotos-admin): backend do relatorio fotografico admin (PUT/DELETE, fotos PATCH/DELETE, lote de ordem, limite, auditoria); docs: registro do backend fotos-admin; feat(fotos-admin): base compartilhada (FotoMiniatura, ErroAlert, validacao de foto, titulo e ordem do relatorio, lista na base); feat(fotos-admin): tela Relatorio fotografico admin (lista, formulario, gerenciador de fotos, upload em fila, reordenar); test: fotos-admin lista, detalhe, fotos, reordenar, upload em fila, papel, e2e e mocks de captura (normal e estresse); fix(fotos-admin): object URL derivado (100 miniaturas), sem piscar 404 ao excluir, mensagem do 400 ao reordenar, h1 limitado a 2 linhas; docs: capturas da revisao de design do relatorio fotografico admin; fix(backend): trava o pai antes de ler chaves no delete de relatorio e lancamento (evita arquivo orfao no R2). Arquivos: outros (1), backend (29), testes backend (11), docs (18), front (33), front/rotas-layouts (2), modules/contratos-admin (3), modules/financeiro-admin (23), modules/financeiro (1), modules/relatorio-fotografico-admin (29), modules/relatorio-fotografico (4).
- 2026-10-20 — `feat/financeiro-admin`: feat(financeiro): backend admin com edicao, exclusao, lote de visibilidade, resumo, filtros e anexos limitados, tudo preso a obra e auditado; docs: registro do financeiro admin (backend); feat(financeiro-admin): base compartilhada (switch, upload multipart, validacao de anexo, tipos, utilitarios movidos); feat(financeiro-admin): tela Financeiro admin com KPIs, tabela, flag por linha, lote, novo/editar com comprovantes e exclusao; test: financeiro-admin lista, KPIs, filtros, paginacao, papel e datas; ordem do menu em contratos-admin; test: financeiro-admin selecao, lote, interruptor por linha, novo e editar lancamento; test: financeiro-admin comprovantes (baixar, remover, enviar, limite) e exclusao de lancamento; test: financeiro-admin bordas dos utilitarios (anexo, categoria, formulario, datas no fuso de Sao Paulo); test: financeiro-admin mocks de captura (normal e estresse com 20 itens, descricoes longas e 10 anexos); test: financeiro-admin e2e (liberar, lote, criar/editar com anexo, excluir, larguras 1280/1440, acesso negado); test: financeiro-admin remove import sem uso; docs: capturas do financeiro-admin (claro, escuro, 1280, estresse); fix(financeiro): remove busca de lancamento sem filtro de obra e valida nome do anexo antes do R2. Arquivos: outros (1), backend (16), testes backend (7), docs (5), front (17), front/rotas-layouts (2), modules/contratos-admin (3), modules/financeiro-admin (23), modules/financeiro (1).
- 2026-10-20 — `feat/dashboard-cliente`: feat(dashboard): GET /obras/{id}/dashboard com DTO unico seguro para o cliente, 4 consultas agregadas presas a obra e relogio injetavel; docs: registro; feat(dashboard): base do grafico (recharts 3.10.1 fixa, tipos, moeda compacta, stub de ResizeObserver) e rotulo truncado na ProgressBar; feat(dashboard): tela Dashboard do cliente com 4 KPIs, avanco por etapa e grafico de custo acumulado; test: dashboard do cliente (estados, KPIs, etapas, gráfico, papéis, regra 7); test: dashboard ProgressBar (rótulo truncado) e formatCurrencyCompact; test: dashboard e2e (Chromium) e mock de estresse para captura; fix(dashboard): eixo X com passo fixo e cards da linha com a mesma altura; docs: capturas do dashboard do cliente (claro, escuro, 1280, estresse). Arquivos: outros (1), backend (6), testes backend (2), docs (6), front (12), modules/dashboard (16), front/rotas-layouts (2).
- 2026-10-20 — `feat/contratos`: feat(contratos): contratos e pagamentos com DTO reduzido ao cliente, totais no SQL, acesso preso a obra e auditoria; docs: registro; feat(contratos): telas Contratos do cliente (somente leitura) e do admin (novo contrato, registrar pagamento); docs: registro; test: contratos (cliente e admin) com Vitest + MSW; test: contratos e2e (cliente e admin) e mocks de captura; docs: capturas de contratos e contratos-admin (claro, escuro, 1280). Arquivos: outros (1), backend (17), testes backend (4), docs (6), front (13), front/rotas-layouts (2), modules/contratos-admin (14), modules/contratos (5), modules/medicoes-admin (1).
- 2026-10-19 — `feat/medicoes-admin`: feat(medicoes): DTO reduzido ao cliente, acesso preso a obra, validacao, lista admin e auditoria; docs(medicoes): API.md atualizada e registro no PLAN-09; feat(medicoes-admin): tipos do admin, rotulo de item na base e plano da tela A3; feat(medicoes-admin): lista de acompanhamento, criacao de medicao e emissao de NF; test: medicoes-admin lista, criar, detalhe, emitir NF, papel e e2e com mocks de captura; fix(medicoes-admin): passa o total da página ao MedicoesKpis e evita consulta duplicada; fix(medicoes-admin): NF sem quebra de linha na lista e link Voltar alinhado ao botao no detalhe; fix(medicoes-admin): tabela da lista cabe em 1280 com table-fixed e colgroup; fix(medicoes-admin): larguras da tabela pelo conteudo real (NF 112px com truncate+title, Competencia 128px); docs: capturas de medicoes-admin (claro, escuro, 1280). Arquivos: outros (1), backend (10), testes backend (6), docs (13), front (5), front/rotas-layouts (2), modules/fechamento (1), modules/medicoes-admin (21), infra (1).
- 2026-10-19 — `feat/etapas-admin`: feat(etapas): PUT /etapas/{id} com percentual concluido (script 008); docs: CLAUDE.md cita os scripts 001..008; feat(etapas-admin): hub admin e Gantt editável com edição de etapas; % concluído no cronograma do cliente; docs: registro; docs: registro (base feat/projetos); test: etapas-admin (hub admin, Gantt editável, zod, e2e e mocks de captura) e % no cronograma do cliente; docs: capturas do Gantt editável, hub admin e cronograma com %; docs: relatório da manhã do Gantt editável; harness: builder não apaga assert obsoleto, reporta ao tester. Arquivos: infra (1), outros (1), backend (8), testes backend (2), banco (1), docs (10), front (16), front/rotas-layouts (4), modules/cronograma (4), modules/etapas-admin (12), modules/obras (4).
- 2026-10-19 — `feat/projetos`: fix(projetos): download preso a obra e liberado ao cliente, upload valida etapa; feat(projetos): tela do cliente com documentos por etapa, visualizar e baixar; test: projetos (unit, página, e2e e mocks de captura); fix(projetos): colunas de largura fixa e igual em todos os cards; fix(projetos): visualizar só PDF/imagem pelo blob.type, espaço na rota; docs: capturas de projetos (claro, escuro, 1280); test: projetos cobre regra de tipos do openBlobInNewTab (html/svg/vazio baixam); docs: relatório da manhã de Projetos. Arquivos: backend (4), testes backend (2), docs (4), front (6), front/rotas-layouts (2), modules/projetos (10), modules/relatorio-fotografico (3).
- 2026-10-18 — `feat/cronograma`: fix(etapas): detalhe preso a obra, acesso antes da validacao no POST, ordenacao da lista; feat(cronograma): tela do cliente com KPIs e linha do tempo mensal das etapas; test: cronograma (vitest, e2e e mocks de captura); fix(cronograma): meses de largura flexível, linhas mais altas, Hoje e período realizado com a mesma cor da legenda; harness: checklist visual cobre respiro de texto, legenda igual ao elemento e timeline cabendo no card; docs: capturas do cronograma (claro, escuro, 1280); test: cronograma - testes unitarios de timeline (barBox, todayLeft, buildRange); docs: relatório da manhã do Cronograma; harness: plano:registro com --base para branch empilhada. Arquivos: infra (3), backend (4), testes backend (2), docs (4), front (5), front/rotas-layouts (2), modules/cronograma (11).
- 2026-10-18 — `feat/financeiro`: fix(financeiro): download de anexo na mesma regua do download de foto; feat(financeiro): tela do cliente com lançamentos paginados e download de comprovante; docs: registro do financeiro; test: financeiro (cliente) - vitest, e2e e mocks de captura; docs: capturas do financeiro (claro, escuro, 1280); fix(financeiro): detalhe e visibilidade presos a obra, paginacao validada, anexos em lote; fix(financeiro): altura uniforme da célula de comprovante; espaço faltando na rota; docs: relatório da manhã do Financeiro; harness: varrer o módulo no gap-filler, altura de linha no checklist visual. Arquivos: infra (2), backend (4), testes backend (4), docs (4), front (4), front/rotas-layouts (2), modules/financeiro (8).
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

### Backlog — Projetos admin (21/10, security-reviewer, todos baixos)
- Auditoria gravada fora da transação da escrita (Projetos, Financeiro, Fotos, Contratos): lacuna geral; mover para a mesma `IDbTransaction`.
- `TryAddAsync`: commit ambíguo se a conexão cair no `Commit` (R2 apagado com linha gravada); `Rollback` agora protegido por try/catch.
- Nome do documento rejeita também caracteres Unicode de formatação (U+202E etc.); o front ainda não recusa C1 (0x80–0x9F), só o servidor.
- `FOR NO KEY UPDATE` do limite de 200 sem teste em Postgres real (dois uploads concorrentes na 200ª vaga).
- Sem substituir arquivo, sem lixeira, sem versionamento, sem paginação (máx. 200).
