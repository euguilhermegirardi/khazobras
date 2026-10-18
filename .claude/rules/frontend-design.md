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
2. Monte com os componentes da lista "Padrão → componente". Faltou um padrão? Crie em `src/components/`
   seguindo o protótipo (e registre no PLAN-09), não estilize à mão dentro do módulo.

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

## Estrutura (já pronta em `layouts/shell/`, não recriar)

- Sidebar branca 210px: logo "Khaz Obras", Hub no topo, **bloco da obra (azul)** e **bloco da empresa
  (verde, só admin)**. Item novo: `layouts/navigation.ts`, na ordem do SPEC.
- Topbar branca fixa; conteúdo em fundo cinza (`bg-background`) com `p-5`.
- Toda tela começa com `PageSection` (título 18px + descrição opcional + ações à direita).
- **Navegação comum a várias telas mora no `AppShell`**, nunca dentro de uma página (ex.: o "← Minhas obras"
  de volta ao hub aparece em toda tela da obra). Precisa de algo assim? Mude o shell, não copie por página.
  Voltar específico da tela (ex.: detalhe → lista) fica na página.

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

Textos com data: use os helpers de `utils/dates.ts`. Mês em **título** = `formatMonthYearTitle`
("Setembro de 2026"); nunca a classe `capitalize` (deixa "De" maiúsculo). Em frase, `formatMonthYear` (minúsculo).

Raios: card `rounded-xl` (12px); botão, input, KPI, alerta `rounded-md` (8px); badge `rounded-full`.
Tipografia (fonte do sistema, base 14px): título de página `text-lg font-medium`; título de card 13px
cinza (`CardTitle`); tabela 13px com cabeçalho 11px; KPI 22px semibold; rótulos 11px; botão 12px.
Espaçamento: `gap-3`/`gap-3.5` entre cards e KPIs; `mb-3.5` entre blocos.

## Padrão do protótipo → componente

| Protótipo | Usar |
|---|---|
| `.card` + `.card-title` (com ícone) | `Card` + `CardTitle` (`components/ui/card`) |
| `.kpi-grid` / `.kpi.blue` etc. | `div.grid gap-3 sm:grid-cols-2 lg:grid-cols-4` + `KpiCard tone="info"` |
| `.badge-green/amber/red/blue/gray` | `Badge variant="success\|warning\|danger\|info\|neutral"` |
| `.bar-track/.bar-fill` + `.progress-label` | `ProgressBar` (`components/`) |
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

Mapas de rótulo e de cor ficam no `constants.ts` do módulo (ex.: `OBRA_STATUS_BADGE`).

## Diferenças deliberadas do protótipo

- Texto terciário (`#888780`) não passa contraste AA em texto pequeno: use `text-muted-foreground`;
  `text-subtle-foreground` só em texto grande/decorativo.
- Bordas de 1px (o protótipo usa 0,5px) e ícones Lucide no lugar de Tabler.
- Tema escuro segue o sistema operacional (`prefers-color-scheme`), como no protótipo.
- **Hover da sidebar** (pedido do Guilherme, 18/10): fundo escuro e texto claro (`--sidebar-hover`, verde no bloco
  da empresa com `--sidebar-hover-empresa`). O protótipo usa cinza claro; não "corrija" de volta.

## Checklist visual (o design-reviewer usa esta lista)

1. Moldura: tela dentro do `AppShell`, começa com `PageSection`, item ativo certo na sidebar, "← Minhas obras"
   presente (telas da obra).
2. Mesma composição da captura de referência: ordem de alertas → KPIs → cards/tabelas.
3. Componentes da tabela acima (nada de HTML estilizado à mão para card, badge, tabela, aba, alerta).
4. Cores só por token e pelo mapa de status; nenhuma cor fixa (`blue-600`, `#185FA5`).
5. Tipografia e raios da seção Tokens; números alinhados à direita em tabelas de valores.
6. Estados carregando/vazio/erro com a mesma moldura e o mesmo visual (Skeleton, vazio tracejado, `ErrorState`).
7. Estados de interação: passe o mouse nos itens da sidebar e nos botões (hover) e navegue com Tab (foco
   visível). Captura estática não mostra isso: confira no código as classes `hover:`/`focus-visible:`.
8. Datas em título no formato "Setembro de 2026" (sem "De" maiúsculo).
8a. Tabelas: altura de linha uniforme. Célula de ação (botão-ícone) e o "—" de quando não há ação ocupam a
   mesma altura; compare linhas com e sem ação na captura.
8c. Texto dentro de linhas e células com respiro: nada encostando na borda da linha vizinha nem cortado.
8d. Legenda = elemento: cada cor/forma da legenda é exatamente a usada no gráfico/timeline (mesmo token, mesma
   opacidade), e nenhuma cor de série coincide com a cor de um status diferente.
8e. Gráficos e timelines cabem na largura do card em 1440 e 1280 quando o intervalo é normal (~12–18 meses);
   rolagem horizontal dentro do card só como último recurso. Compare onde os dados terminam com onde a
   captura corta.
8b. A sidebar é `sticky h-screen`: na captura de página inteira a faixa dela termina na altura do viewport. Igual
   ao protótipo; não é falha.
9. Desktop web: confira em 1440px e 1280px (notebook) e no tema escuro. **Sem mobile** (SPEC §10: sistema
   desktop-only) — não reporte nem corrija quebra em larguras de celular.
