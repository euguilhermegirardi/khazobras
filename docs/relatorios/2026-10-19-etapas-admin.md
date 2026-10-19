---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-19
tela: Gantt editável + Hub admin (+ % no Cronograma do cliente)
branch: feat/etapas-admin
resultado: entregue
pr: (ver PR da branch)
duracao_min: 60            # sessão supervisionada na nuvem
rodadas_correcao: 0
falhas_tester: 0
falhas_design: 0
achados_seguranca: 3       # todas baixas, preexistentes no módulo obras
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Gantt editável e Hub admin (2026-10-19)

## Em uma linha
Primeira área admin pronta: o engenheiro edita status, datas reais e % das etapas, e o cliente passa a ver o avanço no Cronograma. **Antes de subir a API, aplique o script 008.** Mescle depois do #14 e do #15.

## Precisa de você
1. **Aplicar o script no banco local:** `psql -d khazobras_db -f database/schema/008_etapas_percentual_concluido.sql`. Ele cria a coluna `percentual_concluido` e restringe o status a `nao_iniciada`, `em_andamento` e `concluida`. Sem o script, a API quebra ao ler etapas.
2. **Compilar e testar o backend no Mac** (`dotnet build` + `dotnet test tests/KhazObras.Security.Tests`). O teste novo é `Http/EtapaAtualizacaoTests.cs`, com 16 corpos inválidos.
3. **Revise as regras de coerência que o backend impõe** (decisão do agente; se ficarem apertadas no uso real, é só afrouxar o validator):
   - "Não iniciada": 0% e sem datas reais.
   - "Em andamento": menos de 100%, com início real e sem fim real.
   - "Concluída": 100%, com início e fim reais.
4. **O cliente agora vê o % de cada etapa.** O SPEC só diz "timeline, sem Curva S"; mostrar o avanço físico é decisão nossa (registrada no PLAN-09). Não é custo nem margem.

## O que foi entregue
- **Hub admin (`/admin`, "Meus projetos"):** todas as obras em cards, com paginação quando há muitas. É o mesmo componente do hub do cliente, parametrizado por papel.
- **Navegação da obra no admin:** "Dashboard" (ainda em construção) e "Gantt editável".
- **Gantt editável (`/admin/obras/:obraId/gantt`):**
  - tabela com ordem, nome, previsto, real, % com barra, status, peso e "Editar";
  - o diálogo de edição valida na hora as mesmas regras do backend e sugere o status pelo % sem travar a escolha;
  - erro 400 aparece no campo; "+ Etapa" cria uma etapa nova.
  - Sem excluir etapa, porque medições, fotos e projetos apontam para ela.
- **Cronograma do cliente:** "N%" ao lado de cada barra e no texto acessível.
- **Base nova:** `components/ui/dialog.tsx` (shadcn sobre `@radix-ui/react-dialog`, instalado pelo npm), `Input`, `NativeSelect`, `FormField` e `Pagination`.
- **Backend:**
  - script `008`;
  - `PUT /etapas/{id}` (Admin/Master; obra_id → `EnsureAccessAsync` → validação → `UPDATE ... WHERE id AND obra_id`);
  - `percentualConcluido` no `EtapaResponse`;
  - remoção do `GetByIdAsync` sem filtro de obra.
- **Capturas:** `docs/relatorios/capturas/gantt-admin/`, `hub-admin/` e `cronograma/` (claro 1440, escuro, 1280).
- **Suíte:** 347 testes verdes, lint, typecheck e Prettier ok; e2e 24/24 (8 novos do Gantt).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | backend-gap-filler | lacuna: etapas sem atualização nem % | script 008 + `PUT /etapas/{id}` + testes |
| 0 | tester | nenhuma (VERDE, 112 testes novos + 8 e2e). Revisou os testes antigos que o builder ajustou: legítimos; repôs a cobertura do % na visão cliente | — |
| 0 | design-reviewer | nenhuma (VERDE) | — |
| 0 | security-reviewer | 3 baixas preexistentes no módulo obras: paginação sem limite em `GET /obras`, N+1 na lista do cliente, `obraId` sem validar como GUID no front | registradas no PLAN-09 |

## Decisões que os agentes tomaram sozinhos
- Edição em diálogo, não na própria tabela. Sem "Orçado R$" e "Observação", que não existem no modelo.
- O item "Dashboard" do bloco da empresa saiu da sidebar admin: apontava para `/admin`, que agora é o hub.
- O formulário de criação só tem os campos que o `POST` aceita (cria com 0% e "Não iniciada").
- Mapa de status das etapas movido para `utils/etapaStatus.ts` (usado por cliente e admin).

## Sinais para o harness
- **O builder alterou testes do tester** (fixtures do cronograma, nome acessível, um assert que a decisão nova tornou obsoleto). Foi legítimo e o tester validou, mas fere a regra "builder não mexe nos testes do tester". Quando uma decisão de produto muda um comportamento já testado, o certo é o builder reportar e o tester ajustar. Vale reforçar no agente builder.
- **O Prettier novo funcionou na primeira tela:** nenhum bloqueio do pre-commit, e o espaço sumido em `AppRoutes.tsx` não voltou.
