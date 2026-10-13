-- 007_financeiro_visivel_cliente.sql
-- Controla quais lancamentos financeiros o CLIENTE da obra pode ver.
-- Padrao FALSE: nada interno chega ao cliente ate o admin liberar explicitamente.
-- Lancamentos ja existentes ficam ocultos (default seguro).

ALTER TABLE financeiro_lancamentos
    ADD COLUMN visivel_cliente BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_financeiro_lancamentos_obra_visivel
    ON financeiro_lancamentos(obra_id)
    WHERE visivel_cliente;
