-- 004_create_contratos_pagamentos.sql
-- Contratos da obra e pagamentos recebidos do cliente

CREATE TABLE contratos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id             UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    numero              VARCHAR(50) NOT NULL,
    valor_contratado    NUMERIC(14,2) NOT NULL,
    data_assinatura     DATE,
    storage_key         VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (obra_id, numero)
);

CREATE INDEX idx_contratos_obra_id ON contratos(obra_id);

CREATE TABLE pagamentos (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contrato_id             UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    referente_medicao_id    UUID REFERENCES medicoes(id),
    valor                   NUMERIC(14,2) NOT NULL,
    data_pagamento          DATE NOT NULL,
    forma_pagamento         VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagamentos_contrato_id ON pagamentos(contrato_id);
CREATE INDEX idx_pagamentos_referente_medicao_id ON pagamentos(referente_medicao_id);
