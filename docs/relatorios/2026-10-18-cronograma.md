---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-18
tela: Cronograma
branch: feat/cronograma
resultado: entregue
pr: (ver PR da branch)
duracao_min: 35            # sessão supervisionada na nuvem
rodadas_correcao: 1
falhas_tester: 0
falhas_design: 4           # achadas pelo maestro na captura; o design-reviewer tinha dado VERDE
achados_seguranca: 3       # todas baixas
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Cronograma (2026-10-18)

## Em uma linha
Tela pronta e revisada. **Faça o merge depois do PR do Financeiro** (esta branch é empilhada sobre ele). O backend de etapas mudou e **não foi compilado**: rode `dotnet build` e `dotnet test` no Mac.

## Precisa de você
1. **Compilar e testar o backend no Mac.** Mudaram `GET /etapas/{id}` (preso à obra no SQL), a ordem acesso → validação no `POST /etapas` e a ordenação da lista. O teste novo é `Http/EtapaAcessoTests.cs`. Se `WriteEndpointsAuthorizationTests` falhar no `POST /etapas`, a causa é a inversão de ordem.
2. **O status das etapas hoje é sempre "Não iniciada".** O backend só cria etapas com `nao_iniciada` e não existe endpoint para atualizar status, datas reais nem % concluído. A tela já trata "Em andamento" e "Concluída", mas na obra real tudo vai aparecer cinza até a tela admin de etapas existir (lacuna "atualização de etapas", no PLAN-09).
3. **% concluído por etapa** (o protótipo mostra na barra) exige uma coluna nova no banco. Decida se entra junto com a atualização de etapas (script `008_*.sql`).

## O que foi entregue
- O cliente vê as etapas da obra:
  - quatro indicadores no topo: totais, concluídas, em andamento e não iniciadas;
  - uma linha do tempo mensal com uma barra para o período previsto e uma barra fina para o realizado;
  - um marcador de "Hoje";
  - a situação e as datas por extenso ao lado de cada etapa.
- Somente leitura. Sem Curva S nem %.
- Endpoint: `GET /obras/{id}/etapas`.
- Capturas: `docs/relatorios/capturas/cronograma/tela.png` (claro 1440), `tela-escuro.png`, `tela-1280.png`.
- Suíte: 151 testes verdes, lint e typecheck ok; e2e 12/12 (3 novos desta tela).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | backend-gap-filler (varredura do módulo) | `GET /etapas/{id}` buscava só por id; `POST` validava antes do acesso | padrão obra_id → `EnsureAccessAsync` → `WHERE id AND obra_id`; acesso antes da validação |
| 0 | tester | nenhuma (VERDE, 18 testes + 3 e2e) | — |
| 0 | design-reviewer | nenhuma (VERDE) | — |
| 1 | maestro (captura) | timeline cortada em Dez/26 com dados até Fev/27 (design) | meses com largura flexível; 12 meses cabem em 1440 e 1280 |
| 1 | maestro (captura) | texto "Real: …" encostando na linha seguinte (design) | linhas de 64px |
| 1 | maestro (captura) | linha "Hoje" quase preta com legenda vermelha (design) | mesmo token e largura nos dois |
| 1 | maestro (captura) | barra realizada com o cinza de "Não iniciada" (design) | cor sem status (`foreground`) igual na legenda |
| 1 | security-reviewer | 3 baixas: `GetByIdAsync` sem uso e sem filtro de obra; 403×404 entre obras; inversão no POST sem efeito prático | registradas; remover `GetByIdAsync` antes da atualização de etapas |

Reteste do tester: VERDE (+15 testes unitários das funções da timeline). Re-revisão visual: VERDE.

## Decisões que os agentes tomaram sozinhos
- Timeline mensal (o protótipo é semanal): com obra de 12 a 18 meses, a semanal fica ilegível no card.
- Barra grossa = previsto; barra fina = realizado (só com início e fim reais). Datas parciais aparecem em texto ("Real: iniciada em …").
- Status desconhecido entra só no total e aparece cru, em cinza.
- Etapa com só uma data prevista é tratada como "Sem datas previstas".
- Item "Cronograma" na sidebar entre Dashboard e Fechamento (SPEC §5).

## Sinais para o harness
- **O design-reviewer deu VERDE com 4 falhas visíveis na captura.** Ajuste aplicado: checklist com 8c (respiro do texto), 8d (legenda igual ao elemento, nenhuma série com a cor de outro status) e 8e (gráfico cabe no card; comparar onde os dados terminam com onde a captura corta). Na re-revisão ele conferiu os itens um a um.
- **`plano:registro` em branch empilhada herdava os commits da anterior.** Ajuste aplicado: opção `--base feat/<anterior>` no script e instrução na skill `ciclo-tela`.
