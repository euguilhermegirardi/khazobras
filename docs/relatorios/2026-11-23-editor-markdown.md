---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-11-23
tela: Relatório ao cliente (admin) — editor Markdown
branch: feat/relatorio-editor-markdown
resultado: entregue
pr: (ver PR da branch)
duracao_min: 240           # sessão supervisionada na nuvem, com 2 reinícios do container
rodadas_correcao: 1
falhas_tester: 3           # bugs de produção achados nos testes adversariais (todos corrigidos)
falhas_design: 0
achados_seguranca: 2       # 1 médio (texto patológico derrubava a tela), 1 baixo (entidades bidi); corrigidos
contestacoes: 0
motivo_parada: -
suite: verde (1368 testes)
e2e: passou (89/89)
---

# Relatório da manhã — Editor Markdown do relatório (2026-11-23)

## Em uma linha
O campo "Conteúdo" do relatório ao cliente ganhou barra de ferramentas (Negrito, Itálico, Título, Lista, Lista numerada), abas Escrever/Pré-visualizar e renderização segura no Cliente. O backend não mudou.

## Precisa de você
1. **Mesclar** o PR e, no Mac: `git pull origin main`, `cd frontend`, `npm ci`, `npm test`, conferir o e2e.
2. **Testar na tela:** novo relatório, formatar com a barra e os atalhos Ctrl/Cmd+B e I, ver a Pré-visualizar, publicar e abrir como Cliente.
3. Limitações conhecidas (Ctrl+Z, publicar com texto não salvo): ver "Backlog — Editor Markdown" no `PLAN-09`.

## O que o harness pegou (e por que vale)
- **Segurança (médio):** `+ + + …` repetido (≤ 20000 caracteres, aceito pelo backend) estourava a pilha do leitor Markdown e derrubaria a SPA do Cliente; relatório publicado não se edita nem exclui. Corrigido: limite de aninhamento (6) com fallback em texto cru, ErrorBoundary no Markdown e no `Outlet`.
- **Segurança (baixo):** entidades como `&#x202E;` driblavam o filtro de caracteres de direção; removidas na exibição.
- **Testes adversariais:** linhas recuadas em 4 espaços perdiam quebras; resumo da lista quebrava com negrito+itálico e links com parênteses; e2e com `getByLabel` ambíguo.
- **Design:** aprovado, 5 detalhes estéticos no backlog.

## Decisões
- Markdown simples, sem links, imagens, tabelas nem HTML cru (`react-markdown` 10.1.0, sem `rehype-raw`, só p/br/strong/em/h2/h3/ul/ol/li).
- Relatórios antigos em texto puro continuam legíveis.
- Capturas: `docs/relatorios/capturas/editor-markdown/`.
