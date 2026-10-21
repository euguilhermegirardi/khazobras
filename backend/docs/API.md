# API KhazObras — Documentação Completa

**Stack:** .NET 10 | ASP.NET Core Minimal APIs | PostgreSQL 16 | Dapper | Cloudflare R2

**Base URL (Produção):** `https://khazobras.example.com/api` *(será atualizada)*  
**Base URL (Local):** `http://localhost:5285`

**Documentação Interativa:** `/openapi/v1.json` (Swagger UI available via OpenAPI)

---

## Índice

1. [Autenticação](#autenticação)
2. [Modelos de Resposta](#modelos-de-resposta)
3. [Módulo Auth](#módulo-auth)
4. [Módulo Usuários](#módulo-usuários)
5. [Módulo Obras](#módulo-obras)
6. [Módulo Etapas](#módulo-etapas)
7. [Módulo Medições](#módulo-medições)
   - 7b. [Módulo Contratos e Pagamentos](#módulo-contratos-e-pagamentos)
   - 7c. [Módulo Dashboard do Cliente](#módulo-dashboard-do-cliente)
8. [Módulo Financeiro](#módulo-financeiro)
9. [Módulo Relatórios Fotográficos](#módulo-relatórios-fotográficos)
10. [Módulo Relatórios Mensais](#módulo-relatórios-mensais)
11. [Módulo Projetos/Documentos](#módulo-projetosdocumentos)
12. [Módulo Fornecedores](#módulo-fornecedores)
13. [Módulo Prestadores](#módulo-prestadores)
14. [Módulo Estoque](#módulo-estoque)
15. [Módulo Pipeline](#módulo-pipeline)
16. [Módulo Notificações](#módulo-notificações)
17. [Módulo Auditoria](#módulo-auditoria)
18. [Codes de Erro](#codes-de-erro)

---

## Autenticação

Todos os endpoints (exceto `/healthcheck` e `/auth/login`) requerem autenticação JWT.

### Header de Autenticação
```
Authorization: Bearer <jwt_token>
```

### Roles (Papéis de Acesso)
- **Master**: Acesso completo (criação de usuários, auditoria, todas as obras)
- **Admin**: Gestão administrativa (obras, aprovações, internals)
- **Client**: Leitura e ações limitadas (próprias obras, aprovação de medições)

---

## Modelos de Resposta

### Resposta Paginada
```json
{
  "totalItems": 100,
  "pageIndex": 0,
  "pageSize": 10,
  "items": [...]
}
```

### Erro (HTTP 400, 403, 404, 500)
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "detail": "...",
  "requestId": "0HMVJ8LGVJ0G5:00000001"
}
```

### Status de Transição
Alguns recursos possuem máquinas de estado:
- **Medição:** `pending_approval` → `approved` → `invoice_issued`
- **Relatório Mensal:** `draft` → `published`

---

## Módulo Auth

### 1. Login
**POST** `/auth/login`

Autentica usuário e retorna JWT token com 8h de expiração.

**Request:**
```bash
curl -X POST http://localhost:5285/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "senha123"
  }'
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-10-12T18:00:00Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "João Silva",
  "email": "joao@example.com",
  "role": "Client"
}
```

**Response (401 Unauthorized):** Credenciais inválidas

---

## Módulo Usuários

### 1. Criar Usuário
**POST** `/users`

Cria novo usuário (somente Master). Roles disponíveis: Master, Admin, Client.

**Autorização:** Master

**Request:**
```bash
curl -X POST http://localhost:5285/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "password": "senha_segura_123",
    "role": "Admin"
  }'
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Maria Silva",
  "email": "maria@example.com",
  "role": "Admin",
  "isActive": true,
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Usuários
**GET** `/users`

Lista todos os usuários (somente Master).

**Autorização:** Master

**Request:**
```bash
curl -X GET http://localhost:5285/users \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "Client",
    "isActive": true,
    "createdAt": "2026-10-01T10:00:00Z"
  }
]
```

### 3. Obter Dados do Usuário Autenticado
**GET** `/users/me`

Retorna dados do usuário autenticado.

**Autorização:** Qualquer usuário autenticado

**Request:**
```bash
curl -X GET http://localhost:5285/users/me \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "João Silva",
  "email": "joao@example.com",
  "role": "Client",
  "isActive": true,
  "createdAt": "2026-10-01T10:00:00Z"
}
```

### 4. Vincular Usuário a Obra
**POST** `/users/{userId}/obras/{obraId}`

Vincula usuário a uma obra (somente Master).

**Autorização:** Master

**Request:**
```bash
curl -X POST http://localhost:5285/users/550e8400-e29b-41d4-a716-446655440000/obras/660e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):** Vinculação realizada com sucesso.

---

## Módulo Obras

### 1. Criar Obra
**POST** `/obras`

Cria nova obra. Cliente vê apenas obras vinculadas ao seu login.

**Autorização:** Qualquer usuário autenticado

**Request:**
```bash
curl -X POST http://localhost:5285/obras \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Residência João Silva",
    "endereco": "Rua das Flores, 123, São Paulo, SP",
    "dataInicio": "2026-10-15",
    "previsaoConclusao": "2027-06-30",
    "valorTotal": 500000.00,
    "descricao": "Construção de residência unifamiliar"
  }'
```

**Response (201 Created):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "name": "Residência João Silva",
  "endereco": "Rua das Flores, 123, São Paulo, SP",
  "dataInicio": "2026-10-15",
  "previsaoConclusao": "2027-06-30",
  "valorTotal": 500000.00,
  "descricao": "Construção de residência unifamiliar",
  "status": "Em Progresso",
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Obras
**GET** `/obras?pageIndex=0&pageSize=10`

Lista todas as obras (paginado). Clientes veem apenas suas obras.

**Autorização:** Qualquer usuário autenticado

**Request:**
```bash
curl -X GET "http://localhost:5285/obras?pageIndex=0&pageSize=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "totalItems": 5,
  "pageIndex": 0,
  "pageSize": 10,
  "items": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Residência João Silva",
      "endereco": "Rua das Flores, 123, São Paulo, SP",
      "dataInicio": "2026-10-15",
      "previsaoConclusao": "2027-06-30",
      "valorTotal": 500000.00,
      "descricao": "Construção de residência unifamiliar",
      "status": "Em Progresso",
      "createdAt": "2026-10-12T10:00:00Z"
    }
  ]
}
```

### 3. Obter Obra por ID
**GET** `/obras/{id}`

Retorna detalhes de uma obra específica (acesso restrito por obra).

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

**Request:**
```bash
curl -X GET http://localhost:5285/obras/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):** Detalhes completos da obra (ver CreateObra para estrutura)

**Response (403 Forbidden):** Usuário sem acesso à obra

---

## Módulo Etapas

### 1. Criar Etapa
**POST** `/etapas`

Cria etapa (fase) em uma obra.

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/etapas \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Fundação e Estrutura",
    "dataInicio": "2026-10-15",
    "dataTermino": "2026-12-30",
    "orcado": 100000.00
  }'
```

**Response (201 Created):**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "name": "Fundação e Estrutura",
  "dataInicio": "2026-10-15",
  "dataTermino": "2026-12-30",
  "orcado": 100000.00,
  "realizado": 0.00,
  "percentualConcluido": 0,
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Etapas de uma Obra
**GET** `/etapas?obraId={id}`

Lista todas as etapas de uma obra.

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

**Request:**
```bash
curl -X GET "http://localhost:5285/etapas?obraId=770e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):** Array de etapas (ver CreateEtapa para estrutura)

### 3. Obter Etapa por ID
**GET** `/etapas/{id}`

Retorna detalhes de uma etapa específica.

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

---

## Módulo Medições

Controla medições de progresso de obra com máquina de estados.

### Estados
- `pending_approval`: Aguardando aprovação do cliente
- `approved`: Aprovada pelo cliente, aguardando fatura
- `invoice_issued`: Nota fiscal emitida (finalizada)

### 1. Criar Medição
**POST** `/medicoes`

Cria medição para uma obra. Estados: `pending_approval` → `approved` → `invoice_issued`.

**Autorização:** Admin, Master

Ordem de verificação em todos os endpoints com id: 404 (medição/obra inexistente) → 403 (sem acesso à obra) →
400 (corpo/parâmetros inválidos) → 409 (transição inválida). Enums em requests: snake_case; em respostas: PascalCase.
Cliente recebe a visão reduzida (`MedicaoClienteResponse`, sem `approvedByUserId`); Admin/Master, a completa.
Toda mudança de status grava `log_auditoria` (`entidade = "medicao"`; ações `medicao_criada`, `medicao_aprovada`,
`medicao_nf_emitida`; payload só com ids e status).

**Request:**
```json
{
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "etapaId": "880e8400-e29b-41d4-a716-446655440000",
  "numero": 3,
  "competencia": "2026-10-01",
  "itens": [
    { "tipo": "mao_de_obra", "descricao": "Alvenaria", "quantidade": 10, "valorUnitario": 500.00 },
    { "tipo": "material", "descricao": "Cimento", "quantidade": 2.5, "valorUnitario": 100.10 }
  ]
}
```

`etapaId` é opcional e, se enviado, precisa ser da mesma obra (400 `errors.EtapaId`). `numero` é único por obra (409).
`tipo`: `mao_de_obra`, `material` ou `equipamento`. Quantidade > 0; valor unitário >= 0; no máximo 2 casas decimais.
O total de cada item e da medição é calculado no servidor.

**Response (201 Created, `Location: /medicoes/{id}`):**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "etapaId": "880e8400-e29b-41d4-a716-446655440000",
  "numero": 3,
  "competencia": "2026-10-01",
  "valorTotal": 5250.25,
  "status": "PendingApproval",
  "approvedAt": null,
  "approvedByUserId": null,
  "nfNumber": null,
  "nfIssuedAt": null,
  "createdAt": "2026-10-12T10:00:00Z",
  "itens": [
    { "id": "...", "tipo": "MaoDeObra", "descricao": "Alvenaria", "quantidade": 10, "valorUnitario": 500.00, "valorTotal": 5000.00 }
  ]
}
```

**Erros:** 400 `{ "errors": { "Itens[0].Tipo": ["..."] } }`, 403, 404 (obra inexistente), 409 `{ "message": "..." }`.

### 2. Listar Medições de uma Obra
**GET** `/obras/{obraId}/medicoes`

Array puro (sem paginação) com itens. Cliente: `MedicaoClienteResponse` (mesmos campos, sem `approvedByUserId`).

**Autorização:** Qualquer usuário com acesso à obra

### 2b. Lista de acompanhamento (admin)
**GET** `/obras/{obraId}/medicoes/resumo?pageIndex=0&pageSize=20&status=approved`

Paginada (`pageIndex >= 0`, `pageSize` 1..100, senão 400), mais nova primeiro, sem itens. `status` opcional:
`pending_approval`, `approved` ou `invoice_issued`.

**Autorização:** Admin, Master

```json
{
  "totalItems": 1, "pageIndex": 0, "pageSize": 20,
  "items": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440000", "obraId": "770e8400-e29b-41d4-a716-446655440000",
      "etapaId": "880e8400-e29b-41d4-a716-446655440000", "etapaNome": "Fundação",
      "numero": 3, "competencia": "2026-10-01", "valorTotal": 5250.25, "status": "Approved",
      "quantidadeItens": 2, "createdAt": "2026-10-12T10:00:00Z", "approvedAt": "2026-10-13T09:00:00Z",
      "nfIssuedAt": null, "nfNumber": null
    }
  ]
}
```

### 3. Obter Medição por ID
**GET** `/medicoes/{id}`

Retorna a medição com itens (cliente: visão reduzida).

**Autorização:** Qualquer usuário com acesso à obra da medição

### 4. Aprovar Medição
**POST** `/medicoes/{id}/approve`

Aprova medição (transição: `pending_approval` → `approved`). Realizado pelo cliente.

**Autorização:** Client (propriedade da obra)

Sem corpo. Resposta 200 na visão do cliente (`MedicaoClienteResponse`, sem `approvedByUserId`). Admin/Master = 403;
medição que não está `pending_approval` = 409.

### 5. Emitir Nota Fiscal
**POST** `/medicoes/{id}/issue-invoice`

Emite nota fiscal para medição (transição: `approved` → `invoice_issued`). Somente Admin/Master.

**Autorização:** Admin, Master

**Request:**
```json
{ "nfNumber": "NF-2026-001" }
```

`nfNumber`: obrigatório, até 50 caracteres, sem caracteres de controle (400 `{ "errors": { "NfNumber": ["..."] } }`).
Medição fora de `approved` = 409 `{ "message": "..." }`.

**Response (200 OK):** `MedicaoResponse` completo, com `"status": "InvoiceIssued"`, `nfNumber` e `nfIssuedAt`.

---

## Módulo Contratos e Pagamentos

Contratos da obra e pagamentos recebidos do cliente (SPEC §5 item 6, §8). Tabelas `contratos` e `pagamentos` (script 004,
sem schema novo). Datas em `yyyy-MM-dd`; valores em `decimal` com no máximo 2 casas (`NUMERIC(14,2)`, até
999.999.999.999,99). Enums: nenhum. Sem `PUT`/`DELETE` e sem upload do documento no V1.

Ordem de verificação em todos os endpoints: 404 (contrato/obra inexistente) → 403 (sem acesso à obra) → 400 (corpo) →
409 (número repetido). `storage_key` nunca é exposta. Cliente nunca recebe custo real/margem: só valor contratado e o
que ele pagou.

`totalPago` = `SUM(pagamentos.valor)` (SQL agregado, sem N+1). `saldoAPagar` = `valorContratado - totalPago` e **pode ser
negativo** (a API não impede pagamento acima do contratado: adiantamentos e aditivos existem).

### 1. Criar Contrato
**POST** `/contratos`

**Autorização:** Admin, Master (cliente = 403, mesmo com corpo inválido)

**Request:**
```json
{ "obraId": "770e8400-e29b-41d4-a716-446655440000", "numero": "CT-2026/01", "valorContratado": 125000.55, "dataAssinatura": "2026-03-15" }
```

`numero`: obrigatório, até 50 caracteres, sem caracteres de controle, único por obra (409, inclusive em corrida pela UNIQUE;
espaços nas pontas são removidos antes de comparar). `valorContratado` > 0. `dataAssinatura` opcional (2000..2100).

**Response (201 Created, `Location: /contratos/{id}`):** `ContratoResponse`
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000", "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "numero": "CT-2026/01", "valorContratado": 125000.55, "dataAssinatura": "2026-03-15",
  "totalPago": 0, "saldoAPagar": 125000.55,
  "createdAt": "2026-10-19T10:00:00Z", "updatedAt": "2026-10-19T10:00:00Z"
}
```

**Erros:** 400 `{ "errors": { "Numero": ["..."], "ValorContratado": ["..."] } }`, 403, 404 (obra inexistente),
409 `{ "message": "Ja existe um contrato com este numero nesta obra." }`.

Auditoria: `log_auditoria` com `entidade = "contrato"`, ação `contrato_criado`, `detalhes` = `{ obraId, numero, valorContratado }`.

### 2. Listar Contratos de uma Obra
**GET** `/obras/{obraId}/contratos`

Array puro (poucos contratos por obra; sem paginação), mais antigo primeiro.

**Autorização:** Qualquer usuário com acesso à obra (cliente de outra obra = 403)

Admin/Master: `ContratoResponse` (mesmo JSON do 201). Cliente: `ContratoClienteResponse`:
```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440000", "obraId": "770e8400-e29b-41d4-a716-446655440000",
    "numero": "CT-2026/01", "valorContratado": 125000.55, "dataAssinatura": "2026-03-15",
    "totalPago": 5500.50, "saldoAPagar": 119500.05
  }
]
```
Sem `createdAt`, `updatedAt` nem `storageKey`.

### 3. Obter Contrato por ID (com pagamentos)
**GET** `/contratos/{id}`

**Autorização:** Qualquer usuário com acesso à obra do contrato. Pagamentos ordenados por `dataPagamento` desc
(depois `createdAt` desc). Sem paginação.

Admin/Master: `ContratoDetalheResponse` (campos de `ContratoResponse` + `pagamentos` de `PagamentoResponse`).
Cliente: `ContratoDetalheClienteResponse`:
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000", "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "numero": "CT-2026/01", "valorContratado": 125000.55, "dataAssinatura": "2026-03-15",
  "totalPago": 5500.50, "saldoAPagar": 119500.05,
  "pagamentos": [
    { "id": "bb0e8400-e29b-41d4-a716-446655440000", "referenteMedicaoId": "990e8400-e29b-41d4-a716-446655440000",
      "referenteMedicaoNumero": 3, "valor": 2500.50, "dataPagamento": "2026-06-01", "formaPagamento": "TED" },
    { "id": "cc0e8400-e29b-41d4-a716-446655440000", "referenteMedicaoId": null,
      "referenteMedicaoNumero": null, "valor": 3000.00, "dataPagamento": "2026-04-01", "formaPagamento": null }
  ]
}
```
Para Admin/Master, cada pagamento também traz `contratoId` e `createdAt`.

### 4. Registrar Pagamento
**POST** `/contratos/{id}/pagamentos`

**Autorização:** Admin, Master (cliente = 403, mesmo com corpo inválido)

**Request:**
```json
{ "valor": 2500.50, "dataPagamento": "2026-06-01", "formaPagamento": "TED", "referenteMedicaoId": "990e8400-e29b-41d4-a716-446655440000" }
```

`valor` > 0. `dataPagamento` obrigatória, de 2000 até **hoje + 1 dia** (UTC; pagamento já recebido, o dia a mais cobre fuso).
`formaPagamento` opcional (≤ 50, vazio vira `null`). `referenteMedicaoId` opcional: a medição precisa ser **da mesma obra do
contrato** e estar com **NF emitida** (`invoice_issued`, SPEC §8); senão 400 `errors.ReferenteMedicaoId` com a mesma
mensagem para inexistente, de outra obra ou sem NF (não revela medições de outras obras). Várias parcelas da mesma medição
são aceitas. Não há limite de soma ao valor contratado.

**Response (201 Created, `Location: /contratos/{id}`):** `PagamentoResponse`
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000", "contratoId": "aa0e8400-e29b-41d4-a716-446655440000",
  "referenteMedicaoId": "990e8400-e29b-41d4-a716-446655440000", "referenteMedicaoNumero": null,
  "valor": 2500.50, "dataPagamento": "2026-06-01", "formaPagamento": "TED", "createdAt": "2026-10-19T10:00:00Z"
}
```
(`referenteMedicaoNumero` só vem preenchido nas leituras; no 201 é `null`.)

**Erros:** 400 `{ "errors": { "Valor": ["..."], "DataPagamento": ["..."], "ReferenteMedicaoId": ["A medicao informada deve ser desta obra e ter nota fiscal emitida."] } }`,
403, 404 (contrato inexistente).

Auditoria: `entidade = "pagamento"`, ação `pagamento_registrado`, `detalhes` = `{ obraId, contratoId, valor, referenteMedicaoId }`
(valor entra por ser auditoria financeira; só o Master lê o log).

---

## Módulo Dashboard do Cliente

Resumo da obra para a tela Dashboard do cliente (SPEC §5 item 2). Sem schema novo: lê `obras`, `etapas`, `medicoes`,
`contratos` e `pagamentos`. Leitura, sem auditoria. Datas em `yyyy-MM-dd`; valores como número JSON (`decimal`).

### 1. Dashboard da Obra
**GET** `/obras/{obraId}/dashboard`

**Autorização:** qualquer usuário autenticado com acesso à obra (cliente de outra obra = 403; Admin/Master sempre).
Ordem: 401 → 403 (sem acesso) → 404 (obra inexistente; só Admin/Master chegam aqui, o cliente recebe 403).

**DTO único** (`DashboardClienteResponse`): Admin/Master recebem exatamente o mesmo JSON do cliente. **Nunca** traz custo real,
margem, lançamentos do financeiro, peso das etapas, `storageKey` nem ids de usuário (regra 7 do CLAUDE.md).

**Response (200):**
```json
{
  "obra": { "id": "770e8400-e29b-41d4-a716-446655440000", "nome": "Residencial Aurora", "dataInicio": "2026-01-10",
            "dataPrevisaoTermino": "2026-12-31", "status": "EmAndamento" },
  "avancoFisicoPercentual": 70.0,
  "prazo": { "diasRestantes": 72, "dataPrevisaoTermino": "2026-12-31" },
  "valores": { "valorContratado": 100000.00, "valorMedidoAcumulado": 50000.00, "valorRestante": 50000.00, "totalPago": 12000.00 },
  "avancoPorEtapa": [
    { "etapaId": "aa0e8400-e29b-41d4-a716-446655440000", "nome": "Fundacao", "ordem": 1, "percentualConcluido": 100.00,
      "status": "concluida", "dataInicioPrevista": "2026-02-01", "dataFimPrevista": "2026-03-15" }
  ],
  "medidoPorMes": [
    { "competencia": "2026-08-01", "valorMedido": 30000.00, "valorMedidoAcumulado": 30000.00 },
    { "competencia": "2026-10-01", "valorMedido": 20000.00, "valorMedidoAcumulado": 50000.00 }
  ]
}
```

| Campo | Regra |
|---|---|
| `obra.status` | `EmAndamento`, `Concluida` ou `Pausada` (igual ao `GET /obras/{id}`). `dataInicio`/`dataPrevisaoTermino` podem ser `null`. |
| `avancoFisicoPercentual` | Média de `percentualConcluido` ponderada pelo peso das etapas (`Σ(pct × peso) / Σ(peso)`); pesos todos 0 = média simples; sem etapas = 0. Uma casa decimal. |
| `prazo.diasRestantes` | `dataPrevisaoTermino − hoje`; **negativo = atrasado**, 0 = vence hoje, `null` sem data de previsão. "Hoje" = data UTC do servidor menos 3h (America/Sao_Paulo). |
| `valores.valorContratado` | `obras.valor_contratado`. |
| `valores.valorMedidoAcumulado` | Soma de `valor_total` das medições `approved` e `invoice_issued` da obra (o que o cliente já aprovou). É o "Custo acumulado" da tela do cliente: custo **para ele**, nunca o custo real da empresa. |
| `valores.valorRestante` | `valorContratado − valorMedidoAcumulado`; **pode ser negativo**. |
| `valores.totalPago` | Soma dos pagamentos dos contratos da obra. |
| `avancoPorEtapa` | Ordenado por `ordem`. `status`: `nao_iniciada`, `em_andamento` ou `concluida`. Datas previstas podem ser `null`. Sem peso. |
| `medidoPorMes` | Um item por mês de competência com medição aprovada (`competencia` = dia 1), em ordem crescente, **sem meses vazios**. `valorMedidoAcumulado` é corrido; o último item é igual a `valores.valorMedidoAcumulado`. Medição `pending_approval` não entra. Sem medição = `[]`. |

Uma única ida ao banco (4 consultas agregadas, todas com `WHERE obra_id`).

**Erros:** 401 sem token, 403 sem acesso à obra, 404 obra inexistente (Admin/Master).

---

## Módulo Financeiro

Lançamentos de custo de uma obra, com a flag `visivelCliente` (SPEC §5 item 5): o cliente só enxerga o que o
Admin/Master liberou (padrão `false`), em DTO reduzido; o filtro é feito no SQL. Todo endpoint com id de lançamento ou
anexo resolve o `obra_id`, chama `EnsureAccessAsync` (403) e só então lê/grava com `WHERE id AND obra_id`.
Ordem de erros: 401 sem token → 403 (cliente / sem acesso à obra, **antes** de validar o corpo) → 404 → 400.

**Formatos:** datas `yyyy-MM-dd`; `createdAt`/`uploadedAt` ISO 8601 UTC; `valor` decimal com ponto (`NUMERIC(14,2)`:
> 0, no máximo 2 casas, até 999999999999.99); IDs GUID; JSON em camelCase. `categoria` **entra** em snake_case
(`mao_de_obra`, `material`, `equipamento`; o PascalCase também é aceito) e **sai** em PascalCase (`MaoDeObra`, `Material`,
`Equipamento`, o `ToString()` do enum `item_tipo`). Erro de validação (400): `{ "title", "status", "errors": { "Campo": ["msg"] } }`;
outros 400: `{ "message": "..." }`.

**DTO admin (`FinanceiroLancamentoResponse`):**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "categoria": "Material",
  "descricao": "Cimento CP-II",
  "valor": 1500.00,
  "dataLancamento": "2026-09-10",
  "mesCompetencia": "2026-09-01",
  "createdByUserId": "11111111-1111-1111-1111-111111111111",
  "visivelCliente": false,
  "createdAt": "2026-09-10T13:00:00Z",
  "anexos": [
    { "id": "bb0e8400-e29b-41d4-a716-446655440000", "nomeArquivo": "nota-fiscal.pdf", "contentType": "application/pdf", "tamanhoBytes": 10240, "uploadedAt": "2026-09-10T13:05:00Z" }
  ]
}
```

**DTO cliente (`FinanceiroLancamentoClienteResponse`):** `id, obraId, categoria, descricao, valor, dataLancamento, mesCompetencia, anexos`
(sem `createdByUserId`, `visivelCliente`, `createdAt`).

### 1. Categorias (select do front)
**GET** `/financeiro/categorias` — Admin, Master

```json
[
  { "valor": "mao_de_obra", "rotulo": "Mão de obra" },
  { "valor": "material", "rotulo": "Material" },
  { "valor": "equipamento", "rotulo": "Equipamento" }
]
```
A categoria é o enum `item_tipo` do Postgres; a tabela `categorias` do SPEC §9 ainda não é usada pelo financeiro
(`categoria_id` fica nulo). CRUD de categorias é backlog (exige script novo).

### 2. Criar lançamento
**POST** `/financeiro/lancamentos` — Admin, Master

```json
{ "obraId": "770e8400-...", "categoria": "material", "descricao": "Cimento CP-II", "valor": 1500.00,
  "dataLancamento": "2026-09-10", "mesCompetencia": "2026-09-01", "visivelCliente": false }
```
`visivelCliente` é opcional (padrão `false`). Respostas: **201** (DTO admin, `Location: /financeiro/lancamentos/{id}`),
400 (validação), 403 (sem acesso à obra), **404** (obra inexistente).

### 3. Listar lançamentos da obra
**GET** `/obras/{obraId}/financeiro/lancamentos?pageIndex=0&pageSize=20` — qualquer usuário com acesso à obra

Mais recente primeiro (`dataLancamento`, `createdAt`). `pageIndex >= 0`, `pageSize` 1..100 (400 `{ message }`).
Resposta paginada `{ totalItems, pageIndex, pageSize, items }`:
- **Admin/Master:** todos os lançamentos (liberados ou não), DTO admin. Filtros opcionais (todos parametrizados no SQL,
  valores inválidos = 400 `{ message }`): `visivelCliente=true|false`, `categoria=mao_de_obra|material|equipamento`,
  `competencia=yyyy-MM` (mês inteiro de `mesCompetencia`). Vazio = sem filtro. Ex.: `?visivelCliente=false&competencia=2026-10`.
- **Cliente:** só os liberados, DTO cliente; os filtros são ignorados.

### 4. Resumo da obra (custo real: só Admin/Master)
**GET** `/obras/{obraId}/financeiro/resumo` — Admin, Master (cliente = **403**, mesmo da própria obra)

```json
{ "totalLancado": 2000.50, "totalLiberadoCliente": 1500.00, "totalNaoLiberado": 500.50,
  "quantidadeLancamentos": 2, "quantidadeLiberada": 1, "quantidadeNaoLiberada": 1 }
```
Um único SQL agregado (`WHERE obra_id`). Obra sem lançamentos = zeros (200). "Liberado" = `visivelCliente = true`.

### 5. Detalhe
**GET** `/financeiro/lancamentos/{id}` — qualquer usuário com acesso à obra. Admin: DTO admin (qualquer lançamento da obra).
Cliente: DTO cliente; lançamento não liberado ou de outra obra = **404**.

### 6. Editar lançamento
**PUT** `/financeiro/lancamentos/{id}` — Admin, Master

```json
{ "categoria": "equipamento", "descricao": "Betoneira alugada", "valor": 2300.75,
  "dataLancamento": "2026-10-05", "mesCompetencia": "2026-10-01", "visivelCliente": true }
```
Mesmos campos do POST, **sem** `obraId` (a obra nunca troca; se vier no JSON, é ignorado). `visivelCliente` omitido/`null` mantém
o valor atual. `UPDATE ... WHERE id AND obra_id`. Respostas: **200** (DTO admin atualizado), 400, 403, 404.
Auditoria `lancamento_editado` (entidade `financeiro_lancamento`): `{ "obraId": "...", "campos": ["valor","descricao"] }`
(só nomes dos campos alterados; nada alterado = sem registro).

### 7. Excluir lançamento
**DELETE** `/financeiro/lancamentos/{id}` — Admin, Master. **204**, 403, 404.

Exclusão **definitiva** (sem lixeira): os anexos saem do banco por `ON DELETE CASCADE` e os arquivos são apagados do R2 em
seguida (falha no R2 não desfaz: responde 204 e registra aviso no log). Auditoria `lancamento_excluido`:
`{ "obraId": "...", "quantidadeAnexos": 1 }`.

### 8. Liberar/ocultar para o cliente
**PATCH** `/financeiro/lancamentos/{id}/visibilidade` — Admin, Master. Body `{ "visivelCliente": true }`.
**200** (DTO admin), 403 (cliente, antes de validar o corpo), 404. Auditoria `lancamento_visibilidade_alterada`:
`{ "obraId", "statusAnterior": "oculto", "statusNovo": "liberado", "lote": false }` (sem registro se o valor não mudou).

**PATCH** `/obras/{obraId}/financeiro/lancamentos/visibilidade` — Admin, Master (lote)

```json
{ "ids": ["aa0e8400-...", "cc0e8400-..."], "visivelCliente": true }
```
Máximo **200** ids (repetidos contam uma vez). Tudo-ou-nada: `UPDATE ... WHERE id = ANY(@Ids) AND obra_id = @ObraId` só grava se a
contagem bater; se **algum** id não for desta obra (inexistente ou de outra obra, indistinguíveis) → **400**
`{ "errors": { "Ids": ["Um ou mais lancamentos informados nao pertencem a esta obra."] } }` sem alterar nenhum. Sucesso:
**200** `{ "atualizados": 2, "visivelCliente": true }`. Auditoria: um registro `lancamento_visibilidade_alterada` por lançamento
cujo valor mudou (`"lote": true`). 400 também para lista vazia, > 200 ou id vazio.

### 9. Anexar arquivo
**POST** `/financeiro/lancamentos/{id}/anexos` — Admin, Master. `multipart/form-data`, campo `file`.

Máx 10 MB; extensão + MIME + magic bytes (`FileUploadValidator`: jpg, jpeg, png, webp, gif, pdf, doc, docx, xls, xlsx, txt).
Máximo **10 anexos por lançamento** (o 11º = **400** `{ "message": "Cada lancamento aceita no maximo 10 anexos." }`, nada vai ao R2).
Nome do arquivo vazio ou com mais de **255 caracteres** = **400** `{ "message": "O nome do arquivo deve ter de 1 a 255 caracteres." }` (nada vai ao R2).
Se o banco falhar depois do upload, o objeto é removido do R2 e a API responde 500.
**201** `{ "id", "nomeArquivo", "contentType", "tamanhoBytes", "uploadedAt" }` (`Location: /financeiro/anexos/{id}`), 400, 403, 404.
A chave no R2 é `obras/{obraId}/financeiro/{lancamentoId}/{guid}{ext}` (sem o nome original, nunca exposta).

### 10. Baixar anexo
**GET** `/financeiro/anexos/{anexoId}/download` — qualquer usuário com acesso à obra. Cliente só baixa de lançamento liberado da
própria obra (oculto = 404). Resposta: arquivo, `X-Content-Type-Options: nosniff`. O front busca com o token (fetch → blob).

### 11. Remover anexo
**DELETE** `/financeiro/anexos/{anexoId}` — Admin, Master. **204**, 403, 404. Resolve a obra pelo anexo →
`EnsureAccessAsync` → `DELETE ... WHERE a.id AND l.obra_id` → apaga do R2 (falha no R2 = 204 + aviso no log).
Auditoria `lancamento_anexo_removido` (entidade `financeiro_lancamento`, id do lançamento): `{ "obraId", "anexoId" }`.

---

## Módulo Relatórios Fotográficos

Registro visual da obra, por **mês** (`tipo = "mensal"`, usa `competencia`) ou por **etapa** (`tipo = "etapa"`, usa `etapaId`)
(SPEC §6 item 11 e §7). O schema (script 005) não tem rascunho/publicação nem unicidade: **o cliente da obra vê o mesmo que o
admin**, e pode haver mais de um relatório por mês/etapa. Todo endpoint com id de relatório ou foto resolve o `obra_id`, chama
`EnsureAccessAsync` (403) e só então lê/grava com `WHERE id AND obra_id`. Ordem de erros: 401 sem token → 403 (cliente /
sem acesso à obra, **antes** de validar o corpo) → 404 → 400. O cliente é somente leitura: toda escrita é `AdminOrMaster`.

**Formatos:** datas `yyyy-MM-dd`; `createdAt` ISO 8601 UTC; IDs GUID; JSON em camelCase. Erro de validação de corpo JSON (400):
`{ "title", "status", "errors": { "Campo": ["msg"] } }`; outros 400 (upload): `{ "message": "..." }`. A chave do bucket
(`storage_key`) **nunca** aparece em resposta nenhuma; a imagem sai só por `GET /fotos/{id}/arquivo`.

**DTO do relatório (`RelatorioFotograficoResponse`, admin e cliente):**
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "tipo": "mensal",
  "etapaId": null,
  "titulo": "Setembro",
  "competencia": "2026-09-01",
  "createdAt": "2026-10-12T10:00:00Z",
  "quantidadeFotos": 2,
  "fotos": [
    { "id": "dd0e8400-...", "dataFoto": "2026-09-05", "descricao": "Fundacao", "ordem": 0, "createdAt": "2026-10-12T10:10:00Z" },
    { "id": "ee0e8400-...", "dataFoto": null, "descricao": null, "ordem": 1, "createdAt": "2026-10-12T10:11:00Z" }
  ]
}
```
Fotos em ordem estável (`ordem`, `createdAt`, `id`); relatórios do mais novo para o mais antigo (`createdAt DESC`, `id`).

### 1. Listar relatórios da obra
**GET** `/obras/{obraId}/relatorios-fotograficos` — qualquer usuário com acesso à obra. **200** array de `RelatorioFotograficoResponse`
(cada um com suas fotos e `quantidadeFotos`, numa consulta só), 403. Sem paginação (backlog).

### 2. Detalhe
**GET** `/relatorios-fotograficos/{id}` — qualquer usuário com acesso à obra. **200**, 403, 404.

### 3. Criar relatório
**POST** `/relatorios-fotograficos` — Admin, Master

```json
{ "obraId": "770e8400-...", "tipo": "mensal", "etapaId": null, "titulo": "Outubro", "competencia": "2026-10-01" }
```
`tipo`: `mensal` ou `etapa` (qualquer caixa; sai minúsculo). `titulo`: 1 a 150 caracteres (aparado). `competencia`: opcional,
anos 2000–2100. `etapaId`: opcional; se vier, **precisa ser da mesma obra**. Ordem: acesso à obra (403) → validação (400) →
obra existe (404) → etapa da obra (400). **201** (DTO, `Location: /relatorios-fotograficos/{id}`, `fotos: []`), 400, 403, **404** (obra inexistente).
Etapa inexistente e etapa de outra obra dão o **mesmo** 400:
`{ "errors": { "EtapaId": ["A etapa informada deve ser desta obra."] } }`.

### 4. Editar relatório
**PUT** `/relatorios-fotograficos/{id}` — Admin, Master

```json
{ "tipo": "etapa", "etapaId": "ff0e8400-...", "titulo": "Fundacao concluida", "competencia": null }
```
Substitui `tipo`, `etapaId`, `titulo` e `competencia` (mande todos; `null` limpa etapa/competência). A obra **nunca** troca (um `obraId`
no JSON é ignorado). **200** (DTO com as fotos), 400 (inclui o 400 de `EtapaId` acima), 403, 404. Auditoria
`relatorio_fotografico_editado` (entidade `relatorio_fotografico`): `{ "obraId": "...", "campos": ["titulo","competencia"] }`
(só nomes dos campos que mudaram; nada alterado = sem registro).

### 5. Excluir relatório
**DELETE** `/relatorios-fotograficos/{id}` — Admin, Master. **204**, 403, 404. Exclusão **definitiva** (sem lixeira): as chaves das
fotos são lidas e o relatório apagado na mesma transação (fotos saem por `ON DELETE CASCADE`); depois os arquivos saem do R2 (falha
no R2 não desfaz: 204 + aviso no log). Auditoria `relatorio_fotografico_excluido`: `{ "obraId", "quantidadeFotos": 2 }`.

### 6. Enviar foto
**POST** `/relatorios-fotograficos/{id}/fotos?dataFoto=2026-10-01&descricao=Viga&ordem=3` — Admin, Master. `multipart/form-data`,
campo `file`; **`dataFoto`, `descricao` e `ordem` vão na query string** (todos opcionais).

- Arquivo: máx 10 MB, extensão + MIME + magic bytes (`FileUploadValidator`) e **só imagem**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
  (outro tipo = 400 `{ message }`).
- Máximo **100 fotos por relatório**: a 101ª = **400** `{ "message": "Cada relatorio aceita no maximo 100 fotos." }`, nada vai ao R2.
  A contagem é refeita dentro de uma transação que trava o relatório (`FOR UPDATE`), então uploads simultâneos não passam do limite.
- Nome do arquivo vazio ou com mais de **255 caracteres** = **400** `{ "message": "O nome do arquivo deve ter de 1 a 255 caracteres." }`
  (antes do R2; o nome não é gravado, só a extensão entra na chave).
- `descricao` até 255 caracteres (aparada; vazia vira `null`); `dataFoto` entre 2000-01-01 e **amanhã** (UTC); `ordem` de 0 a 100000.
  Fora disso = 400 `{ "message": "..." }` (antes do R2). **Sem `ordem`, a foto vai para o fim** (maior ordem + 1).
- Se o banco falhar depois do upload, ou se a corrida estourar o limite, o objeto é removido do R2 (500 / 400 respectivamente).
- Chave no R2: `obras/{obraId}/relatorios-fotograficos/{relatorioId}/{guid}{ext}` (sem o nome original, nunca exposta).

**201** (`Location: /fotos/{id}`), 400, 403, 404:
```json
{ "id": "dd0e8400-...", "dataFoto": "2026-10-01", "descricao": "Viga", "ordem": 3, "createdAt": "2026-10-12T10:10:00Z" }
```

### 7. Editar foto
**PATCH** `/fotos/{fotoId}` — Admin, Master. **Parcial**: só muda o campo que estiver no JSON; `descricao` e `dataFoto` aceitam
`null` (limpam); `ordem` não aceita `null`. Fotos de outro relatório não são alcançáveis: o `UPDATE` é preso à obra (`JOIN` com o relatório).

```json
{ "descricao": "Fachada norte", "dataFoto": null, "ordem": 4 }
```
**200** (`FotoResponse` atualizada), 403, 404, 400 (`{ "errors": { "Descricao" | "DataFoto" | "Ordem" | "Body": ["msg"] } }`: corpo vazio / sem
nenhum dos três campos, tipo errado, descrição > 255, data fora de 2000–amanhã ou fora de `yyyy-MM-dd`, ordem fora de 0–100000).
Auditoria `foto_editada` (entidade `relatorio_fotografico`, id do relatório): `{ "obraId", "fotoId", "campos": ["descricao","ordem"] }`
(nomes dos campos **enviados**, sem a descrição).

### 8. Remover foto
**DELETE** `/fotos/{fotoId}` — Admin, Master. **204**, 403, 404. Foto → obra → acesso → `DELETE ... WHERE f.id AND r.obra_id` → apaga do R2
(falha no R2 = 204 + aviso no log). Auditoria `foto_removida`: `{ "obraId", "fotoId" }`.

### 9. Reordenar em lote
**PATCH** `/relatorios-fotograficos/{id}/fotos/ordem` — Admin, Master

```json
{ "fotos": [ { "id": "ee0e8400-...", "ordem": 0 }, { "id": "dd0e8400-...", "ordem": 1 } ] }
```
Máximo **200** fotos; `ordem` de 0 a 100000; ids sem repetição; as fotos não citadas ficam como estão. Tudo-ou-nada numa transação com o
relatório travado: se **alguma** foto não for **deste relatório** (inexistente, de outro relatório ou de outra obra, indistinguíveis) → **400**
`{ "errors": { "Fotos": ["Uma ou mais fotos informadas nao pertencem a este relatorio."] } }` sem alterar nenhuma. Sucesso: **200** com
**todas** as fotos do relatório (`FotoResponse[]`) na nova ordem. 400 também para lista vazia, > 200, id vazio, id repetido ou ordem inválida;
403 (cliente, antes de validar o corpo); 404 (relatório inexistente). Auditoria `fotos_reordenadas` (um registro): `{ "obraId", "quantidade": 2 }`.

### 10. Baixar foto
**GET** `/fotos/{fotoId}/arquivo` — qualquer usuário com acesso à obra (cliente só da própria). Resposta: a imagem
(`image/jpeg|png|webp|gif` pela extensão da chave), `Content-Disposition` fixo `foto-{id}{ext}`, `X-Content-Type-Options: nosniff`.
O front busca com o token (fetch → blob → object URL), pois `<img src>` não envia `Authorization`.

---

## Módulo Relatórios Mensais

Gerencia relatórios consolidados mensais de obra com máquina de estados.

### Estados
- `draft`: Rascunho (editável)
- `published`: Publicado (fechado)

### 1. Criar Relatório Mensal
**POST** `/relatorios-mensais`

Cria relatório mensal para uma obra. Estados: `draft` → `published`.

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/relatorios-mensais \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "770e8400-e29b-41d4-a716-446655440000",
    "mesReferencia": "2026-10",
    "resumo": "Progresso de 50% na fundação"
  }'
```

**Response (201 Created):**
```json
{
  "id": "ee0e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "mesReferencia": "2026-10",
  "resumo": "Progresso de 50% na fundação",
  "status": "Draft",
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Relatórios Mensais
**GET** `/relatorios-mensais?obraId={id}&published=true`

Lista relatórios mensais de uma obra (filtrável por status published).

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

**Query Params:**
- `published` (opcional): `true` para apenas publicados, `false` para rascunhos

### 3. Obter Relatório Mensal por ID
**GET** `/relatorios-mensais/{id}`

Retorna detalhes de um relatório mensal.

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

### 4. Publicar Relatório Mensal
**POST** `/relatorios-mensais/{id}/publish`

Publica relatório mensal (transição: `draft` → `published`). Somente Admin/Master.

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/relatorios-mensais/ee0e8400-e29b-41d4-a716-446655440000/publish \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "id": "ee0e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "mesReferencia": "2026-10",
  "resumo": "Progresso de 50% na fundação",
  "status": "Published",
  "publishedAt": "2026-10-12T16:00:00Z"
}
```

---

## Módulo Projetos/Documentos

Documentos técnicos (plantas, memoriais) de uma obra, opcionalmente ligados a uma etapa (SPEC §5 item 9 e §6 item 12). Todo
endpoint com id de documento resolve o `obra_id`, chama `EnsureAccessAsync` (403) e só então lê/grava com `WHERE id AND obra_id`.
Ordem de erros: 401 sem token → 403 (cliente / sem acesso à obra, **antes** de ler o corpo ou o arquivo) → 404 → 400. O cliente é
somente leitura (lista e download da própria obra); toda escrita é `AdminOrMaster`.

**Formatos:** `uploadedAt` ISO 8601 UTC; IDs GUID; JSON em camelCase. Validação de corpo JSON (400):
`{ "title", "status", "errors": { "Campo": ["msg"] } }`; outros 400 do upload: `{ "message": "..." }`. A chave do bucket
(`storage_key`) **nunca** aparece em resposta; o arquivo sai só por `GET /projetos/{id}/download`.

**DTO do documento (`ProjetoDocumentoResponse`, admin e cliente; não há campo interno):**
```json
{
  "id": "ff0e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "etapaId": "aa0e8400-e29b-41d4-a716-446655440000",
  "nome": "planta-baixa.pdf",
  "tipoDocumento": "Planta baixa",
  "uploadedAt": "2026-10-12T10:15:00Z"
}
```
`etapaId` e `tipoDocumento` podem ser `null`. Lista ordenada por ordem da etapa (sem etapa por último), `uploadedAt` mais novo primeiro,
`nome`, `id`.

### 1. Listar documentos da obra
**GET** `/obras/{obraId}/projetos` — qualquer usuário com acesso à obra. **200** array de `ProjetoDocumentoResponse` (sem paginação; no
máximo 200 por obra), 403. Obra inexistente devolve `[]` para Admin/Master.

### 2. Enviar documento
**POST** `/obras/{obraId}/projetos?etapaId={guid}&tipoDocumento=Planta%20baixa` — Admin, Master. `multipart/form-data`, campo `file`;
`etapaId` e `tipoDocumento` vão na **query string** (opcionais).

- Arquivo: máx 10 MB, extensão + MIME + magic bytes (`FileUploadValidator`) e **só estes tipos**: `.pdf`, `.jpg`, `.jpeg`, `.png`,
  `.webp`, `.gif` (o cliente visualiza) e `.doc`, `.docx`, `.xls`, `.xlsx` (o cliente baixa). `.txt` (aceito pelo validador genérico),
  DWG e ZIP = 400 `{ message }`.
- Nome do arquivo: 1 a **255** caracteres, sem `/`, `\` nem caracteres de controle (400 `{ message }`, antes do R2). O nome vira o
  `nome` exibido/baixado; a chave no R2 é `obras/{obraId}/projetos/{guid}{ext}` (sem o nome original, nunca exposta).
- `tipoDocumento`: texto livre aparado, até **50** caracteres, sem controle (vazio = `null`); acima disso 400 `{ message }`.
- `etapaId`: precisa ser **da mesma obra**; inexistente e de outra obra dão o **mesmo** 400
  `{ "errors": { "EtapaId": ["A etapa informada deve ser desta obra."] } }`.
- Limite de **200 documentos por obra**: o 201º = **400** `{ "message": "Cada obra aceita no maximo 200 documentos de projeto." }`, nada
  vai ao R2. A contagem é refeita numa transação que trava a linha da obra (`FOR NO KEY UPDATE`), então uploads simultâneos não passam do
  limite. Se o `INSERT` falhar (500) ou o limite estourar na corrida (400), o objeto é removido do R2.
- Ordem: acesso (403) → arquivo (400) → obra existe (**404**) → limite → etapa → nome → tipo → extensão → R2.

**201** (`Location: /projetos/{id}`, corpo = DTO), 400, 403, 404 (obra inexistente). Auditoria `projeto_enviado` (entidade
`projeto_documento`, id do documento): `{ "obraId": "...", "etapaId": "..." | null }` (sem nome nem tipo).

### 3. Editar metadados
**PUT** `/projetos/{id}` — Admin, Master

```json
{ "nome": "Planta baixa rev. 2.pdf", "tipoDocumento": "Planta baixa", "etapaId": null }
```
**Substitui** os três campos: mande sempre todos (`tipoDocumento` e `etapaId` ausentes ou `null` **limpam**). O arquivo, a obra e a data
de envio nunca mudam (um `obraId` no JSON é ignorado). Regras: `nome` 1 a 255, sem barras/controle e **com a mesma extensão do arquivo**
(sem diferenciar maiúsculas; `planta` ou `planta.docx` num PDF = 400 `errors.Nome`); `tipoDocumento` até 50; `etapaId` da mesma obra
(senão o 400 `errors.EtapaId` acima). **200** (DTO atualizado), 400, 403, 404. Auditoria `projeto_editado`:
`{ "obraId", "campos": ["nome","tipoDocumento","etapaId"] }` (só nomes dos campos que mudaram; nada alterado = sem registro).

### 4. Excluir documento
**DELETE** `/projetos/{id}` — Admin, Master. **204**, 403, 404. Exclusão **definitiva** (sem lixeira): `DELETE ... WHERE id AND obra_id
RETURNING` e, com o banco confirmado, o arquivo sai do R2 (falha no R2 não desfaz: 204 + aviso no log, objeto órfão). Auditoria
`projeto_excluido`: `{ "obraId", "etapaId" }`. Se a auditoria falhar, o arquivo ainda é removido do R2 e a requisição responde 500.

### 5. Baixar documento
**GET** `/projetos/{id}/download` — qualquer usuário com acesso à obra (cliente só da própria). Resposta: o arquivo, com `Content-Type`
pela extensão da **chave** do R2 (não do nome editável), `X-Content-Type-Options: nosniff` e `Content-Disposition` com o `nome` do
documento (se o nome estiver vazio, tiver barras/controle ou extensão diferente da do arquivo: `projeto-{id}{ext}`). O front busca com o
token (fetch → blob); só PDF e imagem abrem no navegador, o resto baixa. **200**, 403, 404.

---

## Módulo Fornecedores

Gerencia fornecedores (módulo interno, sem escopo de obra).

### 1. Criar Fornecedor
**POST** `/fornecedores`

Cria fornecedor (módulo interno, sem escopo de obra).

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/fornecedores \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Areia e Agregados LTDA",
    "email": "contato@areiaagg.com.br",
    "telefone": "11 3456-7890",
    "endereco": "Rua Industrial, 500, São Paulo, SP"
  }'
```

**Response (201 Created):**
```json
{
  "id": "gg0e8400-e29b-41d4-a716-446655440000",
  "name": "Areia e Agregados LTDA",
  "email": "contato@areiaagg.com.br",
  "telefone": "11 3456-7890",
  "endereco": "Rua Industrial, 500, São Paulo, SP",
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Fornecedores
**GET** `/fornecedores`

Lista todos os fornecedores.

**Autorização:** Admin, Master

### 3. Obter Fornecedor por ID
**GET** `/fornecedores/{id}`

Retorna detalhes de um fornecedor.

**Autorização:** Admin, Master

---

## Módulo Prestadores

Gerencia prestadores de serviço.

### 1. Criar Prestador
**POST** `/prestadores`

Cria prestador de serviço (módulo interno, sem escopo de obra).

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/prestadores \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Eng. João Pereira",
    "especialidade": "estrutura",
    "email": "joao.pereira@email.com",
    "telefone": "11 98765-4321"
  }'
```

**Response (201 Created):**
```json
{
  "id": "hh0e8400-e29b-41d4-a716-446655440000",
  "name": "Eng. João Pereira",
  "especialidade": "Estrutura",
  "email": "joao.pereira@email.com",
  "telefone": "11 98765-4321",
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Prestadores
**GET** `/prestadores?obraId={id}`

Lista prestadores vinculados a uma obra.

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

### 3. Obter Prestador por ID
**GET** `/prestadores/{id}`

Retorna detalhes de um prestador.

**Autorização:** Qualquer usuário

---

## Módulo Estoque

Gerencia itens e movimentações de estoque de obra.

### 1. Criar Item de Estoque
**POST** `/estoque`

Cria item de estoque para uma obra.

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/estoque \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "770e8400-e29b-41d4-a716-446655440000",
    "descricao": "Cimento Portland 50kg",
    "quantidade": 100,
    "unidade": "sacos",
    "valorUnitario": 45.50
  }'
```

**Response (201 Created):**
```json
{
  "id": "ii0e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "descricao": "Cimento Portland 50kg",
  "quantidade": 100,
  "unidade": "Sacos",
  "valorUnitario": 45.50,
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Itens de Estoque
**GET** `/estoque?obraId={id}`

Lista itens de estoque de uma obra.

**Autorização:** Qualquer usuário (acesso validado por ObraAccessService)

### 3. Registrar Movimentação
**POST** `/estoque/{id}/movimentacao`

Registra movimentação (entrada/saída) de estoque.

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/estoque/ii0e8400-e29b-41d4-a716-446655440000/movimentacao \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "saida",
    "quantidade": 25,
    "observacao": "Saída para fundação"
  }'
```

**Response (200 OK):**
```json
{
  "id": "jj0e8400-e29b-41d4-a716-446655440000",
  "estoqueItemId": "ii0e8400-e29b-41d4-a716-446655440000",
  "tipo": "Saida",
  "quantidade": 25,
  "observacao": "Saída para fundação",
  "saldoAnterior": 100,
  "saldoAtual": 75,
  "registradaAt": "2026-10-12T14:30:00Z"
}
```

---

## Módulo Pipeline

Gerencia etapas de pipeline para processos internos.

### 1. Criar Item de Pipeline
**POST** `/pipeline`

Cria etapa de pipeline para gestão de processos internos.

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/pipeline \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Análise de Propostas",
    "descricao": "Análise de propostas recebidas",
    "ordem": 1
  }'
```

**Response (201 Created):**
```json
{
  "id": "kk0e8400-e29b-41d4-a716-446655440000",
  "nome": "Análise de Propostas",
  "descricao": "Análise de propostas recebidas",
  "ordem": 1,
  "createdAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Pipeline
**GET** `/pipeline`

Lista todos os itens de pipeline.

**Autorização:** Admin, Master

---

## Módulo Notificações

Gerencia notificações de usuários.

### 1. Criar Notificação
**POST** `/notificacoes`

Cria notificação para módulo específico (email/WhatsApp - apenas base criada).

**Autorização:** Admin, Master

**Request:**
```bash
curl -X POST http://localhost:5285/notificacoes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "obraId": "770e8400-e29b-41d4-a716-446655440000",
    "modulos": ["medicoes", "financeiro"],
    "canal": "email",
    "assunto": "Medição aprovada"
  }'
```

**Response (201 Created):**
```json
{
  "id": "ll0e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "obraId": "770e8400-e29b-41d4-a716-446655440000",
  "modulos": ["medicoes", "financeiro"],
  "canal": "Email",
  "assunto": "Medição aprovada",
  "enviadoAt": "2026-10-12T10:00:00Z"
}
```

### 2. Listar Minhas Notificações
**GET** `/notificacoes/minhas?pageIndex=0&pageSize=10`

Lista notificações do usuário autenticado.

**Autorização:** Qualquer usuário autenticado

**Query Params:**
- `lidas` (opcional): `true` para apenas lidas, `false` para não lidas

**Response (200 OK):**
```json
{
  "totalItems": 5,
  "pageIndex": 0,
  "pageSize": 10,
  "items": [
    {
      "id": "ll0e8400-e29b-41d4-a716-446655440000",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "obraId": "770e8400-e29b-41d4-a716-446655440000",
      "modulos": ["medicoes"],
      "canal": "Email",
      "assunto": "Medição aprovada",
      "lida": false,
      "enviadoAt": "2026-10-12T10:00:00Z"
    }
  ]
}
```

### 3. Marcar Notificação como Lida
**POST** `/notificacoes/{id}/read`

Marca notificação como lida (IDOR prevention).

**Autorização:** Qualquer usuário autenticado (somente próprias notificações)

**Request:**
```bash
curl -X POST http://localhost:5285/notificacoes/ll0e8400-e29b-41d4-a716-446655440000/read \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "id": "ll0e8400-e29b-41d4-a716-446655440000",
  "lida": true,
  "lidaAt": "2026-10-12T15:00:00Z"
}
```

---

## Módulo Auditoria

Gerencia log de auditoria de operações.

### 1. Consultar Log de Auditoria
**GET** `/auditoria?entidade=obra&pageIndex=0&pageSize=10`

Consulta log de auditoria por entidade (somente Master).

**Autorização:** Master

**Query Params:**
- `entidade` (opcional): Tipo de entidade (`obra`, `medicao`, `financeiro`, etc.)
- `pageIndex` (opcional): Página (padrão: 0)
- `pageSize` (opcional): Itens por página (padrão: 10)

**Response (200 OK):**
```json
{
  "totalItems": 50,
  "pageIndex": 0,
  "pageSize": 10,
  "items": [
    {
      "id": "mm0e8400-e29b-41d4-a716-446655440000",
      "usuarioId": "550e8400-e29b-41d4-a716-446655440000",
      "usuarioNome": "João Silva",
      "entidade": "Obra",
      "entityId": "770e8400-e29b-41d4-a716-446655440000",
      "acao": "Create",
      "detalhesAntes": null,
      "detalhesDepois": "{...}",
      "timestamp": "2026-10-12T10:00:00Z",
      "enderecoIp": "192.168.1.1"
    }
  ]
}
```

---

## Health Check

### Verificar Saúde da API
**GET** `/healthcheck`

Verifica a saúde da API e conectividade com o banco de dados.

**Request:**
```bash
curl -X GET http://localhost:5285/healthcheck
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

**Response (500 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "database": "disconnected"
}
```

---

## Codes de Erro

| HTTP Status | Código | Descrição |
|---|---|---|
| **200** | OK | Requisição bem-sucedida |
| **201** | Created | Recurso criado com sucesso |
| **204** | No Content | Sucesso, sem corpo na resposta |
| **400** | Bad Request | Validação falhou (veja `errors` no body) |
| **401** | Unauthorized | Token ausente ou inválido |
| **403** | Forbidden | Sem permissão (acesso a obra de outro usuário, role insuficiente) |
| **404** | Not Found | Recurso não encontrado |
| **409** | Conflict | Transição de estado inválida (ex: aprovar medição já aprovada) |
| **500** | Internal Server Error | Erro no servidor (veja `requestId` para investigação) |

---

## Observações Importantes

### Segurança
1. **CORS:** Ainda não configurado. Ao conectar o frontend, será liberar apenas a origem exata. Nunca usar `AllowAnyOrigin`.
2. **Rate Limiting:** Não implementado em `/auth/login`. Recomendado implementar em produção.
3. **JWT Refresh:** Tokens têm 8h de expiração, sem refresh token. Usuário precisa fazer login novamente.
4. **Uploads:** Todos os uploads são validados (magic bytes + tamanho + extensão). Máximo 10MB.
5. **IDOR Prevention:** Todo endpoint com escopo de obra valida acesso via `ObraAccessService`. Filtros SQL adicionais por `user_id`.

### Convenções
1. **Paginação:** `pageIndex` começa em **0** (não 1).
2. **Valores Monetários:** Sempre `decimal` com até 2 casas decimais.
3. **Datas:** ISO 8601 (ex: `2026-10-12T10:00:00Z`).
4. **Enums (Respostas):** PascalCase (`PendingApproval`, `Approved`, `Draft`, `Published`).
5. **Enums (Requests):** snake_case aceito (`pending_approval`, `draft`).

### Próximas Fases
- **Fase 9:** Frontend React + Vite (começando pela visão do cliente)
- **Fase 10:** PDF consolidado e integração de email real
- **SaaS Transformation:** Adiada até posterior feedback do usuário

---

**Atualizado em:** 2026-10-12  
**Versão:** 1.0 (Backend Fases 1-8)  
**Documentação Interativa:** `/openapi/v1.json`
