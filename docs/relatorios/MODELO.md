---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: AAAA-MM-DD
tela: <nome>
branch: feat/<tela>
resultado: entregue | parado | falhou   # entregue = PR aberto; parado = escalou para o usuário
pr: <url ou ->
duracao_min: <n>
rodadas_correcao: <0-3>
falhas_tester: <n>          # bug-feature encontrados pelo tester (todas as rodadas)
falhas_design: <n>          # falhas do design-reviewer
achados_seguranca: <n>      # achados do security-reviewer
contestacoes: <n>
motivo_parada: - | rodadas | sem-progresso | bloqueado-spec | bloqueado-ambiente | contestacao | regra-de-acesso
suite: verde | vermelha | nao-rodou
e2e: passou | falhou | nao-rodou
---

# Relatório da manhã — <tela> (<data>)

## Em uma linha
<O que você vai encontrar: "PR #12 pronto para revisar" ou "Parou na rodada 2: SPEC e backend divergem em X">

## Precisa de você
<Decisões, divergências, contestações e pendências que só você resolve, cada uma com o contexto mínimo
para decidir. "Nada" se não houver.>

## O que foi entregue
- O que a tela faz (para o cliente/admin, em linguagem de produto)
- Endpoints consumidos
- Capturas: claro, escuro, notebook 1280px (caminhos ou anexos no PR)

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 1 | tester | ... (bug-feature) | ... |

## Decisões que os agentes tomaram sozinhos
<Escolhas não previstas no SPEC/guia (ex.: texto de estado vazio, ordenação padrão). Revise: se alguma
estiver errada, vira regra no harness.>

## Sinais para o harness
<O que travou ou confundiu os agentes: instrução ambígua, contexto faltando, ferramenta bloqueada. Cada item
aqui é candidato a melhoria em CLAUDE.md, rules, skills ou agentes.>
