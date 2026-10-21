---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-21
tela: Projetos (admin)
branch: feat/projetos-admin
resultado: entregue
pr: (ver PR da branch)
duracao_min: 240           # sessão supervisionada na nuvem
rodadas_correcao: 2
falhas_tester: 1
falhas_design: 1
achados_seguranca: 5       # todas baixas
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Projetos admin (2026-10-21)

## Em uma linha
Admin envia, edita, visualiza, baixa e exclui documentos técnicos da obra, com o backend reforçado. A branch parte da `main` (Financeiro e Fotos já mesclados). **O backend não foi compilado.**

## Precisa de você
1. **`dotnet build` e `dotnet test tests/KhazObras.Security.Tests` no Mac.** Sem script SQL novo. Riscos de compilar: `Http/ProjetoAdminTests.cs` (`Cenario` e fake), o `try/finally` do `DeleteAsync` no `ProjetoDocumentoService` e o novo parâmetro `LogAuditoriaService` no construtor do serviço.
2. **Teste manual com Postgres real:** enviar PDF e imagem com e sem etapa; etapa de outra obra (400); editar nome (extensão trocada = 400), tipo e etapa; excluir e conferir que o arquivo sumiu do R2; dois uploads simultâneos perto do 200º; abrir como cliente e ver só leitura (Visualizar/Baixar).
3. **Decisão de produto:** tipos aceitos agora são pdf, jpg, jpeg, png, webp, gif, doc, docx, xls, xlsx (saiu `.txt`; DWG e ZIP não entram). O engenheiro usa DWG? Se sim, precisa de magic bytes próprio.
4. **Decisão de produto:** limite de 200 documentos por obra, exclusão definitiva (sem lixeira), sem substituir arquivo nem versionar.
5. Antes do merge: `cd frontend && npm run plano:registro -- --escrever` com tudo commitado e commit `docs: registro`.

## O que foi entregue
- **Tela** (`/admin/obras/:obraId/projetos`, depois de Relatório fotográfico): um card por etapa ("Sem etapa" por último) com tabela Nome/Tipo/Enviado em/Ações; Visualizar (só PDF/imagem), Baixar, Editar (Dialog) e Excluir (confirmação inline); upload múltiplo em fila sequencial com etapa e tipo para o lote, progresso, tentar de novo e cancelar.
- **Backend:** `PUT` e `DELETE` de documento, upload validado antes do R2 (nome 1..255, tipo ≤50, extensões), limpeza do R2 quando o INSERT falha, limite de 200 com `FOR NO KEY UPDATE` na obra, download com Content-Type pela chave e nome seguro, auditoria `projeto_enviado/editado/excluido` sem texto livre. Varredura corrigiu: 500 em obra inexistente, nome/tipo longos que sobravam no R2 e `.txt` aceito.
- **Base:** a fila de upload subiu para `utils/uploadFila`, `hooks/useUploadFila` e componentes `Upload*`; Fotos e Projetos usam a mesma. `useEtapas` com `retryOnMount: false`.
- Capturas: `docs/relatorios/capturas/projetos-admin/` (normal e estresse; claro 1440, escuro e 1280).
- Suíte: 1074 testes verdes; e2e 77/77 (4 novos).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | backend-gap-filler | varredura do módulo (500, órfãos no R2, sem limite, sem auditoria) | corrigidos |
| 1 | tester | editar com etapas em erro 500 trava em loop de skeleton (188 GET /etapas) (bug-feature) | `retryOnMount: false` no `useEtapas` |
| 2 | design-reviewer | mensagem de limite quase ilegível (opacidade 60% no texto) (design) | opacidade só no ícone |
| 2 | design-reviewer (re-revisão) | VERDE | — |
| — | security-reviewer | 5 baixas | 2 corrigidas, 3 registradas no PLAN-09 |

## Achados do security-reviewer (todos baixos)
1. Auditoria fora da transação (lacuna geral, também em Financeiro, Fotos e Contratos): registrada.
2. **Corrigido:** `Rollback` dentro do `catch` do `TryAddAsync` podia esconder o erro original; commit ambíguo registrado.
3. **Corrigido:** nome com caracteres Unicode de formatação (U+202E) podia disfarçar a extensão na janela de download.
4. Lock do limite sem teste em Postgres real: registrado.
5. Front não recusa controle C1; o servidor recusa: só mensagem.

## Decisões que os agentes tomaram sozinhos
- `FOR NO KEY UPDATE` (não `FOR UPDATE`) na linha da obra, para não bloquear INSERTs de etapas e medições; sem deadlock (nenhum outro código trava `obras`).
- `DELETE ... RETURNING` atômico, sem travar antes (a chave nunca muda); R2 removido mesmo se a auditoria falhar.
- `PUT` com os três campos sempre (null limpa), em vez de PATCH.
- A etapa é o título do card, não uma coluna.
- O limite responde 400 `{message}`, como fotos e anexos.

## Sinais para o harness
- **`useEtapas` em erro + `isPending` + diálogo remontando = loop.** Regra para o `frontend-componentes`: skeleton de página só no carregamento inicial (`isLoading`), nunca em `isPending` de uma query secundária.
- **Auditoria fora da transação** apareceu em quatro módulos: virar item fixo do `novo-endpoint-backend` (gravar na mesma transação) em vez de achado a cada tela.
- **O design-reviewer não achou o mock de fotos** e deixou a comparação visual da refatoração para o builder; vale citar os mocks pelo nome no briefing.
- Esta tela chegou ao design sem falha de tabela larga: o checklist 8f e o mock de estresse (200 documentos, nomes de 255) funcionaram.
