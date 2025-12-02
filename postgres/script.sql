CREATE UNLOGGED TABLE pagamentos (
    id UUID PRIMARY KEY,
    valor INTEGER NOT NULL,
    gateway VARCHAR(10) NOT NULL,
    status VARCHAR(10) NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
);

-- Index para o filtro de datas (GET /payments)
CREATE INDEX idx_data ON pagamentos(criado_em);