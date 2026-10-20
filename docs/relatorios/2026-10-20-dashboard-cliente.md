---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-20
tela: Dashboard do cliente
branch: feat/dashboard-cliente
resultado: entregue
pr: (ver PR da branch)
duracao_min: 100           # sessão supervisionada na nuvem
rodadas_correcao: 1
falhas_tester: 0
falhas_design: 2
achados_seguranca: 4       # 1 baixa, 3 informativas
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Dashboard do cliente (2026-10-20)

## Em uma linha
Dashboard do cliente pronto (4 KPIs, avanço por etapa e gráfico do custo acumulado). **Mesclar depois do #18 (Contratos), que vem depois do #17 (Medições).** O backend não foi compilado.

## Precisa de você
1. **Ordem dos merges:** #17 (Medições) → #18 (Contratos) → este PR. As branches são empilhadas e cada PR aponta para a `main`. Depois de cada merge, confira com `git log origin/main..origin/feat/<tela>` que nada ficou para trás.
2. **`dotnet build` e `dotnet test tests/KhazObras.Security.Tests` no Mac.** Sem script SQL novo. Antes do merge, rode `npm --prefix frontend install` (entrou a dependência `recharts` 3.10.1).
3. **Teste manual com Postgres real:** abrir o dashboard de uma obra com etapas, medições aprovadas e pagamentos; conferir o `valorMedidoAcumulado` contra as medições aprovadas da tela de Fechamento; conferir o cast do enum `medicao_status`, o `date_trunc` e o `QueryMultiple` (o SQL real não tem teste automático).
4. **Decisão de produto:** "Custo acumulado" do cliente = soma das medições aprovadas e com NF emitida (o que ele já aprovou), nunca custo real da empresa. "Valor restante" = contratado − medido acumulado, e fica "Acima do contratado" quando negativo. Confirme com o engenheiro.
5. **Decisão de produto:** o peso das etapas não sai na resposta, mas dá para estimá-lo cruzando leituras do avanço (informativo do security-reviewer). Se o peso for confidencial, vale pensar em arredondar ou esconder o `percentualConcluido` ponderado.
6. Visual opcional: o card do gráfico sobra ~70px no fim quando há poucas etapas ou muitas. Dá para subir a altura do gráfico para ~340px se incomodar.

## O que foi entregue
- **Tela** (`/cliente/obras/:obraId`, o item "Dashboard"): cabeçalho com o nome da obra; KPIs Avanço físico, Prazo restante ("72 dias", "Vence hoje", "Prazo vencido há N dias", "Sem prazo definido"), Custo acumulado (com "medições aprovadas" e "Pago: R$ x") e Valor restante; seção "Avanço por etapa" (badge e barra por etapa); gráfico "Custo acumulado — todos os meses" (barras do medido no mês e linha do acumulado), com tabela acessível escondida e vazio ("Ainda não há medições aprovadas").
- **Backend:** `GET /obras/{obraId}/dashboard` com um DTO único e seguro para o cliente (sem custo, margem, peso nem ids de usuário), avanço ponderado por peso no serviço, `TimeProvider` para o prazo, 4 consultas agregadas numa ida só (`QueryMultiple`), todas presas à obra.
- **Base:** `recharts` (3.10.1, versão fixa), `formatCurrencyCompact`, rótulo truncado na `ProgressBar`, stub de `ResizeObserver` nos testes.
- Capturas: `docs/relatorios/capturas/dashboard/` (claro 1440, escuro, 1280 e variante de estresse com 30 meses, acima do contratado e prazo vencido).
- Suíte: 627 testes verdes; e2e 52/52 (8 novos).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | tester | nenhuma (VERDE, 69 testes + 8 e2e) | — |
| 1 | design-reviewer | eixo X do gráfico com espaçamento irregular do último rótulo em séries longas (design) | `interval` numérico fixo |
| 1 | design-reviewer | bases dos dois cards desalinhadas (`items-start`) (design) | grid esticado |
| 1 | tester (reteste) | VERDE | — |
| 1 | design-reviewer (re-revisão) | VERDE | — |
| — | security-reviewer | nenhum médio ou acima; 1 baixa (SQL real sem teste) e 3 informativos | registrados no PLAN-09 |

## Decisões que os agentes tomaram sozinhos
- `totalPago` aparece só como linha secundária ("Pago: R$ x"), nunca como o valor de "Custo acumulado".
- O gráfico usa `--chart-1` (barras) e `--chart-3` (linha), sem verde nem vermelho, que são cores de status.
- O front completa os meses vazios entre o primeiro e o último (até 120 meses); o backend só devolve meses com medição.
- Tabela alternativa escondida (`sr-only`) em vez de botão "Ver tabela".
- O avanço físico é calculado no serviço (não no SQL), sobre as etapas já lidas, para o código real ser exercitado nos testes.

## Sinais para o harness
- **Primeira tela com gráfico:** o jsdom não desenha o svg do Recharts; a divisão ficou unitário (tabela alternativa e rótulos) + e2e no Chromium real (svg, pontos e rótulos). Vale uma regra curta em `frontend-testes` sobre isso.
- **Mock de estresse** (muitos meses, valor acima do contratado, prazo vencido) pegou o problema do eixo X que o mock normal não mostraria: adotar um segundo mock "de estresse" como padrão para telas com gráfico ou tabela longa.
- Dicas do tester: `formatCurrencyCompact` depende do ICU (Node 22 devolve "R$ 100,0 mil", Chromium "R$ 100 mil"); seletores do Recharts 3.10 para o e2e: `.recharts-xAxis-tick-labels text` e `.recharts-yAxis-tick-labels text`.
- Os testes HTTP do backend seguem usando repositório falso: o SQL de filtro por obra só é conferido por revisão manual. Item de backlog do harness: testes de integração com Postgres.
