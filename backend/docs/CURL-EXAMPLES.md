# KhazObras API — Exemplos Curl

Exemplos prontos para copiar/colar na terminal. Substitua `<variáveis>` conforme necessário.

**Base URL:** `http://localhost:5285` (local)  
**Produção:** `https://khazobras.example.com` (será atualizada)

---

## 1. Autenticação

### Login (obter JWT token)
```bash
curl -X POST http://localhost:5285/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "senha123"
  }' | jq .
```

**Resposta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-10-12T18:00:00Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "João Silva",
  "email": "user@example.com",
  "role": "Client"
}
```

**Salvar token em variável de ambiente:**
```bash
TOKEN=$(curl -X POST http://localhost:5285/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}' | jq -r '.token')

echo "Token: $TOKEN"
```

---

## 2. Verificar Saúde da API

```bash
curl -X GET http://localhost:5285/healthcheck | jq .
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## 3. Usuários

### Obter dados do usuário autenticado
```bash
curl -X GET http://localhost:5285/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Listar todos os usuários (Master)
```bash
curl -X GET http://localhost:5285/users \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Criar novo usuário (Master)
```bash
curl -X POST http://localhost:5285/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "password": "senha_segura_123",
    "role": "Admin"
  }' | jq .
```

### Vincular usuário a obra (Master)
```bash
curl -X POST http://localhost:5285/users/<USER_ID>/obras/<OBRA_ID> \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Obras

### Criar obra
```bash
curl -X POST http://localhost:5285/obras \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Residência João Silva",
    "endereco": "Rua das Flores, 123, São Paulo, SP",
    "dataInicio": "2026-10-15",
    "previsaoConclusao": "2027-06-30",
    "valorTotal": 500000.00,
    "descricao": "Construção de residência unifamiliar"
  }' | jq .
```

### Listar obras (paginado)
```bash
curl -X GET "http://localhost:5285/obras?pageIndex=0&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter obra por ID
```bash
curl -X GET http://localhost:5285/obras/<OBRA_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Salvar obra_id em variável
```bash
OBRA_ID=$(curl -X POST http://localhost:5285/obras \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","endereco":"Test","dataInicio":"2026-10-15","previsaoConclusao":"2027-06-30","valorTotal":100000}' | jq -r '.id')

echo "Obra criada: $OBRA_ID"
```

---

## 5. Etapas

### Criar etapa
```bash
curl -X POST http://localhost:5285/etapas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "<OBRA_ID>",
    "name": "Fundação e Estrutura",
    "dataInicio": "2026-10-15",
    "dataTermino": "2026-12-30",
    "orcado": 100000.00
  }' | jq .
```

### Listar etapas de uma obra
```bash
curl -X GET "http://localhost:5285/etapas?obraId=<OBRA_ID>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter etapa por ID
```bash
curl -X GET http://localhost:5285/etapas/<ETAPA_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 6. Medições (Fluxo Completo)

### Criar medição (estado: pending_approval)
```bash
curl -X POST http://localhost:5285/medicoes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "<OBRA_ID>",
    "etapaId": "<ETAPA_ID>",
    "mesReferencia": "2026-10",
    "valor": 50000.00,
    "descricao": "Medição de 50% da fundação"
  }' | jq .
```

### Listar medições de uma obra
```bash
curl -X GET "http://localhost:5285/medicoes?obraId=<OBRA_ID>&pageIndex=0&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter medição por ID
```bash
curl -X GET http://localhost:5285/medicoes/<MEDICAO_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Aprovar medição (Client) — transição: pending_approval → approved
```bash
curl -X POST http://localhost:5285/medicoes/<MEDICAO_ID>/approve \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Emitir nota fiscal (Admin/Master) — transição: approved → invoice_issued
```bash
curl -X POST http://localhost:5285/medicoes/<MEDICAO_ID>/invoice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "numeroNota": "NF-2026-001",
    "dataEmissao": "2026-10-12"
  }' | jq .
```

---

## 7. Financeiro

### Criar lançamento financeiro
```bash
curl -X POST http://localhost:5285/financeiro/lancamentos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "<OBRA_ID>",
    "tipo": "despesa",
    "descricao": "Compra de materiais de construção",
    "valor": 25000.00,
    "data": "2026-10-12",
    "categoria": "materiais"
  }' | jq .
```

### Listar lançamentos de uma obra
```bash
curl -X GET "http://localhost:5285/financeiro/lancamentos?obraId=<OBRA_ID>&pageIndex=0&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter lançamento por ID
```bash
curl -X GET http://localhost:5285/financeiro/lancamentos/<LANCAMENTO_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Anexar arquivo a lançamento (máx 10MB)
```bash
curl -X POST http://localhost:5285/financeiro/lancamentos/<LANCAMENTO_ID>/anexo \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@nota_fiscal.pdf"
```

### Baixar arquivo de lançamento
```bash
curl -X GET http://localhost:5285/financeiro/lancamentos/<LANCAMENTO_ID>/anexo \
  -H "Authorization: Bearer $TOKEN" \
  -o nota_fiscal.pdf
```

---

## 8. Relatórios Fotográficos

### Criar relatório fotográfico
```bash
curl -X POST http://localhost:5285/relatorios-fotograficos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "<OBRA_ID>",
    "data": "2026-10-12",
    "descricao": "Progresso da fundação - 50% concluído"
  }' | jq .
```

### Listar relatórios fotográficos de uma obra
```bash
curl -X GET "http://localhost:5285/relatorios-fotograficos?obraId=<OBRA_ID>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter relatório fotográfico por ID
```bash
curl -X GET http://localhost:5285/relatorios-fotograficos/<RELATORIO_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Adicionar foto a relatório
```bash
curl -X POST http://localhost:5285/relatorios-fotograficos/<RELATORIO_ID>/fotos \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@foto_fundacao.png"
```

---

## 9. Relatórios Mensais

### Criar relatório mensal (estado: draft)
```bash
curl -X POST http://localhost:5285/relatorios-mensais \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "<OBRA_ID>",
    "mesReferencia": "2026-10",
    "resumo": "Progresso de 50% na fundação"
  }' | jq .
```

### Listar relatórios mensais de uma obra
```bash
curl -X GET "http://localhost:5285/relatorios-mensais?obraId=<OBRA_ID>&published=false" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter relatório mensal por ID
```bash
curl -X GET http://localhost:5285/relatorios-mensais/<RELATORIO_MENSAL_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Publicar relatório mensal — transição: draft → published
```bash
curl -X POST http://localhost:5285/relatorios-mensais/<RELATORIO_MENSAL_ID>/publish \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 10. Projetos/Documentos

### Anexar documento a obra
```bash
curl -X POST http://localhost:5285/projetos/documentos \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@planta_arquitera.pdf" \
  -F "obraId=<OBRA_ID>" \
  -F "tipo=planta_arquitetura"
```

### Listar documentos de uma obra
```bash
curl -X GET "http://localhost:5285/projetos/documentos?obraId=<OBRA_ID>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Baixar documento
```bash
curl -X GET http://localhost:5285/projetos/documentos/<DOCUMENTO_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -o planta_arquitera.pdf
```

---

## 11. Fornecedores

### Criar fornecedor
```bash
curl -X POST http://localhost:5285/fornecedores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Areia e Agregados LTDA",
    "email": "contato@areiaagg.com.br",
    "telefone": "11 3456-7890",
    "endereco": "Rua Industrial, 500, São Paulo, SP"
  }' | jq .
```

### Listar fornecedores
```bash
curl -X GET http://localhost:5285/fornecedores \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter fornecedor por ID
```bash
curl -X GET http://localhost:5285/fornecedores/<FORNECEDOR_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 12. Prestadores

### Criar prestador
```bash
curl -X POST http://localhost:5285/prestadores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Eng. João Pereira",
    "especialidade": "estrutura",
    "email": "joao.pereira@email.com",
    "telefone": "11 98765-4321"
  }' | jq .
```

### Listar prestadores de uma obra
```bash
curl -X GET "http://localhost:5285/prestadores?obraId=<OBRA_ID>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Obter prestador por ID
```bash
curl -X GET http://localhost:5285/prestadores/<PRESTADOR_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 13. Estoque

### Criar item de estoque
```bash
curl -X POST http://localhost:5285/estoque \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obraId": "<OBRA_ID>",
    "descricao": "Cimento Portland 50kg",
    "quantidade": 100,
    "unidade": "sacos",
    "valorUnitario": 45.50
  }' | jq .
```

### Listar itens de estoque de uma obra
```bash
curl -X GET "http://localhost:5285/estoque?obraId=<OBRA_ID>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Registrar movimentação de estoque
```bash
curl -X POST http://localhost:5285/estoque/<ESTOQUE_ID>/movimentacao \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "saida",
    "quantidade": 25,
    "observacao": "Saída para fundação"
  }' | jq .
```

---

## 14. Pipeline

### Criar etapa de pipeline
```bash
curl -X POST http://localhost:5285/pipeline \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Análise de Propostas",
    "descricao": "Análise de propostas recebidas",
    "ordem": 1
  }' | jq .
```

### Listar pipeline
```bash
curl -X GET http://localhost:5285/pipeline \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 15. Notificações

### Criar notificação
```bash
curl -X POST http://localhost:5285/notificacoes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<USER_ID>",
    "obraId": "<OBRA_ID>",
    "modulos": ["medicoes", "financeiro"],
    "canal": "email",
    "assunto": "Medição aprovada"
  }' | jq .
```

### Listar minhas notificações
```bash
curl -X GET "http://localhost:5285/notificacoes/minhas?pageIndex=0&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Marcar notificação como lida
```bash
curl -X POST http://localhost:5285/notificacoes/<NOTIFICACAO_ID>/read \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 16. Auditoria

### Consultar log de auditoria (Master)
```bash
curl -X GET "http://localhost:5285/auditoria?entidade=obra&pageIndex=0&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Script Completo de Fluxo

Exemplo de automação de um fluxo completo (login → criar obra → criar etapa → criar medição → aprovar → faturar):

```bash
#!/bin/bash

BASE_URL="http://localhost:5285"
EMAIL="user@example.com"
PASSWORD="senha123"

# 1. Login
echo "1. Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Token obtido: ${TOKEN:0:20}..."

# 2. Criar obra
echo -e "\n2. Criando obra..."
OBRA_RESPONSE=$(curl -s -X POST $BASE_URL/obras \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Residência Automática",
    "endereco": "Rua Teste, 123",
    "dataInicio": "2026-10-15",
    "previsaoConclusao": "2027-06-30",
    "valorTotal": 500000.00,
    "descricao": "Test"
  }')

OBRA_ID=$(echo $OBRA_RESPONSE | jq -r '.id')
echo "Obra criada: $OBRA_ID"

# 3. Criar etapa
echo -e "\n3. Criando etapa..."
ETAPA_RESPONSE=$(curl -s -X POST $BASE_URL/etapas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"obraId\": \"$OBRA_ID\",
    \"name\": \"Fundação\",
    \"dataInicio\": \"2026-10-15\",
    \"dataTermino\": \"2026-12-30\",
    \"orcado\": 100000.00
  }")

ETAPA_ID=$(echo $ETAPA_RESPONSE | jq -r '.id')
echo "Etapa criada: $ETAPA_ID"

# 4. Criar medição
echo -e "\n4. Criando medição..."
MEDICAO_RESPONSE=$(curl -s -X POST $BASE_URL/medicoes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"obraId\": \"$OBRA_ID\",
    \"etapaId\": \"$ETAPA_ID\",
    \"mesReferencia\": \"2026-10\",
    \"valor\": 50000.00,
    \"descricao\": \"Medição de teste\"
  }")

MEDICAO_ID=$(echo $MEDICAO_RESPONSE | jq -r '.id')
echo "Medição criada: $MEDICAO_ID (status: PendingApproval)"

# 5. Aprovar medição
echo -e "\n5. Aprovando medição..."
APPROVE_RESPONSE=$(curl -s -X POST $BASE_URL/medicoes/$MEDICAO_ID/approve \
  -H "Authorization: Bearer $TOKEN")

echo "Medição aprovada (novo status: Approved)"

# 6. Emitir nota fiscal
echo -e "\n6. Emitindo nota fiscal..."
INVOICE_RESPONSE=$(curl -s -X POST $BASE_URL/medicoes/$MEDICAO_ID/invoice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "numeroNota": "NF-2026-001",
    "dataEmissao": "2026-10-12"
  }')

echo "Nota fiscal emitida (novo status: InvoiceIssued)"
echo -e "\n=== Fluxo completo finalizado com sucesso! ==="
```

**Salvar como `workflow.sh` e executar:**
```bash
chmod +x workflow.sh
./workflow.sh
```

---

## Dicas e Troubleshooting

### Instalar jq (JSON parsing)
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Windows (com WSL)
sudo apt-get install jq
```

### Erro: `401 Unauthorized`
Token expirado ou não fornecido. Faça login novamente e obtenha um novo token.

### Erro: `403 Forbidden`
Sem permissão (role insuficiente ou acesso negado à obra). Verifique:
- Seu role (Client, Admin, Master)
- Seu acesso à obra (vinculação via user_obras)

### Erro: `404 Not Found`
Recurso não existe. Verifique o ID.

### Erro: `400 Bad Request`
Validação falhou. Verifique o JSON enviado e tipos de dados.

---

**Atualizado em:** 2026-10-12  
**Total de Exemplos:** 40+ curls + 1 script de automação
