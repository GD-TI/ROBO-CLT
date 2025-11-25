const db = require('../config/database');
const { simulationQueue } = require('../services/simulationWorker');

class JobController {
  // Criar novo job com round-robin de credenciais (ASSÍNCRONO)
  async create(req, res) {
    try {
      const { name, cpfs } = req.body;
      const userId = req.user.id;

      if (!name || !cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
        return res.status(400).json({ error: 'Nome e lista de CPFs são obrigatórios' });
      }

      // Buscar TODAS as credenciais ativas do usuário
      const credentialsResult = await db.query(
        'SELECT id FROM bank_credentials WHERE user_id = $1 AND active = true ORDER BY id',
        [userId]
      );

      if (credentialsResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Você precisa ter pelo menos uma credencial bancária ativa' 
        });
      }

      const credentials = credentialsResult.rows.map(r => r.id);

      // Criar job
      const jobResult = await db.query(
        `INSERT INTO jobs (user_id, name, total_cpfs, status)
         VALUES ($1, $2, $3, 'PROCESSING')
         RETURNING id, name, total_cpfs, status, created_at`,
        [userId, name, cpfs.length]
      );

      const job = jobResult.rows[0];

      // IMPORTANTE: Responder IMEDIATAMENTE ao usuário
      res.status(201).json({
        ...job,
        credentials_used: credentials.length,
        message: `Job criado! Processamento iniciado em background com ${cpfs.length} CPFs distribuídos entre ${credentials.length} credencial(is).`
      });

      // PROCESSAR EM BACKGROUND (depois de responder)
      // Usar setImmediate para liberar a requisição
      setImmediate(async () => {
        try {
          for (let i = 0; i < cpfs.length; i++) {
            const cpf = cpfs[i].replace(/\D/g, '');
            
            // Round-robin: usar credencial baseada no índice
            const credentialId = credentials[i % credentials.length];

            const simResult = await db.query(
              `INSERT INTO simulations (job_id, user_id, bank_credential_id, cpf, status)
               VALUES ($1, $2, $3, $4, 'PENDING')
               RETURNING id`,
              [job.id, userId, credentialId, cpf]
            );

            // Adicionar na fila para processamento
            await simulationQueue.add({
              simulationId: simResult.rows[0].id,
              cpf,
              bankCredentialId: credentialId,
              userId,
              jobId: job.id,
            }, {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            });
          }
          
          console.log(`✅ Job #${job.id} - Todos os ${cpfs.length} CPFs adicionados à fila`);
        } catch (error) {
          console.error(`❌ Erro ao processar job #${job.id}:`, error);
          
          // Atualizar status do job para FAILED
          await db.query(
            'UPDATE jobs SET status = $1 WHERE id = $2',
            ['FAILED', job.id]
          );
        }
      });

    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ error: 'Erro ao criar job' });
    }
  }

  // Listar todos os jobs do usuário
  async list(req, res) {
    try {
      const userId = req.user.id;
      const result = await db.query(
        `SELECT j.*, 
                (SELECT COUNT(*) FROM bank_credentials WHERE user_id = $1 AND active = true) as credentials_count
         FROM jobs j
         WHERE j.user_id = $1 
         ORDER BY j.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('List jobs error:', error);
      res.status(500).json({ error: 'Erro ao listar jobs' });
    }
  }

  // Obter detalhes de um job específico
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
        `SELECT s.*, bc.name as credential_name
         FROM simulations s
         LEFT JOIN bank_credentials bc ON s.bank_credential_id = bc.id
         WHERE s.job_id = $1 
         ORDER BY s.created_at`,
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

  // Exportar resultados do job em CSV
  async exportCSV(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const simulations = await db.query(
        `SELECT s.cpf, s.name, s.status, s.best_disbursement_value, 
                s.best_installment_numbers, s.best_installment_value, 
                s.description, s.error_message, bc.name as credential_name
         FROM simulations s
         JOIN jobs j ON s.job_id = j.id
         LEFT JOIN bank_credentials bc ON s.bank_credential_id = bc.id
         WHERE j.id = $1 AND j.user_id = $2
         ORDER BY s.created_at`,
        [id, userId]
      );

      if (simulations.rows.length === 0) {
        return res.status(404).json({ error: 'Job não encontrado ou sem simulações' });
      }

      // Gerar CSV com BOM UTF-8
      let csv = 'CPF,Nome,Status,Valor Desembolso,Num Parcelas,Valor Parcela,Credencial Usada,Descrição,Erro\n';
      
      simulations.rows.forEach(row => {
        const cpf = row.cpf || '';
        const name = (row.name || '').replace(/"/g, '""');
        const status = row.status || '';
        const disbursement = row.best_disbursement_value || '';
        const installments = row.best_installment_numbers || '';
        const installmentValue = row.best_installment_value || '';
        const credential = (row.credential_name || '').replace(/"/g, '""');
        const description = (row.description || '').replace(/"/g, '""');
        const error = (row.error_message || '').replace(/"/g, '""');
        
        csv += `"${cpf}","${name}","${status}","${disbursement}","${installments}","${installmentValue}","${credential}","${description}","${error}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="job-${id}-${Date.now()}.csv"`);
      res.send('\uFEFF' + csv); // BOM para UTF-8
    } catch (error) {
      console.error('Export CSV error:', error);
      res.status(500).json({ error: 'Erro ao exportar CSV' });
    }
  }

  // Deletar job (e todas simulações associadas em cascata)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await db.query(
        'DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job não encontrado' });
      }

      res.json({ message: 'Job removido com sucesso' });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ error: 'Erro ao remover job' });
    }
  }

  // Estatísticas gerais de jobs
  async stats(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `SELECT 
          COUNT(*) as total_jobs,
          SUM(total_cpfs) as total_cpfs,
          SUM(success_count) as total_success,
          SUM(failed_count) as total_failed,
          COUNT(*) FILTER (WHERE status = 'PROCESSING') as jobs_processing,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as jobs_completed
         FROM jobs 
         WHERE user_id = $1`,
        [userId]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Jobs stats error:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  }

  async createBulk(req, res) {
  const { name, cpfs } = req.body;
  const BATCH_SIZE = 500; // 500 CPFs por job
  
  const batches = [];
  for (let i = 0; i < cpfs.length; i += BATCH_SIZE) {
    batches.push(cpfs.slice(i, i + BATCH_SIZE));
  }
  
  // Criar múltiplos jobs
  for (let i = 0; i < batches.length; i++) {
    await this.create({
      body: {
        name: `${name} - Lote ${i + 1}`,
        cpfs: batches[i]
      },
      user: req.user
    }, res);
  }
  
  // 50.000 CPFs = 100 jobs de 500 CPFs cada
  }
}


module.exports = new JobController();
