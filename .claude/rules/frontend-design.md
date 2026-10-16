---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/index.css"
---

# Design do frontend (aparência)

**Fonte da aparência:** o protótipo do engenheiro, `docs/design/referencia.html` (abrir no navegador), e as
capturas em `docs/design/capturas/`. **Fonte do conteúdo:** `docs/SPEC.md` §5/§6 e `docs/PLAN-09-frontend.md`.
Copie do protótipo *como as coisas parecem*; nunca *o que existe* (navbar, visões, funcionalidades, regras).

> ⚠️ A página do cliente do protótipo (`capturas/visao-cliente.png`) mostra custos reais (tabela "Custos
> mensais detalhados"). Copie só o visual. Na nossa visão cliente vale a regra 7 do CLAUDE.md: só valores
> previstos/contratados.

## Antes de construir uma tela

1. Ache a tela equivalente no protótipo (tabela abaixo) e **abra a captura** com a ferramenta Read.
2. Monte com os componentes da lista "Padrão → componente". Faltou um padrão? Crie em `shared/components/`
   seguindo o protótipo (e registre no PLAN-09), não estilize à mão dentro da feature.

| Nossa tela | Captura de referência |
|---|---|
| Hub | `hub.png` |
| Dashboard (cliente e admin) | `dashboard.png` (escuro: `dashboard-escuro.png`) |
| Cronograma | `cronograma.png` |
| Fechamento (cliente) / Medições (admin) | `medicoes.png` |
| Financeiro | `financeiro.png`, `financeiro-lancamentos.png` |
| Contratos (+ pagamentos) | `contratos.png`, `pagamentos.png` |
| Relatório mensal / Relatório ao cliente | `relatorio-cliente.png`, `visao-cliente.png` |
| Projetos, relatório fotográfico | `documentos.png` |
| RDO | `rdo.png` |
| KPIs | `kpis.png` |
| Fornecedores, Estoque, Prestadores | `fornecedores.png` |
| Administração, Gestão de usuários | `admin.png` |

Regenerar capturas: `node scripts/design-capturas.mjs`.

## Estrutura (já pronta em `app/shell/`, não recriar)

- Sidebar branca 210px: logo "Khaz Obras", Hub no topo, **bloco da obra (azul)** e **bloco da empresa
  (verde, só admin)**. Item novo: `app/navigation.ts`, na ordem do SPEC.
- Topbar branca fixa; conteúdo em fundo cinza (`bg-background`) com `p-5`.
- Toda tela começa com `PageSection` (título 18px + descrição opcional + ações à direita).

## Tokens (em `src/index.css`; nunca cor fixa)

| Uso | Classe |
|---|---|
| Fundo da página / card / KPI | `bg-background` / `bg-card` / `bg-muted` |
| Texto principal / secundário | `text-foreground` / `text-muted-foreground` |
| Azul (ação, link, ativo, "em andamento") | `bg-primary`, `text-info`, `bg-info-soft text-info-soft-foreground` |
| Verde (concluído, pago, aprovado) | `text-success`, `bg-success-soft text-success-soft-foreground` |
| Âmbar (pendente, aguardando, atenção) | `text-warning`, `bg-warning-soft text-warning-soft-foreground` |
| Vermelho (atrasado, vencendo, erro, acima do orçado) | `text-danger`, `bg-danger-soft text-danger-soft-foreground` |
| Cinza (planejado, rascunho, sem dado) | `text-neutral`, `bg-neutral-soft text-neutral-soft-foreground` |
| Gráficos (material, mão de obra, equipamento, acumulado, outros) | `var(--chart-1..5)` |

Raios: card `rounded-xl` (12px); botão, input, KPI, alerta `rounded-md` (8px); badge `rounded-full`.
Tipografia (fonte do sistema, base 14px): título de página `text-lg font-medium`; título de card 13px
cinza (`CardTitle`); tabela 13px com cabeçalho 11px; KPI 22px semibold; rótulos 11px; botão 12px.
Espaçamento: `gap-3`/`gap-3.5` entre cards e KPIs; `mb-3.5` entre blocos.

## Padrão do protótipo → componente

| Protótipo | Usar |
|---|---|
| `.card` + `.card-title` (com ícone) | `Card` + `CardTitle` (`shared/ui/card`) |
| `.kpi-grid` / `.kpi.blue` etc. | `div.grid gap-3 sm:grid-cols-2 lg:grid-cols-4` + `KpiCard tone="info"` |
| `.badge-green/amber/red/blue/gray` | `Badge variant="success\|warning\|danger\|info\|neutral"` |
| `.bar-track/.bar-fill` + `.progress-label` | `ProgressBar` (`shared/components`) |
| `.alert-amber/red/blue` (faixa com ícone) | `Alert variant="warning\|danger\|info"` |
| `.tab-bar/.tab` | `Tabs/TabsList/TabsTrigger/TabsContent` |
| `table` / `th` / `td` | `Table/TableHeader/TableRow/TableHead/TableCell` dentro de um `Card` |
| `.btn-primary` / `.btn` / `.btn-sm` | `Button` / `Button variant="outline"` / `size="sm"` |
| `.grid2` / `.grid3` | `grid gap-3.5 lg:grid-cols-2` / `lg:grid-cols-3` |
| `.upload-zone` / estado vazio | `rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground` |
| Ícones Tabler (`ti ti-*`) | equivalente do `lucide-react` (ex.: `ti-coin`→`Coins`, `ti-calendar`→`Calendar`, `ti-ruler-measure`→`Ruler`) |

## Mapa de status → cor (use sempre o mesmo)

| Cor | Status |
|---|---|
| `success` | Concluída, Aprovada, Pago, Publicado |
| `info` | Em andamento, NF emitida |
| `warning` | Pendente, Aguardando aprovação (`PendingApproval`), A pagar, Planejada |
| `danger` | Atrasado, A vencer, Vencido, Recusada |
| `neutral` | Aguardando, Rascunho, Sem início |

Mapas de rótulo e de cor ficam no `constants.ts` da feature (ex.: `OBRA_STATUS_BADGE`).

## Diferenças deliberadas do protótipo

- Texto terciário (`#888780`) não passa contraste AA em texto pequeno: use `text-muted-foreground`;
  `text-subtle-foreground` só em texto grande/decorativo.
- Bordas de 1px (o protótipo usa 0,5px) e ícones Lucide no lugar de Tabler.
- Tema escuro segue o sistema operacional (`prefers-color-scheme`), como no protótipo.

## Checklist visual (o design-reviewer usa esta lista)

1. Moldura: tela dentro do `AppShell`, começa com `PageSection`, item ativo certo na sidebar.
2. Mesma composição da captura de referência: ordem de alertas → KPIs → cards/tabelas.
3. Componentes da tabela acima (nada de HTML estilizado à mão para card, badge, tabela, aba, alerta).
4. Cores só por token e pelo mapa de status; nenhuma cor fixa (`blue-600`, `#185FA5`).
5. Tipografia e raios da seção Tokens; números alinhados à direita em tabelas de valores.
6. Estados carregando/vazio/erro com a mesma moldura e o mesmo visual (Skeleton, vazio tracejado, `ErrorState`).
7. Desktop web: confira em 1440px e 1280px (notebook) e no tema escuro. **Sem mobile** (SPEC §10: sistema
   desktop-only) — não reporte nem corrija quebra em larguras de celular.
