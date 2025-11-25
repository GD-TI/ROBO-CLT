-- APLICAR ESTE SCHEMA DEPOIS DO SCHEMA ORIGINAL

-- Tabela de JOBS
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bank_credential_id INTEGER REFERENCES bank_credentials(id),
    name VARCHAR(255) NOT NULL,
    total_cpfs INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    completed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    processing_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);

-- Adicionar job_id nas simulações
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE;

-- Remover partner_id (se existir)
ALTER TABLE bank_credentials DROP COLUMN IF EXISTS partner_id;
ALTER TABLE simulations DROP COLUMN IF EXISTS partner_id;

-- Índices
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulations_job_id ON simulations(job_id);

-- Trigger para atualizar contadores do job
CREATE OR REPLACE FUNCTION update_job_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE jobs SET
        completed_count = (
            SELECT COUNT(*) FROM simulations 
            WHERE job_id = NEW.job_id 
            AND status IN ('COMPLETED', 'FAILED', 'REJECTED', 'TIMEOUT')
        ),
        success_count = (
            SELECT COUNT(*) FROM simulations 
            WHERE job_id = NEW.job_id 
            AND status = 'COMPLETED'
        ),
        failed_count = (
            SELECT COUNT(*) FROM simulations 
            WHERE job_id = NEW.job_id 
            AND status IN ('FAILED', 'REJECTED', 'TIMEOUT')
        ),
        processing_count = (
            SELECT COUNT(*) FROM simulations 
            WHERE job_id = NEW.job_id 
            AND status IN ('PENDING', 'PROCESSING')
        ),
        status = CASE
            WHEN (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status IN ('PENDING', 'PROCESSING')) = 0
            THEN 'COMPLETED'
            ELSE 'PROCESSING'
        END,
        finished_at = CASE
            WHEN (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status IN ('PENDING', 'PROCESSING')) = 0
            AND finished_at IS NULL
            THEN CURRENT_TIMESTAMP
            ELSE finished_at
        END
    WHERE id = NEW.job_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_job_counts_trigger ON simulations;
CREATE TRIGGER update_job_counts_trigger 
    AFTER UPDATE ON simulations
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_job_counts();

-- Usuário admin padrão (senha: admin123)
INSERT INTO users (email, password_hash, name) 
VALUES ('admin@sistema.com', '$2b$10$8K1p/a0dL3AMPyH/Rg4W4.bF5qGqE4hQnCqOQYIYT5Qn4Gx4k4wVK', 'Administrador')
ON CONFLICT (email) DO NOTHING;
