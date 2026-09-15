-- 005_create_relatorios_documentos.sql
-- Relatorios (fotografico e mensal) e documentos tecnicos (projetos) - conteudo client-facing

CREATE TYPE relatorio_fotografico_tipo AS ENUM ('mensal', 'etapa');

CREATE TABLE relatorios_fotograficos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id     UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    tipo        relatorio_fotografico_tipo NOT NULL,
    etapa_id    UUID REFERENCES etapas(id),
    titulo      VARCHAR(150) NOT NULL,
    competencia DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatorios_fotograficos_obra_id ON relatorios_fotograficos(obra_id);
CREATE INDEX idx_relatorios_fotograficos_etapa_id ON relatorios_fotograficos(etapa_id);

CREATE TABLE fotos (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    relatorio_fotografico_id    UUID NOT NULL REFERENCES relatorios_fotograficos(id) ON DELETE CASCADE,
    storage_key                 VARCHAR(500) NOT NULL,
    data_foto                   DATE,
    descricao                   VARCHAR(255),
    ordem                       INTEGER NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fotos_relatorio_fotografico_id ON fotos(relatorio_fotografico_id);

-- "Relatorio ao cliente" no admin / "Relatorio mensal" (somente leitura) no cliente
CREATE TYPE relatorio_mensal_status AS ENUM ('draft', 'published');

CREATE TABLE relatorios_mensais (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id             UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    competencia         DATE NOT NULL,
    conteudo            TEXT NOT NULL,
    status              relatorio_mensal_status NOT NULL DEFAULT 'draft',
    published_at        TIMESTAMPTZ,
    created_by_user_id  UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (obra_id, competencia)
);

CREATE INDEX idx_relatorios_mensais_obra_id ON relatorios_mensais(obra_id);
CREATE INDEX idx_relatorios_mensais_status ON relatorios_mensais(status);

-- "Projetos" no navbar do cliente: plantas/documentos tecnicos organizados por etapa
CREATE TABLE projetos_documentos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id         UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    etapa_id        UUID REFERENCES etapas(id),
    nome            VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,
    tipo_documento  VARCHAR(50),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projetos_documentos_obra_id ON projetos_documentos(obra_id);
CREATE INDEX idx_projetos_documentos_etapa_id ON projetos_documentos(etapa_id);
