-- 003_create_medicoes_financeiro.sql
-- Etapas da obra, medicoes (com fluxo de aprovacao do cliente) e financeiro

CREATE TABLE etapas (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id                 UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    nome                    VARCHAR(150) NOT NULL,
    ordem                   INTEGER NOT NULL,
    percentual_peso         NUMERIC(5,2) NOT NULL DEFAULT 0,
    data_inicio_prevista    DATE,
    data_inicio_real        DATE,
    data_fim_prevista       DATE,
    data_fim_real           DATE,
    status                  VARCHAR(30) NOT NULL DEFAULT 'nao_iniciada',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_etapas_obra_id ON etapas(obra_id);

-- Status da medicao em ingles, conforme definido
CREATE TYPE medicao_status AS ENUM ('pending_approval', 'approved', 'invoice_issued');

CREATE TABLE medicoes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id             UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    etapa_id            UUID REFERENCES etapas(id),
    numero              INTEGER NOT NULL,
    competencia         DATE NOT NULL,
    valor_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
    status              medicao_status NOT NULL DEFAULT 'pending_approval',
    approved_at         TIMESTAMPTZ,
    approved_by_user_id UUID REFERENCES users(id),
    nf_number           VARCHAR(50),
    nf_issued_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (obra_id, numero)
);

CREATE INDEX idx_medicoes_obra_id ON medicoes(obra_id);
CREATE INDEX idx_medicoes_status ON medicoes(status);

CREATE TYPE item_tipo AS ENUM ('mao_de_obra', 'material', 'equipamento');

CREATE TABLE medicao_itens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicao_id      UUID NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
    tipo            item_tipo NOT NULL,
    descricao       VARCHAR(255) NOT NULL,
    quantidade      NUMERIC(12,2) NOT NULL,
    valor_unitario  NUMERIC(14,2) NOT NULL,
    valor_total     NUMERIC(14,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medicao_itens_medicao_id ON medicao_itens(medicao_id);

CREATE TABLE categorias (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome    VARCHAR(100) NOT NULL,
    tipo    item_tipo NOT NULL
);

CREATE TABLE financeiro_lancamentos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id             UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    categoria_id        UUID REFERENCES categorias(id),
    categoria           item_tipo NOT NULL,
    descricao           VARCHAR(255) NOT NULL,
    valor               NUMERIC(14,2) NOT NULL,
    data_lancamento     DATE NOT NULL,
    mes_competencia     DATE NOT NULL,
    created_by_user_id  UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financeiro_lancamentos_obra_id ON financeiro_lancamentos(obra_id);
CREATE INDEX idx_financeiro_lancamentos_mes_competencia ON financeiro_lancamentos(mes_competencia);

-- Anexos/comprovantes vinculados a cada lancamento (o icone de "attach" da visao cliente)
CREATE TABLE financeiro_lancamento_anexos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lancamento_id   UUID NOT NULL REFERENCES financeiro_lancamentos(id) ON DELETE CASCADE,
    nome_arquivo    VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,
    content_type    VARCHAR(100),
    tamanho_bytes   BIGINT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financeiro_anexos_lancamento_id ON financeiro_lancamento_anexos(lancamento_id);
