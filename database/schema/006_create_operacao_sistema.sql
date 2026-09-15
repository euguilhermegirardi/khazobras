-- 006_create_operacao_sistema.sql
-- Operacao interna (nunca exposta ao cliente) + tabelas de sistema (notificacoes, auditoria)

-- ===== OPERACAO INTERNA =====

CREATE TABLE fornecedores (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome        VARCHAR(150) NOT NULL,
    cnpj_cpf    VARCHAR(20),
    contato     VARCHAR(150),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prestadores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id         UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    nome            VARCHAR(150) NOT NULL,
    funcao          VARCHAR(100),
    valor_contrato  NUMERIC(14,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prestadores_obra_id ON prestadores(obra_id);

CREATE TABLE estoque_itens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id             UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    nome                VARCHAR(150) NOT NULL,
    unidade             VARCHAR(20) NOT NULL,
    quantidade_atual    NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estoque_itens_obra_id ON estoque_itens(obra_id);

CREATE TYPE estoque_movimentacao_tipo AS ENUM ('entrada', 'saida');

CREATE TABLE estoque_movimentacoes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id     UUID NOT NULL REFERENCES estoque_itens(id) ON DELETE CASCADE,
    tipo        estoque_movimentacao_tipo NOT NULL,
    quantidade  NUMERIC(12,2) NOT NULL,
    data        DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estoque_movimentacoes_item_id ON estoque_movimentacoes(item_id);

CREATE TABLE pipeline (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_cliente_potencial  VARCHAR(150) NOT NULL,
    valor_estimado          NUMERIC(14,2),
    probabilidade           NUMERIC(5,2),
    etapa_funil             VARCHAR(50) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== SISTEMA =====

CREATE TABLE notificacoes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id     UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    modulos     JSONB NOT NULL,
    canal       VARCHAR(30) NOT NULL,
    enviado_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    lida_at     TIMESTAMPTZ
);

CREATE INDEX idx_notificacoes_user_id ON notificacoes(user_id);
CREATE INDEX idx_notificacoes_obra_id ON notificacoes(obra_id);

CREATE TABLE log_auditoria (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    acao        VARCHAR(100) NOT NULL,
    entidade    VARCHAR(100) NOT NULL,
    entidade_id UUID,
    detalhes    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_log_auditoria_user_id ON log_auditoria(user_id);
CREATE INDEX idx_log_auditoria_entidade ON log_auditoria(entidade, entidade_id);
