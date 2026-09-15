-- 002_create_obras.sql
-- Tabela de obras (projetos) e vinculo entre usuarios (clientes) e obras

CREATE TYPE obra_status AS ENUM ('em_andamento', 'concluida', 'pausada');

CREATE TABLE obras (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome                    VARCHAR(150) NOT NULL,
    endereco                VARCHAR(255),
    valor_contratado        NUMERIC(14,2) NOT NULL,
    data_inicio             DATE,
    data_previsao_termino   DATE,
    status                  obra_status NOT NULL DEFAULT 'em_andamento',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obras_status ON obras(status);

-- Vinculo N:N entre usuarios (clientes) e obras.
-- Modelado como N:N para nao travar caso um cliente venha a ter mais de uma obra no futuro,
-- mesmo que hoje a regra de negocio seja 1 login de cliente = 1 obra.
CREATE TABLE user_obra (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    obra_id     UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, obra_id)
);

CREATE INDEX idx_user_obra_obra_id ON user_obra(obra_id);
