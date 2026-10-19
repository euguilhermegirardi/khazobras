-- 008_etapas_percentual_concluido.sql
-- Atualizacao de etapas (cronograma): % concluido (avanco fisico) e status restrito aos 3 valores validos.
-- Etapas existentes ficam com 0% (todas foram criadas 'nao_iniciada': o codigo so gravava esse valor,
-- entao o CHECK do status e seguro para os dados atuais).
-- Aplicar: psql -d khazobras_db -f database/schema/008_etapas_percentual_concluido.sql

ALTER TABLE etapas
    ADD COLUMN percentual_concluido NUMERIC(5,2) NOT NULL DEFAULT 0
        CONSTRAINT chk_etapas_percentual_concluido CHECK (percentual_concluido BETWEEN 0 AND 100);

ALTER TABLE etapas
    ADD CONSTRAINT chk_etapas_status CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida'));
