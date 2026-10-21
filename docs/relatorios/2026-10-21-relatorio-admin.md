---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-21
tela: Relatório ao cliente (admin)
branch: feat/relatorio-admin
resultado: entregue
pr: (ver PR da branch)
duracao_min: 200           # sessão supervisionada na nuvem
rodadas_correcao: 1
falhas_tester: 1
falhas_design: 0
achados_seguranca: 4       # todas baixas
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Relatório ao cliente admin (2026-10-21)

## Em uma linha
Admin cria, edita, publica e exclui o relatório mensal que o cliente enxerga, com pré-visualização e histórico de alterações. **Mesclar depois do #22 (Projetos admin)**: a branch parte dela. O backend não foi compilado.

## Precisa de você
1. **Mesclar na ordem:** #22 (Projetos) → este PR. Depois do merge, confira com `git log origin/main..origin/feat/relatorio-admin` que nada ficou para trás.
2. **`dotnet build` e `dotnet test tests/KhazObras.Security.Tests` no Mac.** Sem script SQL novo (a unicidade obra+competência já existia). Riscos de compilar: `ConteudoDoRelatorio` (extensão sobre `IRuleBuilderInitial` com `Cascade`), `Http/RelatorioMensalAdminTests.cs` (o maior arquivo novo) e o fake reescrito.
3. **Teste manual com Postgres real:** dois POST do mesmo mês ao mesmo tempo (o segundo deve dar 409); publicar duas vezes (um 200 e um 409); editar o mês para um já usado (409); editar e excluir publicado (409); abrir como cliente e confirmar que rascunho não aparece nem por id; conferir o histórico depois de criar, editar e publicar.
4. **Decisões de produto:** (a) o conteúdo é texto puro (sem negrito, listas, fotos ou anexos); (b) publicado não volta a rascunho e não há versões do texto — se o engenheiro precisar corrigir algo já enviado, falta despublicar ou nova versão; (c) publicar não avisa o cliente (a tela "Notificar cliente" é separada); (d) exclusão de rascunho é definitiva.
5. Visual: o card do relatório do cliente agora preserva espaços e tabs repetidos (`pre-wrap`); confira que o texto antigo continua como esperado.
6. Antes do merge: `cd frontend && npm run plano:registro -- --escrever` com tudo commitado e commit `docs: registro`.

## O que foi entregue
- **Lista** (`/admin/obras/:obraId/relatorio-ao-cliente`, depois de Projetos): tabela por competência com resumo, status (Rascunho/Publicado), datas e ações; filtro por status.
- **Criar** (`.../novo`) e **editar rascunho** (`.../:relatorioId`): mês e texto com contador x/20000 ao lado da pré-visualização "Como o cliente vê"; erros por campo; 409 de mês repetido no campo.
- **Publicar** com confirmação inline (depois não edita nem exclui; o publicado fica só leitura) e **excluir rascunho** com confirmação.
- **Histórico** de alterações (quem, quando, campos alterados; nunca o texto anterior).
- **Backend:** `PUT` e `DELETE` de rascunho, `GET .../historico`, `publish` agora só `AdminOrMaster`, transições atômicas (`UPDATE ... WHERE status='draft' RETURNING`), `INSERT ... ON CONFLICT DO NOTHING`, competência normalizada ao dia 1, conteúdo 1..20000 sem controle nem caracteres de direção, DTO do cliente reduzido, auditoria sem texto livre. Varredura corrigiu: POST validava antes do acesso e dava 500 em obra inexistente ou mês repetido; leituras sem filtro de obra; corrida na publicação; filtro em memória; sem limite de conteúdo.
- **Base:** `RelatorioMensalCard`, `useRelatoriosMensais`, `formatDateTime` e `ui/textarea` (escrito à mão; reinstalar pelo CLI do shadcn quando houver rede).
- Capturas: `docs/relatorios/capturas/relatorio-admin/` (lista, novo, rascunho, publicado e estresse; claro 1440, escuro e 1280).
- Suíte: 1178 testes verdes; e2e 85/85 (8 novos).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | backend-gap-filler | varredura do módulo (acesso depois do corpo, 500, corrida, leitura sem obra) | corrigidos |
| 1 | tester | excluir pelo detalhe relia o relatório apagado e piscava "Não encontrado." (bug-feature) | não invalidar detalhe/histórico do id apagado e só limpar o cache ao desmontar a página |
| — | design-reviewer | nenhuma (VERDE; 2 observações) | registradas |
| — | security-reviewer | VERDE; 4 baixas | registradas no PLAN-09 |

## Decisões que os agentes tomaram sozinhos
- Páginas (não Dialog): o texto chega a 20000 caracteres e a pré-visualização fica ao lado do editor.
- Histórico = auditoria liberada ao Admin (o SPEC §6 item 13 pede); a auditoria crua continua só do Master.
- Competência sempre no dia 1; mês repetido é 409.
- Sem despublicar e sem versões do texto (exigiria tabela e script novos).
- Cache do admin dentro da chave do cliente: publicar/excluir atualiza a tela do cliente junto.

## Sinais para o harness
- **Mesma lição do `useExcluir` em Fotos, de novo aqui:** "excluir pela página de detalhe sem piscar 404" foi pedido ao builder em duas telas e escapou nas duas na primeira tentativa. Vale virar item fixo do briefing e da `nova-tela-frontend`: ao excluir pelo detalhe, navegar antes de limpar o cache e não invalidar as chaves do id apagado.
- **A falha foi pega pelo e2e (e pelo teste do jsdom) escrito por um agente separado**, não pelo builder: o desenho builder ≠ tester continua se pagando.
- O `shadcn add` falhou sem rede (quarta vez com componente escrito à mão): considerar vendorizar o registro ou um passo de "componentes pendentes de reinstalação" no PLAN-09.
- Auditoria fora da transação segue em todos os módulos (já no backlog geral).
