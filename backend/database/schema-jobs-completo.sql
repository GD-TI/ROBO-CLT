-- SCHEMA COMPLETO - Sistema de Jobs V2
-- Execute APÓS o schema original

-- 1. Criar tabela de JOBS
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

-- 2. Adicionar job_id nas simulações
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE;

-- 3. Remover partner_id (não é mais usado)
ALTER TABLE bank_credentials DROP COLUMN IF EXISTS partner_id;
ALTER TABLE simulations DROP COLUMN IF EXISTS partner_id;

-- 4. Modificar constraint de bank_credential_id para SET NULL ao deletar
ALTER TABLE simulations 
DROP CONSTRAINT IF EXISTS simulations_bank_credential_id_fkey;

ALTER TABLE simulations 
ADD CONSTRAINT simulations_bank_credential_id_fkey 
FOREIGN KEY (bank_credential_id) 
REFERENCES bank_credentials(id) 
ON DELETE SET NULL;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulations_job_id ON simulations(job_id);

-- 6. Trigger para atualizar contadores do job automaticamente
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

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS update_job_counts_trigger ON simulations;

-- Criar trigger que dispara quando status muda
CREATE TRIGGER update_job_counts_trigger 
    AFTER UPDATE ON simulations
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_job_counts();

-- 7. Criar usuário admin padrão (senha: admin123)
INSERT INTO users (email, password_hash, name) 
VALUES ('admin@sistema.com', '$2b$10$8K1p/a0dL3AMPyH/Rg4W4.bF5qGqE4hQnCqOQYIYT5Qn4Gx4k4wVK', 'Administrador')
ON CONFLICT (email) DO NOTHING;

-- 8. Atualizar trigger de updated_at para jobs
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar se tudo foi criado
SELECT 'Jobs table created' as status WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'jobs');
SELECT 'Triggers created' as status WHERE EXISTS (SELECT FROM pg_trigger WHERE tgname = 'update_job_counts_trigger');
