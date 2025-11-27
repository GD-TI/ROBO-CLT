-- Tabela para armazenar webhooks de consultas do banco
CREATE TABLE IF NOT EXISTS webhook_consult (
    id VARCHAR(255) PRIMARY KEY,  -- ID da consulta (vem do banco)
    status VARCHAR(50) NOT NULL,  -- SUCCESS, REJECTED, WAITING_CONSULT, PROCESSING, etc.
    description TEXT,             -- Descrição do status
    message TEXT,                 -- Mensagem adicional
    payload JSONB,                -- Payload completo do webhook
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_webhook_consult_status ON webhook_consult(status);

-- Índice para buscar por data de recebimento
CREATE INDEX IF NOT EXISTS idx_webhook_consult_received_at ON webhook_consult(received_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_webhook_consult_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_webhook_consult_updated_at
    BEFORE UPDATE ON webhook_consult
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_consult_updated_at();
