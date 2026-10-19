---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-18
tela: Financeiro
branch: feat/financeiro
resultado: entregue
pr: (ver PR da branch)
duracao_min: 45            # sessão supervisionada na nuvem
rodadas_correcao: 1
falhas_tester: 0
falhas_design: 0           # + 1 achado do maestro na captura (altura irregular das linhas)
achados_seguranca: 6       # 2 médias (bloquearam, preexistentes no módulo) + 4 baixas
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Financeiro (2026-10-18)

## Em uma linha
Tela pronta e revisada. O backend do financeiro mudou bastante e **não foi compilado**: rode `dotnet build` e `dotnet test` no Mac antes do merge.

## Precisa de você
1. **Compilar e testar o backend no Mac.** A nuvem não tem .NET. Mudou:
   - download de comprovante, detalhe do lançamento e PATCH de visibilidade, agora presos à obra no SQL;
   - limites de paginação;
   - anexos buscados em lote com `ANY(@Ids)`, a única parte que depende do Postgres real. Abra a listagem com anexos para conferir;
   - testes novos em `Http/FinanceiroAnexoDownloadTests.cs` e `Http/FinanceiroLancamentoAcessoTests.cs`.
2. **Nome do arquivo do comprovante aparece ao cliente** (`nomeArquivo`). Se o admin subir "NF Fornecedor X.pdf", o cliente vê o nome. É decisão de produto: avisar quem sobe os arquivos ou trocar por um nome neutro.
3. **Lembrete de produto:** se o contrato da Khaz for de preço fechado, liberar um lançamento mostra custo real. Isso depende só de como o admin usa a flag `visivel_cliente`; o SPEC já registra que o modelo de contrato está a confirmar.

## O que foi entregue
- O cliente vê os lançamentos que a Khaz liberou, em uma tabela com Data, Competência ("Maio de 2026"), Categoria, Descrição, Valor e Comprovante. Clicar no clipe baixa o comprovante. A paginação é do servidor (20 por página), com estados de carregando, erro e vazio. Somente leitura.
- Endpoints: `GET /obras/{id}/financeiro/lancamentos` e `GET /financeiro/anexos/{id}/download` (Bearer → blob; nunca URL do bucket).
- Capturas: `docs/relatorios/capturas/financeiro/tela.png` (claro 1440), `tela-escuro.png`, `tela-1280.png`.
- Suíte: 115 testes verdes, lint e typecheck ok; e2e 9/9 (3 novos desta tela).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | backend-gap-filler | lacuna: download de comprovante com a segunda consulta só por id | padrão do download de foto: `obra_id` → `EnsureAccessAsync` → `WHERE a.id AND l.obra_id AND visivel_cliente` |
| 0 | tester | nenhuma (VERDE, 21 testes + 3 e2e) | — |
| 0 | design-reviewer | nenhuma (VERDE) | — |
| 0 | maestro (captura) | linhas sem comprovante mais baixas (design) | célula com contêiner de altura fixa |
| 1 | security-reviewer | **média**: PATCH de visibilidade sem `EnsureAccessAsync` e UPDATE sem `obra_id` (regra 4/9), preexistente | resolve obra → acesso → `UPDATE ... WHERE id AND obra_id` + teste HTTP |
| 1 | security-reviewer | **média**: detalhe do lançamento filtrava visibilidade em C# (regra 9), preexistente | consulta única com obra e visibilidade no SQL + teste HTTP |
| 1 | security-reviewer | baixas: paginação sem limite + anexos N+1; sem `nosniff` | 400 fora de 1..100, offset `long`, anexos em lote; `nosniff` no download |

Reteste do tester: VERDE. Re-revisão de segurança: não bloqueia. Ficaram como baixas: upload ainda carrega o lançamento inteiro antes do acesso (sem IDOR), 403×404 revela existência entre obras (GUIDs; igual ao resto), `nosniff` só neste download.

## Decisões que os agentes tomaram sozinhos
- Só a visão Lançamentos: "Resumo" e "Por categoria" do protótipo ficaram de fora, porque "Valor contratado" depende de Contratos e "Custo realizado" é custo real (regra 7).
- Sem filtro de mês: o backend não filtra por mês e filtrar só a página atual seria enganoso.
- Categoria aceita `MaoDeObra` (como o backend serializa) e `mao_de_obra`.
- Item "Financeiro" na sidebar logo depois de "Fechamento" (SPEC §5).
- Chave nova de upload do comprovante sem o nome original (`{guid}{ext}`), como nas fotos.

## Sinais para o harness
- **Achado preexistente no mesmo módulo bloqueou o ciclo** (régua do security-reviewer funcionando). O backend-gap-filler corrigiu só o endpoint pedido. Ajuste aplicado: ao mexer num endpoint de um módulo, o gap-filler passa a varrer os outros endpoints com escopo de obra do mesmo módulo contra o padrão.
- **Altura irregular de linha passou pelo design-reviewer**; vista pelo maestro na captura. Ajuste aplicado: item no checklist visual (altura uniforme em tabelas com célula de ação).
- **Captura de página inteira com sidebar `sticky`** dá a impressão de que a sidebar "acaba" a 900px. Não é falha (o protótipo é igual); está registrado no guia para o reviewer não perder tempo.
