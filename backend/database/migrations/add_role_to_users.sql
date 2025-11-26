-- Adicionar coluna role na tabela users
-- Role pode ser 'admin' ou 'regular'

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'regular' CHECK (role IN ('admin', 'regular'));

-- Criar índice para melhorar performance das queries de role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Comentário na coluna
COMMENT ON COLUMN users.role IS 'Tipo de usuário: admin (60 workers) ou regular (20 workers)';
