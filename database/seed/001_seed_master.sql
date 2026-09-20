-- 001_seed_master.sql
-- Usuario master inicial - unico jeito de logar antes de existir gestao de usuarios funcional

INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    'Guilherme Girardi',
    'girardi.gui@icloud.com',
    'AQAAAAIAAYagAAAAECtQ8yNvHB1v3GMXz1aca2WKqfuR7v7RX1bd3uXpenuaOGnJ311vDo1v+4Jdo74oJQ==',
    'master',
    true,
    now(),
    now()
);