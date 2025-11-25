# 🔄 Guia Completo de Mudanças - Sistema V2

## 📋 Resumo Executivo

Este documento contém TODAS as mudanças necessárias para transformar o sistema atual no sistema V2 com Jobs, sem registro, e com exportação CSV.

---

## 🗄️ PARTE 1: BANCO DE DADOS

### 1.1 Aplicar Novo Schema

Execute este SQL no PostgreSQL:

```sql
-- Adicionar tabela de JOBS
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

-- Remover partner_id
ALTER TABLE bank_credentials DROP COLUMN IF EXISTS partner_id;

-- Criar índices
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_simulations_job_id ON simulations(job_id);

-- Trigger para atualizar contadores do job
CREATE OR REPLACE FUNCTION update_job_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE jobs SET
        completed_count = (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status IN ('COMPLETED', 'FAILED', 'REJECTED')),
        success_count = (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status = 'COMPLETED'),
        failed_count = (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status IN ('FAILED', 'REJECTED')),
        processing_count = (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status IN ('PENDING', 'PROCESSING')),
        status = CASE WHEN (SELECT COUNT(*) FROM simulations WHERE job_id = NEW.job_id AND status IN ('PENDING', 'PROCESSING')) = 0 THEN 'COMPLETED' ELSE 'PROCESSING' END
    WHERE id = NEW.job_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_counts_trigger AFTER UPDATE ON simulations
    FOR EACH ROW EXECUTE FUNCTION update_job_counts();

-- Criar usuário admin padrão
INSERT INTO users (email, password_hash, name) 
VALUES ('admin@sistema.com', '$2b$10$rH3tY5F.qJx9K3VqP8Zn0.5HkVQx5i7XNqZ3Lm8wK4LxHj9sP1Y2W', 'Administrador')
ON CONFLICT (email) DO NOTHING;
```

---

## 🔧 PARTE 2: BACKEND - Mudanças nos Arquivos

### 2.1 Criar `jobController.js`

Arquivo: `src/controllers/jobController.js`

```javascript
const db = require('../config/database');
const simulationQueue = require('../services/simulationWorker');
const bankCredentialController = require('./bankCredentialController');

class JobController {
  async create(req, res) {
    try {
      const { name, cpfs, bank_credential_id } = req.body;
      const userId = req.user.id;

      if (!name || !cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
        return res.status(400).json({ error: 'Nome e CPFs são obrigatórios' });
      }

      // Criar job
      const jobResult = await db.query(
        `INSERT INTO jobs (user_id, bank_credential_id, name, total_cpfs, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING id, name, total_cpfs, status, created_at`,
        [userId, bank_credential_id, name, cpfs.length]
      );

      const job = jobResult.rows[0];

      // Criar simulações
      for (const cpf of cpfs) {
        const simResult = await db.query(
          `INSERT INTO simulations (job_id, user_id, bank_credential_id, cpf, status)
           VALUES ($1, $2, $3, $4, 'PENDING')
           RETURNING id`,
          [job.id, userId, bank_credential_id, cpf]
        );

        // Adicionar na fila
        await simulationQueue.add({
          simulationId: simResult.rows[0].id,
          cpf,
          bankCredentialId: bank_credential_id,
          userId,
        });
      }

      res.status(201).json(job);
    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ error: 'Erro ao criar job' });
    }
  }

  async list(req, res) {
    try {
      const userId = req.user.id;
      const result = await db.query(
        `SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('List jobs error:', error);
      res.status(500).json({ error: 'Erro ao listar jobs' });
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const jobResult = await db.query(
        'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job não encontrado' });
      }

      const simulationsResult = await db.query(
        'SELECT * FROM simulations WHERE job_id = $1 ORDER BY created_at',
        [id]
      );

      res.json({
        job: jobResult.rows[0],
        simulations: simulationsResult.rows,
      });
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ error: 'Erro ao buscar job' });
    }
  }

  async exportCSV(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const simulations = await db.query(
        `SELECT s.cpf, s.name, s.status, s.best_disbursement_value, 
                s.best_installment_numbers, s.best_installment_value, s.description
         FROM simulations s
         JOIN jobs j ON s.job_id = j.id
         WHERE j.id = $1 AND j.user_id = $2
         ORDER BY s.created_at`,
        [id, userId]
      );

      // Gerar CSV
      let csv = 'CPF,Nome,Status,Valor Desembolso,Num Parcelas,Valor Parcela,Descrição\n';
      simulations.rows.forEach(row => {
        csv += `"${row.cpf}","${row.name || ''}","${row.status}","${row.best_disbursement_value || ''}","${row.best_installment_numbers || ''}","${row.best_installment_value || ''}","${row.description || ''}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="job-${id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Export CSV error:', error);
      res.status(500).json({ error: 'Erro ao exportar CSV' });
    }
  }
}

module.exports = new JobController();
```

### 2.2 Atualizar `routes/index.js`

```javascript
const jobController = require('../controllers/jobController');

// Remover rota de registro
// router.post('/auth/register', authController.register);

// Adicionar rotas de jobs
router.post('/jobs', jobController.create);
router.get('/jobs', jobController.list);
router.get('/jobs/:id', jobController.get);
router.get('/jobs/:id/export', jobController.exportCSV);
```

### 2.3 Corrigir `bankCredentialController.js` - testLogin

Na linha 192, mudar de:
```javascript
const token = await this.getValidToken(id, userId);
```

Para:
```javascript
const token = await bankCredentialController.getValidToken(id, userId);
```

Ou melhor, adicionar bind no export:
```javascript
// No final do arquivo
const controller = new BankCredentialController();
module.exports = controller;
```

E no método testLogin:
```javascript
async testLogin(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const token = await bankCredentialController.getValidToken(id, userId);
    // resto do código...
  }
}
```

### 2.4 Remover partner_id

Em TODOS os arquivos, remover referências a `partner_id`:
- `bankCredentialController.js`: remover do create, update, list
- `routes/index.js`: já atualizado
- Frontend: remover campos do formulário

---

## 🎨 PARTE 3: FRONTEND - Mudanças

### 3.1 Remover Registro

Arquivo: `src/App.js`

```javascript
// Remover rota de register
// <Route path="/register" element={<Register />} />

// Remover link de registro em Login.js
// <Link to="/register">Cadastre-se</Link>
```

### 3.2 Criar `Jobs.js` - Página Principal

Arquivo: `src/pages/Jobs.js`

```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function Jobs() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Auto-refresh
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(response.data);
    } catch (error) {
      console.error('Erro ao carregar jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async (jobId) => {
    const token = localStorage.getItem('token');
    window.open(`http://localhost:3000/api/jobs/${jobId}/export?token=${token}`, '_blank');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🏦 Simulação Bancária</h1>
        <button onClick={() => { logout(); navigate('/login'); }} className="btn-logout">
          Sair
        </button>
      </header>

      <div className="jobs-container">
        <div className="page-header">
          <h2>Meus Jobs</h2>
          <button onClick={() => navigate('/new-job')} className="btn-primary">
            ➕ Novo Job
          </button>
        </div>

        {loading ? (
          <div className="loading">Carregando...</div>
        ) : (
          <div className="jobs-grid">
            {jobs.map(job => (
              <div key={job.id} className={`job-card ${job.status.toLowerCase()}`}>
                <h3>{job.name}</h3>
                <div className="job-stats">
                  <div className="stat">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">{job.total_cpfs}</span>
                  </div>
                  <div className="stat success">
                    <span className="stat-label">✅ Sucesso:</span>
                    <span className="stat-value">{job.success_count}</span>
                  </div>
                  <div className="stat error">
                    <span className="stat-label">❌ Falha:</span>
                    <span className="stat-value">{job.failed_count}</span>
                  </div>
                  <div className="stat processing">
                    <span className="stat-label">⏳ Processando:</span>
                    <span className="stat-value">{job.processing_count}</span>
                  </div>
                </div>
                <div className="job-actions">
                  <button onClick={() => navigate(`/jobs/${job.id}`)} className="btn-secondary">
                    Ver Detalhes
                  </button>
                  <button onClick={() => exportCSV(job.id)} className="btn-export">
                    📥 Exportar CSV
                  </button>
                </div>
                <div className="job-date">
                  Criado em: {new Date(job.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Jobs;
```

### 3.3 Criar NewJob.js

```javascript
// Similar ao NewSimulation.js mas cria Jobs
// Adicionar campo "Nome do Job"
// Chamar POST /api/jobs ao invés de /api/simulations/batch
```

### 3.4 Remover partner_id do frontend

- Remover campo `partner_id` de `Credentials.js`
- Atualizar formulários

---

## 🚀 PARTE 4: DEPLOY PÚBLICO

### 4.1 Preparar Backend para Produção

Arquivo: `.env.production`

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=sua_chave_super_secreta_production
# resto das configs...
```

### 4.2 Preparar Frontend para Produção

```bash
# Build
npm run build

# Configurar nginx
server {
    listen 80;
    server_name seu-dominio.com;
    
    location / {
        root /var/www/frontend/build;
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
    }
}
```

### 4.3 PM2 para Backend

```bash
npm install -g pm2
pm2 start src/server.js --name api-simulacao
pm2 startup
pm2 save
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] 1. Aplicar schema SQL novo
- [ ] 2. Criar jobController.js
- [ ] 3. Atualizar routes/index.js
- [ ] 4. Corrigir getValidToken
- [ ] 5. Remover partner_id backend
- [ ] 6. Criar Jobs.js frontend
- [ ] 7. Criar NewJob.js frontend
- [ ] 8. Remover registro frontend
- [ ] 9. Remover partner_id frontend
- [ ] 10. Testar fluxo completo
- [ ] 11. Testar exportação CSV
- [ ] 12. Preparar para deploy

---

## 📝 CREDENCIAIS

**Login Único:**
- Email: `admin@sistema.com`
- Senha: `admin123`

---

## 🎯 RESULTADO FINAL

- ✅ Sistema com Jobs (lotes de CPFs)
- ✅ Cards mostrando estatísticas
- ✅ Processamento em background
- ✅ Exportação CSV
- ✅ Sem registro (login único)
- ✅ Sem partner_id
- ✅ Pronto para deploy público

